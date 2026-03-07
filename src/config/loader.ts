/**
 * Config file loader — reads, parses, and validates commands.config.json.
 *
 * Uses Zod for runtime schema validation and the non-destructive guard
 * to reject any configuration that would allow write operations.
 */

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';

import { Logger } from '../server/logger.js';
import { validateCommandArgs, buildGuardOptions, DestructiveCommandError } from './guard.js';
import { type CommandsConfig, type CommandConfig } from './types.js';

const log = new Logger('config');

/** Default config file name. */
export const DEFAULT_CONFIG_FILENAME = 'commands.config.json';

// ── Zod schemas ────────────────────────────────────────────────────

const ExtraArgsPropertySchema = z
  .object({
    type: z.enum(['string', 'number', 'boolean']),
    description: z.string().optional(),
    default: z.union([z.string(), z.number(), z.boolean()]).optional(),
    enum: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .strict();

const ExtraArgsSchemaSchema = z
  .object({
    type: z.literal('object'),
    properties: z.record(z.string(), ExtraArgsPropertySchema),
  })
  .strict();

const CommandConfigSchema = z
  .object({
    name: z
      .string()
      .regex(/^[a-z][a-z0-9_]*$/, 'name must be lowercase alphanumeric with underscores'),
    description: z.string().min(1, 'description must not be empty'),
    command: z.literal('git'),
    args: z.array(z.string()),
    allowExtraArgs: z.boolean(),
    extraArgsSchema: ExtraArgsSchemaSchema.optional(),
  })
  .strict()
  .refine(
    (cmd) => {
      if (cmd.allowExtraArgs && !cmd.extraArgsSchema) return false;
      if (!cmd.allowExtraArgs && cmd.extraArgsSchema) return false;
      return true;
    },
    {
      message:
        'allowExtraArgs and extraArgsSchema must be consistent: ' +
        'allowExtraArgs=true requires extraArgsSchema, ' +
        'allowExtraArgs=false forbids extraArgsSchema',
    },
  );

const AllowedOperationSchema = z.enum(['merge', 'rebase', 'checkout', 'switch', 'branch:delete']);

const CommandsConfigSchema = z
  .object({
    $schema: z.string().optional(),
    commands: z.array(CommandConfigSchema).min(1, 'at least one command must be defined'),
    allowedOperations: z.array(AllowedOperationSchema).optional(),
    protectedBranches: z.array(z.string().min(1)).optional(),
  })
  .strict();

// ── Error types ────────────────────────────────────────────────────

/** Error thrown when the configuration file cannot be loaded or is invalid. */
export class ConfigLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'ConfigLoadError';
  }
}

/** Error thrown when the configuration is structurally valid but semantically wrong. */
export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly issues: string[],
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

// ── Validation helpers ─────────────────────────────────────────────

/** Ensure no two commands share the same name. */
function validateUniqueNames(commands: CommandConfig[]): string[] {
  const seen = new Set<string>();
  const errors: string[] = [];
  for (const cmd of commands) {
    if (seen.has(cmd.name)) {
      errors.push(`Duplicate command name: "${cmd.name}"`);
    }
    seen.add(cmd.name);
  }
  return errors;
}

/** Run the non-destructive guard on every command, respecting allowlists. */
function validateGuard(commands: CommandConfig[], config: CommandsConfig): string[] {
  const guardOpts = buildGuardOptions(config.allowedOperations, config.protectedBranches);
  const errors: string[] = [];
  for (const cmd of commands) {
    try {
      validateCommandArgs(cmd, guardOpts);
    } catch (err) {
      if (err instanceof DestructiveCommandError) {
        errors.push(err.message);
      } else {
        throw err;
      }
    }
  }
  return errors;
}

/** Validate that default values are compatible with enum constraints. */
function validateDefaultInEnum(commands: CommandConfig[]): string[] {
  const errors: string[] = [];
  for (const cmd of commands) {
    if (!cmd.extraArgsSchema) continue;
    for (const [key, prop] of Object.entries(cmd.extraArgsSchema.properties)) {
      if (prop.default !== undefined && prop.enum && prop.enum.length > 0) {
        if (!prop.enum.includes(prop.default)) {
          errors.push(
            `Command "${cmd.name}": property "${key}" has default ` +
              `value ${JSON.stringify(prop.default)} which is not in enum ` +
              `[${prop.enum.map((v) => JSON.stringify(v)).join(', ')}]`,
          );
        }
      }
    }
  }
  return errors;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Parse and validate a raw JSON object as a commands config.
 * Throws ConfigValidationError on any schema or semantic issue.
 */
export function parseConfig(raw: unknown): CommandsConfig {
  const result = CommandsConfigSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new ConfigValidationError('Invalid configuration schema', issues);
  }

  const config = result.data as CommandsConfig;

  // Semantic validations
  const errors: string[] = [
    ...validateUniqueNames(config.commands),
    ...validateGuard(config.commands, config),
    ...validateDefaultInEnum(config.commands),
  ];

  if (errors.length > 0) {
    throw new ConfigValidationError('Configuration validation failed', errors);
  }

  log.info(`Validated ${config.commands.length} command(s)`);
  return config;
}

/**
 * Load and validate a commands config from a JSON file.
 *
 * @param configPath — Absolute or relative path to the JSON config file.
 *                     Defaults to `commands.config.json` in the cwd.
 */
export async function loadConfig(configPath?: string): Promise<CommandsConfig> {
  const filePath = resolve(configPath ?? DEFAULT_CONFIG_FILENAME);
  log.info(`Loading config from ${filePath}`);

  let raw: string;
  try {
    raw = await readFile(filePath, 'utf-8');
  } catch (err) {
    throw new ConfigLoadError(`Failed to read config file: ${filePath}`, err);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigLoadError(`Failed to parse config file as JSON: ${filePath}`, err);
  }

  return parseConfig(parsed);
}
