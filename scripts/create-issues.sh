#!/usr/bin/env bash
# ============================================================
# create-issues.sh
#
# Creates the "Epic" label, epic issues, and their sub-issues
# in the nikan/gitpride GitHub repository.
#
# Requirements: gh CLI authenticated with repo + issues scope
#   gh auth login  (or set GH_TOKEN env var)
#
# Usage:
#   chmod +x scripts/create-issues.sh
#   ./scripts/create-issues.sh
# ============================================================

set -euo pipefail

REPO="nikan/gitpride"

echo "==> Creating 'Epic' label..."
gh label create "Epic" \
  --repo "$REPO" \
  --color "0075ca" \
  --description "Epic issue tracking a major feature area" \
  2>/dev/null || echo "  (label already exists, continuing)"

# ── Helper ──────────────────────────────────────────────────
create_issue() {
  local title="$1"
  local body="$2"
  local labels="${3:-}"
  local extra_flags=()
  if [[ -n "$labels" ]]; then
    extra_flags+=(--label "$labels")
  fi
  gh issue create \
    --repo "$REPO" \
    --title "$title" \
    --body "$body" \
    "${extra_flags[@]}"
}

add_sub_issue() {
  local parent_number="$1"
  local child_number="$2"
  gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    "/repos/$REPO/issues/$parent_number/sub_issues" \
    -F sub_issue_id="$child_number" \
    --silent && echo "  Linked #$child_number as sub-issue of #$parent_number"
}

