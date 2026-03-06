/**
 * Git module — public API.
 */

export { runGit, DEFAULT_TIMEOUT_MS, MAX_OUTPUT_BYTES } from './runner.js';
export type { GitResult, RunGitOptions } from './runner.js';
export { buildTools, buildToolDefinition } from './tools.js';
