# Changelog

All notable changes to the GitPride VS Code extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.1.0] - 2026-03-07

### Added

- **MCP Configuration Bootstrap:** Command to create/update `.vscode/mcp.json` with gitpride server entry. Safely merges with existing config.
- **Starter Config Generation:** Command to generate `commands.config.json` from template with common git commands.
- **Server Lifecycle Management:** Start, stop, and restart the gitpride MCP server from VS Code.
  - Automatic crash detection with restart prompt
  - Duplicate process prevention
  - Graceful shutdown on VS Code exit
- **Output Channel:** Dedicated "GitPride" output channel for server logs and troubleshooting.
- **Diagnostics Command:** Comprehensive environment check covering Node.js, git, config files, and server state.
- **Status Command:** Quick view of current server state, PID, and uptime.
- **Extension Settings:**
  - `gitpride.configPath` — Custom config file path
  - `gitpride.startupMode` — Manual or auto-start
  - `gitpride.serverCommand` — Custom server command
  - `gitpride.minimumVersion` — Minimum gitpride version
- **Documentation:** User guide, troubleshooting matrix, and release checklist.
