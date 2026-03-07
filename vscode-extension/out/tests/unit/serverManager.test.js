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
 * Unit tests for ServerManager module.
 *
 * Tests lifecycle management logic with mocked child_process.
 */
const vitest_1 = require("vitest");
const events_1 = require("events");
// Mock vscode
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
        showInformationMessage: vitest_1.vi.fn(() => Promise.resolve(undefined)),
        showWarningMessage: vitest_1.vi.fn(() => Promise.resolve(undefined)),
        showErrorMessage: vitest_1.vi.fn(() => Promise.resolve(undefined)),
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
function createMockProcess() {
    const proc = new events_1.EventEmitter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proc.stdout = new events_1.EventEmitter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proc.stderr = new events_1.EventEmitter();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    proc.stdin = new events_1.EventEmitter();
    proc.kill = vitest_1.vi.fn().mockReturnValue(true);
    proc.pid = 12345;
    return proc;
}
let mockProcess;
vitest_1.vi.mock('child_process', () => ({
    spawn: vitest_1.vi.fn(() => {
        mockProcess = createMockProcess();
        return mockProcess;
    }),
}));
vitest_1.vi.mock('../../src/configBootstrap', () => ({
    resolveConfigPath: vitest_1.vi.fn(() => ''),
}));
const serverManager_1 = require("../../src/serverManager");
(0, vitest_1.describe)('ServerManager', () => {
    let manager;
    let outputChannel;
    (0, vitest_1.beforeEach)(() => {
        outputChannel = {
            appendLine: vitest_1.vi.fn(),
            show: vitest_1.vi.fn(),
            dispose: vitest_1.vi.fn(),
        };
        manager = new serverManager_1.ServerManager(outputChannel);
    });
    (0, vitest_1.afterEach)(() => {
        manager.dispose();
        vitest_1.vi.clearAllMocks();
    });
    (0, vitest_1.it)('starts in stopped state', () => {
        const info = manager.getInfo();
        (0, vitest_1.expect)(info.state).toBe('stopped');
    });
    (0, vitest_1.it)('transitions to running after start', async () => {
        await manager.start();
        const info = manager.getInfo();
        (0, vitest_1.expect)(info.state).toBe('running');
        (0, vitest_1.expect)(info.pid).toBe(12345);
        (0, vitest_1.expect)(info.startedAt).toBeInstanceOf(Date);
    });
    (0, vitest_1.it)('prevents duplicate starts', async () => {
        const vscode = await Promise.resolve().then(() => __importStar(require('vscode')));
        await manager.start();
        await manager.start();
        (0, vitest_1.expect)(vscode.window.showWarningMessage).toHaveBeenCalledWith(vitest_1.expect.stringContaining('already'));
    });
    (0, vitest_1.it)('stops a running server', async () => {
        await manager.start();
        (0, vitest_1.expect)(manager.getInfo().state).toBe('running');
        manager.stop();
        (0, vitest_1.expect)(mockProcess.kill).toHaveBeenCalledWith('SIGTERM');
    });
    (0, vitest_1.it)('restart stops then starts', async () => {
        await manager.start();
        const exitPromise = manager.restart();
        mockProcess.emit('exit', 0, null);
        await exitPromise;
        const info = manager.getInfo();
        (0, vitest_1.expect)(info.state).toBe('running');
    });
    (0, vitest_1.it)('detects process crash and offers restart', async () => {
        const vscode = await Promise.resolve().then(() => __importStar(require('vscode')));
        await manager.start();
        mockProcess.emit('exit', 1, null);
        (0, vitest_1.expect)(vscode.window.showWarningMessage).toHaveBeenCalledWith(vitest_1.expect.stringContaining('exited unexpectedly'), 'Restart', 'Show Output');
    });
    (0, vitest_1.it)('handles process error events', async () => {
        const vscode = await Promise.resolve().then(() => __importStar(require('vscode')));
        await manager.start();
        mockProcess.emit('error', new Error('ENOENT'));
        const info = manager.getInfo();
        (0, vitest_1.expect)(info.state).toBe('error');
        (0, vitest_1.expect)(info.errorMessage).toBe('ENOENT');
    });
    (0, vitest_1.it)('returns a copy of info (not mutable reference)', () => {
        const info1 = manager.getInfo();
        const info2 = manager.getInfo();
        (0, vitest_1.expect)(info1).not.toBe(info2);
        (0, vitest_1.expect)(info1).toEqual(info2);
    });
});
//# sourceMappingURL=serverManager.test.js.map