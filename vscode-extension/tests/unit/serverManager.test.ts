/**
 * Unit tests for ServerManager module.
 *
 * Tests lifecycle management logic with mocked child_process.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import type { ChildProcess } from 'child_process';

// Mock vscode
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

function createMockProcess(): ChildProcess & EventEmitter {
  const proc = new EventEmitter() as ChildProcess & EventEmitter;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proc.stdout = new EventEmitter() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proc.stderr = new EventEmitter() as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  proc.stdin = new EventEmitter() as any;
  proc.kill = vi.fn().mockReturnValue(true);
  (proc as unknown as Record<string, number>).pid = 12345;
  return proc;
}

let mockProcess: ChildProcess & EventEmitter;

vi.mock('child_process', () => ({
  spawn: vi.fn(() => {
    mockProcess = createMockProcess();
    return mockProcess;
  }),
}));

vi.mock('../../src/configBootstrap', () => ({
  resolveConfigPath: vi.fn(() => ''),
}));

import { ServerManager } from '../../src/serverManager';

describe('ServerManager', () => {
  let manager: ServerManager;
  let outputChannel: {
    appendLine: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    outputChannel = {
      appendLine: vi.fn(),
      show: vi.fn(),
      dispose: vi.fn(),
    };
    manager = new ServerManager(
      outputChannel as unknown as import('vscode').OutputChannel
    );
  });

  afterEach(() => {
    manager.dispose();
    vi.clearAllMocks();
  });

  it('starts in stopped state', () => {
    const info = manager.getInfo();
    expect(info.state).toBe('stopped');
  });

  it('transitions to running after start', async () => {
    await manager.start();

    const info = manager.getInfo();
    expect(info.state).toBe('running');
    expect(info.pid).toBe(12345);
    expect(info.startedAt).toBeInstanceOf(Date);
  });

  it('prevents duplicate starts', async () => {
    const vscode = await import('vscode');
    await manager.start();
    await manager.start();

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('already')
    );
  });

  it('stops a running server', async () => {
    await manager.start();
    expect(manager.getInfo().state).toBe('running');

    manager.stop();

    expect(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
  });

  it('restart stops then starts', async () => {
    await manager.start();

    const exitPromise = manager.restart();
    mockProcess.emit('exit', 0, null);
    await exitPromise;

    const info = manager.getInfo();
    expect(info.state).toBe('running');
  });

  it('detects process crash and offers restart', async () => {
    const vscode = await import('vscode');
    await manager.start();

    mockProcess.emit('exit', 1, null);

    expect(vscode.window.showWarningMessage).toHaveBeenCalledWith(
      expect.stringContaining('exited unexpectedly'),
      'Restart',
      'Show Output'
    );
  });

  it('handles process error events', async () => {
    const vscode = await import('vscode');
    await manager.start();

    mockProcess.emit('error', new Error('ENOENT'));

    const info = manager.getInfo();
    expect(info.state).toBe('error');
    expect(info.errorMessage).toBe('ENOENT');
  });

  it('returns a copy of info (not mutable reference)', () => {
    const info1 = manager.getInfo();
    const info2 = manager.getInfo();
    expect(info1).not.toBe(info2);
    expect(info1).toEqual(info2);
  });
});
