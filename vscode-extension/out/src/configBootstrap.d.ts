import * as vscode from 'vscode';
/**
 * Resolve the config path from settings or workspace root.
 */
export declare function resolveConfigPath(config: vscode.WorkspaceConfiguration): string;
/**
 * Bootstrap .vscode/mcp.json with gitpride server entry.
 * Merges safely with existing config — never overwrites other servers.
 */
export declare function bootstrapMcpConfig(outputChannel: vscode.OutputChannel): Promise<void>;
/**
 * Create a starter commands.config.json in the workspace root.
 * Does not overwrite if the file already exists.
 */
export declare function createStarterConfig(outputChannel: vscode.OutputChannel): Promise<void>;
