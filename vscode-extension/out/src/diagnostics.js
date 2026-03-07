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
exports.showStatus = showStatus;
exports.showDiagnostics = showDiagnostics;
const vscode = __importStar(require("vscode"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
function showStatus(manager) {
    const info = manager.getInfo();
    const lines = [`Server State: ${info.state}`];
    if (info.pid) {
        lines.push(`PID: ${info.pid}`);
    }
    if (info.startedAt) {
        lines.push(`Started: ${info.startedAt.toLocaleString()}`);
    }
    if (info.exitCode !== undefined && info.exitCode !== null) {
        lines.push(`Last Exit Code: ${info.exitCode}`);
    }
    if (info.exitSignal) {
        lines.push(`Last Exit Signal: ${info.exitSignal}`);
    }
    if (info.errorMessage) {
        lines.push(`Error: ${info.errorMessage}`);
    }
    vscode.window.showInformationMessage(`GitPride: ${lines.join(' | ')}`);
}
async function showDiagnostics(manager, outputChannel) {
    const results = ['=== GitPride Diagnostics ===', ''];
    // 1. Check Node.js
    try {
        const nodeVersion = (0, child_process_1.execSync)('node --version', { encoding: 'utf-8' }).trim();
        const major = parseInt(nodeVersion.replace('v', '').split('.')[0], 10);
        if (major >= 20) {
            results.push(`✅ Node.js: ${nodeVersion}`);
        }
        else {
            results.push(`⚠️  Node.js: ${nodeVersion} (gitpride requires >=20.0.0)`, '   → Install Node.js 20+ from https://nodejs.org/');
        }
    }
    catch {
        results.push('❌ Node.js: not found on PATH', '   → Install Node.js 20+ from https://nodejs.org/');
    }
    // 2. Check git
    try {
        const gitVersion = (0, child_process_1.execSync)('git --version', { encoding: 'utf-8' }).trim();
        results.push(`✅ git: ${gitVersion}`);
    }
    catch {
        results.push('❌ git: not found on PATH', '   → Install git from https://git-scm.com/');
    }
    // 3. Check npx / gitpride availability
    try {
        const npxVersion = (0, child_process_1.execSync)('npx --version', { encoding: 'utf-8' }).trim();
        results.push(`✅ npx: ${npxVersion}`);
    }
    catch {
        results.push('❌ npx: not found on PATH', '   → npx is included with npm. Install Node.js or run: npm install -g npm');
    }
    // 4. Check workspace
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        results.push(`✅ Workspace: ${workspaceFolder.uri.fsPath}`);
        // Check .git
        const gitDir = path.join(workspaceFolder.uri.fsPath, '.git');
        if (fs.existsSync(gitDir)) {
            results.push('✅ Git repository detected');
        }
        else {
            results.push('⚠️  No .git directory found in workspace root', '   → Run: git init');
        }
        // Check commands.config.json
        const config = vscode.workspace.getConfiguration('gitpride');
        const explicitPath = config.get('configPath');
        const configFile = explicitPath && explicitPath.trim() !== ''
            ? path.isAbsolute(explicitPath)
                ? explicitPath
                : path.join(workspaceFolder.uri.fsPath, explicitPath)
            : path.join(workspaceFolder.uri.fsPath, 'commands.config.json');
        if (fs.existsSync(configFile)) {
            try {
                const content = fs.readFileSync(configFile, 'utf-8');
                JSON.parse(content);
                results.push(`✅ Config file: ${configFile}`);
            }
            catch {
                results.push(`❌ Config file is not valid JSON: ${configFile}`, '   → Check for syntax errors in the file');
            }
        }
        else {
            results.push(`⚠️  Config file not found: ${configFile}`, '   → Run "GitPride: Create Starter commands.config.json" to generate one');
        }
        // Check .vscode/mcp.json
        const mcpJsonPath = path.join(workspaceFolder.uri.fsPath, '.vscode', 'mcp.json');
        if (fs.existsSync(mcpJsonPath)) {
            try {
                const content = fs.readFileSync(mcpJsonPath, 'utf-8');
                const mcpConfig = JSON.parse(content);
                const servers = mcpConfig.servers;
                if (servers && servers['gitpride']) {
                    results.push('✅ MCP config: gitpride entry present');
                }
                else {
                    results.push('⚠️  MCP config exists but missing "gitpride" server entry', '   → Run "GitPride: Bootstrap MCP Configuration"');
                }
            }
            catch {
                results.push('❌ .vscode/mcp.json is not valid JSON', '   → Fix or delete the file, then run "GitPride: Bootstrap MCP Configuration"');
            }
        }
        else {
            results.push('⚠️  .vscode/mcp.json not found', '   → Run "GitPride: Bootstrap MCP Configuration"');
        }
    }
    else {
        results.push('❌ No workspace folder open', '   → Open a folder in VS Code');
    }
    // 5. Server state
    const info = manager.getInfo();
    results.push('');
    results.push(`Server state: ${info.state}`);
    if (info.pid)
        results.push(`  PID: ${info.pid}`);
    if (info.errorMessage)
        results.push(`  Error: ${info.errorMessage}`);
    // 6. Settings
    results.push('');
    results.push('Settings:');
    const config = vscode.workspace.getConfiguration('gitpride');
    results.push(`  configPath: "${config.get('configPath') || '(default)'}"`);
    results.push(`  startupMode: "${config.get('startupMode')}"`);
    results.push(`  serverCommand: "${config.get('serverCommand')}"`);
    results.push(`  minimumVersion: "${config.get('minimumVersion')}"`);
    const output = results.join('\n');
    outputChannel.appendLine(output);
    outputChannel.show();
}
//# sourceMappingURL=diagnostics.js.map