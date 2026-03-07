#!/usr/bin/env node

/**
 * GitPride — MCP server entry point.
 * Exposes non-destructive git commands to AI assistants via the Model Context Protocol.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import {
  loadConfig,
  buildGuardOptions,
  ConfigLoadError,
  ConfigValidationError,
} from './config/index.js';
import { type CommandConfig, type GuardOptions } from './config/types.js';
import { buildTools } from './git/index.js';
import { Logger } from './server/logger.js';
import { ToolRegistry } from './server/registry.js';

export const SERVER_NAME = 'gitpride';
export const SERVER_VERSION = '0.2.0';

const log = new Logger('main');

/** Create a configured McpServer instance and its tool registry. */
export function createServer(): { server: McpServer; registry: ToolRegistry } {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { capabilities: { tools: {} } },
  );
  const registry = new ToolRegistry(server);
  return { server, registry };
}

/**
 * Install signal handlers for SIGINT and SIGTERM that close the server
 * and exit cleanly. Returns a cleanup function that removes the handlers.
 */
export function installShutdownHandlers(
  server: McpServer,
  exitFn: (code: number) => void = (code) => process.exit(code),
): () => void {
  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    log.info(`Received ${signal}, shutting down…`);
    try {
      await server.close();
      log.info('Server closed');
    } catch (err) {
      log.error('Error during shutdown', {
        error: err instanceof Error ? err.message : String(err),
      });
    }
    exitFn(0);
  };

  const onSigint = () => void shutdown('SIGINT');
  const onSigterm = () => void shutdown('SIGTERM');

  process.on('SIGINT', onSigint);
  process.on('SIGTERM', onSigterm);

  return () => {
    process.removeListener('SIGINT', onSigint);
    process.removeListener('SIGTERM', onSigterm);
  };
}

export async function main(): Promise<void> {
  log.info(`Starting ${SERVER_NAME} v${SERVER_VERSION}`);

  // Load command configuration (optional — server starts without config)
  const configPath = process.env.GITPRIDE_CONFIG;
  let commands: CommandConfig[] = [];
  let guardOptions: GuardOptions = {};
  try {
    const config = await loadConfig(configPath);
    commands = config.commands;
    guardOptions = buildGuardOptions(config.allowedOperations, config.protectedBranches);
    log.info(`Loaded ${config.commands.length} command(s) from config`);
  } catch (err) {
    if (err instanceof ConfigLoadError && !configPath) {
      log.info('No config file found, starting with no commands');
    } else if (err instanceof ConfigValidationError) {
      log.error('Config validation failed', { issues: (err as ConfigValidationError).issues });
      process.exit(1);
    } else {
      log.error('Failed to load config', {
        error: err instanceof Error ? err.message : String(err),
      });
      process.exit(1);
    }
  }

  const { server, registry } = createServer();

  // Build and register git command tools from config
  if (commands.length > 0) {
    const tools = buildTools(commands, undefined, guardOptions);
    registry.registerAll(tools);
    log.info(`Registered ${tools.length} git tool(s)`);
  }

  installShutdownHandlers(server);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log.info('MCP server connected via stdio');
}

// Run only when executed directly (not imported)
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('index.js');

if (isDirectRun) {
  main().catch((err) => {
    log.error('Fatal error', { error: err instanceof Error ? err.message : String(err) });
    process.exit(1);
  });
}
