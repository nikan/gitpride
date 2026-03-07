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
exports.resolveConfigPath = resolveConfigPath;
exports.bootstrapMcpConfig = bootstrapMcpConfig;
exports.createStarterConfig = createStarterConfig;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const GITPRIDE_MCP_ENTRY = {
    command: 'npx',
    args: ['gitpride'],
    env: {},
};
const STARTER_COMMANDS_CONFIG = {
    $schema: 'https://raw.githubusercontent.com/nikan/gitpride/main/src/config/schema.json',
    commands: [
        {
            name: 'git_status',
            description: 'Show the working tree status',
            command: 'git',
            args: ['status'],
            allowExtraArgs: false,
        },
        {
            name: 'git_log',
            description: 'Show commit logs',
            command: 'git',
            args: ['log', '--oneline'],
            allowExtraArgs: true,
            extraArgsSchema: {
                type: 'object',
                properties: {
                    limit: {
                        type: 'number',
                        description: 'Maximum number of commits to show',
                        default: 20,
                    },
                },
            },
        },
        {
            name: 'git_diff',
            description: 'Show changes between commits, commit and working tree, etc.',
            command: 'git',
            args: ['diff'],
            allowExtraArgs: true,
            extraArgsSchema: {
                type: 'object',
                properties: {
                    ref: {
                        type: 'string',
                        description: 'Git ref to diff against (e.g. HEAD~1, branch name)',
                    },
                    staged: {
                        type: 'boolean',
                        description: 'Show staged changes (--cached)',
                        default: false,
                    },
                },
            },
        },
        {
            name: 'git_branch',
            description: 'List branches',
            command: 'git',
            args: ['branch'],
            allowExtraArgs: true,
            extraArgsSchema: {
                type: 'object',
                properties: {
                    all: {
                        type: 'boolean',
                        description: 'List both remote-tracking and local branches',
                        default: false,
                    },
                },
            },
        },
        {
            name: 'git_show',
            description: 'Show a commit or object',
            command: 'git',
            args: ['show'],
            allowExtraArgs: true,
            extraArgsSchema: {
                type: 'object',
                properties: {
                    ref: {
                        type: 'string',
                        description: 'Commit SHA or ref to show',
                        default: 'HEAD',
                    },
                },
            },
        },
    ],
};
/**
 * Resolve the config path from settings or workspace root.
 */
function resolveConfigPath(config) {
    const explicit = config.get('configPath');
    if (explicit && explicit.trim() !== '') {
        if (path.isAbsolute(explicit)) {
            return explicit;
        }
        const wsRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        return wsRoot ? path.join(wsRoot, explicit) : explicit;
    }
    return '';
}
/**
 * Bootstrap .vscode/mcp.json with gitpride server entry.
 * Merges safely with existing config — never overwrites other servers.
 */
async function bootstrapMcpConfig(outputChannel) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('GitPride: No workspace folder open. Open a folder first.');
        return;
    }
    const vscodeDirPath = path.join(workspaceFolder.uri.fsPath, '.vscode');
    const mcpJsonPath = path.join(vscodeDirPath, 'mcp.json');
    const config = vscode.workspace.getConfiguration('gitpride');
    const serverCommand = config.get('serverCommand') || 'npx gitpride';
    const [cmd, ...args] = serverCommand.split(/\s+/);
    const configPath = resolveConfigPath(config);
    const entry = {
        command: cmd,
        args: args,
        env: configPath ? { GITPRIDE_CONFIG: configPath } : {},
    };
    try {
        // Ensure .vscode directory exists
        if (!fs.existsSync(vscodeDirPath)) {
            fs.mkdirSync(vscodeDirPath, { recursive: true });
        }
        let mcpConfig = {};
        if (fs.existsSync(mcpJsonPath)) {
            const existing = fs.readFileSync(mcpJsonPath, 'utf-8');
            try {
                mcpConfig = JSON.parse(existing);
            }
            catch {
                const overwrite = await vscode.window.showWarningMessage('GitPride: Existing .vscode/mcp.json is not valid JSON. Overwrite?', 'Overwrite', 'Cancel');
                if (overwrite !== 'Overwrite') {
                    outputChannel.appendLine('MCP config bootstrap cancelled by user.');
                    return;
                }
                mcpConfig = {};
            }
        }
        // Ensure servers key exists
        if (!mcpConfig.servers ||
            typeof mcpConfig.servers !== 'object' ||
            Array.isArray(mcpConfig.servers)) {
            mcpConfig.servers = {};
        }
        const servers = mcpConfig.servers;
        if (servers['gitpride']) {
            const overwrite = await vscode.window.showWarningMessage('GitPride: A "gitpride" entry already exists in .vscode/mcp.json. Overwrite?', 'Overwrite', 'Cancel');
            if (overwrite !== 'Overwrite') {
                outputChannel.appendLine('MCP config bootstrap cancelled — existing entry preserved.');
                return;
            }
        }
        servers['gitpride'] = entry;
        mcpConfig.servers = servers;
        fs.writeFileSync(mcpJsonPath, JSON.stringify(mcpConfig, null, 2) + '\n');
        outputChannel.appendLine(`MCP config written to ${mcpJsonPath}`);
        vscode.window.showInformationMessage(`GitPride: .vscode/mcp.json updated with gitpride server entry.`);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Failed to bootstrap MCP config: ${message}`);
        vscode.window.showErrorMessage(`GitPride: Failed to write .vscode/mcp.json — ${message}`);
    }
}
/**
 * Create a starter commands.config.json in the workspace root.
 * Does not overwrite if the file already exists.
 */
async function createStarterConfig(outputChannel) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('GitPride: No workspace folder open. Open a folder first.');
        return;
    }
    const configPath = path.join(workspaceFolder.uri.fsPath, 'commands.config.json');
    if (fs.existsSync(configPath)) {
        const overwrite = await vscode.window.showWarningMessage('GitPride: commands.config.json already exists. Overwrite?', 'Overwrite', 'Cancel');
        if (overwrite !== 'Overwrite') {
            outputChannel.appendLine('Starter config creation cancelled — existing file preserved.');
            return;
        }
    }
    try {
        fs.writeFileSync(configPath, JSON.stringify(STARTER_COMMANDS_CONFIG, null, 2) + '\n');
        outputChannel.appendLine(`Starter config written to ${configPath}`);
        vscode.window.showInformationMessage(`GitPride: commands.config.json created in workspace root.`);
        // Open the file for the user
        const doc = await vscode.workspace.openTextDocument(configPath);
        await vscode.window.showTextDocument(doc);
    }
    catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        outputChannel.appendLine(`Failed to create starter config: ${message}`);
        vscode.window.showErrorMessage(`GitPride: Failed to create commands.config.json — ${message}`);
    }
}
//# sourceMappingURL=configBootstrap.js.map