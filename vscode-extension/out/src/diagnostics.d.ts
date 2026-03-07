import * as vscode from 'vscode';
import { ServerManager } from './serverManager';
export declare function showStatus(manager: ServerManager): void;
export declare function showDiagnostics(manager: ServerManager, outputChannel: vscode.OutputChannel): Promise<void>;
