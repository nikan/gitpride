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
/**
 * Unit tests for diagnostics module.
 */
const vitest_1 = require("vitest");
const fs = __importStar(require("fs"));
vitest_1.vi.mock('vscode', () => ({
    workspace: {
        workspaceFolders: [
            { uri: { fsPath: '/test/workspace' }, name: 'test', index: 0 },
        ],
        getConfiguration: vitest_1.vi.fn(() => ({
            get: vitest_1.vi.fn((key) => {
                const defaults = {
                    configPath: '',
                    startupMode: 'manual',
                    serverCommand: 'npx gitpride',
                    minimumVersion: '0.1.0',
                };
                return defaults[key];
            }),
        })),
    },
    window: {
        showInformationMessage: vitest_1.vi.fn(),
        showWarningMessage: vitest_1.vi.fn(),
        showErrorMessage: vitest_1.vi.fn(),
    },
}));
vitest_1.vi.mock('child_process', () => ({
    execSync: vitest_1.vi.fn((cmd) => {
        if (cmd === 'node --version')
            return 'v20.11.0';
        if (cmd === 'git --version')
            return 'git version 2.43.0';
        if (cmd === 'npx --version')
            return '10.2.0';
        return '';
    }),
    spawn: vitest_1.vi.fn(),
}));
vitest_1.vi.mock('../../src/serverManager', () => ({
    ServerManager: vitest_1.vi.fn(),
}));
const diagnostics_1 = require("../../src/diagnostics");
(0, vitest_1.describe)('showStatus', () => {
    (0, vitest_1.it)('displays server state', async () => {
        const vscode = await Promise.resolve().then(() => __importStar(require('vscode')));
        const manager = {
            getInfo: vitest_1.vi.fn(() => ({
                state: 'running',
                pid: 12345,
                startedAt: new Date('2026-01-01'),
            })),
        };
        (0, diagnostics_1.showStatus)(manager);
        (0, vitest_1.expect)(vscode.window.showInformationMessage).toHaveBeenCalledWith(vitest_1.expect.stringContaining('running'));
        (0, vitest_1.expect)(vscode.window.showInformationMessage).toHaveBeenCalledWith(vitest_1.expect.stringContaining('12345'));
    });
    (0, vitest_1.it)('shows stopped state with exit info', async () => {
        const vscode = await Promise.resolve().then(() => __importStar(require('vscode')));
        const manager = {
            getInfo: vitest_1.vi.fn(() => ({
                state: 'stopped',
                exitCode: 1,
                errorMessage: 'ENOENT',
            })),
        };
        (0, diagnostics_1.showStatus)(manager);
        (0, vitest_1.expect)(vscode.window.showInformationMessage).toHaveBeenCalledWith(vitest_1.expect.stringContaining('stopped'));
    });
});
(0, vitest_1.describe)('showDiagnostics', () => {
    let outputChannel;
    (0, vitest_1.beforeEach)(() => {
        outputChannel = {
            appendLine: vitest_1.vi.fn(),
            show: vitest_1.vi.fn(),
        };
        vitest_1.vi.spyOn(fs, 'existsSync');
        vitest_1.vi.spyOn(fs, 'readFileSync');
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)('runs diagnostics and outputs to channel', async () => {
        const manager = {
            getInfo: vitest_1.vi.fn(() => ({ state: 'stopped' })),
        };
        vitest_1.vi.mocked(fs.existsSync).mockReturnValue(false);
        await (0, diagnostics_1.showDiagnostics)(manager, outputChannel);
        (0, vitest_1.expect)(outputChannel.appendLine).toHaveBeenCalled();
        (0, vitest_1.expect)(outputChannel.show).toHaveBeenCalled();
        const output = vitest_1.vi.mocked(outputChannel.appendLine).mock.calls[0][0];
        (0, vitest_1.expect)(output).toContain('GitPride Diagnostics');
        (0, vitest_1.expect)(output).toContain('Node.js');
    });
    (0, vitest_1.it)('reports Node.js version check results', async () => {
        const manager = {
            getInfo: vitest_1.vi.fn(() => ({ state: 'stopped' })),
        };
        vitest_1.vi.mocked(fs.existsSync).mockReturnValue(false);
        await (0, diagnostics_1.showDiagnostics)(manager, outputChannel);
        const output = vitest_1.vi.mocked(outputChannel.appendLine).mock.calls[0][0];
        (0, vitest_1.expect)(output).toContain('✅ Node.js: v20.11.0');
    });
});
//# sourceMappingURL=diagnostics.test.js.map