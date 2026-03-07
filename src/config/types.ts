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

/**
 * Valid values for the `allowedOperations` config field.
 *
 * Each value unblocks a specific git operation that is otherwise forbidden
 * by the non-destructive guard:
 *
 * - `"merge"`          — allows `git merge`
 * - `"rebase"`         — allows `git rebase`
 * - `"checkout"`       — allows `git checkout`
 * - `"switch"`         — allows `git switch`
 * - `"branch:delete"`  — allows `branch -d / -D / --delete`
 */
export type AllowedOperation = 'merge' | 'rebase' | 'checkout' | 'switch' | 'branch:delete';

/** Root shape of `commands.config.json`. */
export interface CommandsConfig {
  $schema?: string;
  commands: CommandConfig[];
  /**
   * Operations that are normally blocked by the non-destructive guard but
   * should be permitted in this configuration.  Each entry must be one of
   * the recognised operation identifiers (see {@link AllowedOperation}).
   */
  allowedOperations?: AllowedOperation[];
  /**
   * Branch names that must never be the target of a `branch -d / -D / --delete`
   * operation.  Requires `"branch:delete"` in `allowedOperations` to be useful.
   * Common values: `["main", "master", "develop"]`.
   */
  protectedBranches?: string[];
}

/**
 * Options forwarded to the non-destructive guard so it can respect
 * per-config allowlists and protected-branch rules.
 */
export interface GuardOptions {
  /** Subcommands that may bypass the blocked-subcommands check. */
  allowedSubcommands?: ReadonlySet<string>;
  /** Arg sequences that may bypass the blocked-sequences check. */
  allowedSequences?: readonly [string, string][];
  /** Branch names that must never be deleted. */
  protectedBranches?: readonly string[];
}
