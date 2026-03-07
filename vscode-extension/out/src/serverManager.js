"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ServerManager = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const configBootstrap_1 = require("./configBootstrap");
class ServerManager {
    process = null;
    info = { state: 'stopped' };
    outputChannel;
    disposables = [];
    constructor(outputChannel) {
        this.outputChannel = outputChannel;
    }
    getInfo() {
        return { ...this.info };
    }
    async start() {
        if (this.info.state === 'running' || this.info.state === 'starting') {
            vscode.window.showWarningMessage(`GitPride server is already ${this.info.state}.`);
            return;
        }
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            vscode.window.showErrorMessage('GitPride: No workspace folder open. Open a folder first.');
            return;
        }
        const config = vscode.workspace.getConfiguration('gitpride');
        const serverCommand = config.get('serverCommand') || 'npx gitpride';
        const configPath = (0, configBootstrap_1.resolveConfigPath)(config);
        const [cmd, ...args] = serverCommand.split(/\s+/);
        const env = { ...process.env };
        if (configPath) {
            env['GITPRIDE_CONFIG'] = configPath;
        }
        this.info = { state: 'starting' };
        this.outputChannel.appendLine(`Starting gitpride server: ${serverCommand} (cwd: ${workspaceFolder.uri.fsPath})`);
        try {
            this.process = (0, child_process_1.spawn)(cmd, args, {
                cwd: workspaceFolder.uri.fsPath,
                env,
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: process.platform === 'win32',
            });
            this.process.stdout?.on('data', (data) => {
                this.outputChannel.appendLine(`[stdout] ${data.toString().trimEnd()}`);
            });
            this.process.stderr?.on('data', (data) => {
                this.outputChannel.appendLine(`[stderr] ${data.toString().trimEnd()}`);
            });
            this.process.on('error', (err) => {
                this.info = {
                    state: 'error',
                    errorMessage: err.message,
                };
                this.outputChannel.appendLine(`Server error: ${err.message}`);
                vscode.window
                    .showErrorMessage(`GitPride server failed to start: ${err.message}`, 'Show Output')
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
                        .showWarningMessage(`GitPride server exited unexpectedly (${reason}).`, 'Restart', 'Show Output')
                        .then((action) => {
                        if (action === 'Restart') {
                            this.start();
                        }
                        else if (action === 'Show Output') {
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
                this.outputChannel.appendLine(`Server started (PID: ${this.process.pid}).`);
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            this.info = { state: 'error', errorMessage: message };
            this.outputChannel.appendLine(`Failed to start server: ${message}`);
            vscode.window.showErrorMessage(`GitPride: Failed to start server — ${message}`);
        }
    }
    stop() {
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
            }
            catch {
                // Process may have already exited
            }
        }, 5000);
        proc.once('exit', () => {
            clearTimeout(killTimeout);
            this.info = { state: 'stopped' };
            this.outputChannel.appendLine('Server stopped.');
        });
    }
    async restart() {
        this.stop();
        // Wait briefly for the process to exit
        await new Promise((resolve) => setTimeout(resolve, 500));
        return this.start();
    }
    dispose() {
        this.stop();
        for (const d of this.disposables) {
            d.dispose();
        }
    }
}
exports.ServerManager = ServerManager;
//# sourceMappingURL=serverManager.js.map