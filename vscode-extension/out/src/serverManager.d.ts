import * as vscode from 'vscode';
export type ServerState = 'stopped' | 'starting' | 'running' | 'error';
export interface ServerInfo {
    state: ServerState;
    pid?: number;
    exitCode?: number | null;
    exitSignal?: string | null;
    errorMessage?: string;
    startedAt?: Date;
}
export declare class ServerManager {
    private process;
    private info;
    private outputChannel;
    private disposables;
    constructor(outputChannel: vscode.OutputChannel);
    getInfo(): ServerInfo;
    start(): Promise<void>;
    stop(): void;
    restart(): Promise<void>;
    dispose(): void;
}
