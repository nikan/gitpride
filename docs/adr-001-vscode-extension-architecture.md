# ADR-001: VS Code Extension Architecture and Server Provisioning Strategy

**Status:** Accepted  
**Date:** 2026-03-07  
**Issue:** [#49](https://github.com/nikan/gitpride/issues/49)  
**Epic:** [#48](https://github.com/nikan/gitpride/issues/48)

## Context

gitpride is a lightweight MCP (Model Context Protocol) server that exposes non-destructive git commands to AI assistants. We want to wrap gitpride as a VS Code extension so users can configure and manage the MCP server directly from their editor, without manually editing JSON files or managing processes.

Key questions:
1. How does the extension obtain and run `gitpride`?
2. How are updates managed?
3. What happens when dependencies are missing?

## Decision

### Packaging Model: External `npx gitpride` (not bundled)

We chose to use **external invocation via `npx gitpride`** (or a user-configured command) rather than bundling the gitpride JS entrypoint into the extension.

**Rationale:**
- **Decoupled release cycles.** The extension and gitpride core can be versioned and published independently. Bug fixes in the MCP server don't require an extension release.
- **Smaller extension size.** The extension ships only the VS Code integration logic (~50 KB), not the full server and its transitive dependencies.
- **User control.** Advanced users can pin a specific gitpride version, use a fork, or run from a local checkout.
- **npx caching.** After first run, `npx gitpride` resolves from the npm cache with negligible startup overhead.

**Tradeoffs:**
- Requires Node.js ≥ 20 on the user's PATH (same as gitpride itself).
- First-time `npx` invocation downloads the package (cold-start latency).
- The extension cannot guarantee the exact server version running.

**Rejected alternative — Bundled JS entrypoint:**
- Would eliminate the Node.js runtime dependency outside VS Code's extension host.
- However, the extension host runs in a restricted Electron context; spawning child processes for git execution is still required, and bundling would tightly couple versions, inflating extension size and complicating updates.

### Node / Runtime Compatibility

- **VS Code extension host** runs on Node.js 20+ (Electron's embedded Node). Extension code (activation, commands, UI) runs here.
- **gitpride server** runs as a **separate child process** spawned by the extension, using the system Node.js. This avoids conflicts with extension host constraints (e.g., module resolution, restricted APIs).
- The extension validates that `node --version` meets `>=20.0.0` at activation and surfaces a clear diagnostic if not.

### Version Coupling Policy

| Component | Versioning | Coupling |
|-----------|-----------|----------|
| Extension | Follows semver independently | Declares `gitpride` minimum version in settings |
| gitpride core | Published to npm independently | No direct dependency on extension |

- The extension includes a `gitpride.minimumVersion` setting (default: current compatible version at release time).
- On server start, the extension checks the gitpride version and warns if below minimum.
- **No hard lock.** Users can override to use newer or older versions at their own risk.

### Fallback Behavior

| Scenario | Behavior |
|----------|----------|
| Node.js not found | Error notification with install link |
| `npx gitpride` fails | Error notification with stderr details; suggest `npm install -g gitpride` |
| git not on PATH | Error from gitpride server surfaced in output channel |
| Config file missing | Offer to create starter `commands.config.json` from template |
| Config file invalid | Diagnostic with specific validation error and file location |
| Server crashes | Auto-detect exit, show notification, offer restart |

### Security and Supply-Chain Considerations

1. **npx execution scope.** The extension runs `npx gitpride` which resolves from the npm registry. Users should verify the package name and publisher. The extension does **not** execute arbitrary user-supplied binaries by default.
2. **User-configurable command.** The `gitpride.serverCommand` setting allows overriding the server command. This is explicitly an advanced/trusted setting; documentation warns about the security implications.
3. **No eval or dynamic code loading.** The extension never `eval()`s server output or dynamically loads code from the server process.
4. **Stdio transport only.** Communication between extension and server uses MCP stdio transport (stdin/stdout JSON-RPC), minimizing attack surface compared to network transports.
5. **Non-destructive by default.** gitpride's built-in guard blocks destructive git operations, providing defense-in-depth even if the extension or MCP client is compromised.

### Migration Path

If the strategy changes later (e.g., to bundled JS or WebAssembly):

1. **Settings remain stable.** The `gitpride.serverCommand` setting already supports arbitrary commands, so a bundled entrypoint could be wired in without breaking user configuration.
2. **Lifecycle manager is transport-agnostic.** The `ServerManager` class manages a child process via stdio; swapping the spawned command is a one-line change.
3. **MCP config generation is independent.** The `.vscode/mcp.json` bootstrap writes a static config; it doesn't depend on how the server is provisioned.
4. **Feature-flag approach.** A future version could offer both strategies (`"serverStrategy": "npx" | "bundled"`) and deprecate one gracefully.

## Consequences

- Users must have Node.js ≥ 20 and npm available.
- First activation may have a brief delay while npx fetches gitpride.
- The extension is lightweight and fast to install from the Marketplace.
- Version mismatches between extension and server are possible but mitigated by minimum version checks.
- Changing to a bundled strategy later is straightforward due to the abstraction layer.
