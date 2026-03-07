import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import { resolveConfigPath } from './configBootstrap';

export type ServerState = 'stopped' | 'starting' | 'running' | 'error';

export interface ServerInfo {
  state: ServerState;
  pid?: number;
  exitCode?: number | null;
  exitSignal?: string | null;
  errorMessage?: string;
  startedAt?: Date;
}

export class ServerManager {
  private process: ChildProcess | null = null;
  private info: ServerInfo = { state: 'stopped' };
  private outputChannel: vscode.OutputChannel;
  private disposables: vscode.Disposable[] = [];

  constructor(outputChannel: vscode.OutputChannel) {
    this.outputChannel = outputChannel;
  }

  getInfo(): ServerInfo {
    return { ...this.info };
  }

  async start(): Promise<void> {
    if (this.info.state === 'running' || this.info.state === 'starting') {
      vscode.window.showWarningMessage(
        `GitPride server is already ${this.info.state}.`
      );
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      vscode.window.showErrorMessage(
        'GitPride: No workspace folder open. Open a folder first.'
      );
      return;
    }

    const config = vscode.workspace.getConfiguration('gitpride');
    const serverCommand = config.get<string>('serverCommand') || 'npx gitpride';
    const configPath = resolveConfigPath(config);

    const [cmd, ...args] = serverCommand.split(/\s+/);

    const env: Record<string, string> = { ...process.env } as Record<
      string,
      string
    >;
    if (configPath) {
      env['GITPRIDE_CONFIG'] = configPath;
    }

    this.info = { state: 'starting' };
    this.outputChannel.appendLine(
      `Starting gitpride server: ${serverCommand} (cwd: ${workspaceFolder.uri.fsPath})`
    );

    try {
      this.process = spawn(cmd, args, {
        cwd: workspaceFolder.uri.fsPath,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: process.platform === 'win32',
      });

      this.process.stdout?.on('data', (data: Buffer) => {
        this.outputChannel.appendLine(`[stdout] ${data.toString().trimEnd()}`);
      });

      this.process.stderr?.on('data', (data: Buffer) => {
        this.outputChannel.appendLine(`[stderr] ${data.toString().trimEnd()}`);
      });

      this.process.on('error', (err: Error) => {
        this.info = {
          state: 'error',
          errorMessage: err.message,
        };
        this.outputChannel.appendLine(`Server error: ${err.message}`);
        vscode.window
          .showErrorMessage(
            `GitPride server failed to start: ${err.message}`,
            'Show Output'
          )
          .then((action) => {
            if (action === 'Show Output') {
              this.outputChannel.show();
            }
          });
      });

      this.process.on('exit', (code, signal) => {
        const wasRunning = this.info.state === 'running';
        this.info = {
          state: 'stopped',
          exitCode: code,
          exitSignal: signal,
        };
        this.process = null;

        const reason = signal
          ? `signal ${signal}`
          : `exit code ${code ?? 'unknown'}`;
        this.outputChannel.appendLine(`Server exited (${reason}).`);

        if (wasRunning && code !== 0 && code !== null) {
          vscode.window
            .showWarningMessage(
              `GitPride server exited unexpectedly (${reason}).`,
              'Restart',
              'Show Output'
            )
            .then((action) => {
              if (action === 'Restart') {
                this.start();
              } else if (action === 'Show Output') {
                this.outputChannel.show();
              }
            });
        }
      });

      // If the process has a PID, consider it running
      if (this.process.pid) {
        this.info = {
          state: 'running',
          pid: this.process.pid,
          startedAt: new Date(),
        };
        this.outputChannel.appendLine(
          `Server started (PID: ${this.process.pid}).`
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.info = { state: 'error', errorMessage: message };
      this.outputChannel.appendLine(`Failed to start server: ${message}`);
      vscode.window.showErrorMessage(
        `GitPride: Failed to start server — ${message}`
      );
    }
  }

  stop(): void {
    if (!this.process) {
      if (this.info.state !== 'stopped') {
        this.info = { state: 'stopped' };
      }
      return;
    }

    this.outputChannel.appendLine('Stopping gitpride server...');

    const proc = this.process;
    this.process = null;

    // Give the process a chance to exit gracefully
    proc.kill('SIGTERM');

    const killTimeout = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {
        // Process may have already exited
      }
    }, 5000);

    proc.once('exit', () => {
      clearTimeout(killTimeout);
      this.info = { state: 'stopped' };
      this.outputChannel.appendLine('Server stopped.');
    });
  }

  async restart(): Promise<void> {
    this.stop();
    // Wait briefly for the process to exit
    await new Promise((resolve) => setTimeout(resolve, 500));
    return this.start();
  }

  dispose(): void {
    this.stop();
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
