/**
 * Structured error types and helpers for converting errors into MCP tool results.
 */

import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js';

/** Base error for all gitpride-specific errors. */
export class GitPrideError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'GitPrideError';
  }
}

/** Raised when a tool fails during execution. */
export class ToolExecutionError extends GitPrideError {
  constructor(toolName: string, message: string, cause?: unknown) {
    super(`Tool "${toolName}" failed: ${message}`, 'TOOL_EXECUTION_ERROR', cause);
    this.name = 'ToolExecutionError';
  }
}

/** Raised when a requested tool is not found in the registry. */
export class ToolNotFoundError extends GitPrideError {
  constructor(toolName: string) {
    super(`Tool "${toolName}" is not registered`, 'TOOL_NOT_FOUND');
    this.name = 'ToolNotFoundError';
  }
}

/** Convert any error into an MCP CallToolResult with isError: true. */
export function errorToToolResult(error: unknown): CallToolResult {
  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);

  return {
    content: [{ type: 'text', text: message }],
    isError: true,
  };
}
