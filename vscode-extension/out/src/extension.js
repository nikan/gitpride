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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const serverManager_1 = require("./serverManager");
const configBootstrap_1 = require("./configBootstrap");
const diagnostics_1 = require("./diagnostics");
let serverManager;
function activate(context) {
    const outputChannel = vscode.window.createOutputChannel('GitPride');
    serverManager = new serverManager_1.ServerManager(outputChannel);
    context.subscriptions.push(outputChannel, vscode.commands.registerCommand('gitpride.bootstrapMcpConfig', () => (0, configBootstrap_1.bootstrapMcpConfig)(outputChannel)), vscode.commands.registerCommand('gitpride.createStarterConfig', () => (0, configBootstrap_1.createStarterConfig)(outputChannel)), vscode.commands.registerCommand('gitpride.startServer', () => serverManager.start()), vscode.commands.registerCommand('gitpride.stopServer', () => serverManager.stop()), vscode.commands.registerCommand('gitpride.restartServer', () => serverManager.restart()), vscode.commands.registerCommand('gitpride.showStatus', () => (0, diagnostics_1.showStatus)(serverManager)), vscode.commands.registerCommand('gitpride.showDiagnostics', () => (0, diagnostics_1.showDiagnostics)(serverManager, outputChannel)));
    const config = vscode.workspace.getConfiguration('gitpride');
    if (config.get('startupMode') === 'auto') {
        serverManager.start();
    }
    outputChannel.appendLine('GitPride extension activated.');
}
function deactivate() {
    if (serverManager) {
        serverManager.stop();
    }
}
//# sourceMappingURL=extension.js.map