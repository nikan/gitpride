/**
 * Non-destructive command guard — blocks write-commands and shell operators.
 *
 * The guard validates both static configuration (at load time) and
 * dynamic extra arguments (at runtime) to ensure only read-only git
 * operations are ever executed.
 *
 * When a config provides `allowedOperations`, the corresponding subcommands
 * or arg sequences are exempted from blocking.  Protected branches are
 * still enforced even when `branch:delete` is allowed.
 */

import { type CommandConfig, type GuardOptions } from './types.js';

/**
 * Git subcommands considered destructive / write operations.
 *
 * Each entry blocks the subcommand unconditionally because the command
 * always mutates the repository, working tree, or index.
 */
export const BLOCKED_SUBCOMMANDS: ReadonlySet<string> = new Set([
  // ── Original set ───────────────────────────────────────────────
  'push', // uploads local commits to a remote
  'reset', // moves HEAD / modifies index or working tree
  'clean', // removes untracked files
  'rebase', // rewrites commit history
  'merge', // integrates branches (mutates history)
  'checkout', // switches branches / restores files (legacy)
  'commit', // records changes to the repository
  'add', // stages files to the index
  'rm', // removes files from working tree and index
  'mv', // renames/moves files in working tree and index
  'stash', // shelves working-tree changes

  // ── Modern porcelain (git 2.23+) ──────────────────────────────
  'switch', // switches branches (modern replacement for checkout)
  'restore', // restores working-tree files (modern replacement for checkout)

  // ── History / commit mutation ──────────────────────────────────
  'cherry-pick', // applies existing commits onto the current branch
  'revert', // creates new commits that undo previous commits

  // ── Remote-mutating fetch+merge ────────────────────────────────
  'pull', // fetches and merges/rebases (modifies working tree + history)

  // ── Patch application ──────────────────────────────────────────
  'apply', // applies a patch to the working tree / index
  'am', // applies patches from mailbox messages

  // ── Repository creation ────────────────────────────────────────
  'init', // creates a new git repository
  'clone', // clones a repository into a new directory

  // ── Object / ref maintenance ───────────────────────────────────
  'gc', // runs garbage collection on the object store
  'prune', // removes unreachable objects from the object store

  // ── Dangerous plumbing / history rewriting ─────────────────────
  'bisect', // modifies HEAD while binary-searching for a bug
  'filter-branch', // rewrites branch history (deprecated but still available)
  'update-ref', // directly modifies refs (low-level plumbing)
]);

/**
 * Multi-token destructive sequences that are only dangerous when their
 * tokens appear together in the args array (in order).
 *
 * Used for commands that have both read-only and write modes
 * (e.g. `branch -a` is safe but `branch -D` is destructive).
 */
