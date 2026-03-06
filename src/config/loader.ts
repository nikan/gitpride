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
import { validateCommandArgs, DestructiveCommandError } from './guard.js';
import { type CommandsConfig, type CommandConfig } from './types.js';

const log = new Logger('config');

/** Default config file name. */
export const DEFAULT_CONFIG_FILENAME = 'commands.config.json';

// ── Zod schemas ────────────────────────────────────────────────────

const ExtraArgsPropertySchema = z.object({
  type: z.enum(['string', 'number', 'boolean']),
  description: z.string().optional(),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  enum: z.array(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

const ExtraArgsSchemaSchema = z.object({
  type: z.literal('object'),
  properties: z.record(z.string(), ExtraArgsPropertySchema),
});

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
  });

const CommandsConfigSchema = z.object({
  $schema: z.string().optional(),
  commands: z.array(CommandConfigSchema).min(1, 'at least one command must be defined'),
});

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

/** Run the non-destructive guard on every command. */
function validateGuard(commands: CommandConfig[]): string[] {
  const errors: string[] = [];
  for (const cmd of commands) {
    try {
      validateCommandArgs(cmd);
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

// ── Public API ─────────────────────────────────────────────────────

/**
 * Parse and validate a raw JSON object as a commands config.
 * Throws ConfigValidationError on any schema or semantic issue.
 */
export function parseConfig(raw: unknown): CommandsConfig {
  const result = CommandsConfigSchema.safeParse(raw);

  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `${i.path.join('.')}: ${i.message}`,
    );
    throw new ConfigValidationError('Invalid configuration schema', issues);
  }

  const config = result.data as CommandsConfig;

  // Semantic validations
  const errors: string[] = [
    ...validateUniqueNames(config.commands),
    ...validateGuard(config.commands),
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
    throw new ConfigLoadError(
      `Failed to read config file: ${filePath}`,
      err,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new ConfigLoadError(
      `Failed to parse config file as JSON: ${filePath}`,
      err,
    );
  }

  return parseConfig(parsed);
}
