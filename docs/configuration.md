# Command Configuration Reference

GitPride uses a JSON configuration file to define which git commands are exposed as MCP tools. By default, the server looks for `commands.config.json` in the current working directory.

## File Location

The server resolves the config file in this order:

1. Path set via the `GITPRIDE_CONFIG` environment variable
2. `commands.config.json` in the current working directory

If no config file is found and `GITPRIDE_CONFIG` is not set, the server starts with zero tools registered.

## Top-Level Structure

```json
{
  "$schema": "./src/config/schema.json",
  "commands": [...]
}
```

| Field      | Type   | Required | Description                                              |
| ---------- | ------ | -------- | -------------------------------------------------------- |
| `$schema`  | string | No       | Path or URL to the JSON Schema (enables editor autocompletion) |
| `commands` | array  | Yes      | List of command definitions (minimum 1)                  |

## Command Definition

Each entry in the `commands` array defines a single MCP tool:

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

### Fields

| Field             | Type    | Required | Description                                                              |
| ----------------- | ------- | -------- | ------------------------------------------------------------------------ |
| `name`            | string  | Yes      | Unique tool name exposed via MCP. Must match `^[a-z][a-z0-9_]*$`.       |
| `description`     | string  | Yes      | Human-readable description shown to the AI assistant.                    |
| `command`         | string  | Yes      | The executable to run. Currently only `"git"` is supported.              |
| `args`            | array   | Yes      | Base arguments always passed to the command (e.g. `["log", "--oneline"]`). |
| `allowExtraArgs`  | boolean | Yes      | Whether the AI may supply additional arguments at runtime.               |
| `extraArgsSchema` | object  | No       | Schema for extra arguments. Required when `allowExtraArgs` is `true`.    |

### `name` Rules

- Must start with a lowercase letter
- May contain only lowercase letters, digits, and underscores
- Must be unique across all commands in the file

### `args` Array

The base arguments are always passed to `git` when the tool is invoked. They define the subcommand and any default flags:

```json
"args": ["log", "--oneline", "--graph"]
```

The non-destructive guard validates these at config load time (see [Security](#security) below).

## Extra Arguments Schema

When `allowExtraArgs` is `true`, you must provide an `extraArgsSchema` that describes the parameters the AI assistant can pass at runtime.

### Schema Structure

```json
"extraArgsSchema": {
  "type": "object",
  "properties": {
    "<param_name>": {
      "type": "<type>",
      "description": "<description>",
      "default": "<default_value>",
      "enum": ["<value1>", "<value2>"]
    }
  }
}
```

### Property Fields

| Field         | Type   | Required | Description                                 |
| ------------- | ------ | -------- | ------------------------------------------- |
| `type`        | string | Yes      | One of `"string"`, `"number"`, `"boolean"`. |
| `description` | string | No       | Explanation shown to the AI assistant.       |
| `default`     | any    | No       | Default value if the AI omits the parameter. |
| `enum`        | array  | No       | Restrict allowed values to this list.        |

### How Properties Map to CLI Arguments

The tool builder converts extra argument values into git CLI arguments:

| Property Type | Value          | Resulting CLI Argument           |
| ------------- | -------------- | -------------------------------- |
| `number`      | `limit: 10`    | `-n 10`                         |
| `boolean`     | `staged: true` | `--cached`                       |
| `boolean`     | `all: true`    | `--all`                          |
| `string`      | `ref: "HEAD"`  | `HEAD` (positional)              |
| `string`      | `file: "a.ts"` | `a.ts` (positional)              |

Boolean properties named `staged` map to `--cached`; other booleans map to `--<name>`.

## Security

### Non-Destructive Guard

GitPride enforces a strict non-destructive guard at two levels:

1. **Config load time** — the `args` array of each command is validated
2. **Runtime** — extra arguments from the AI assistant are validated before execution

The following are **blocked**:

#### Destructive Subcommands

`push`, `reset`, `clean`, `rebase`, `merge`, `checkout`, `commit`, `add`, `rm`, `mv`, `stash`

#### Destructive Argument Sequences

- `tag --delete` / `tag -d`
- `branch -D` / `branch --delete`

#### Shell Operators

`&&`, `||`, `;`, `|`, `>`, `>>`

Any config file or runtime invocation containing these will be rejected with a `DestructiveCommandError`.

### Execution Limits

- **Timeout:** 30 seconds per command
- **Output cap:** 1 MB maximum stdout

## Complete Example

Below is a fully annotated config exposing two tools:

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
    },
    {
      "name": "git_diff",
      "description": "Show changes between commits, commit and working tree, etc.",
      "command": "git",
      "args": ["diff"],
      "allowExtraArgs": true,
      "extraArgsSchema": {
        "type": "object",
        "properties": {
          "ref": {
            "type": "string",
            "description": "Git ref to diff against (e.g. HEAD~1, branch name)"
          },
          "staged": {
            "type": "boolean",
            "description": "Show staged changes (--cached)",
            "default": false
          }
        }
      }
    }
  ]
}
```

When the AI calls `git_diff` with `{ "ref": "main", "staged": true }`, the server executes:

```
git diff --cached main
```

## Example Configs

See the [`examples/`](../examples/) directory for ready-to-use configurations:

| File                                                  | Description                                |
| ----------------------------------------------------- | ------------------------------------------ |
| [`minimal.config.json`](../examples/minimal.config.json)       | Bare minimum — status and log only         |
| [`full.config.json`](../examples/full.config.json)             | All 7 default commands                     |
| [`code-review.config.json`](../examples/code-review.config.json) | Focused on diff, blame, and log for reviews |
| [`history.config.json`](../examples/history.config.json)       | Repository history exploration             |

To use an example, copy it to your project root:

```bash
cp node_modules/gitpride/examples/code-review.config.json commands.config.json
```

Or point to it directly:

```bash
GITPRIDE_CONFIG=./examples/code-review.config.json gitpride
```
