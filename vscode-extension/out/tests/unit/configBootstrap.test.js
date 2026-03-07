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
 * VS Code API — we mock vscode, fs, and path as needed.
 */
const vitest_1 = require("vitest");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// Mock vscode module
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
        showInformationMessage: vitest_1.vi.fn(),
        showWarningMessage: vitest_1.vi.fn(),
        showErrorMessage: vitest_1.vi.fn(),
        showTextDocument: vitest_1.vi.fn(),
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
        mockOutputChannel = {
            appendLine: vitest_1.vi.fn(),
            show: vitest_1.vi.fn(),
        };
        vitest_1.vi.spyOn(fs, 'existsSync');
        vitest_1.vi.spyOn(fs, 'mkdirSync');
        vitest_1.vi.spyOn(fs, 'readFileSync');
        vitest_1.vi.spyOn(fs, 'writeFileSync');
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)('creates .vscode/mcp.json with gitpride entry when no file exists', async () => {
        const { bootstrapMcpConfig } = await Promise.resolve().then(() => __importStar(require('../../src/configBootstrap')));
        const vscode = await Promise.resolve().then(() => __importStar(require('vscode')));
        vitest_1.vi.mocked(fs.existsSync).mockImplementation((p) => {
            const filePath = typeof p === 'string' ? p : p.toString();
            if (filePath.endsWith('.vscode'))
                return false;
            if (filePath.endsWith('mcp.json'))
                return false;
            return false;
        });
        vitest_1.vi.mocked(fs.mkdirSync).mockReturnValue(undefined);
        vitest_1.vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
        await bootstrapMcpConfig(mockOutputChannel);
        (0, vitest_1.expect)(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = vitest_1.vi.mocked(fs.writeFileSync).mock.calls[0];
        const writtenPath = writeCall[0];
        const writtenContent = JSON.parse(writeCall[1]);
        (0, vitest_1.expect)(writtenPath).toContain('mcp.json');
        (0, vitest_1.expect)(writtenContent.servers).toBeDefined();
        (0, vitest_1.expect)(writtenContent.servers.gitpride).toBeDefined();
        (0, vitest_1.expect)(writtenContent.servers.gitpride.command).toBe('npx');
        (0, vitest_1.expect)(writtenContent.servers.gitpride.args).toEqual(['gitpride']);
    });
    (0, vitest_1.it)('merges with existing mcp.json preserving other servers', async () => {
        const { bootstrapMcpConfig } = await Promise.resolve().then(() => __importStar(require('../../src/configBootstrap')));
        const existingConfig = {
            servers: {
                'other-server': { command: 'other', args: [] },
            },
        };
        vitest_1.vi.mocked(fs.existsSync).mockReturnValue(true);
        vitest_1.vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(existingConfig));
        vitest_1.vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
        await bootstrapMcpConfig(mockOutputChannel);
        (0, vitest_1.expect)(fs.writeFileSync).toHaveBeenCalled();
        const writtenContent = JSON.parse(vitest_1.vi.mocked(fs.writeFileSync).mock.calls[0][1]);
        (0, vitest_1.expect)(writtenContent.servers['other-server']).toBeDefined();
        (0, vitest_1.expect)(writtenContent.servers['gitpride']).toBeDefined();
    });
    (0, vitest_1.it)('shows error when no workspace folder is open', async () => {
        const vscode = await Promise.resolve().then(() => __importStar(require('vscode')));
        // Temporarily clear workspace folders
        const original = vscode.workspace.workspaceFolders;
        Object.defineProperty(vscode.workspace, 'workspaceFolders', {
            value: undefined,
            writable: true,
            configurable: true,
        });
        const { bootstrapMcpConfig } = await Promise.resolve().then(() => __importStar(require('../../src/configBootstrap')));
        await bootstrapMcpConfig(mockOutputChannel);
        (0, vitest_1.expect)(vscode.window.showErrorMessage).toHaveBeenCalledWith(vitest_1.expect.stringContaining('No workspace folder'));
        // Restore
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
        mockOutputChannel = {
            appendLine: vitest_1.vi.fn(),
            show: vitest_1.vi.fn(),
        };
        vitest_1.vi.spyOn(fs, 'existsSync');
        vitest_1.vi.spyOn(fs, 'writeFileSync');
    });
    (0, vitest_1.afterEach)(() => {
        vitest_1.vi.restoreAllMocks();
    });
    (0, vitest_1.it)('creates commands.config.json when file does not exist', async () => {
        const { createStarterConfig } = await Promise.resolve().then(() => __importStar(require('../../src/configBootstrap')));
        vitest_1.vi.mocked(fs.existsSync).mockReturnValue(false);
        vitest_1.vi.mocked(fs.writeFileSync).mockReturnValue(undefined);
        await createStarterConfig(mockOutputChannel);
        (0, vitest_1.expect)(fs.writeFileSync).toHaveBeenCalled();
        const writeCall = vitest_1.vi.mocked(fs.writeFileSync).mock.calls[0];
        const writtenPath = writeCall[0];
        const writtenContent = JSON.parse(writeCall[1]);
        (0, vitest_1.expect)(writtenPath).toContain('commands.config.json');
        (0, vitest_1.expect)(writtenContent.commands).toBeDefined();
        (0, vitest_1.expect)(Array.isArray(writtenContent.commands)).toBe(true);
        (0, vitest_1.expect)(writtenContent.commands.length).toBeGreaterThan(0);
        (0, vitest_1.expect)(writtenContent.commands[0].name).toBe('git_status');
    });
});
//# sourceMappingURL=configBootstrap.test.js.map