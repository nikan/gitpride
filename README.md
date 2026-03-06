# gitpride

A lightweight, configurable [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server that exposes **non-destructive git commands** to AI assistants (e.g. Claude Desktop, Cursor, Zed). Designed for local development use.

## Features

- 🔒 **Non-destructive** — only read-only git commands are allowed
- ⚙️ **Configurable** — add or remove commands by editing a single JSON file
- 🚀 **Lightweight** — built with Node.js + TypeScript, minimal dependencies
- 🔌 **Standard transport** — communicates over stdio (MCP standard for local tools)

## Implementation Plan

The full implementation plan is in [`PLAN.md`](./PLAN.md). It is organized into 5 epics:

| # | Epic | Description |
|---|------|-------------|
| 1 | Project Setup & Infrastructure | TypeScript project skeleton, tooling, CI |
| 2 | MCP Server Core | Server entry point, tool registry, lifecycle |
| 3 | Command Configuration System | JSON config schema, loader, non-destructive guard |
| 4 | Git Commands Implementation | status, log, diff, branch, show, blame, remote |
| 5 | Documentation & Distribution | README, docs, examples, npm packaging |

## Creating the GitHub Epics and Issues

The [`scripts/create-issues.sh`](./scripts/create-issues.sh) script creates the `Epic` label, all 5 epic issues, and their 19 sub-issues in this repository.

**Option A — GitHub Actions (recommended):**

1. Go to **Actions** → **Create GitHub Issues from Plan**
2. Click **Run workflow**, type `yes` in the confirmation field
3. Click **Run workflow**

**Option B — Local `gh` CLI:**

```bash
# Authenticate first
gh auth login

# Run the script
bash scripts/create-issues.sh
```

> **Note:** The workflow has an idempotency guard — it checks for existing Epic-labelled issues and skips creation if any are found. Run it only once to avoid duplicates.
