/**
 * Non-destructive command guard — blocks write-commands and shell operators.
 *
 * The guard validates both static configuration (at load time) and
 * dynamic extra arguments (at runtime) to ensure only read-only git
 * operations are ever executed.
 */

import { type CommandConfig } from './types.js';

/** Git subcommands considered destructive / write operations. */
export const BLOCKED_SUBCOMMANDS: ReadonlySet<string> = new Set([
  'push',
  'reset',
  'clean',
  'rebase',
  'merge',
  'checkout',
  'commit',
  'add',
  'rm',
  'mv',
  'stash',
]);

/**
 * Multi-token destructive sequences that are only dangerous when their
 * tokens appear together in the args array (in order).
 */
export const BLOCKED_ARG_SEQUENCES: readonly [string, string][] = [
  ['tag', '--delete'],
  ['tag', '-d'],
  ['branch', '-D'],
  ['branch', '--delete'],
];

/** Shell operators that must never appear in arguments. */
export const BLOCKED_SHELL_OPERATORS: ReadonlySet<string> = new Set([
  '&&',
  '||',
  ';',
  '|',
  '>',
  '>>',
]);

/** Error thrown when the guard detects a destructive command. */
export class DestructiveCommandError extends Error {
  constructor(
    public readonly commandName: string,
    public readonly reason: string,
  ) {
    super(`Command "${commandName}" blocked: ${reason}`);
    this.name = 'DestructiveCommandError';
  }
}

/**
 * Validate that an argument list contains no shell operators.
 * Checks both exact tokens and tokens embedded inside other args.
 */
function checkShellOperators(commandName: string, args: readonly string[]): void {
  for (const arg of args) {
    if (BLOCKED_SHELL_OPERATORS.has(arg)) {
      throw new DestructiveCommandError(commandName, `shell operator "${arg}" is not allowed`);
    }
    // Also check if a shell operator is embedded (e.g. "foo;bar")
    for (const op of BLOCKED_SHELL_OPERATORS) {
      if (arg.includes(op) && arg !== op) {
        throw new DestructiveCommandError(
          commandName,
          `argument "${arg}" contains shell operator "${op}"`,
        );
      }
    }
  }
}

/**
 * Validate that an argument list does not invoke a destructive git subcommand.
 * The first non-flag argument after "git" is the subcommand.
 */
function checkDestructiveSubcommand(commandName: string, args: readonly string[]): void {
  // The first arg that doesn't start with '-' is the subcommand
  const subcommand = args.find((a) => !a.startsWith('-'));
  if (subcommand && BLOCKED_SUBCOMMANDS.has(subcommand)) {
    throw new DestructiveCommandError(
      commandName,
      `destructive subcommand "${subcommand}" is not allowed`,
    );
  }
}

/**
 * Check for multi-token destructive sequences like "tag --delete".
 */
function checkBlockedSequences(commandName: string, args: readonly string[]): void {
  for (const [first, second] of BLOCKED_ARG_SEQUENCES) {
    const firstIdx = args.indexOf(first);
    if (firstIdx !== -1 && args.indexOf(second, firstIdx + 1) !== -1) {
      throw new DestructiveCommandError(
        commandName,
        `destructive sequence "${first} ${second}" is not allowed`,
      );
    }
  }
}

/**
 * Validate a command's base args at config load time.
 * Throws DestructiveCommandError if the command is destructive.
 */
export function validateCommandArgs(command: CommandConfig): void {
  checkShellOperators(command.name, command.args);
  checkDestructiveSubcommand(command.name, command.args);
  checkBlockedSequences(command.name, command.args);
}

/**
 * Validate extra arguments provided at runtime.
 * Called before executing a command that has allowExtraArgs: true.
 */
export function validateExtraArgs(commandName: string, extraArgs: readonly string[]): void {
  checkShellOperators(commandName, extraArgs);
  checkDestructiveSubcommand(commandName, extraArgs);
  checkBlockedSequences(commandName, extraArgs);
}

/**
 * Validate the combined base args + extra args together.
 *
 * This catches destructive sequences that span the boundary between
 * configured base args and user-supplied extra args (e.g. base=['tag']
 * combined with extra=['--delete', 'v1'] forms the blocked sequence
 * "tag --delete").
 */
export function validateCombinedArgs(
  commandName: string,
  baseArgs: readonly string[],
  extraArgs: readonly string[],
): void {
  // Extra args are already validated individually by validateExtraArgs;
  // here we only need to check blocked sequences across the combined list.
  const combined = [...baseArgs, ...extraArgs];
  checkBlockedSequences(commandName, combined);
}
