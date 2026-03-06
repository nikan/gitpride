/**
 * TypeScript types for the command configuration system.
 *
 * These mirror the JSON Schema defined in schema.json and are used by the
 * config loader and the non-destructive command guard.
 */

/** Schema describing what extra arguments a command accepts. */
export interface ExtraArgsProperty {
  type: 'string' | 'number' | 'boolean';
  description?: string;
  default?: string | number | boolean;
  enum?: (string | number | boolean)[];
}

/** JSON-Schema-like definition for extra arguments. */
export interface ExtraArgsSchema {
  type: 'object';
  properties: Record<string, ExtraArgsProperty>;
}

/** A single command entry in the configuration file. */
export interface CommandConfig {
  /** Unique tool name exposed via MCP (e.g. "git_status"). */
  name: string;
  /** Human-readable description shown to the AI assistant. */
  description: string;
  /** The executable to run (must be "git"). */
  command: 'git';
  /** Base arguments always passed to the command. */
  args: string[];
  /** Whether the user may supply additional arguments beyond `args`. */
  allowExtraArgs: boolean;
  /** Schema for extra arguments when allowExtraArgs is true. */
  extraArgsSchema?: ExtraArgsSchema;
}

/** Root shape of `commands.config.json`. */
export interface CommandsConfig {
  $schema?: string;
  commands: CommandConfig[];
}