export const BLOCKED_ARG_SEQUENCES: readonly [string, string][] = [
  // ── Tag mutation ───────────────────────────────────────────────
  ['tag', '--delete'], // deletes a tag
  ['tag', '-d'], // deletes a tag (short form)

  // ── Branch deletion ────────────────────────────────────────────
  ['branch', '-D'], // force-deletes a branch
  ['branch', '--delete'], // deletes a branch
  ['branch', '-d'], // deletes a branch (safe but still mutating)

  // ── Branch rename / copy ───────────────────────────────────────
  ['branch', '-m'], // renames a branch
  ['branch', '-M'], // force-renames a branch
  ['branch', '--move'], // renames a branch (long form)
  ['branch', '-c'], // copies a branch
  ['branch', '-C'], // force-copies a branch
  ['branch', '--copy'], // copies a branch (long form)

  // ── Remote mutation (remote list / remote -v are read-only) ────
  ['remote', 'add'], // adds a new remote
  ['remote', 'remove'], // removes a remote
  ['remote', 'rename'], // renames a remote
  ['remote', 'set-url'], // changes a remote's URL

  // ── Worktree mutation (worktree list is read-only) ─────────────
  ['worktree', 'add'], // creates a new worktree
  ['worktree', 'remove'], // removes a worktree
  ['worktree', 'prune'], // prunes stale worktree info

  // ── Submodule mutation (submodule status is read-only) ─────────
  ['submodule', 'add'], // registers a new submodule
  ['submodule', 'init'], // initializes submodules
  ['submodule', 'update'], // updates submodules to recorded commits
  ['submodule', 'deinit'], // unregisters submodules

  // ── Notes mutation (notes list is read-only) ───────────────────
  ['notes', 'add'], // adds a note to an object
  ['notes', 'remove'], // removes a note from an object
  ['notes', 'edit'], // edits a note
  ['notes', 'merge'], // merges notes refs
  ['notes', 'prune'], // removes notes for unreachable objects

  // ── Reflog mutation (reflog show is read-only) ─────────────────
  ['reflog', 'delete'], // deletes reflog entries
  ['reflog', 'expire'], // expires old reflog entries
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
 *
 * When `opts.allowedSubcommands` is provided, listed subcommands are exempt.
 */
function checkDestructiveSubcommand(
  commandName: string,
  args: readonly string[],
  opts?: GuardOptions,
): void {
  // The first arg that doesn't start with '-' is the subcommand
  const subcommand = args.find((a) => !a.startsWith('-'));
  if (subcommand && BLOCKED_SUBCOMMANDS.has(subcommand)) {
    if (opts?.allowedSubcommands?.has(subcommand)) return;
    throw new DestructiveCommandError(
      commandName,
      `destructive subcommand "${subcommand}" is not allowed`,
    );
  }
}

/**
 * Check for multi-token destructive sequences like "tag --delete".
 *
 * When `opts.allowedSequences` is provided, matching sequences are exempt.
 */
function checkBlockedSequences(
  commandName: string,
  args: readonly string[],
  opts?: GuardOptions,
): void {
  for (const [first, second] of BLOCKED_ARG_SEQUENCES) {
    const firstIdx = args.indexOf(first);
    if (firstIdx !== -1 && args.indexOf(second, firstIdx + 1) !== -1) {
      // Check if this sequence is explicitly allowed
      if (opts?.allowedSequences?.some(([af, as]) => af === first && as === second)) {
        continue;
      }
      throw new DestructiveCommandError(
        commandName,
        `destructive sequence "${first} ${second}" is not allowed`,
      );
    }
  }
}

/**
 * Check that no protected branch is the target of a branch-delete operation.
 *
 * Detects args like `branch -d main` or `branch --delete main` and rejects
 * when the branch name appears in `opts.protectedBranches`.
 */
function checkProtectedBranches(
  commandName: string,
  args: readonly string[],
  opts?: GuardOptions,
): void {
  if (!opts?.protectedBranches || opts.protectedBranches.length === 0) return;

  const branchIdx = args.indexOf('branch');
  if (branchIdx === -1) return;

  const deleteFlags = new Set(['-d', '-D', '--delete']);
  const hasDelete = args.some((a, i) => i > branchIdx && deleteFlags.has(a));
  if (!hasDelete) return;

  // Every non-flag arg after 'branch' that isn't the delete flag itself
  // is a potential branch name target.
  for (let i = branchIdx + 1; i < args.length; i++) {
    const arg = args[i];
    if (deleteFlags.has(arg)) continue;
    if (arg.startsWith('-')) continue;
    if (opts.protectedBranches.includes(arg)) {
      throw new DestructiveCommandError(commandName, `cannot delete protected branch "${arg}"`);
    }
  }
}

/**
 * Validate a command's base args at config load time.
 * Throws DestructiveCommandError if the command is destructive.
 */
export function validateCommandArgs(command: CommandConfig, opts?: GuardOptions): void {
  checkShellOperators(command.name, command.args);
  checkDestructiveSubcommand(command.name, command.args, opts);
  checkBlockedSequences(command.name, command.args, opts);
  checkProtectedBranches(command.name, command.args, opts);
}

/**
 * Validate extra arguments provided at runtime.
 * Called before executing a command that has allowExtraArgs: true.
 */
export function validateExtraArgs(
  commandName: string,
  extraArgs: readonly string[],
  opts?: GuardOptions,
): void {
  checkShellOperators(commandName, extraArgs);
  checkDestructiveSubcommand(commandName, extraArgs, opts);
  checkBlockedSequences(commandName, extraArgs, opts);
  checkProtectedBranches(commandName, extraArgs, opts);
}

/**
 * Validate the combined base args + extra args together.
 *
 * This catches destructive sequences that span the boundary between
 * configured base args and user-supplied extra args (e.g. base=['tag']
 * combined with extra=['--delete', 'v1'] forms the blocked sequence
 * "tag --delete").
 *
 * Also enforces protected-branch rules on the full argument list.
 */
export function validateCombinedArgs(
  commandName: string,
  baseArgs: readonly string[],
  extraArgs: readonly string[],
  opts?: GuardOptions,
): void {
  // Extra args are already validated individually by validateExtraArgs;
  // here we only need to check blocked sequences across the combined list.
  const combined = [...baseArgs, ...extraArgs];
  checkBlockedSequences(commandName, combined, opts);
  checkProtectedBranches(commandName, combined, opts);
}

/**
 * Build a `GuardOptions` from the config-level `allowedOperations` and
 * `protectedBranches` arrays.
 */
export function buildGuardOptions(
  allowedOperations?: readonly string[],
  protectedBranches?: readonly string[],
): GuardOptions {
  const allowedSubcommands = new Set<string>();
  const allowedSequences: [string, string][] = [];

  for (const op of allowedOperations ?? []) {
    switch (op) {
      case 'merge':
      case 'rebase':
      case 'checkout':
      case 'switch':
        allowedSubcommands.add(op);
        break;
      case 'branch:delete':
        allowedSequences.push(['branch', '-d']);
        allowedSequences.push(['branch', '-D']);
        allowedSequences.push(['branch', '--delete']);
        break;
    }
  }

  return {
    allowedSubcommands: allowedSubcommands.size > 0 ? allowedSubcommands : undefined,
    allowedSequences: allowedSequences.length > 0 ? allowedSequences : undefined,
    protectedBranches:
      protectedBranches && protectedBranches.length > 0 ? protectedBranches : undefined,
  };
}
