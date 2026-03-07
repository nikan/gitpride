# VS Code Extension Release Checklist

**Issue:** [#55](https://github.com/nikan/gitpride/issues/55)  
**Epic:** [#48](https://github.com/nikan/gitpride/issues/48)

## Packaging

The extension is packaged using [`@vscode/vsce`](https://github.com/microsoft/vscode-vsce).

### Build & Package

```bash
cd vscode-extension
npm install
npm run build
npm run package         # Creates gitpride-vscode-<version>.vsix
```

### Publish to Marketplace

```bash
npm run publish         # Requires VSCE_PAT environment variable or login
```

## Versioning

### Strategy

The extension version follows **semver** independently from gitpride core:

| Component | Version | Coupling |
|-----------|---------|----------|
| `gitpride` (npm) | `0.x.y` | Independent releases |
| `gitpride-vscode` | `0.x.y` | Declares minimum compatible `gitpride` version in settings |

### When to Bump

| Change Type | Bump | Example |
|------------|------|---------|
| New commands or settings | Minor | `0.1.0 → 0.2.0` |
| Bug fixes, diagnostics improvements | Patch | `0.1.0 → 0.1.1` |
| Breaking settings or command changes | Major | `0.x → 1.0.0` |

### Changelog

Maintain a `CHANGELOG.md` in `vscode-extension/` following [Keep a Changelog](https://keepachangelog.com/) format:

```markdown
# Changelog

## [0.1.0] - 2026-03-07
### Added
- Initial release
- MCP configuration bootstrap command
- Starter config generation
- Server lifecycle management (start/stop/restart)
- Diagnostics and status commands
- Settings for config path, startup mode, server command
```

## Marketplace Assets

### Required Files

| Asset | Location | Purpose |
|-------|----------|---------|
| Icon | `vscode-extension/assets/icon.png` | 128×128 PNG extension icon |
| README | `vscode-extension/README.md` | Marketplace listing page |
| CHANGELOG | `vscode-extension/CHANGELOG.md` | Version history |
| LICENSE | Root `LICENSE` (MIT) | License display |

### Marketplace Metadata (in package.json)

- **displayName:** `"GitPride — MCP Git Server"`
- **description:** Concise one-liner for search results
- **categories:** `["Other", "SCM Providers"]`
- **keywords:** `["git", "mcp", "model-context-protocol", "ai", "copilot", "gitpride"]`
- **repository:** Points to GitHub repo with `directory: "vscode-extension"`

### Icon

Create a 128×128 PNG icon and place at `vscode-extension/assets/icon.png`. The icon should:
- Be recognizable at small sizes
- Use the gitpride brand colors (if defined)
- Be distinct from the default VS Code git icon

## Pre-Release Checklist

Before each release:

- [ ] All unit tests pass: `npm run test:unit`
- [ ] Extension builds cleanly: `npm run build`
- [ ] Package creates valid VSIX: `npm run package`
- [ ] Version bumped in `package.json`
- [ ] `CHANGELOG.md` updated
- [ ] `gitpride.minimumVersion` default updated if needed
- [ ] README is current with all commands and settings
- [ ] Test locally via `F5` in Extension Development Host
- [ ] Verify commands work: bootstrap, start, stop, diagnostics
- [ ] Verify settings are respected

## CI/CD

The GitHub Actions workflow (`.github/workflows/ci.yml`) should:

1. Build the extension on every PR
2. Run unit tests
3. On tagged releases (`v*`), package and publish to Marketplace

See `.github/workflows/ci.yml` for the implementation.

## Security Considerations

- Never include secrets or tokens in the VSIX package
- The `.vscodeignore` file excludes source files and test data
- Review dependencies before each release (supply chain)
- The extension runs `npx gitpride` by default — users should verify the npm package authenticity
