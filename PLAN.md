# Lightweight Git MCP Server — Implementation Plan

A lightweight, configurable [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server written in **Node.js + TypeScript** that exposes non-destructive git commands for use in local development with AI assistants.

---

## Goals

- Expose a curated set of **read-only / non-destructive** git commands as MCP tools.
- Allow operators to **add or remove commands by editing a single config/settings file** — no code changes required.
- Keep the runtime dependency footprint minimal.
- Target **local development** scenarios (stdio transport, single-repo or multi-repo).

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│                  AI Client (e.g. Claude)        │
└──────────────────────┬──────────────────────────┘
                       │  MCP (stdio / SSE)
┌──────────────────────▼──────────────────────────┐
│               MCP Server Entry Point            │
│  src/index.ts                                   │
├─────────────────────────────────────────────────┤
│           Tool Registry & Dispatcher            │
│  src/server/registry.ts                         │
├─────────────────────────────────────────────────┤
│            Config / Settings Loader             │
│  src/config/loader.ts  +  commands.config.json  │
├─────────────────────────────────────────────────┤
│                 Git Command Runner              │
│  src/git/runner.ts                              │
└─────────────────────────────────────────────────┘
```

### Key Design Decisions

| Decision       | Choice                      | Reason                             |
| -------------- | --------------------------- | ---------------------------------- |
| Language       | TypeScript                  | Type safety, great MCP SDK support |
| Transport      | stdio (default)             | Standard for local dev MCP servers |
| Config format  | JSON (with JSON Schema)     | Widely understood, easy to edit    |
| Git execution  | `child_process.spawn`       | No extra git library needed        |
| MCP SDK        | `@modelcontextprotocol/sdk` | Official SDK                       |
| Test framework | Vitest                      | Fast, ESM-friendly                 |
| Linter         | ESLint + Prettier           | Industry standard                  |

---

## Epic Breakdown

### Epic 1 — Project Setup & Infrastructure

Stand up the Node.js/TypeScript project skeleton and developer tooling.

**Issues:**

1. Initialize Node.js/TypeScript project (`package.json`, `tsconfig.json`)
2. Configure ESLint and Prettier
3. Set up Vitest testing framework
4. Configure build scripts and npm run scripts
5. Add `.gitignore` and repository hygiene files

---

### Epic 2 — MCP Server Core

Implement the MCP protocol layer: entry point, tool registration, error handling.

**Issues:** 6. Implement MCP server entry point (`src/index.ts`) with stdio transport 7. Implement tool registry — register and dispatch MCP tools 8. Add structured error handling and logging 9. Implement graceful shutdown (SIGINT / SIGTERM handling)

---

### Epic 3 — Command Configuration System

Allow non-developer operators to configure which git commands are exposed by editing a single JSON file.

**Issues:** 10. Design and document the command configuration schema (JSON Schema) 11. Implement config file loader with validation 12. Add non-destructive command guard (block write-commands) 13. Support per-command argument allow-listing in the config

---

### Epic 4 — Git Commands Implementation

Implement the concrete MCP tools that wrap git commands.

**Issues:** 14. Implement `git status` tool 15. Implement `git log` tool (configurable format and limit) 16. Implement `git diff` tool (staged, unstaged, between refs) 17. Implement `git branch` listing tool 18. Implement `git show` tool (commit or object) 19. Implement `git blame` tool 20. Implement `git remote` info tool

---

### Epic 5 — Documentation & Distribution

Ensure the project is easy to install, configure, and understand.

**Issues:** 21. Write comprehensive README (installation, configuration, usage) 22. Document the command configuration file format with examples 23. Add example `commands.config.json` files for common scenarios 24. Prepare package for npm distribution (publish config, `bin` entry)

---

## Directory Structure (target)

```
gitpride/
├── src/
│   ├── index.ts               # Entry point — creates and starts MCP server
│   ├── server/
│   │   └── registry.ts        # Tool registry and dispatcher
│   ├── config/
│   │   ├── loader.ts          # Loads and validates commands.config.json
│   │   └── schema.json        # JSON Schema for config file
│   └── git/
│       └── runner.ts          # Spawns git processes and returns output
├── commands.config.json       # Default configurable command list
├── examples/
│   └── commands.config.example.json
├── tests/
│   ├── config.test.ts
│   ├── registry.test.ts
│   └── git-runner.test.ts
├── package.json
├── tsconfig.json
├── .eslintrc.json
├── .prettierrc
├── PLAN.md
└── README.md
```

---

## Command Configuration File Format

```jsonc
// commands.config.json
{
  "$schema": "./src/config/schema.json",
  "commands": [
    {
      "name": "git_status",
      "description": "Show the working tree status",
      "command": "git",
      "args": ["status"],
      "allowExtraArgs": false,
    },
    {
      "name": "git_log",
      "description": "Show commit logs",
      "command": "git",
      "args": ["log", "--oneline"],
      "allowExtraArgs": true,
      "extraArgsSchema": {
        "type": "object",
        "properties": {
          "limit": { "type": "number", "default": 20 },
        },
      },
    },
  ],
}
```

---

## Non-Destructive Guard

The config loader and server core will **reject** any command whose `args` array includes:

- Destructive git subcommands: `push`, `reset`, `clean`, `rebase`, `merge`, `checkout`, `commit`, `add`, `rm`, `mv`, `tag --delete`, `branch -D`, `stash drop`
- Shell operators: `&&`, `||`, `;`, `|`, `>`, `>>`

This ensures the server can only be used to **read** repository state.

---

## Milestones

| Milestone                    | Epics          | Target |
| ---------------------------- | -------------- | ------ |
| v0.1 — Skeleton              | Epic 1, Epic 2 | Week 1 |
| v0.2 — Configurable Commands | Epic 3         | Week 2 |
| v0.3 — Full Command Set      | Epic 4         | Week 3 |
| v1.0 — Production Ready      | Epic 5         | Week 4 |
