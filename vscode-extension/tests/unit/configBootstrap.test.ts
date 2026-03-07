/**
 * Unit tests for configBootstrap module.
 *
 * These tests exercise the pure-logic functions without requiring the
 * VS Code API — we mock vscode and fs as needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as path from 'path';

// Track fs mock state per test
let fsState: {
  existsSync: (p: string) => boolean;
  readFileSync: (p: string) => string;
  writeFileSync: ReturnType<typeof vi.fn>;
  mkdirSync: ReturnType<typeof vi.fn>;
};

vi.mock('fs', () => ({
  existsSync: vi.fn((...args: unknown[]) => fsState.existsSync(String(args[0]))),
  readFileSync: vi.fn((...args: unknown[]) => fsState.readFileSync(String(args[0]))),
  writeFileSync: vi.fn((...args: unknown[]) => fsState.writeFileSync(...args)),
  mkdirSync: vi.fn((...args: unknown[]) => fsState.mkdirSync(...args)),
}));

vi.mock('vscode', () => ({
  workspace: {
    workspaceFolders: [
      { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 },
    ],
    getConfiguration: vi.fn(() => ({
      get: vi.fn((key: string) => {
        const defaults: Record<string, string> = {
          configPath: '',
          startupMode: 'manual',
          serverCommand: 'npx gitpride',
          minimumVersion: '0.1.0',
        };
        return defaults[key];
      }),
    })),
    openTextDocument: vi.fn(() => Promise.resolve({})),
  },
  window: {
    showInformationMessage: vi.fn(() => Promise.resolve(undefined)),
    showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
    showErrorMessage: vi.fn(() => Promise.resolve(undefined)),
    showTextDocument: vi.fn(() => Promise.resolve()),
    createOutputChannel: vi.fn(() => ({
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    })),
  },
  commands: {
    registerCommand: vi.fn(),
  },
}));

import { resolveConfigPath, bootstrapMcpConfig, createStarterConfig } from '../../src/configBootstrap';
import * as fs from 'fs';

describe('resolveConfigPath', () => {
  it('returns empty string when no explicit path is set', () => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'configPath') return '';
        return undefined;
      }),
    } as unknown as import('vscode').WorkspaceConfiguration;

    expect(resolveConfigPath(config)).toBe('');
  });

  it('returns absolute path as-is', () => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'configPath') return '/absolute/path/config.json';
        return undefined;
      }),
    } as unknown as import('vscode').WorkspaceConfiguration;

    expect(resolveConfigPath(config)).toBe('/absolute/path/config.json');
  });

  it('resolves relative path against workspace root', () => {
    const config = {
      get: vi.fn((key: string) => {
        if (key === 'configPath') return 'my-config.json';
        return undefined;
      }),
    } as unknown as import('vscode').WorkspaceConfiguration;

    const result = resolveConfigPath(config);
    expect(result).toBe(path.join('/test/workspace', 'my-config.json'));
  });
});

describe('bootstrapMcpConfig', () => {
  let mockOutputChannel: { appendLine: ReturnType<typeof vi.fn>; show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockOutputChannel = { appendLine: vi.fn(), show: vi.fn() };
    vi.clearAllMocks();
    fsState = {
      existsSync: () => false,
      readFileSync: () => '{}',
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
    };
  });

  it('creates .vscode/mcp.json with gitpride entry when no file exists', async () => {
    fsState.existsSync = () => false;

    await bootstrapMcpConfig(mockOutputChannel as unknown as import('vscode').OutputChannel);

    expect(fs.writeFileSync).toHaveBeenCalled();
    const calls = vi.mocked(fs.writeFileSync).mock.calls;
    const writtenPath = calls[0][0] as string;
    const writtenContent = JSON.parse(calls[0][1] as string);

    expect(writtenPath).toContain('mcp.json');
    expect(writtenContent.servers).toBeDefined();
    expect(writtenContent.servers.gitpride).toBeDefined();
    expect(writtenContent.servers.gitpride.command).toBe('npx');
    expect(writtenContent.servers.gitpride.args).toEqual(['gitpride']);
  });

  it('merges with existing mcp.json preserving other servers', async () => {
    const existingConfig = {
      servers: { 'other-server': { command: 'other', args: [] } },
    };
    fsState.existsSync = () => true;
    fsState.readFileSync = () => JSON.stringify(existingConfig);

    await bootstrapMcpConfig(mockOutputChannel as unknown as import('vscode').OutputChannel);

    expect(fs.writeFileSync).toHaveBeenCalled();
    const writtenContent = JSON.parse(vi.mocked(fs.writeFileSync).mock.calls[0][1] as string);

    expect(writtenContent.servers['other-server']).toBeDefined();
    expect(writtenContent.servers['gitpride']).toBeDefined();
  });

  it('shows error when no workspace folder is open', async () => {
    const vscode = await import('vscode');
    const original = vscode.workspace.workspaceFolders;
    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: undefined,
      writable: true,
      configurable: true,
    });

    await bootstrapMcpConfig(mockOutputChannel as unknown as import('vscode').OutputChannel);

    expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
      expect.stringContaining('No workspace folder')
    );

    Object.defineProperty(vscode.workspace, 'workspaceFolders', {
      value: original,
      writable: true,
      configurable: true,
    });
  });
});

describe('createStarterConfig', () => {
  let mockOutputChannel: { appendLine: ReturnType<typeof vi.fn>; show: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockOutputChannel = { appendLine: vi.fn(), show: vi.fn() };
    vi.clearAllMocks();
    fsState = {
      existsSync: () => false,
      readFileSync: () => '{}',
      writeFileSync: vi.fn(),
      mkdirSync: vi.fn(),
    };
  });

  it('creates commands.config.json when file does not exist', async () => {
    fsState.existsSync = () => false;

    await createStarterConfig(mockOutputChannel as unknown as import('vscode').OutputChannel);

    expect(fs.writeFileSync).toHaveBeenCalled();
    const calls = vi.mocked(fs.writeFileSync).mock.calls;
    const writtenPath = calls[0][0] as string;
    const writtenContent = JSON.parse(calls[0][1] as string);

    expect(writtenPath).toContain('commands.config.json');
    expect(writtenContent.commands).toBeDefined();
    expect(Array.isArray(writtenContent.commands)).toBe(true);
    expect(writtenContent.commands.length).toBeGreaterThan(0);
    expect(writtenContent.commands[0].name).toBe('git_status');
  });
});
