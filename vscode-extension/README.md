# GitPride — VS Code Extension

> Configure and manage the [gitpride](https://github.com/nikan/gitpride) MCP server for AI-assisted git workflows directly from VS Code.

## Features

- **🔧 One-Command Setup** — Bootstrap `.vscode/mcp.json` and `commands.config.json` with a single command
- **🚀 Server Lifecycle** — Start, stop, and restart the gitpride server from the Command Palette
- **📊 Diagnostics** — Comprehensive environment checks with actionable remediation steps
- **⚙️ Configurable** — Settings for config path, startup mode, and server command
- **🛡️ Safe** — Non-destructive merges of existing configuration files

## Quick Start

1. Install the extension from the VS Code Marketplace
2. Open a git repository in VS Code
3. Run `GitPride: Bootstrap MCP Configuration` from the Command Palette (`Ctrl+Shift+P`)
4. Run `GitPride: Start Server` to launch the MCP server

## Commands

| Command | Description |
|---------|-------------|
| `GitPride: Bootstrap MCP Configuration` | Create/update `.vscode/mcp.json` |
| `GitPride: Create Starter commands.config.json` | Generate starter config |
| `GitPride: Start Server` | Start the gitpride server |
| `GitPride: Stop Server` | Stop the server |
| `GitPride: Restart Server` | Restart the server |
| `GitPride: Show Server Status` | Show current server state |
| `GitPride: Show Diagnostics` | Run environment diagnostics |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `gitpride.configPath` | `""` | Path to `commands.config.json` |
| `gitpride.startupMode` | `"manual"` | `"manual"` or `"auto"` |
| `gitpride.serverCommand` | `"npx gitpride"` | Server start command |
| `gitpride.minimumVersion` | `"0.1.0"` | Minimum gitpride version |

## Requirements

- Node.js ≥ 20.0.0
- git
- A workspace with a git repository

## Documentation

- [Full Setup & Usage Guide](https://github.com/nikan/gitpride/blob/main/docs/vscode-extension-guide.md)
- [Architecture Decision Record](https://github.com/nikan/gitpride/blob/main/docs/adr-001-vscode-extension-architecture.md)
- [Configuration Reference](https://github.com/nikan/gitpride/blob/main/docs/configuration.md)

## Development

```bash
cd vscode-extension
npm install
npm run build
# Press F5 in VS Code to launch Extension Development Host
```

## License

MIT © Nikos Anagnostou
