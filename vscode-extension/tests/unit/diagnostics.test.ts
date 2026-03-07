/**
 * Unit tests for diagnostics module.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

let fsExistsResult = false;

vi.mock('fs', () => ({
  existsSync: vi.fn(() => fsExistsResult),
  readFileSync: vi.fn(() => '{}'),
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
  },
  window: {
    showInformationMessage: vi.fn(() => Promise.resolve(undefined)),
    showWarningMessage: vi.fn(() => Promise.resolve(undefined)),
    showErrorMessage: vi.fn(() => Promise.resolve(undefined)),
  },
}));

vi.mock('child_process', () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd === 'node --version') return 'v20.11.0';
    if (cmd === 'git --version') return 'git version 2.43.0';
    if (cmd === 'npx --version') return '10.2.0';
    return '';
  }),
  spawn: vi.fn(),
}));

import { showStatus, showDiagnostics } from '../../src/diagnostics';

describe('showStatus', () => {
  it('displays server state', async () => {
    const vscode = await import('vscode');
    const manager = {
      getInfo: vi.fn(() => ({
        state: 'running' as const,
        pid: 12345,
        startedAt: new Date('2026-01-01'),
      })),
    };

    showStatus(manager as unknown as import('../../src/serverManager').ServerManager);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('running')
    );
    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('12345')
    );
  });

  it('shows stopped state with exit info', async () => {
    const vscode = await import('vscode');
    const manager = {
      getInfo: vi.fn(() => ({
        state: 'stopped' as const,
        exitCode: 1,
        errorMessage: 'ENOENT',
      })),
    };

    showStatus(manager as unknown as import('../../src/serverManager').ServerManager);

    expect(vscode.window.showInformationMessage).toHaveBeenCalledWith(
      expect.stringContaining('stopped')
    );
  });
});

describe('showDiagnostics', () => {
  let outputChannel: {
    appendLine: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    outputChannel = { appendLine: vi.fn(), show: vi.fn() };
    fsExistsResult = false;
    vi.clearAllMocks();
  });

  it('runs diagnostics and outputs to channel', async () => {
    const manager = {
      getInfo: vi.fn(() => ({ state: 'stopped' as const })),
    };

    await showDiagnostics(
      manager as unknown as import('../../src/serverManager').ServerManager,
      outputChannel as unknown as import('vscode').OutputChannel
    );

    expect(outputChannel.appendLine).toHaveBeenCalled();
    expect(outputChannel.show).toHaveBeenCalled();

    const output = vi.mocked(outputChannel.appendLine).mock.calls[0][0];
    expect(output).toContain('GitPride Diagnostics');
    expect(output).toContain('Node.js');
  });

  it('reports Node.js version check results', async () => {
    const manager = {
      getInfo: vi.fn(() => ({ state: 'stopped' as const })),
    };

    await showDiagnostics(
      manager as unknown as import('../../src/serverManager').ServerManager,
      outputChannel as unknown as import('vscode').OutputChannel
    );

    const output = vi.mocked(outputChannel.appendLine).mock.calls[0][0];
    expect(output).toContain('✅ Node.js: v20.11.0');
  });
});
