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
 * Unit tests for configBootstrap module.
 *
 * These tests exercise the pure-logic functions without requiring the
 * VS Code API — we mock vscode and fs as needed.
 */
const vitest_1 = require("vitest");
const path = __importStar(require("path"));
// Track fs mock state per test
let fsState;
vitest_1.vi.mock('fs', () => ({
    existsSync: vitest_1.vi.fn((...args) => fsState.existsSync(String(args[0]))),
    readFileSync: vitest_1.vi.fn((...args) => fsState.readFileSync(String(args[0]))),
    writeFileSync: vitest_1.vi.fn((...args) => fsState.writeFileSync(...args)),
    mkdirSync: vitest_1.vi.fn((...args) => fsState.mkdirSync(...args)),
}));
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
        openTextDocument: vitest_1.vi.fn(() => Promise.resolve({})),
    },
    window: {
        showInformationMessage: vitest_1.vi.fn(() => Promise.resolve(undefined)),
        showWarningMessage: vitest_1.vi.fn(() => Promise.resolve(undefined)),
        showErrorMessage: vitest_1.vi.fn(() => Promise.resolve(undefined)),
        showTextDocument: vitest_1.vi.fn(() => Promise.resolve()),
        createOutputChannel: vitest_1.vi.fn(() => ({
            appendLine: vitest_1.vi.fn(),
            show: vitest_1.vi.fn(),
            dispose: vitest_1.vi.fn(),
        })),
    },
    commands: {
        registerCommand: vitest_1.vi.fn(),
    },
}));
const configBootstrap_1 = require("../../src/configBootstrap");
const fs = __importStar(require("fs"));
(0, vitest_1.describe)('resolveConfigPath', () => {
    (0, vitest_1.it)('returns empty string when no explicit path is set', () => {
        const config = {
            get: vitest_1.vi.fn((key) => {
                if (key === 'configPath')
                    return '';
                return undefined;
            }),
        };
        (0, vitest_1.expect)((0, configBootstrap_1.resolveConfigPath)(config)).toBe('');
    });
    (0, vitest_1.it)('returns absolute path as-is', () => {
        const config = {
            get: vitest_1.vi.fn((key) => {
                if (key === 'configPath')
                    return '/absolute/path/config.json';
                return undefined;
            }),
        };
        (0, vitest_1.expect)((0, configBootstrap_1.resolveConfigPath)(config)).toBe('/absolute/path/config.json');
    });
    (0, vitest_1.it)('resolves relative path against workspace root', () => {
        const config = {
            get: vitest_1.vi.fn((key) => {
                if (key === 'configPath')
                    return 'my-config.json';
                return undefined;
            }),
        };
        const result = (0, configBootstrap_1.resolveConfigPath)(config);
        (0, vitest_1.expect)(result).toBe(path.join('/test/workspace', 'my-config.json'));
    });
});
(0, vitest_1.describe)('bootstrapMcpConfig', () => {
    let mockOutputChannel;
    (0, vitest_1.beforeEach)(() => {
        mockOutputChannel = { appendLine: vitest_1.vi.fn(), show: vitest_1.vi.fn() };
        vitest_1.vi.clearAllMocks();
        fsState = {
            existsSync: () => false,
            readFileSync: () => '{}',
            writeFileSync: vitest_1.vi.fn(),
            mkdirSync: vitest_1.vi.fn(),
        };
    });
    (0, vitest_1.it)('creates .vscode/mcp.json with gitpride entry when no file exists', async () => {
        fsState.existsSync = () => false;
        await (0, configBootstrap_1.bootstrapMcpConfig)(mockOutputChannel);
        (0, vitest_1.expect)(fs.writeFileSync).toHaveBeenCalled();
        const calls = vitest_1.vi.mocked(fs.writeFileSync).mock.calls;
        const writtenPath = calls[0][0];
        const writtenContent = JSON.parse(calls[0][1]);
        (0, vitest_1.expect)(writtenPath).toContain('mcp.json');
        (0, vitest_1.expect)(writtenContent.servers).toBeDefined();
        (0, vitest_1.expect)(writtenContent.servers.gitpride).toBeDefined();
        (0, vitest_1.expect)(writtenContent.servers.gitpride.command).toBe('npx');
        (0, vitest_1.expect)(writtenContent.servers.gitpride.args).toEqual(['gitpride']);
    });
    (0, vitest_1.it)('merges with existing mcp.json preserving other servers', async () => {
        const existingConfig = {
            servers: { 'other-server': { command: 'other', args: [] } },
        };
        fsState.existsSync = () => true;
        fsState.readFileSync = () => JSON.stringify(existingConfig);
        await (0, configBootstrap_1.bootstrapMcpConfig)(mockOutputChannel);
        (0, vitest_1.expect)(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = JSON.parse(vitest_1.vi.mocked(fs.writeFileSync).mock.calls[0][1]);
        (0, vitest_1.expect)(writtenContent.servers['other-server']).toBeDefined();
        (0, vitest_1.expect)(writtenContent.servers['gitpride']).toBeDefined();
    });
    (0, vitest_1.it)('shows error when no workspace folder is open', async () => {
        const vscode = await Promise.resolve().then(() => __importStar(require('vscode')));
        const original = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: undefined,
            writable: true,
            configurable: true,
        });
        await (0, configBootstrap_1.bootstrapMcpConfig)(mockOutputChannel);
        (0, vitest_1.expect)(vscode.window.showErrorMessage).toHaveBeenCalledWith(vitest_1.expect.stringContaining('No workspace folder'));
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: original,
            writable: true,
            configurable: true,
        });
    });
});
(0, vitest_1.describe)('createStarterConfig', () => {
    let mockOutputChannel;
    (0, vitest_1.beforeEach)(() => {
        mockOutputChannel = { appendLine: vitest_1.vi.fn(), show: vitest_1.vi.fn() };
        vitest_1.vi.clearAllMocks();
        fsState = {
            existsSync: () => false,
            readFileSync: () => '{}',
            writeFileSync: vitest_1.vi.fn(),
            mkdirSync: vitest_1.vi.fn(),
        };
    });
    (0, vitest_1.it)('creates commands.config.json when file does not exist', async () => {
        fsState.existsSync = () => false;
        await (0, configBootstrap_1.createStarterConfig)(mockOutputChannel);
        (0, vitest_1.expect)(fs.writeFileSync).toHaveBeenCalled();
        const calls = vitest_1.vi.mocked(fs.writeFileSync).mock.calls;
        const writtenPath = calls[0][0];
        const writtenContent = JSON.parse(calls[0][1]);
        (0, vitest_1.expect)(writtenPath).toContain('commands.config.json');
        (0, vitest_1.expect)(writtenContent.commands).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(writtenContent.commands)).toBe(true);
        (0, vitest_1.expect)(writtenContent.commands.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(writtenContent.commands[0].name).toBe('git_status');
    });
});
//# sourceMappingURL=configBootstrap.test.js.map