/**
 * Tool registry — register and dispatch MCP tools.
 *
 * Wraps McpServer.tool() with a typed ToolDefinition interface so that
 * future epics can register tools declaratively (e.g. from config).
 */

import { type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  type ZodRawShapeCompat,
  type ShapeOutput,
} from '@modelcontextprotocol/sdk/server/zod-compat.js';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { errorToToolResult, ToolExecutionError } from './errors.js';
import { Logger } from './logger.js';

const log = new Logger('registry');

/**
 * Describes a tool that can be registered with the MCP server.
 * The handler receives the validated input args and returns a CallToolResult.
 */
export interface ToolDefinition<T extends ZodRawShapeCompat = ZodRawShapeCompat> {
  name: string;
  description: string;
  inputSchema: T;
  handler: (args: ShapeOutput<T>) => Promise<CallToolResult>;
}

/**
 * Manages tool registration and provides a catalog of registered tools.
 */
export class ToolRegistry {
  private readonly registered = new Map<string, ToolDefinition>();

  constructor(private readonly server: McpServer) {}

  /**
   * Register a single tool definition with the MCP server.
   * The handler is wrapped with error handling that converts thrown errors
   * into MCP error results.
   */
  register<T extends ZodRawShapeCompat>(definition: ToolDefinition<T>): void {
    const { name, description, inputSchema, handler } = definition;

    if (this.registered.has(name)) {
      throw new Error(`Tool "${name}" is already registered`);
    }

    this.registered.set(name, definition as unknown as ToolDefinition);
    log.info(`Registering tool: ${name}`);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (this.server.tool as any)(name, description, inputSchema, async (args: any, _extra: any) => {
      try {
        log.debug(`Executing tool: ${name}`, { args: args as Record<string, unknown> });
        const result = await handler(args);
        log.debug(`Tool completed: ${name}`, { isError: result.isError ?? false });
        return result;
      } catch (err) {
        log.error(`Tool failed: ${name}`, {
          error: err instanceof Error ? err.message : String(err),
        });
        if (err instanceof ToolExecutionError) {
          return errorToToolResult(err);
        }
        return errorToToolResult(new ToolExecutionError(name, 'Unexpected error', err));
      }
    });
  }

  /**
   * Register multiple tool definitions at once.
   */
  registerAll(definitions: ToolDefinition[]): void {
    for (const def of definitions) {
      this.register(def);
    }
  }

  /** Names of all currently registered tools. */
  get toolNames(): string[] {
    return Array.from(this.registered.keys());
  }

  /** Number of registered tools. */
  get size(): number {
    return this.registered.size;
  }

  /** Check whether a tool is registered. */
  has(name: string): boolean {
    return this.registered.has(name);
  }
}
