/**
 * Git command runner — spawns git processes and captures output.
 *
 * Uses child_process.spawn to execute git commands with a configurable
 * timeout. All output is captured as strings from stdout and stderr.
 */

import { spawn } from 'node:child_process';

import { Logger } from '../server/logger.js';

const log = new Logger('git-runner');

/** Default timeout for git commands (30 seconds). */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Maximum output size in bytes (1 MB). */
export const MAX_OUTPUT_BYTES = 1_024 * 1_024;

/** Result of a git command execution. */
export interface GitResult {
  /** Standard output from the command. */
  stdout: string;
  /** Standard error output from the command. */
  stderr: string;
  /** Process exit code (null if killed by signal). */
  exitCode: number | null;
}

/** Options for running a git command. */
export interface RunGitOptions {
  /** Working directory for the git command. Defaults to cwd. */
  cwd?: string;
  /** Timeout in milliseconds. Defaults to DEFAULT_TIMEOUT_MS. */
  timeoutMs?: number;
}

/**
 * Run a git command and capture its output.
 *
 * @param args — Arguments to pass to `git` (e.g. ['status', '--short']).
 * @param options — Optional cwd and timeout settings.
 * @returns The captured stdout, stderr, and exit code.
 */
export function runGit(args: readonly string[], options: RunGitOptions = {}): Promise<GitResult> {
  const { cwd, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  log.debug('Running git command', { args: [...args], cwd });

  return new Promise<GitResult>((resolve, reject) => {
    const child = spawn('git', args as string[], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: timeoutMs,
    });

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let truncated = false;

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes <= MAX_OUTPUT_BYTES) {
        stdoutChunks.push(chunk);
      } else if (!truncated) {
        truncated = true;
        log.warn('stdout output truncated', { maxBytes: MAX_OUTPUT_BYTES });
      }
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= MAX_OUTPUT_BYTES) {
        stderrChunks.push(chunk);
      }
    });

    child.on('error', (err) => {
      log.error('Failed to spawn git process', { error: err.message });
      reject(err);
    });

    child.on('close', (code) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf-8');
      const stderr = Buffer.concat(stderrChunks).toString('utf-8');

      log.debug('Git command completed', {
        args: [...args],
        exitCode: code,
        stdoutLength: stdout.length,
        stderrLength: stderr.length,
      });

      resolve({ stdout, stderr, exitCode: code });
    });
  });
}
