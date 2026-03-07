# gitpride

A lightweight, configurable [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes **non-destructive git commands** to AI assistants (e.g. Claude Desktop, Cursor, Zed). Designed for local development use.

## Features

- 🔒 **Non-destructive** — only read-only git commands are allowed; a built-in guard blocks push, reset, checkout, and other write operations
- ⚙️ **Configurable** — add or remove commands by editing a single JSON file
- 🚀 **Lightweight** — built with Node.js + TypeScript, minimal dependencies
- 🔌 **Standard transport** — communicates over stdio (MCP standard for local tools)

## Installation

**Requirements:** Node.js ≥ 20, git available on `PATH`.

### Global install

```bash
npm install -g gitpride
```

### Run without installing

```bash
npx gitpride
```

### Local development

```bash
git clone https://github.com/nikan/gitpride.git
cd gitpride
npm install
npm run build
```

## Quick Start

1. **Create a config file** in your project root (or copy an [example](./examples/)):

   ```bash
   cp node_modules/gitpride/examples/minimal.config.json commands.config.json
   ```

2. **Run the server:**

   ```bash
   gitpride
   ```

3. **Connect an MCP client** (see [Client Integration](#client-integration) below).

The server reads `commands.config.json` from the current directory by default. Override with the `GITPRIDE_CONFIG` environment variable:

```bash
GITPRIDE_CONFIG=./my-config.json gitpride
```

## Default Commands

The included [`commands.config.json`](./commands.config.json) exposes these tools:

| Tool         | Git Command     | Extra Args                         |
| ------------ | --------------- | ---------------------------------- |
| `git_status` | `git status`    | —                                  |
| `git_log`    | `git log`       | `limit` (number)                   |
| `git_diff`   | `git diff`      | `ref` (string), `staged` (boolean) |
| `git_branch` | `git branch`    | `all` (boolean)                    |
| `git_show`   | `git show`      | `ref` (string)                     |
| `git_blame`  | `git blame`     | `file` (string)                    |
| `git_remote` | `git remote -v` | —                                  |

## Configuration

Commands are defined in a JSON file. Each entry maps to an MCP tool:

```json
{
  "$schema": "./src/config/schema.json",
  "commands": [
    {
      "name": "git_status",
      "description": "Show the working tree status",
      "command": "git",
      "args": ["status"],
      "allowExtraArgs": false
    }
  ]
}
```

Set `allowExtraArgs: true` and provide an `extraArgsSchema` to let the AI pass parameters at runtime:

```json
{
  "name": "git_log",
  "description": "Show commit logs",
  "command": "git",
  "args": ["log", "--oneline"],
  "allowExtraArgs": true,
  "extraArgsSchema": {
    "type": "object",
    "properties": {
      "limit": {
        "type": "number",
        "description": "Maximum number of commits to show",
        "default": 20
      }
    }
  }
}
```

For the complete field reference, property type mapping, and security rules, see the **[Configuration Reference](./docs/configuration.md)**.

### Example Configs

Ready-to-use configurations are in the [`examples/`](./examples/) directory:

| File                                                            | Use Case                           |
| --------------------------------------------------------------- | ---------------------------------- |
| [`minimal.config.json`](./examples/minimal.config.json)         | Bare minimum — status and log only |
| [`full.config.json`](./examples/full.config.json)               | All 7 default commands             |
| [`code-review.config.json`](./examples/code-review.config.json) | Diff, blame, and log for reviews   |
| [`history.config.json`](./examples/history.config.json)         | Repository history exploration     |

## Client Integration

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "gitpride": {
      "command": "npx",
      "args": ["-y", "gitpride"],
      "env": {
        "GITPRIDE_CONFIG": "/absolute/path/to/commands.config.json"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "gitpride": {
      "command": "npx",
      "args": ["-y", "gitpride"],
      "env": {
        "GITPRIDE_CONFIG": "./commands.config.json"
      }
    }
  }
}
```

### VS Code (Copilot)

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "gitpride": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "gitpride"],
      "env": {
        "GITPRIDE_CONFIG": "./commands.config.json"
      }
    }
  }
}
```

## Environment Variables

| Variable          | Description                                     | Default                  |
| ----------------- | ----------------------------------------------- | ------------------------ |
| `GITPRIDE_CONFIG` | Path to the command configuration file          | `./commands.config.json` |
| `LOG_LEVEL`       | Log verbosity: `debug`, `info`, `warn`, `error` | `info`                   |

## Security

GitPride enforces a strict **non-destructive guard** that blocks:

- **Destructive subcommands:** `push`, `reset`, `clean`, `rebase`, `merge`, `checkout`, `commit`, `add`, `rm`, `mv`, `stash`
- **Destructive argument sequences:** `tag --delete`, `tag -d`, `branch -D`, `branch --delete`
- **Shell operators:** `&&`, `||`, `;`, `|`, `>`, `>>`

Validation runs both at config load time and at runtime before each command execution. Additionally, each command has a **30-second timeout** and a **1 MB output cap**.

## Development

```bash
# Install dependencies
npm install

# Run in development mode (auto-reloads via tsx)
npm run dev

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint

# Format
npm run format
```

## License

[MIT](./LICENSE) © Nikos Anagnostou
