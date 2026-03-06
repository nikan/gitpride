/**
 * Tests for the git tool builder.
 *
 * Validates that CommandConfig entries are correctly converted into
 * ToolDefinition objects with proper input schemas, arg mapping,
 * guard validation, and execution.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

import { buildToolDefinition, buildTools } from '../../src/git/tools.js';
import { type CommandConfig } from '../../src/config/types.js';

// Suppress logger output during tests
vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

// ── Test fixtures ──────────────────────────────────────────────────

const STATUS_CONFIG: CommandConfig = {
  name: 'git_status',
  description: 'Show the working tree status',
  command: 'git',
  args: ['status'],
  allowExtraArgs: false,
};

const LOG_CONFIG: CommandConfig = {
  name: 'git_log',
  description: 'Show commit logs',
  command: 'git',
  args: ['log', '--oneline'],
  allowExtraArgs: true,
  extraArgsSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of commits to show',
        default: 20,
      },
    },
  },
};

const DIFF_CONFIG: CommandConfig = {
  name: 'git_diff',
  description: 'Show changes',
  command: 'git',
  args: ['diff'],
  allowExtraArgs: true,
  extraArgsSchema: {
    type: 'object',
    properties: {
      ref: {
        type: 'string',
        description: 'Git ref to diff against',
      },
      staged: {
        type: 'boolean',
        description: 'Show staged changes',
        default: false,
      },
    },
  },
};

const BRANCH_CONFIG: CommandConfig = {
  name: 'git_branch',
  description: 'List branches',
  command: 'git',
  args: ['branch'],
  allowExtraArgs: true,
  extraArgsSchema: {
    type: 'object',
    properties: {
      all: {
        type: 'boolean',
        description: 'List all branches',
        default: false,
      },
    },
  },
};

const SHOW_CONFIG: CommandConfig = {
  name: 'git_show',
  description: 'Show a commit or object',
  command: 'git',
  args: ['show'],
  allowExtraArgs: true,
  extraArgsSchema: {
    type: 'object',
    properties: {
      ref: {
        type: 'string',
        description: 'Commit SHA or ref to show',
        default: 'HEAD',
      },
    },
  },
};

const BLAME_CONFIG: CommandConfig = {
  name: 'git_blame',
  description: 'Show line attribution',
  command: 'git',
  args: ['blame'],
  allowExtraArgs: true,
  extraArgsSchema: {
    type: 'object',
    properties: {
      file: {
        type: 'string',
        description: 'File path to blame',
      },
    },
  },
};

const REMOTE_CONFIG: CommandConfig = {
  name: 'git_remote',
  description: 'Show remote repositories',
  command: 'git',
  args: ['remote', '-v'],
  allowExtraArgs: false,
};

// ── Tests ──────────────────────────────────────────────────────────

describe('buildToolDefinition', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'gitpride-tools-'));
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should create a tool with correct name and description', () => {
    const tool = buildToolDefinition(STATUS_CONFIG);
    expect(tool.name).toBe('git_status');
    expect(tool.description).toBe('Show the working tree status');
  });

  it('should create empty inputSchema for commands without extra args', () => {
    const tool = buildToolDefinition(STATUS_CONFIG);
    expect(Object.keys(tool.inputSchema)).toHaveLength(0);
  });

  it('should create inputSchema with properties from extraArgsSchema', () => {
    const tool = buildToolDefinition(LOG_CONFIG);
    expect(tool.inputSchema).toHaveProperty('limit');
  });

  it('should create inputSchema for diff with ref and staged', () => {
    const tool = buildToolDefinition(DIFF_CONFIG);
    expect(tool.inputSchema).toHaveProperty('ref');
    expect(tool.inputSchema).toHaveProperty('staged');
  });

  describe('git_status tool', () => {
    it('should return status output from a clean repo', async () => {
      const tool = buildToolDefinition(STATUS_CONFIG, { cwd: tempDir });
      const result = await tool.handler({});
      expect(result.isError).toBeUndefined();
      expect(result.content[0]).toHaveProperty('text');
      expect((result.content[0] as { text: string }).text).toContain('nothing to commit');
    });
  });

  describe('git_log tool', () => {
    it('should return commit logs', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'content');
      execSync('git add . && git commit -m "test log"', { cwd: tempDir, stdio: 'ignore' });

      const tool = buildToolDefinition(LOG_CONFIG, { cwd: tempDir });
      const result = await tool.handler({ limit: 5 });
      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain('test log');
    });

    it('should use default limit when not provided', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'content');
      execSync('git add . && git commit -m "default limit"', { cwd: tempDir, stdio: 'ignore' });

      const tool = buildToolDefinition(LOG_CONFIG, { cwd: tempDir });
      const result = await tool.handler({});
      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain('default limit');
    });
  });

  describe('git_diff tool', () => {
    it('should show unstaged changes', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'original');
      execSync('git add . && git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });
      await writeFile(join(tempDir, 'file.txt'), 'modified');

      const tool = buildToolDefinition(DIFF_CONFIG, { cwd: tempDir });
      const result = await tool.handler({});
      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain('+modified');
    });

    it('should show staged changes with --cached', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'original');
      execSync('git add . && git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });
      await writeFile(join(tempDir, 'file.txt'), 'staged change');
      execSync('git add .', { cwd: tempDir, stdio: 'ignore' });

      const tool = buildToolDefinition(DIFF_CONFIG, { cwd: tempDir });
      const result = await tool.handler({ staged: true });
      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain('+staged change');
    });

    it('should diff against a ref', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'v1');
      execSync('git add . && git commit -m "v1"', { cwd: tempDir, stdio: 'ignore' });
      await writeFile(join(tempDir, 'file.txt'), 'v2');
      execSync('git add . && git commit -m "v2"', { cwd: tempDir, stdio: 'ignore' });

      const tool = buildToolDefinition(DIFF_CONFIG, { cwd: tempDir });
      const result = await tool.handler({ ref: 'HEAD~1' });
      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain('v2');
    });
  });

  describe('git_branch tool', () => {
    it('should list branches', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'content');
      execSync('git add . && git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });

      const tool = buildToolDefinition(BRANCH_CONFIG, { cwd: tempDir });
      const result = await tool.handler({});
      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toMatch(/\*\s+(main|master)/);
    });

    it('should list all branches including remote-tracking', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'content');
      execSync('git add . && git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });

      const tool = buildToolDefinition(BRANCH_CONFIG, { cwd: tempDir });
      const result = await tool.handler({ all: true });
      expect(result.isError).toBeUndefined();
    });
  });

  describe('git_show tool', () => {
    it('should show HEAD commit', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'content');
      execSync('git add . && git commit -m "show me"', { cwd: tempDir, stdio: 'ignore' });

      const tool = buildToolDefinition(SHOW_CONFIG, { cwd: tempDir });
      const result = await tool.handler({ ref: 'HEAD' });
      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain('show me');
    });

    it('should show default ref (HEAD) when not specified', async () => {
      await writeFile(join(tempDir, 'file.txt'), 'content');
      execSync('git add . && git commit -m "default ref"', { cwd: tempDir, stdio: 'ignore' });

      const tool = buildToolDefinition(SHOW_CONFIG, { cwd: tempDir });
      const result = await tool.handler({});
      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain('default ref');
    });
  });

  describe('git_blame tool', () => {
    it('should show blame for a file', async () => {
      await writeFile(join(tempDir, 'hello.txt'), 'blame this line');
      execSync('git add . && git commit -m "blame test"', { cwd: tempDir, stdio: 'ignore' });

      const tool = buildToolDefinition(BLAME_CONFIG, { cwd: tempDir });
      const result = await tool.handler({ file: 'hello.txt' });
      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toContain('blame this line');
    });

    it('should return error for missing file', async () => {
      await writeFile(join(tempDir, 'hello.txt'), 'content');
      execSync('git add . && git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });

      const tool = buildToolDefinition(BLAME_CONFIG, { cwd: tempDir });
      const result = await tool.handler({ file: 'nonexistent.txt' });
      expect(result.isError).toBe(true);
    });
  });

  describe('git_remote tool', () => {
    it('should return empty output when no remotes configured', async () => {
      const tool = buildToolDefinition(REMOTE_CONFIG, { cwd: tempDir });
      const result = await tool.handler({});
      expect(result.isError).toBeUndefined();
      expect((result.content[0] as { text: string }).text).toBe('(no output)');
    });
  });

  describe('guard validation at runtime', () => {
    it('should reject destructive extra args', async () => {
      const maliciousConfig: CommandConfig = {
        name: 'git_log_bad',
        description: 'Should fail',
        command: 'git',
        args: ['log'],
        allowExtraArgs: true,
        extraArgsSchema: {
          type: 'object',
          properties: {
            ref: { type: 'string', description: 'ref' },
          },
        },
      };

      const tool = buildToolDefinition(maliciousConfig, { cwd: tempDir });
      // Try to inject a shell operator via string arg
      await expect(tool.handler({ ref: '; rm -rf /' })).rejects.toThrow(/shell operator/);
    });
  });
});

describe('buildTools', () => {
  it('should build tools for all config entries', () => {
    const tools = buildTools([STATUS_CONFIG, LOG_CONFIG, REMOTE_CONFIG]);
    expect(tools).toHaveLength(3);
    expect(tools.map((t) => t.name)).toEqual(['git_status', 'git_log', 'git_remote']);
  });

  it('should return empty array for empty config', () => {
    const tools = buildTools([]);
    expect(tools).toHaveLength(0);
  });
});
