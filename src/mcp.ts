import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Logger } from "./utils/logger.js";

const serverInfo = {
  name: "Taskmaster MCP Server",
  version: process.env.NPM_PACKAGE_VERSION ?? "unknown",
};

function createServer(): McpServer {
  const server = new McpServer(serverInfo);
  registerTools(server);

  return server;
}

function registerTools(server: McpServer): void {
  server.tool(
    "start_next_task",
    "Safely find the first [New] task in tasks.md, mark it [In Progress], and begin work",
    {},
    async (params: Record<string, unknown>, context: { sessionId?: string }) => {
      // Try to get the session ID from the context, fallback to undefined
      const sessionId: string | undefined = context?.sessionId || undefined;
      Logger.log("Sending result to client");

      return {
        content: [
          {
            type: "text",
            text: `In the project's root directory, open the file \`tasks.md\`, read the most recent version from disk. Immediately and atomically find the first line starting with \`[New]\` and update it to \`[In Progress - ${sessionId}]\` (where ${sessionId} is the unique session ID for this request). Then, begin working on the task as described in that line.\n\nIf no \`[New]\` tasks are found, inform the user and stop.\n\nImportant:\n- Only modify the first \`[New]\` task.\n- Do not change \`[In Progress]\` or \`[Complete]\` tasks.\n\nRemember this session ID: \`${sessionId}\` for use in any future requests related to this task. Stop and ask before taking on any new tasks.`,
          },
        ],
      };
    },
  );
}

export { createServer };
