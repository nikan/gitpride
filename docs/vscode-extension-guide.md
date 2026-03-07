# VS Code Extension Setup and Usage Guide

**Issue:** [#56](https://github.com/nikan/gitpride/issues/56)  
**Epic:** [#48](https://github.com/nikan/gitpride/issues/48)

## Overview

The GitPride VS Code extension provides an integrated experience for configuring and managing the gitpride MCP server directly from your editor. It handles workspace configuration, server lifecycle, and diagnostics — so you can focus on using AI-assisted git workflows.

## Installation

### From VS Code Marketplace (recommended)

1. Open VS Code
2. Go to Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`)
3. Search for **"GitPride"**
4. Click **Install**

### From a local `.vsix` file

```bash
# Build the extension package
cd vscode-extension
npm install
npm run build
npm run package

# Install the .vsix
code --install-extension gitpride-vscode-0.1.0.vsix
```

### Prerequisites

| Dependency | Minimum Version | Check Command |
|-----------|----------------|---------------|
| Node.js | 20.0.0 | `node --version` |
| git | any recent | `git --version` |
| npm/npx | included with Node.js | `npx --version` |

## Quick Start

### 1. Bootstrap MCP Configuration

Open the Command Palette (`Ctrl+Shift+P` / `Cmd+Shift+P`) and run:

```
GitPride: Bootstrap MCP Configuration
```

This creates or updates `.vscode/mcp.json` with the gitpride server entry:

```json
{
  "servers": {
    "gitpride": {
      "command": "npx",
      "args": ["gitpride"],
      "env": {}
    }
  }
}
```

### 2. Create a Commands Configuration

If your workspace doesn't have a `commands.config.json`, run:

```
GitPride: Create Starter commands.config.json
```

This generates a ready-to-use configuration with common git commands (status, log, diff, branch, show).

### 3. Start the Server

```
GitPride: Start Server
```

Or set `gitpride.startupMode` to `"auto"` for automatic start when the workspace opens.

## Commands Reference

| Command | Description |
|---------|-------------|
| `GitPride: Bootstrap MCP Configuration` | Create/update `.vscode/mcp.json` with gitpride server entry |
| `GitPride: Create Starter commands.config.json` | Generate a starter config file in workspace root |
| `GitPride: Start Server` | Start the gitpride MCP server |
| `GitPride: Stop Server` | Stop the running server |
| `GitPride: Restart Server` | Stop and restart the server |
| `GitPride: Show Server Status` | Display current server state (PID, uptime, etc.) |
| `GitPride: Show Diagnostics` | Run comprehensive diagnostics and show results |

## Settings

Configure via `File > Preferences > Settings` or `.vscode/settings.json`:

| Setting | Default | Description |
|---------|---------|-------------|
| `gitpride.configPath` | `""` (auto-detect) | Path to `commands.config.json`. Absolute or relative to workspace root. |
| `gitpride.startupMode` | `"manual"` | `"manual"` or `"auto"`. Auto starts the server when workspace opens. |
| `gitpride.serverCommand` | `"npx gitpride"` | Command to start the server. Change for custom installs or forks. |
| `gitpride.minimumVersion` | `"0.1.0"` | Minimum required gitpride version for compatibility warnings. |

### Example `.vscode/settings.json`

```json
{
  "gitpride.startupMode": "auto",
  "gitpride.configPath": "./my-custom-config.json"
}
```

## How It Works

### Architecture

The extension spawns `gitpride` as a **child process** using the configured server command (default: `npx gitpride`). Communication uses MCP stdio transport (stdin/stdout JSON-RPC).

```
VS Code Extension Host
  └── ServerManager
        └── spawns: npx gitpride
              └── communicates via stdin/stdout (MCP protocol)
```

### File Layout

After setup, your workspace will contain:

```
your-project/
├── .vscode/
│   ├── mcp.json              ← MCP server configuration
│   └── settings.json         ← Optional gitpride settings
├── commands.config.json      ← Git commands exposed to AI
└── ... your project files
```

## Server Lifecycle

### Starting

The server starts when you:
- Run `GitPride: Start Server` command
- Open a workspace with `gitpride.startupMode` set to `"auto"`

### Stopping

The server stops when you:
- Run `GitPride: Stop Server` command
- Close the VS Code window (graceful shutdown)

### Crash Recovery

If the server exits unexpectedly:
1. A warning notification appears with the exit reason
2. You can click **Restart** to immediately restart
3. Click **Show Output** to see server logs for debugging

### Log Output

All server output is captured in the **GitPride** output channel:
- `View > Output` → select **GitPride** from the dropdown
- Shows server stdout, stderr, start/stop events, and errors

## Troubleshooting

### Diagnostics Command

Run `GitPride: Show Diagnostics` for an automated check of your environment. It verifies:

- ✅ Node.js version and availability
- ✅ git installation
- ✅ npx availability
- ✅ Workspace and git repository detection
- ✅ Config file presence and validity
- ✅ MCP configuration status
- ✅ Current server state
- ✅ Extension settings

### Common Issues

| Problem | Cause | Solution |
|---------|-------|----------|
| "Node.js not found" | Node.js not on PATH | Install Node.js 20+ from [nodejs.org](https://nodejs.org/) |
| "git not found" | git not on PATH | Install git from [git-scm.com](https://git-scm.com/) |
| Server fails to start | First `npx` run downloading package | Wait for download to complete; check network |
| Server exits with code 1 | Invalid `commands.config.json` | Check output channel for validation errors; fix JSON syntax |
| "Config file not found" | Wrong `gitpride.configPath` setting | Verify path exists; use absolute path or relative to workspace root |
| Server crashes repeatedly | Corrupted config or incompatible version | Run diagnostics; try `npm cache clean --force` then restart |
| MCP client can't connect | Missing `.vscode/mcp.json` | Run `GitPride: Bootstrap MCP Configuration` |
| Permission denied | File system permissions | Check read/write access to workspace and config files |
| Duplicate server warning | Server already running | Run `GitPride: Show Status` to check; stop existing server first |

### Manual Debugging Steps

1. **Check the output channel:** `View > Output > GitPride`
2. **Run diagnostics:** `Ctrl+Shift+P > GitPride: Show Diagnostics`
3. **Verify config:** Open `commands.config.json` — look for JSON syntax errors
4. **Test gitpride directly:** Run `npx gitpride` in terminal to isolate extension vs server issues
5. **Check VS Code Developer Tools:** `Help > Toggle Developer Tools > Console` for extension errors

## Local Extension Development

### Setup

```bash
cd vscode-extension
npm install
npm run build
```

### Run in Extension Development Host

1. Open the `vscode-extension/` folder in VS Code
2. Press `F5` (or `Run > Start Debugging`)
3. A new VS Code window opens with the extension loaded
4. Test commands via `Ctrl+Shift+P`

### Watch Mode

```bash
npm run watch   # Recompiles on file changes
```

Then press `F5` — changes are picked up on reload (`Ctrl+R` in the Extension Development Host).

### Running Tests

```bash
# Unit tests (fast, no VS Code instance needed)
npm run test:unit

# Integration tests (launches VS Code)
npm run test:integration
```
