import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  createServer,
  installShutdownHandlers,
  SERVER_NAME,
  SERVER_VERSION,
} from '../../src/index.js';

// Suppress logger output during tests
vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

describe('createServer', () => {
  it('should return a server and registry', () => {
    const { server, registry } = createServer();
    expect(server).toBeDefined();
    expect(registry).toBeDefined();
    expect(registry.size).toBe(0);
  });
});

describe('installShutdownHandlers', () => {
  afterEach(() => {
    // Remove any leftover listeners that tests may have added
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGTERM');
  });

  it('should call exitFn(0) on SIGINT', async () => {
    const { server } = createServer();
    const exitFn = vi.fn();

    installShutdownHandlers(server, exitFn);
    process.emit('SIGINT');

    // Allow the async shutdown to complete
    await new Promise((r) => setTimeout(r, 50));
    expect(exitFn).toHaveBeenCalledWith(0);
  });

  it('should call exitFn(0) on SIGTERM', async () => {
    const { server } = createServer();
    const exitFn = vi.fn();

    installShutdownHandlers(server, exitFn);
    process.emit('SIGTERM');

    await new Promise((r) => setTimeout(r, 50));
    expect(exitFn).toHaveBeenCalledWith(0);
  });

  it('should only shut down once on repeated signals', async () => {
    const { server } = createServer();
    const exitFn = vi.fn();

    installShutdownHandlers(server, exitFn);
    process.emit('SIGINT');
    process.emit('SIGINT');

    await new Promise((r) => setTimeout(r, 50));
    expect(exitFn).toHaveBeenCalledTimes(1);
  });

  it('should return a cleanup function that removes handlers', () => {
    const { server } = createServer();
    const exitFn = vi.fn();

    const cleanup = installShutdownHandlers(server, exitFn);
    const beforeCount = process.listenerCount('SIGINT');

    cleanup();
    const afterCount = process.listenerCount('SIGINT');

    expect(afterCount).toBeLessThan(beforeCount);
  });
});

describe('smoke tests (preserved from Epic 1)', () => {
  it('should export the server name', () => {
    expect(SERVER_NAME).toBe('gitpride');
  });

  it('should export a valid semver version', () => {
    expect(SERVER_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