# ============================================================
# EPIC 1 — Project Setup & Infrastructure
# ============================================================
echo ""
echo "==> Creating Epic 1: Project Setup & Infrastructure..."
EPIC1_URL=$(create_issue \
  "Epic: Project Setup & Infrastructure" \
  "Stand up the Node.js/TypeScript project skeleton and all developer tooling.

## Goal
Initialize the repository with a well-configured TypeScript/Node.js project that supports building, linting, testing, and running the MCP server.

## Sub-issues
- [ ] Initialize Node.js/TypeScript project
- [ ] Configure ESLint and Prettier
- [ ] Set up Vitest testing framework
- [ ] Configure build scripts and npm run scripts
- [ ] Add \`.gitignore\` and repository hygiene files

See [PLAN.md](https://github.com/nikan/gitpride/blob/main/PLAN.md#epic-1--project-setup--infrastructure) for full details." \
  "Epic")
EPIC1_NUM=$(echo "$EPIC1_URL" | grep -oE '[0-9]+$')
echo "  Created Epic 1 as issue #$EPIC1_NUM"

echo "  Creating sub-issues for Epic 1..."
I1_URL=$(create_issue \
  "Initialize Node.js/TypeScript project (package.json, tsconfig.json)" \
  "Set up the base \`package.json\` and \`tsconfig.json\` for the MCP server.

### Acceptance Criteria
- \`package.json\` with name, version, scripts (\`build\`, \`start\`, \`test\`, \`lint\`)
- \`tsconfig.json\` targeting ES2022, \`NodeNext\` modules, strict mode
- \`@modelcontextprotocol/sdk\` listed as a dependency
- \`typescript\`, \`@types/node\` as dev dependencies" "")
I1_NUM=$(echo "$I1_URL" | grep -oE '[0-9]+$')

I2_URL=$(create_issue \
  "Configure ESLint and Prettier" \
  "Add ESLint and Prettier with TypeScript support.

### Acceptance Criteria
- \`.eslintrc.json\` with TypeScript plugin rules
- \`.prettierrc\` with consistent formatting settings
- \`npm run lint\` and \`npm run format\` scripts work" "")
I2_NUM=$(echo "$I2_URL" | grep -oE '[0-9]+$')

I3_URL=$(create_issue \
  "Set up Vitest testing framework" \
  "Configure Vitest for unit and integration testing.

### Acceptance Criteria
- \`vitest.config.ts\` present and configured
- \`npm run test\` runs all tests
- At least one smoke-test passes" "")
I3_NUM=$(echo "$I3_URL" | grep -oE '[0-9]+$')

I4_URL=$(create_issue \
  "Configure build scripts and npm run scripts" \
  "Wire up all npm scripts so the project can be built, run, tested and linted with standard commands.

### Acceptance Criteria
- \`npm run build\` compiles TypeScript to \`dist/\`
- \`npm start\` runs the compiled server
- \`npm run dev\` runs with \`ts-node\` or \`tsx\` for fast iteration" "")
I4_NUM=$(echo "$I4_URL" | grep -oE '[0-9]+$')

I5_URL=$(create_issue \
  "Add .gitignore and repository hygiene files" \
  "Add standard repository hygiene files.

### Files
- \`.gitignore\` — ignore \`node_modules\`, \`dist\`, \`.env\`, editor files
- \`.editorconfig\` — consistent editor settings
- \`LICENSE\` — verify correct license is present" "")
I5_NUM=$(echo "$I5_URL" | grep -oE '[0-9]+$')

echo "  Linking sub-issues to Epic 1..."
add_sub_issue "$EPIC1_NUM" "$I1_NUM"
add_sub_issue "$EPIC1_NUM" "$I2_NUM"
add_sub_issue "$EPIC1_NUM" "$I3_NUM"
add_sub_issue "$EPIC1_NUM" "$I4_NUM"
add_sub_issue "$EPIC1_NUM" "$I5_NUM"

# ============================================================
# EPIC 2 — MCP Server Core
# ============================================================
echo ""
echo "==> Creating Epic 2: MCP Server Core..."
EPIC2_URL=$(create_issue \
  "Epic: MCP Server Core" \
  "Implement the MCP protocol layer: server entry point, tool registration, error handling, and lifecycle management.

## Goal
A working MCP server that AI clients (e.g. Claude Desktop) can connect to via stdio transport and call registered tools.

## Sub-issues
- [ ] Implement MCP server entry point with stdio transport
- [ ] Implement tool registry and dispatcher
- [ ] Add structured error handling and logging
- [ ] Implement graceful shutdown

See [PLAN.md](https://github.com/nikan/gitpride/blob/main/PLAN.md#epic-2--mcp-server-core) for full details." \
  "Epic")
EPIC2_NUM=$(echo "$EPIC2_URL" | grep -oE '[0-9]+$')
echo "  Created Epic 2 as issue #$EPIC2_NUM"

echo "  Creating sub-issues for Epic 2..."
I6_URL=$(create_issue \
  "Implement MCP server entry point (src/index.ts) with stdio transport" \
  "Create \`src/index.ts\` that instantiates the MCP server and listens on stdio.

### Acceptance Criteria
- Uses \`@modelcontextprotocol/sdk\` \`Server\` class
- Communicates via \`StdioServerTransport\`
- Server name and version read from \`package.json\`
- Starts cleanly with \`npm start\`" "")
I6_NUM=$(echo "$I6_URL" | grep -oE '[0-9]+$')

I7_URL=$(create_issue \
  "Implement tool registry — register and dispatch MCP tools" \
  "Create \`src/server/registry.ts\` that registers tools loaded from the command config and dispatches incoming MCP tool-call requests.

### Acceptance Criteria
- Loads tool definitions from config at startup
- Registers each as an MCP tool with name, description, and inputSchema
- Routes incoming \`tools/call\` requests to the correct handler
- Returns structured \`CallToolResult\` responses" "")
I7_NUM=$(echo "$I7_URL" | grep -oE '[0-9]+$')

I8_URL=$(create_issue \
  "Add structured error handling and logging" \
  "Ensure the server surfaces errors clearly without crashing.

### Acceptance Criteria
- Unhandled promise rejections are caught and logged
- MCP tool errors return a well-formed error response (not a server crash)
- Log level is configurable via \`LOG_LEVEL\` env var
- Logs go to stderr so they don't pollute the MCP stdio stream" "")
I8_NUM=$(echo "$I8_URL" | grep -oE '[0-9]+$')

I9_URL=$(create_issue \
  "Implement graceful shutdown (SIGINT / SIGTERM handling)" \
  "The server should shut down cleanly when it receives a termination signal.

### Acceptance Criteria
- Handles \`SIGINT\` and \`SIGTERM\`
- Closes the MCP transport before exiting
- Exit code \`0\` on clean shutdown, non-zero on error" "")
I9_NUM=$(echo "$I9_URL" | grep -oE '[0-9]+$')

echo "  Linking sub-issues to Epic 2..."
add_sub_issue "$EPIC2_NUM" "$I6_NUM"
add_sub_issue "$EPIC2_NUM" "$I7_NUM"
add_sub_issue "$EPIC2_NUM" "$I8_NUM"
add_sub_issue "$EPIC2_NUM" "$I9_NUM"

# ============================================================
# EPIC 3 — Command Configuration System
# ============================================================
echo ""
echo "==> Creating Epic 3: Command Configuration System..."
EPIC3_URL=$(create_issue \
  "Epic: Command Configuration System" \
  "Design and implement the configuration system that lets operators add or remove exposed git commands by editing a single JSON file — no code changes required.

## Goal
Any git command can be exposed (or hidden) by editing \`commands.config.json\`. The system validates configurations and enforces the non-destructive rule.

## Sub-issues
- [ ] Design and document the command configuration schema
- [ ] Implement config file loader with validation
- [ ] Add non-destructive command guard
- [ ] Support per-command argument allow-listing

See [PLAN.md](https://github.com/nikan/gitpride/blob/main/PLAN.md#epic-3--command-configuration-system) for full details." \
  "Epic")
EPIC3_NUM=$(echo "$EPIC3_URL" | grep -oE '[0-9]+$')
echo "  Created Epic 3 as issue #$EPIC3_NUM"

echo "  Creating sub-issues for Epic 3..."
I10_URL=$(create_issue \
  "Design and document the command configuration schema (JSON Schema)" \
  "Create \`src/config/schema.json\` that formally describes the shape of \`commands.config.json\`.

### Schema Fields (per command)
- \`name\` (string, required) — MCP tool name
- \`description\` (string, required) — shown to the AI
- \`command\` (string, required) — executable, e.g. \`\"git\"\`
- \`args\` (string[], required) — fixed arguments
- \`allowExtraArgs\` (boolean) — whether the caller can pass additional args
- \`extraArgsSchema\` (object, optional) — JSON Schema for caller-supplied args" "")
I10_NUM=$(echo "$I10_URL" | grep -oE '[0-9]+$')

I11_URL=$(create_issue \
  "Implement config file loader with validation" \
  "Create \`src/config/loader.ts\` that reads \`commands.config.json\` (or a path specified via env var), parses it, and validates it against the JSON Schema.

### Acceptance Criteria
- Throws a descriptive error on invalid config
- Supports overriding config path via \`GITPRIDE_CONFIG\` env var
- Exports typed \`CommandConfig\` TypeScript interface" "")
I11_NUM=$(echo "$I11_URL" | grep -oE '[0-9]+$')

I12_URL=$(create_issue \
  "Add non-destructive command guard (block write git subcommands)" \
  "The config loader and/or registry must reject any command whose \`args\` include write-git subcommands or shell operators.

### Blocked Subcommands
\`push\`, \`reset\`, \`clean\`, \`rebase\`, \`merge\`, \`checkout\`, \`commit\`, \`add\`, \`rm\`, \`mv\`, \`tag --delete\`, \`branch -D\`, \`stash drop\`

### Blocked Shell Operators
\`&&\`, \`||\`, \`;\`, \`|\`, \`>\`, \`>>\`

### Acceptance Criteria
- Attempting to register a destructive command throws a clear error at startup
- Unit tests cover all blocked patterns" "")
I12_NUM=$(echo "$I12_URL" | grep -oE '[0-9]+$')

I13_URL=$(create_issue \
  "Support per-command argument allow-listing in the config" \
  "When \`allowExtraArgs: true\`, the caller can pass additional arguments. These should be validated against \`extraArgsSchema\` before being passed to the git process.

### Acceptance Criteria
- Extra args are validated (type, range, allowed values) before execution
- Unknown extra args are rejected when \`allowExtraArgs: false\`
- Prevents argument injection (e.g. \`--upload-pack\`, path traversal)" "")
I13_NUM=$(echo "$I13_URL" | grep -oE '[0-9]+$')

echo "  Linking sub-issues to Epic 3..."
add_sub_issue "$EPIC3_NUM" "$I10_NUM"
add_sub_issue "$EPIC3_NUM" "$I11_NUM"
add_sub_issue "$EPIC3_NUM" "$I12_NUM"
add_sub_issue "$EPIC3_NUM" "$I13_NUM"

# ============================================================
# EPIC 4 — Git Commands Implementation
# ============================================================
echo ""
echo "==> Creating Epic 4: Git Commands Implementation..."
EPIC4_URL=$(create_issue \
  "Epic: Git Commands Implementation" \
  "Implement the concrete MCP tools that wrap non-destructive git commands using the configuration system and git runner.

## Goal
A default \`commands.config.json\` ships with all common read-only git commands pre-configured and working end-to-end.

## Sub-issues
- [ ] Implement \`git status\` tool
- [ ] Implement \`git log\` tool
- [ ] Implement \`git diff\` tool
- [ ] Implement \`git branch\` listing tool
- [ ] Implement \`git show\` tool
- [ ] Implement \`git blame\` tool
- [ ] Implement \`git remote\` info tool

See [PLAN.md](https://github.com/nikan/gitpride/blob/main/PLAN.md#epic-4--git-commands-implementation) for full details." \
  "Epic")
EPIC4_NUM=$(echo "$EPIC4_URL" | grep -oE '[0-9]+$')
echo "  Created Epic 4 as issue #$EPIC4_NUM"

echo "  Creating sub-issues for Epic 4..."
I14_URL=$(create_issue \
  "Implement git_status tool" \
  "Add \`git_status\` to the default \`commands.config.json\` and implement the git runner integration.

### Config Entry
\`\`\`json
{
  \"name\": \"git_status\",
  \"description\": \"Show the working tree status\",
  \"command\": \"git\",
  \"args\": [\"status\", \"--porcelain=v1\"],
  \"allowExtraArgs\": false
}
\`\`\`

### Acceptance Criteria
- Returns current working tree status as text
- Works from any working directory (configurable via \`cwd\` option)" "")
I14_NUM=$(echo "$I14_URL" | grep -oE '[0-9]+$')

I15_URL=$(create_issue \
  "Implement git_log tool (configurable format and limit)" \
  "Add \`git_log\` to the default \`commands.config.json\` with configurable limit.

### Config Entry
\`\`\`json
{
  \"name\": \"git_log\",
  \"description\": \"Show recent commit history\",
  \"command\": \"git\",
  \"args\": [\"log\", \"--oneline\"],
  \"allowExtraArgs\": true,
  \"extraArgsSchema\": {
    \"type\": \"object\",
    \"properties\": {
      \"limit\": { \"type\": \"number\", \"minimum\": 1, \"maximum\": 500, \"default\": 20 }
    }
  }
}
\`\`\`

### Acceptance Criteria
- Defaults to last 20 commits
- Caller can override limit via MCP tool input" "")
I15_NUM=$(echo "$I15_URL" | grep -oE '[0-9]+$')

I16_URL=$(create_issue \
  "Implement git_diff tool (staged, unstaged, between refs)" \
  "Add \`git_diff\` variants to the default config.

### Variants
- \`git_diff\` — unstaged changes (\`git diff\`)
- \`git_diff_staged\` — staged changes (\`git diff --staged\`)
- \`git_diff_refs\` — diff between two refs (extra args: \`from\`, \`to\`)

### Acceptance Criteria
- Output is returned as plain text (unified diff format)
- Large diffs are truncated with a notice" "")
I16_NUM=$(echo "$I16_URL" | grep -oE '[0-9]+$')

I17_URL=$(create_issue \
  "Implement git_branch listing tool" \
  "Add \`git_branch\` to the default config.

### Config Entry
\`\`\`json
{
  \"name\": \"git_branch\",
  \"description\": \"List local and remote branches\",
  \"command\": \"git\",
  \"args\": [\"branch\", \"-a\", \"--format=%(refname:short) %(objectname:short)\"],
  \"allowExtraArgs\": false
}
\`\`\`

### Acceptance Criteria
- Lists all local branches with their short SHAs
- Current branch is clearly indicated" "")
I17_NUM=$(echo "$I17_URL" | grep -oE '[0-9]+$')

I18_URL=$(create_issue \
  "Implement git_show tool (commit or object)" \
  "Add \`git_show\` to the default config with a required \`ref\` extra arg.

### Acceptance Criteria
- Shows commit metadata + diff for a given ref
- Defaults to HEAD if no ref provided
- Output truncated at a configurable limit" "")
I18_NUM=$(echo "$I18_URL" | grep -oE '[0-9]+$')

I19_URL=$(create_issue \
  "Implement git_blame tool" \
  "Add \`git_blame\` to the default config.

### Acceptance Criteria
- Requires \`file\` extra arg (relative path)
- Returns per-line annotation (commit, author, date, line content)
- Path is validated to prevent directory traversal" "")
I19_NUM=$(echo "$I19_URL" | grep -oE '[0-9]+$')

I20_URL=$(create_issue \
  "Implement git_remote tool" \
  "Add \`git_remote\` to the default config.

### Config Entry
\`\`\`json
{
  \"name\": \"git_remote\",
  \"description\": \"List configured remotes\",
  \"command\": \"git\",
  \"args\": [\"remote\", \"-v\"],
  \"allowExtraArgs\": false
}
\`\`\`

### Acceptance Criteria
- Lists all remotes with fetch and push URLs
- No credentials are exposed in the output" "")
I20_NUM=$(echo "$I20_URL" | grep -oE '[0-9]+$')

echo "  Linking sub-issues to Epic 4..."
add_sub_issue "$EPIC4_NUM" "$I14_NUM"
add_sub_issue "$EPIC4_NUM" "$I15_NUM"
add_sub_issue "$EPIC4_NUM" "$I16_NUM"
add_sub_issue "$EPIC4_NUM" "$I17_NUM"
add_sub_issue "$EPIC4_NUM" "$I18_NUM"
add_sub_issue "$EPIC4_NUM" "$I19_NUM"
add_sub_issue "$EPIC4_NUM" "$I20_NUM"

# ============================================================
# EPIC 5 — Documentation & Distribution
# ============================================================
echo ""
echo "==> Creating Epic 5: Documentation & Distribution..."
EPIC5_URL=$(create_issue \
  "Epic: Documentation & Distribution" \
  "Ensure the project is easy to install, configure, understand, and distribute.

## Goal
A developer can install the server with a single npm command, configure it in minutes, and connect it to their AI assistant.

## Sub-issues
- [ ] Write comprehensive README
- [ ] Document the command configuration file format
- [ ] Add example configuration files
- [ ] Prepare package for npm distribution

See [PLAN.md](https://github.com/nikan/gitpride/blob/main/PLAN.md#epic-5--documentation--distribution) for full details." \
  "Epic")
EPIC5_NUM=$(echo "$EPIC5_URL" | grep -oE '[0-9]+$')
echo "  Created Epic 5 as issue #$EPIC5_NUM"

echo "  Creating sub-issues for Epic 5..."
I21_URL=$(create_issue \
  "Write comprehensive README (installation, configuration, usage)" \
  "Rewrite \`README.md\` to cover the full lifecycle: install → configure → connect → use.

### Sections
1. What is gitpride?
2. Quick Start (3-step install)
3. Configuration (commands.config.json explained)
4. Connecting to Claude Desktop / Cursor / Zed
5. Security model (non-destructive guarantee)
6. Contributing" "")
I21_NUM=$(echo "$I21_URL" | grep -oE '[0-9]+$')

I22_URL=$(create_issue \
  "Document the command configuration file format with examples" \
  "Create a dedicated \`docs/configuration.md\` explaining every field in \`commands.config.json\` with worked examples and edge cases.

### Acceptance Criteria
- Every schema field is documented with type, default, and example
- At least 3 full end-to-end example command entries
- Non-destructive guard rules are explained" "")
I22_NUM=$(echo "$I22_URL" | grep -oE '[0-9]+$')

I23_URL=$(create_issue \
  "Add example commands.config.json files for common scenarios" \
  "Create \`examples/\` directory with ready-to-use config files.

### Files
- \`examples/minimal.config.json\` — just status + log
- \`examples/full.config.json\` — all available commands enabled
- \`examples/monorepo.config.json\` — multi-root configuration

### Acceptance Criteria
- All examples are valid against the JSON Schema
- Examples are referenced from the README" "")
I23_NUM=$(echo "$I23_URL" | grep -oE '[0-9]+$')

I24_URL=$(create_issue \
  "Prepare package for npm distribution (publish config, bin entry)" \
  "Configure \`package.json\` so the server can be installed globally via npm and invoked as a CLI tool.

### Acceptance Criteria
- \`bin\` field points to compiled entry point
- \`files\` field includes only necessary files (\`dist/\`, \`commands.config.json\`)
- \`npm pack\` produces a clean tarball
- \`npx gitpride\` starts the server
- \`README.md\` contains npm badge" "")
I24_NUM=$(echo "$I24_URL" | grep -oE '[0-9]+$')

echo "  Linking sub-issues to Epic 5..."
add_sub_issue "$EPIC5_NUM" "$I21_NUM"
add_sub_issue "$EPIC5_NUM" "$I22_NUM"
add_sub_issue "$EPIC5_NUM" "$I23_NUM"
add_sub_issue "$EPIC5_NUM" "$I24_NUM"

# ============================================================
echo ""
echo "============================================================"
echo "  All epics and issues created successfully!"
echo ""
echo "  Epic 1 (Project Setup):        #$EPIC1_NUM"
echo "  Epic 2 (MCP Server Core):      #$EPIC2_NUM"
echo "  Epic 3 (Config System):        #$EPIC3_NUM"
echo "  Epic 4 (Git Commands):         #$EPIC4_NUM"
echo "  Epic 5 (Docs & Distribution):  #$EPIC5_NUM"
echo "============================================================"
