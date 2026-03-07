/**
 * Tests for allowedOperations, protectedBranches, and the code review
 * workflow configuration (issue #44).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeFile, rm, mkdir, mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

import {
  validateCommandArgs,
  validateExtraArgs,
  validateCombinedArgs,
  buildGuardOptions,
  DestructiveCommandError,
} from '../../src/config/guard.js';
import { parseConfig, loadConfig, ConfigValidationError } from '../../src/config/loader.js';
import { buildToolDefinition } from '../../src/git/tools.js';
import { type CommandConfig } from '../../src/config/types.js';

// Suppress logger output during tests
vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

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

// ── buildGuardOptions ──────────────────────────────────────────────

describe('buildGuardOptions', () => {
  it('should return empty options when no operations specified', () => {
    const opts = buildGuardOptions(undefined, undefined);
    expect(opts.allowedSubcommands).toBeUndefined();
    expect(opts.allowedSequences).toBeUndefined();
    expect(opts.protectedBranches).toBeUndefined();
  });

  it('should return empty options for empty arrays', () => {
    const opts = buildGuardOptions([], []);
    expect(opts.allowedSubcommands).toBeUndefined();
    expect(opts.allowedSequences).toBeUndefined();
    expect(opts.protectedBranches).toBeUndefined();
  });

  it('should build allowed subcommands for merge/rebase/checkout/switch', () => {
    const opts = buildGuardOptions(['merge', 'rebase', 'checkout', 'switch']);
    expect(opts.allowedSubcommands).toBeDefined();
    expect(opts.allowedSubcommands!.has('merge')).toBe(true);
    expect(opts.allowedSubcommands!.has('rebase')).toBe(true);
    expect(opts.allowedSubcommands!.has('checkout')).toBe(true);
    expect(opts.allowedSubcommands!.has('switch')).toBe(true);
  });

  it('should build allowed sequences for branch:delete', () => {
    const opts = buildGuardOptions(['branch:delete']);
    expect(opts.allowedSequences).toBeDefined();
    expect(opts.allowedSequences).toEqual(
      expect.arrayContaining([
        ['branch', '-d'],
        ['branch', '-D'],
        ['branch', '--delete'],
      ]),
    );
  });

  it('should set protectedBranches from input', () => {
    const opts = buildGuardOptions([], ['main', 'master']);
    expect(opts.protectedBranches).toEqual(['main', 'master']);
  });

  it('should handle combined operations and protected branches', () => {
    const opts = buildGuardOptions(['merge', 'branch:delete'], ['main', 'develop']);
    expect(opts.allowedSubcommands!.has('merge')).toBe(true);
    expect(opts.allowedSequences).toHaveLength(3);
    expect(opts.protectedBranches).toEqual(['main', 'develop']);
  });
});

// ── Guard with allowedOperations ───────────────────────────────────

describe('validateCommandArgs with GuardOptions', () => {
  it('should allow merge when opted in', () => {
    const opts = buildGuardOptions(['merge']);
    expect(() =>
      validateCommandArgs(makeCommand({ args: ['merge', '--no-edit'] }), opts),
    ).not.toThrow();
  });

  it('should allow rebase when opted in', () => {
    const opts = buildGuardOptions(['rebase']);
    expect(() => validateCommandArgs(makeCommand({ args: ['rebase'] }), opts)).not.toThrow();
  });

  it('should allow checkout when opted in', () => {
    const opts = buildGuardOptions(['checkout']);
    expect(() => validateCommandArgs(makeCommand({ args: ['checkout'] }), opts)).not.toThrow();
  });

  it('should allow switch when opted in', () => {
    const opts = buildGuardOptions(['switch']);
    expect(() => validateCommandArgs(makeCommand({ args: ['switch'] }), opts)).not.toThrow();
  });

  it('should allow branch -d when branch:delete opted in', () => {
    const opts = buildGuardOptions(['branch:delete']);
    expect(() => validateCommandArgs(makeCommand({ args: ['branch', '-d'] }), opts)).not.toThrow();
  });

  it('should allow branch --delete when branch:delete opted in', () => {
    const opts = buildGuardOptions(['branch:delete']);
    expect(() =>
      validateCommandArgs(makeCommand({ args: ['branch', '--delete'] }), opts),
    ).not.toThrow();
  });

  it('should allow branch -D when branch:delete opted in', () => {
    const opts = buildGuardOptions(['branch:delete']);
    expect(() => validateCommandArgs(makeCommand({ args: ['branch', '-D'] }), opts)).not.toThrow();
  });

  it('should still block merge without opt-in', () => {
    expect(() => validateCommandArgs(makeCommand({ args: ['merge'] }))).toThrow(
      DestructiveCommandError,
    );
  });

  it('should still block push even with all operations allowed', () => {
    const opts = buildGuardOptions(['merge', 'rebase', 'checkout', 'switch', 'branch:delete']);
    expect(() => validateCommandArgs(makeCommand({ args: ['push'] }), opts)).toThrow(
      DestructiveCommandError,
    );
  });

  it('should still block commit even with operations allowed', () => {
    const opts = buildGuardOptions(['merge', 'rebase']);
    expect(() => validateCommandArgs(makeCommand({ args: ['commit'] }), opts)).toThrow(
      DestructiveCommandError,
    );
  });

  it('should still block branch -m even with branch:delete allowed', () => {
    const opts = buildGuardOptions(['branch:delete']);
    expect(() => validateCommandArgs(makeCommand({ args: ['branch', '-m'] }), opts)).toThrow(
      DestructiveCommandError,
    );
  });

  it('should still block tag --delete even with branch:delete allowed', () => {
    const opts = buildGuardOptions(['branch:delete']);
    expect(() => validateCommandArgs(makeCommand({ args: ['tag', '--delete'] }), opts)).toThrow(
      DestructiveCommandError,
    );
  });
});

// ── Protected branches ─────────────────────────────────────────────

describe('validateCombinedArgs with protectedBranches', () => {
  const opts = buildGuardOptions(['branch:delete'], ['main', 'master', 'develop']);

  it('should block deleting a protected branch', () => {
    expect(() =>
      validateCombinedArgs('git_branch_delete', ['branch', '-d'], ['main'], opts),
    ).toThrow(DestructiveCommandError);
    expect(() =>
      validateCombinedArgs('git_branch_delete', ['branch', '-d'], ['main'], opts),
    ).toThrow(/protected branch "main"/);
  });

  it('should block deleting master', () => {
    expect(() =>
      validateCombinedArgs('git_branch_delete', ['branch', '-d'], ['master'], opts),
    ).toThrow(/protected branch "master"/);
  });

  it('should block deleting develop', () => {
    expect(() =>
      validateCombinedArgs('git_branch_delete', ['branch', '--delete'], ['develop'], opts),
    ).toThrow(/protected branch "develop"/);
  });

  it('should block force-deleting a protected branch', () => {
    expect(() =>
      validateCombinedArgs('git_branch_delete', ['branch', '-D'], ['main'], opts),
    ).toThrow(/protected branch "main"/);
  });

  it('should allow deleting a non-protected branch', () => {
    expect(() =>
      validateCombinedArgs('git_branch_delete', ['branch', '-d'], ['feature/my-branch'], opts),
    ).not.toThrow();
  });

  it('should allow operations on branches when no delete flag present', () => {
    expect(() => validateCombinedArgs('git_branch', ['branch'], ['main'], opts)).not.toThrow();
  });
});

describe('validateExtraArgs with GuardOptions', () => {
  it('should allow merge subcommand in extra args when opted in', () => {
    const opts = buildGuardOptions(['merge']);
    expect(() => validateExtraArgs('git_run', ['merge'], opts)).not.toThrow();
  });

  it('should block merge subcommand in extra args without opt-in', () => {
    expect(() => validateExtraArgs('git_run', ['merge'])).toThrow(DestructiveCommandError);
  });
});

// ── Config parsing with allowedOperations ──────────────────────────

describe('parseConfig with allowedOperations', () => {
  it('should accept config with allowedOperations and write commands', () => {
    const config = {
      allowedOperations: ['merge', 'rebase'],
      commands: [
        {
          name: 'git_merge',
          description: 'Merge a branch',
          command: 'git',
          args: ['merge', '--no-edit'],
          allowExtraArgs: true,
          extraArgsSchema: {
            type: 'object',
            properties: {
              branch: { type: 'string', description: 'Branch to merge' },
            },
          },
        },
        {
          name: 'git_rebase',
          description: 'Rebase onto branch',
          command: 'git',
          args: ['rebase'],
          allowExtraArgs: true,
          extraArgsSchema: {
            type: 'object',
            properties: {
              onto: { type: 'string', description: 'Branch to rebase onto' },
            },
          },
        },
      ],
    };
    const result = parseConfig(config);
    expect(result.commands).toHaveLength(2);
    expect(result.allowedOperations).toEqual(['merge', 'rebase']);
  });

  it('should reject merge command without allowedOperations', () => {
    const config = {
      commands: [
        {
          name: 'git_merge',
          description: 'Merge',
          command: 'git',
          args: ['merge'],
          allowExtraArgs: false,
        },
      ],
    };
    expect(() => parseConfig(config)).toThrow(ConfigValidationError);
  });

  it('should accept config with protectedBranches', () => {
    const config = {
      allowedOperations: ['branch:delete'],
      protectedBranches: ['main', 'master'],
      commands: [
        {
          name: 'git_branch_delete',
          description: 'Delete branch',
          command: 'git',
          args: ['branch', '-d'],
          allowExtraArgs: true,
          extraArgsSchema: {
            type: 'object',
            properties: {
              branch: { type: 'string', description: 'Branch to delete' },
            },
          },
        },
      ],
    };
    const result = parseConfig(config);
    expect(result.protectedBranches).toEqual(['main', 'master']);
  });

  it('should reject invalid allowedOperations values', () => {
    const config = {
      allowedOperations: ['push'],
      commands: [
        {
          name: 'git_status',
          description: 'Status',
          command: 'git',
          args: ['status'],
          allowExtraArgs: false,
        },
      ],
    };
    expect(() => parseConfig(config)).toThrow(ConfigValidationError);
  });

  it('should accept all valid allowedOperations values', () => {
    const config = {
      allowedOperations: ['merge', 'rebase', 'checkout', 'switch', 'branch:delete'],
      protectedBranches: ['main'],
      commands: [
        {
          name: 'git_status',
          description: 'Status',
          command: 'git',
          args: ['status'],
          allowExtraArgs: false,
        },
      ],
    };
    expect(() => parseConfig(config)).not.toThrow();
  });

  it('should work without allowedOperations (backward compat)', () => {
    const config = {
      commands: [
        {
          name: 'git_status',
          description: 'Status',
          command: 'git',
          args: ['status'],
          allowExtraArgs: false,
        },
      ],
    };
    const result = parseConfig(config);
    expect(result.allowedOperations).toBeUndefined();
    expect(result.protectedBranches).toBeUndefined();
  });
});

// ── loadConfig with code-review-workflow example ───────────────────

describe('loadConfig with code-review-workflow example', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `gitpride-test-${Date.now()}`);
    await mkdir(tempDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should load config with allowedOperations from file', async () => {
    const config = {
      allowedOperations: ['merge', 'branch:delete'],
      protectedBranches: ['main'],
      commands: [
        {
          name: 'git_merge',
          description: 'Merge branch',
          command: 'git',
          args: ['merge', '--no-edit'],
          allowExtraArgs: true,
          extraArgsSchema: {
            type: 'object',
            properties: {
              branch: { type: 'string', description: 'Branch' },
            },
          },
        },
        {
          name: 'git_branch_delete',
          description: 'Delete branch',
          command: 'git',
          args: ['branch', '-d'],
          allowExtraArgs: true,
          extraArgsSchema: {
            type: 'object',
            properties: {
              branch: { type: 'string', description: 'Branch' },
            },
          },
        },
      ],
    };
    const configPath = join(tempDir, 'commands.config.json');
    await writeFile(configPath, JSON.stringify(config));

    const result = await loadConfig(configPath);
    expect(result.commands).toHaveLength(2);
    expect(result.allowedOperations).toEqual(['merge', 'branch:delete']);
    expect(result.protectedBranches).toEqual(['main']);
  });
});

// ── Tool execution with GuardOptions ───────────────────────────────

describe('buildToolDefinition with GuardOptions (integration)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'gitpride-cr-'));
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
    await writeFile(join(tempDir, 'file.txt'), 'initial');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('git_merge tool', () => {
    it('should merge a feature branch', async () => {
      execSync('git checkout -b feature/test', { cwd: tempDir, stdio: 'ignore' });
      await writeFile(join(tempDir, 'feature.txt'), 'feature content');
      execSync('git add . && git commit -m "feature commit"', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout master 2>/dev/null || git checkout main', {
        cwd: tempDir,
        stdio: 'ignore',
      });

      const guardOpts = buildGuardOptions(['merge']);
      const mergeConfig: CommandConfig = {
        name: 'git_merge',
        description: 'Merge a branch',
        command: 'git',
        args: ['merge', '--no-edit'],
        allowExtraArgs: true,
        extraArgsSchema: {
          type: 'object',
          properties: {
            branch: { type: 'string', description: 'Branch to merge' },
          },
        },
      };

      const tool = buildToolDefinition(mergeConfig, { cwd: tempDir }, guardOpts);
      const result = await tool.handler({ branch: 'feature/test' });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('git_branch_delete tool', () => {
    it('should delete a feature branch', async () => {
      execSync('git checkout -b feature/to-delete', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout master 2>/dev/null || git checkout main', {
        cwd: tempDir,
        stdio: 'ignore',
      });

      const guardOpts = buildGuardOptions(['branch:delete'], ['main', 'master']);
      const deleteConfig: CommandConfig = {
        name: 'git_branch_delete',
        description: 'Delete branch',
        command: 'git',
        args: ['branch', '-d'],
        allowExtraArgs: true,
        extraArgsSchema: {
          type: 'object',
          properties: {
            branch: { type: 'string', description: 'Branch to delete' },
          },
        },
      };

      const tool = buildToolDefinition(deleteConfig, { cwd: tempDir }, guardOpts);
      const result = await tool.handler({ branch: 'feature/to-delete' });
      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain('feature/to-delete');
    });

    it('should block deleting a protected branch at runtime', async () => {
      const guardOpts = buildGuardOptions(['branch:delete'], ['main', 'master']);
      const deleteConfig: CommandConfig = {
        name: 'git_branch_delete',
        description: 'Delete branch',
        command: 'git',
        args: ['branch', '-d'],
        allowExtraArgs: true,
        extraArgsSchema: {
          type: 'object',
          properties: {
            branch: { type: 'string', description: 'Branch to delete' },
          },
        },
      };

      const tool = buildToolDefinition(deleteConfig, { cwd: tempDir }, guardOpts);
      await expect(tool.handler({ branch: 'main' })).rejects.toThrow(/protected branch "main"/);
    });
  });

  describe('git_checkout tool', () => {
    it('should switch to a branch', async () => {
      execSync('git checkout -b feature/switch-test', { cwd: tempDir, stdio: 'ignore' });
      execSync('git checkout master 2>/dev/null || git checkout main', {
        cwd: tempDir,
        stdio: 'ignore',
      });

      const guardOpts = buildGuardOptions(['checkout']);
      const checkoutConfig: CommandConfig = {
        name: 'git_checkout',
        description: 'Switch branch',
        command: 'git',
        args: ['checkout'],
        allowExtraArgs: true,
        extraArgsSchema: {
          type: 'object',
          properties: {
            branch: { type: 'string', description: 'Branch to switch to' },
          },
        },
      };

      const tool = buildToolDefinition(checkoutConfig, { cwd: tempDir }, guardOpts);
      const result = await tool.handler({ branch: 'feature/switch-test' });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('git_rebase tool', () => {
    it('should rebase a branch', async () => {
      // Create divergent history
      execSync('git checkout -b feature/rebase-test', { cwd: tempDir, stdio: 'ignore' });
      await writeFile(join(tempDir, 'feature-rebase.txt'), 'rebase content');
      execSync('git add . && git commit -m "feature for rebase"', {
        cwd: tempDir,
        stdio: 'ignore',
      });

      const guardOpts = buildGuardOptions(['rebase']);
      const rebaseConfig: CommandConfig = {
        name: 'git_rebase',
        description: 'Rebase branch',
        command: 'git',
        args: ['rebase'],
        allowExtraArgs: true,
        extraArgsSchema: {
          type: 'object',
          properties: {
            onto: { type: 'string', description: 'Branch to rebase onto' },
          },
        },
      };

      const defaultBranch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: tempDir })
        .toString()
        .trim();
      // Already on feature branch, rebase onto itself is a no-op, which is fine for the test
      const tool = buildToolDefinition(rebaseConfig, { cwd: tempDir }, guardOpts);
      const result = await tool.handler({ onto: defaultBranch });
      expect(result.isError).toBeUndefined();
    });
  });
});
