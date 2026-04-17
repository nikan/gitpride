import * as vscode from 'vscode';
import { ServerManager } from './serverManager';
import { bootstrapMcpConfig, createStarterConfig } from './configBootstrap';
import { showDiagnostics, showStatus } from './diagnostics';

let serverManager: ServerManager | undefined;

export function activate(context: vscode.ExtensionContext): void {
  const outputChannel = vscode.window.createOutputChannel('GitPride');
  serverManager = new ServerManager(outputChannel);

  const gitprideConfig = vscode.workspace.getConfiguration('gitpride');
  const configPath = gitprideConfig.get<string>('configPath') || '';
  const serverCommand = gitprideConfig.get<string>('serverCommand') || 'npx gitpride';

  const provider: vscode.McpServerDefinitionProvider = {
    async provideMcpServerDefinitions() {
      const env: Record<string, string> = {};
      if (configPath) {
        env.GITPRIDE_CONFIG = configPath;
      }

      outputChannel.appendLine('[MCP] Registering GitPride server definition');
      return [new vscode.McpStdioServerDefinition('GitPride', 'npx', ['-y', 'gitpride'], env)];
    },
  };

  context.subscriptions.push(
    vscode.lm.registerMcpServerDefinitionProvider('gitpride.mcpServer', provider),
    outputChannel,
    vscode.commands.registerCommand('gitpride.bootstrapMcpConfig', () =>
      bootstrapMcpConfig(outputChannel),
    ),
    vscode.commands.registerCommand('gitpride.createStarterConfig', () =>
      createStarterConfig(outputChannel),
    ),
    vscode.commands.registerCommand('gitpride.startServer', () => serverManager!.start()),
    vscode.commands.registerCommand('gitpride.stopServer', () => serverManager!.stop()),
    vscode.commands.registerCommand('gitpride.restartServer', () => serverManager!.restart()),
    vscode.commands.registerCommand('gitpride.showStatus', () => showStatus(serverManager!)),
    vscode.commands.registerCommand('gitpride.showDiagnostics', () =>
      showDiagnostics(serverManager!, outputChannel),
    ),
  );

  if (gitprideConfig.get<string>('startupMode') === 'auto') {
    serverManager.start();
  }

  outputChannel.appendLine('GitPride extension activated.');
}

export function deactivate(): void {
  if (serverManager) {
    serverManager.stop();
  }
}
