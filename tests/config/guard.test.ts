import { describe, it, expect } from 'vitest';
import {
  validateCommandArgs,
  validateExtraArgs,
  validateCombinedArgs,
  DestructiveCommandError,
  BLOCKED_SUBCOMMANDS,
  BLOCKED_SHELL_OPERATORS,
} from '../../src/config/guard.js';
import { type CommandConfig } from '../../src/config/types.js';

function makeCommand(overrides: Partial<CommandConfig> = {}): CommandConfig {
  return {
    name: 'test_cmd',
    description: 'Test command',
    command: 'git',
    args: ['status'],
    allowExtraArgs: false,
    ...overrides,
  };
}

describe('validateCommandArgs', () => {
  it('should accept safe read-only commands', () => {
    const safe = ['status', 'log', 'diff', 'branch', 'show', 'blame', 'remote'];
    for (const sub of safe) {
      expect(() => validateCommandArgs(makeCommand({ args: [sub] }))).not.toThrow();
    }
  });

  it('should block all destructive subcommands', () => {
    for (const sub of BLOCKED_SUBCOMMANDS) {
      expect(
        () => validateCommandArgs(makeCommand({ args: [sub] })),
        `expected "${sub}" to be blocked`,
      ).toThrow(DestructiveCommandError);
    }
  });

  it('should block "tag --delete" sequence', () => {
    expect(() =>
      validateCommandArgs(makeCommand({ args: ['tag', '--delete'] })),
    ).toThrow(DestructiveCommandError);
  });

  it('should block "tag -d" sequence', () => {
    expect(() =>
      validateCommandArgs(makeCommand({ args: ['tag', '-d'] })),
    ).toThrow(DestructiveCommandError);
  });

  it('should block "branch -D" sequence', () => {
    expect(() =>
      validateCommandArgs(makeCommand({ args: ['branch', '-D'] })),
    ).toThrow(DestructiveCommandError);
  });

  it('should block "branch --delete" sequence', () => {
    expect(() =>
      validateCommandArgs(makeCommand({ args: ['branch', '--delete'] })),
    ).toThrow(DestructiveCommandError);
  });

  it('should allow "branch" without -D', () => {
    expect(() =>
      validateCommandArgs(makeCommand({ args: ['branch', '-a'] })),
    ).not.toThrow();
  });

  it('should allow "tag" without --delete', () => {
    expect(() =>
      validateCommandArgs(makeCommand({ args: ['tag', '-l'] })),
    ).not.toThrow();
  });

  it('should block shell operators as exact tokens', () => {
    for (const op of BLOCKED_SHELL_OPERATORS) {
      expect(
        () => validateCommandArgs(makeCommand({ args: ['log', op] })),
        `expected "${op}" to be blocked`,
      ).toThrow(DestructiveCommandError);
    }
  });

  it('should block embedded shell operators', () => {
    expect(() =>
      validateCommandArgs(makeCommand({ args: ['log;rm', '-rf'] })),
    ).toThrow(DestructiveCommandError);
  });

  it('should include the command name in the error message', () => {
    try {
      validateCommandArgs(makeCommand({ name: 'evil_tool', args: ['push'] }));
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DestructiveCommandError);
      expect((err as DestructiveCommandError).commandName).toBe('evil_tool');
      expect((err as DestructiveCommandError).message).toContain('evil_tool');
    }
  });

  it('should accept commands with flags before the subcommand', () => {
    expect(() =>
      validateCommandArgs(makeCommand({ args: ['-C', '/tmp', 'log'] })),
    ).not.toThrow();
  });
});

describe('validateExtraArgs', () => {
  it('should accept safe extra arguments', () => {
    expect(() => validateExtraArgs('git_log', ['--oneline', '-n', '10'])).not.toThrow();
  });

  it('should block destructive subcommands in extra args', () => {
    expect(() => validateExtraArgs('git_log', ['push'])).toThrow(DestructiveCommandError);
  });

  it('should block shell operators in extra args', () => {
    expect(() => validateExtraArgs('git_log', ['--format=%H', '|', 'cat'])).toThrow(
      DestructiveCommandError,
    );
  });

  it('should block redirect operators in extra args', () => {
    expect(() => validateExtraArgs('git_log', ['>', '/tmp/out'])).toThrow(
      DestructiveCommandError,
    );
  });
});

describe('validateCombinedArgs', () => {
  it('should block sequences spanning base and extra args', () => {
    // base=['tag'], extra=['--delete', 'v1'] → combined=['tag', '--delete', 'v1']
    expect(() => validateCombinedArgs('git_tag', ['tag'], ['--delete', 'v1'])).toThrow(
      DestructiveCommandError,
    );
  });

  it('should block "tag -d" spanning base and extra args', () => {
    expect(() => validateCombinedArgs('git_tag', ['tag'], ['-d', 'v1'])).toThrow(
      DestructiveCommandError,
    );
  });

  it('should block "branch --delete" spanning base and extra args', () => {
    expect(() => validateCombinedArgs('git_branch', ['branch'], ['--delete', 'feat'])).toThrow(
      DestructiveCommandError,
    );
  });

  it('should block "branch -D" spanning base and extra args', () => {
    expect(() => validateCombinedArgs('git_branch', ['branch'], ['-D', 'feat'])).toThrow(
      DestructiveCommandError,
    );
  });

  it('should allow safe combined args', () => {
    expect(() => validateCombinedArgs('git_tag', ['tag'], ['-l'])).not.toThrow();
  });

  it('should allow empty extra args', () => {
    expect(() => validateCombinedArgs('git_log', ['log', '--oneline'], [])).not.toThrow();
  });
});
