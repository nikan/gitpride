/**
 * Tests for the git command runner.
 *
 * These tests exercise the runGit function against a real git installation
 * to validate process spawning, output capture, and error handling.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execSync } from 'node:child_process';

import { runGit, DEFAULT_TIMEOUT_MS, MAX_OUTPUT_BYTES } from '../../src/git/runner.js';

// Suppress logger output during tests
vi.spyOn(process.stderr, 'write').mockImplementation(() => true);

describe('runGit', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'gitpride-runner-'));
    // Initialize a git repo in the temp directory
    execSync('git init', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@test.com"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Test"', { cwd: tempDir, stdio: 'ignore' });
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('should run git status in a clean repo', async () => {
    const result = await runGit(['status'], { cwd: tempDir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('nothing to commit');
  });

  it('should capture stderr from git commands', async () => {
    const result = await runGit(['log'], { cwd: tempDir });
    // Empty repo has no commits — git log fails
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toBeTruthy();
  });

  it('should respect the cwd option', async () => {
    const result = await runGit(['rev-parse', '--show-toplevel'], { cwd: tempDir });
    expect(result.exitCode).toBe(0);
    // realpath resolves symlinks (e.g., /tmp -> /private/tmp on macOS)
    expect(result.stdout.trim()).toContain(tempDir.split('/').pop());
  });

  it('should run git branch in a repo with a commit', async () => {
    // Create a file and commit
    await writeFile(join(tempDir, 'hello.txt'), 'hello');
    execSync('git add . && git commit -m "initial"', { cwd: tempDir, stdio: 'ignore' });

    const result = await runGit(['branch'], { cwd: tempDir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/\*\s+(main|master)/);
  });

  it('should run git log in a repo with commits', async () => {
    await writeFile(join(tempDir, 'hello.txt'), 'hello');
    execSync('git add . && git commit -m "first commit"', { cwd: tempDir, stdio: 'ignore' });

    const result = await runGit(['log', '--oneline'], { cwd: tempDir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('first commit');
  });

  it('should run git diff', async () => {
    await writeFile(join(tempDir, 'hello.txt'), 'hello');
    execSync('git add . && git commit -m "init"', { cwd: tempDir, stdio: 'ignore' });
    await writeFile(join(tempDir, 'hello.txt'), 'hello world');

    const result = await runGit(['diff'], { cwd: tempDir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('+hello world');
  });

  it('should run git show', async () => {
    await writeFile(join(tempDir, 'hello.txt'), 'hello');
    execSync('git add . && git commit -m "show test"', { cwd: tempDir, stdio: 'ignore' });

    const result = await runGit(['show', 'HEAD'], { cwd: tempDir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('show test');
  });

  it('should run git blame', async () => {
    await writeFile(join(tempDir, 'hello.txt'), 'hello');
    execSync('git add . && git commit -m "blame test"', { cwd: tempDir, stdio: 'ignore' });

    const result = await runGit(['blame', 'hello.txt'], { cwd: tempDir });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('hello');
  });

  it('should run git remote -v', async () => {
    const result = await runGit(['remote', '-v'], { cwd: tempDir });
    expect(result.exitCode).toBe(0);
    // No remotes configured — empty output is fine
    expect(result.stdout).toBe('');
  });

  it('should return non-zero exit code for invalid commands', async () => {
    const result = await runGit(['no-such-command'], { cwd: tempDir });
    expect(result.exitCode).not.toBe(0);
  });

  it('should export expected constants', () => {
    expect(DEFAULT_TIMEOUT_MS).toBe(30_000);
    expect(MAX_OUTPUT_BYTES).toBe(1_024 * 1_024);
  });
});
