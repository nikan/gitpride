import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from '../../src/server/logger.js';

describe('Logger', () => {
  let stderrSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrSpy.mockRestore();
  });

  it('should write JSON to stderr', () => {
    const log = new Logger('test', 'debug');
    log.info('hello');

    expect(stderrSpy).toHaveBeenCalledOnce();

    const output = stderrSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed).toMatchObject({
      level: 'info',
      name: 'test',
      message: 'hello',
    });
    expect(parsed.timestamp).toBeDefined();
  });

  it('should include data when provided', () => {
    const log = new Logger('test', 'debug');
    log.warn('oops', { key: 'value' });

    const output = stderrSpy.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);

    expect(parsed.data).toEqual({ key: 'value' });
  });

  it('should suppress messages below the configured level', () => {
    const log = new Logger('test', 'error');
    log.debug('ignored');
    log.info('ignored');
    log.warn('ignored');

    expect(stderrSpy).not.toHaveBeenCalled();

    log.error('shown');
    expect(stderrSpy).toHaveBeenCalledOnce();
  });

  it('should support all log levels', () => {
    const log = new Logger('test', 'debug');

    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');

    expect(stderrSpy).toHaveBeenCalledTimes(4);

    const levels = stderrSpy.mock.calls.map((c) => JSON.parse(c[0] as string).level);
    expect(levels).toEqual(['debug', 'info', 'warn', 'error']);
  });

  it('should default to info level when LOG_LEVEL is unset', () => {
    const original = process.env.LOG_LEVEL;
    delete process.env.LOG_LEVEL;
    try {
      const log = new Logger('test');
      log.debug('ignored');
      expect(stderrSpy).not.toHaveBeenCalled();

      log.info('shown');
      expect(stderrSpy).toHaveBeenCalledOnce();
    } finally {
      if (original !== undefined) process.env.LOG_LEVEL = original;
    }
  });
});
