/**
 * Git tool builder — converts command config entries into MCP tool definitions.
 *
 * Each CommandConfig entry is transformed into a ToolDefinition that:
 * 1. Accepts typed input matching the extraArgsSchema (if any)
 * 2. Validates extra args through the non-destructive guard at runtime
 * 3. Builds the final argument list and runs git via the runner
 * 4. Returns stdout as the tool result (or stderr on failure)
 */

import { z } from 'zod';
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';

import { type ToolDefinition } from '../server/registry.js';
import { ToolExecutionError } from '../server/errors.js';
import { Logger } from '../server/logger.js';
import { validateExtraArgs, validateCombinedArgs } from '../config/guard.js';
import { type CommandConfig, type ExtraArgsSchema, type ExtraArgsProperty } from '../config/types.js';
import { runGit, type RunGitOptions } from './runner.js';

const log = new Logger('git-tools');

function literalSchemaFromValues<T extends string | number | boolean>(
  values: readonly T[],
): z.ZodTypeAny {
  const literals = values.map((value) => z.literal(value));
  const [first, second, ...rest] = literals;
  if (!first) {
    throw new Error('Expected at least one literal value');
  }
  if (!second) {
    return first;
  }
  return z.union([first, second, ...rest]);
}

/**
 * Convert an ExtraArgsProperty from config into a Zod schema.
 */
function propertyToZod(prop: ExtraArgsProperty): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (prop.type) {
    case 'string':
      if (prop.enum && prop.enum.length > 0) {
        const values = prop.enum.map(String) as [string, ...string[]];
        schema = z.enum(values).describe(prop.description ?? '');
      } else {
        schema = z.string().describe(prop.description ?? '');
      }
      break;
    case 'number':
      if (prop.enum && prop.enum.length > 0) {
        const values = prop.enum.map((v) => Number(v));
        schema = literalSchemaFromValues(values).describe(prop.description ?? '');
      } else {
        schema = z.number().describe(prop.description ?? '');
      }
      break;
    case 'boolean':
      if (prop.enum && prop.enum.length > 0) {
        const values = prop.enum.map((v) => Boolean(v));
        schema = literalSchemaFromValues(values).describe(prop.description ?? '');
      } else {
        schema = z.boolean().describe(prop.description ?? '');
      }
      break;
  }

  if (prop.default !== undefined) {
    schema = schema.default(prop.default);
  }

  // Make properties without defaults optional
  if (prop.default === undefined) {
    schema = schema.optional();
  }

  return schema;
}

/**
 * Convert an ExtraArgsSchema from config into a Zod object shape
 * suitable for ToolDefinition.inputSchema.
 */
function buildInputSchema(extraArgsSchema?: ExtraArgsSchema): Record<string, z.ZodTypeAny> {
  if (!extraArgsSchema) return {};

  const shape: Record<string, z.ZodTypeAny> = {};
  for (const [key, prop] of Object.entries(extraArgsSchema.properties)) {
    shape[key] = propertyToZod(prop);
  }
  return shape;
}

/**
 * Convert validated tool input args into CLI arguments for git.
 *
 * Maps schema properties to their corresponding git flags:
 * - boolean true → adds the flag name as --key (or specific mapped flag)
 * - string/number → adds as positional or --key value
 */
function buildExtraCliArgs(
  config: CommandConfig,
  inputArgs: Record<string, unknown>,
): string[] {
  const extra: string[] = [];

  if (!config.extraArgsSchema) return extra;

  for (const [key, value] of Object.entries(inputArgs)) {
    if (value === undefined || value === null) continue;

    const prop = config.extraArgsSchema.properties[key];
    if (!prop) continue;

    switch (prop.type) {
      case 'boolean':
        if (value === true) {
          // Map known boolean flags to their git equivalents
          if (key === 'staged') {
            extra.push('--cached');
          } else if (key === 'all') {
            extra.push('--all');
          } else {
            extra.push(`--${key}`);
          }
        }
        break;
      case 'number':
        // Map known number properties to their git equivalents
        if (key === 'limit') {
          extra.push(`-n`, String(value));
        } else {
          extra.push(`--${key}`, String(value));
        }
        break;
      case 'string':
        // String values are typically positional (e.g., ref, file)
        if (value) {
          extra.push(String(value));
        }
        break;
    }
  }

  return extra;
}

/**
 * Build a single ToolDefinition from a CommandConfig entry.
 */
export function buildToolDefinition(
  config: CommandConfig,
  gitOptions?: RunGitOptions,
): ToolDefinition {
  const inputSchema = buildInputSchema(
    config.allowExtraArgs ? config.extraArgsSchema : undefined,
  );

  return {
    name: config.name,
    description: config.description,
    inputSchema,
    handler: async (args: Record<string, unknown>): Promise<CallToolResult> => {
      log.debug(`Handling tool: ${config.name}`, { args });

      // Build the final argument list
      const cliArgs = [...config.args];

      if (config.allowExtraArgs && args && Object.keys(args).length > 0) {
        const extraArgs = buildExtraCliArgs(config, args);

        // Validate extra args individually and combined with base args
        if (extraArgs.length > 0) {
          try {
            validateExtraArgs(config.name, extraArgs);
            validateCombinedArgs(config.name, config.args, extraArgs);
          } catch (err) {
            throw new ToolExecutionError(
              config.name,
              err instanceof Error ? err.message : String(err),
              err,
            );
          }
        }

        cliArgs.push(...extraArgs);
      }

      // Execute the git command
      const result = await runGit(cliArgs, gitOptions);

      if (result.exitCode !== 0) {
        const errorOutput = result.stderr.trim() || result.stdout.trim() || 'Command failed';
        return {
          content: [{ type: 'text', text: errorOutput }],
          isError: true,
        };
      }

      const output = result.stdout.trim() || result.stderr.trim() || '(no output)';
      return {
        content: [{ type: 'text', text: output }],
      };
    },
  };
}

/**
 * Build ToolDefinitions for all commands in a config.
 */
export function buildTools(
  commands: readonly CommandConfig[],
  gitOptions?: RunGitOptions,
): ToolDefinition[] {
  log.info(`Building ${commands.length} tool(s) from config`);
  return commands.map((cmd) => buildToolDefinition(cmd, gitOptions));
}
