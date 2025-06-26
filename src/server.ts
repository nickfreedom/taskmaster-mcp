import { randomUUID } from "node:crypto";
import express, { type Request, type Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Logger } from "./utils/logger.js";

const transports = {
  streamable: {} as Record<string, StreamableHTTPServerTransport>,
  sse: {} as Record<string, SSEServerTransport>,
};

export async function startHttpServer(port: number, mcpServer: McpServer): Promise<void> {
  const app = express();

  // Parse JSON requests for the Streamable HTTP endpoint only, will break SSE endpoint
  app.use("/mcp", express.json());

  // Modern Streamable HTTP endpoint
  app.post("/mcp", async (req, res): Promise<void> => {
    Logger.log("Received StreamableHTTP request");
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports.streamable[sessionId]) {
      // Reuse existing transport
      Logger.log("Reusing existing StreamableHTTP transport for sessionId", sessionId);
      transport = transports.streamable[sessionId];
    } else if (!sessionId && isInitializeRequest(req.body)) {
      Logger.log("New initialization request for StreamableHTTP sessionId", sessionId);
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: (): string => randomUUID(),
        onsessioninitialized: (sessionId: string): void => {
          // Store the transport by session ID
          transports.streamable[sessionId] = transport;
        },
      });
      transport.onclose = (): void => {
        if (transport.sessionId) {
          delete transports.streamable[transport.sessionId];
        }
      };
      // TODO? There semes to be an issue—at least in Cursor—where after a connection is made to an HTTP Streamable endpoint, SSE connections to the same Express server fail with "Received a response for an unknown message ID"
      await mcpServer.connect(transport);
    } else {
      // Invalid request
      Logger.log("Invalid request:", req.body);
      res.status(400).json({
        jsonrpc: "2.0",
        error: {
          code: -32000,
          message: "Bad Request: No valid session ID provided",
        },
        id: null,
      });
      return;
    }

    let progressInterval: NodeJS.Timeout | null = null;
    const progressToken = req.body.params?._meta?.progressToken;
    // Logger.log("Progress token:", progressToken);
    let progress = 0;
    if (progressToken) {
      Logger.log(
        `Setting up progress notifications for token ${progressToken} on session ${sessionId}`,
      );
      progressInterval = setInterval(async (): Promise<void> => {
        Logger.log("Sending progress notification", progress);
        await mcpServer.server.notification({
          method: "notifications/progress",
          params: {
            progress,
            progressToken,
          },
        });
        progress++;
      }, 1000);
    }

    Logger.log("Handling StreamableHTTP request");
    await transport.handleRequest(req, res, req.body);

    if (progressInterval) {
      clearInterval(progressInterval);
    }
    Logger.log("StreamableHTTP request handled");
  });

  // Handle GET requests for SSE streams (using built-in support from StreamableHTTP)
  const handleSessionRequest = async (req: Request, res: Response): Promise<void> => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId || !transports.streamable[sessionId]) {
      res.status(400).send("Invalid or missing session ID");
      return;
    }

    Logger.log(`Received session termination request for session ${sessionId}`);

    try {
      const transport = transports.streamable[sessionId];
      await transport.handleRequest(req, res);
    } catch (error) {
      Logger.error("Error handling session termination:", error);
      if (!res.headersSent) {
        res.status(500).send("Error processing session termination");
      }
    }
  };

  // Handle GET requests for server-to-client notifications via SSE
  app.get("/mcp", handleSessionRequest);

  // Handle DELETE requests for session termination
  app.delete("/mcp", handleSessionRequest);

  app.get("/sse", async (req, res) => {
    Logger.log("Establishing new SSE connection");
    const transport = new SSEServerTransport("/messages", res);
    Logger.log(`New SSE connection established for sessionId ${transport.sessionId}`);
    Logger.log("/sse request headers:", req.headers);
    Logger.log("/sse request body:", req.body);

    transports.sse[transport.sessionId] = transport;
    res.on("close", () => {
      delete transports.sse[transport.sessionId];
    });

    await mcpServer.connect(transport);
  });

  app.post("/messages", async (req, res) => {
    const sessionId = req.query.sessionId as string;
    const transport = transports.sse[sessionId];
    if (transport) {
      Logger.log(`Received SSE message for sessionId ${sessionId}`);
      Logger.log("/messages request headers:", req.headers);
      Logger.log("/messages request body:", req.body);
      await transport.handlePostMessage(req, res);
    } else {
      res.status(400).send(`No transport found for sessionId ${sessionId}`);
      return;
    }
  });

  app.listen(port, () => {
    Logger.log(`HTTP server listening on port ${port}`);
    Logger.log(`SSE endpoint available at http://localhost:${port}/sse`);
    Logger.log(`Message endpoint available at http://localhost:${port}/messages`);
    Logger.log(`StreamableHTTP endpoint available at http://localhost:${port}/mcp`);
  });

  process.on("SIGINT", async () => {
    Logger.log("Shutting down server...");

    // Close all active transports to properly clean up resources
    await closeTransports(transports.sse);
    await closeTransports(transports.streamable);

    Logger.log("Server shutdown complete");
    process.exit(0);
  });
}

async function closeTransports(
  transports: Record<string, SSEServerTransport | StreamableHTTPServerTransport>,
): Promise<void> {
  for (const sessionId in transports) {
    try {
      await transports[sessionId]?.close();
      delete transports[sessionId];
    } catch (error) {
      Logger.error(`Error closing transport for session ${sessionId}:`, error);
    }
  }
}
