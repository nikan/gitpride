/**
 * Integration smoke test for the VS Code extension.
 *
 * This file is designed to run via @vscode/test-electron which launches
 * a real VS Code instance. It verifies that the extension activates
 * and registers commands correctly.
 *
 * Run with: npm run test:integration (from vscode-extension/)
 */
import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  try {
    const extensionDevelopmentPath = path.resolve(__dirname, '../../');
    const extensionTestsPath = path.resolve(__dirname, './integrationSuite');

    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [
        '--disable-extensions',
        '--disable-gpu',
      ],
    });
  } catch (err) {
    console.error('Failed to run integration tests:', err);
    process.exit(1);
  }
}

main();
