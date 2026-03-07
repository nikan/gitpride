import * as vscode from 'vscode';
import { ServerManager } from './serverManager';
import { bootstrapMcpConfig, createStarterConfig } from './configBootstrap';
import { showDiagnostics, showStatus } from './diagnostics';

let serverManager: ServerManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('GitPride');
  serverManager = new ServerManager(outputChannel);

  context.subscriptions.push(
    outputChannel,
    vscode.commands.registerCommand('gitpride.bootstrapMcpConfig', () =>
      bootstrapMcpConfig(outputChannel)
    ),
    vscode.commands.registerCommand('gitpride.createStarterConfig', () =>
      createStarterConfig(outputChannel)
    ),
    vscode.commands.registerCommand('gitpride.startServer', () =>
      serverManager!.start()
    ),
    vscode.commands.registerCommand('gitpride.stopServer', () =>
      serverManager!.stop()
    ),
    vscode.commands.registerCommand('gitpride.restartServer', () =>
      serverManager!.restart()
    ),
    vscode.commands.registerCommand('gitpride.showStatus', () =>
      showStatus(serverManager!)
    ),
    vscode.commands.registerCommand('gitpride.showDiagnostics', () =>
      showDiagnostics(serverManager!, outputChannel)
    )
  );

  const config = vscode.workspace.getConfiguration('gitpride');
  if (config.get<string>('startupMode') === 'auto') {
    serverManager.start();
  }

  outputChannel.appendLine('GitPride extension activated.');
}

export function deactivate(): void {
  if (serverManager) {
    serverManager.stop();
  }
}
