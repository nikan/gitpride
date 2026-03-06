/**
 * GitPride — MCP server entry point.
 * Exposes non-destructive git commands to AI assistants via the Model Context Protocol.
 */

export const SERVER_NAME = 'gitpride';
export const SERVER_VERSION = '0.1.0';

export async function main() {
  // Server implementation will be added in Epic 2.
  // eslint-disable-next-line no-console
  console.error(`${SERVER_NAME} v${SERVER_VERSION} — server not yet implemented`);
}

// Run only when executed directly (not imported)
const isDirectRun =
  import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('index.js');

if (isDirectRun) {
  main();
}
