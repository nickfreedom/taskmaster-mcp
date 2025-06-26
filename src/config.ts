import { config as loadEnv } from "dotenv";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { resolve } from "path";

interface ServerConfig {
  port: number;
  outputFormat: "yaml" | "json";
  configSources: {
    port: "cli" | "env" | "default";
    outputFormat: "cli" | "env" | "default";
    envFile: "cli" | "default";
  };
}

interface CliArgs {
  env?: string;
  port?: number;
  json?: boolean;
}

export function getServerConfig(): ServerConfig {
  // Parse command line arguments
  const argv = yargs(hideBin(process.argv))
    .options({
      env: {
        type: "string",
        description: "Path to custom .env file to load environment variables from",
      },
      port: {
        type: "number",
        description: "Port to run the server on",
      },
      json: {
        type: "boolean",
        description: "Output data from tools in JSON format instead of YAML",
        default: false,
      },
    })
    .help()
    .version(process.env.NPM_PACKAGE_VERSION ?? "unknown")
    .parseSync() as CliArgs;

  // Load environment variables ASAP from custom path or default
  let envFilePath: string;
  let envFileSource: "cli" | "default";

  if (argv["env"]) {
    envFilePath = resolve(argv["env"]);
    envFileSource = "cli";
  } else {
    envFilePath = resolve(process.cwd(), ".env");
    envFileSource = "default";
  }

  // Override anything auto-loaded from .env if a custom file is provided.
  loadEnv({ path: envFilePath, override: true });

  const config: Omit<ServerConfig, "auth"> = {
    port: 3333,
    outputFormat: "yaml",
    configSources: {
      port: "default",
      outputFormat: "default",
      envFile: envFileSource,
    },
  };

  // Handle PORT
  if (argv.port) {
    config.port = argv.port;
    config.configSources.port = "cli";
  } else if (process.env.PORT) {
    config.port = parseInt(process.env.PORT, 10);
    config.configSources.port = "env";
  }

  // Handle JSON output format
  if (argv.json) {
    config.outputFormat = "json";
    config.configSources.outputFormat = "cli";
  } else if (process.env.OUTPUT_FORMAT) {
    config.outputFormat = process.env.OUTPUT_FORMAT as "yaml" | "json";
    config.configSources.outputFormat = "env";
  }

  return {
    ...config,
  };
}
