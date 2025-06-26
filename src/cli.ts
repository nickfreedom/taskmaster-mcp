#!/usr/bin/env node

import { config } from "dotenv";
import { resolve } from "path";
import { getServerConfig } from "./config.js";
import { startHttpServer } from "./server.js";
import { createServer } from "./mcp.js";
import { Logger } from "./utils/logger.js";

// Load .env from the current working directory
config({ path: resolve(process.cwd(), ".env") });

export async function startServer(): Promise<void> {
  const config = getServerConfig();

  const server = createServer();

  Logger.log(`Initializing Taskmaster MCP Server in HTTP mode on port ${config.port}...`);
  await startHttpServer(config.port, server);
}

// If we're being executed directly (not imported), start the server
if (process.argv[1]) {
  startServer().catch((error) => {
    Logger.error("Failed to start server:", error);
    process.exit(1);
  });
}
