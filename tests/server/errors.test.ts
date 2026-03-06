import { describe, it, expect } from 'vitest';
import {
  GitPrideError,
  ToolExecutionError,
  ToolNotFoundError,
  errorToToolResult,
} from '../../src/server/errors.js';

describe('GitPrideError', () => {
  it('should store code and message', () => {
    const err = new GitPrideError('bad thing', 'BAD_THING');
    expect(err.message).toBe('bad thing');
    expect(err.code).toBe('BAD_THING');
    expect(err.name).toBe('GitPrideError');
    expect(err).toBeInstanceOf(Error);
  });

  it('should preserve the cause', () => {
    const cause = new Error('root cause');
    const err = new GitPrideError('wrapper', 'WRAP', cause);
    expect(err.cause).toBe(cause);
  });
});

describe('ToolExecutionError', () => {
  it('should include tool name in message', () => {
    const err = new ToolExecutionError('git_status', 'spawn failed');
    expect(err.message).toContain('git_status');
    expect(err.message).toContain('spawn failed');
    expect(err.code).toBe('TOOL_EXECUTION_ERROR');
    expect(err.name).toBe('ToolExecutionError');
  });
});

describe('ToolNotFoundError', () => {
  it('should include tool name in message', () => {
    const err = new ToolNotFoundError('nonexistent');
    expect(err.message).toContain('nonexistent');
    expect(err.code).toBe('TOOL_NOT_FOUND');
  });
});

describe('errorToToolResult', () => {
  it('should convert an Error to a tool result with isError: true', () => {
    const result = errorToToolResult(new Error('boom'));
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: 'text', text: 'boom' }]);
  });

  it('should convert a string to a tool result', () => {
    const result = errorToToolResult('string error');
    expect(result.isError).toBe(true);
    expect(result.content[0]).toHaveProperty('text', 'string error');
  });

  it('should convert unknown values to a tool result', () => {
    const result = errorToToolResult(42);
    expect(result.isError).toBe(true);
    expect(result.content[0]).toHaveProperty('text', '42');
  });
});
