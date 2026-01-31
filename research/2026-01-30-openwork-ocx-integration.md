# OpenWork + OCX Integration

## Summary
OCX adds profile-based OpenCode configuration and registry-managed components. OpenWork can integrate by optionally launching OpenCode through OCX for profile-aware host mode, and by using the OCX CLI for installing skills/plugins/components while keeping its existing remote `/config` flows.

## Key Points
- OCX uses profiles stored under `~/.config/opencode/profiles/<name>/` and can launch OpenCode with `ocx opencode` (aka `ocx oc`) while passing through OpenCode flags.
- OCX installs components by copying files into `.opencode/` (ShadCN-style) and tracks them in `ocx.lock`; registries can ship skills, plugins, agents, commands, tools, and profiles.
- OCX exposes `--json` output for most commands, enabling UI integrations without scraping CLI output.
- OpenWork runs OpenCode locally in host mode and manages skills/plugins via `opencode.json` plus `.opencode/skills`, so OCX can slot in as a local package/profile manager without changing OpenWork's remote server model.
- OpenCode config files merge across scopes (global, project, `.opencode`), so profile config can layer on top of project-specific settings.

## Findings
### Optional OCX launcher for host mode
- Detect `ocx` in PATH; if present and the user selects a profile, start OpenCode with `ocx oc -p <profile> -- serve --hostname 127.0.0.1 --port <port>` so OCX handles profile resolution and config merging.
- If no profile or OCX is missing, fall back to the existing `opencode serve` flow.
- Respect OCX profile settings (for example a custom OpenCode binary via `bin` in `ocx.jsonc`) by letting OCX choose the executable.

### Profile-aware configuration UI
- Use `ocx profile list --json` to populate a profile picker and `ocx profile show --json` to preview profile metadata.
- Use `ocx config show --origin --json` to display merged config with origin info, aligning UI explanations with what OpenCode actually sees.
- Surface profile `exclude`/`include` patterns so users understand visibility constraints applied to workspaces.

### Component and plugin management
- Offer OCX-based installs in local/host mode: `ocx add` for skills/plugins/agents, `ocx update` for upgrades, and `ocx diff` before applying updates.
- After OCX installs, refresh OpenWork's skill/plugin views from `.opencode/` and `opencode.jsonc` as it already does.
- Keep remote/client mode on the OpenCode API (`/config`), since OCX is local-only.

### Registry integration and safety
- OCX registries can distribute components for `.opencode/` plus profiles; OpenWork could add a registry manager UI that maps to `ocx registry add/list/remove`.
- Emphasize OCX's integrity model (version pinning, SHA-256) and show diffs before updating to preserve OpenWork's auditable UX.
- Label OCX as a third-party tool and gate installation/updates behind explicit user consent.

## Sources
- [OCX README](https://raw.githubusercontent.com/kdcokenny/ocx/main/README.md) - profiles, components, and CLI overview
- [OCX Profiles](https://raw.githubusercontent.com/kdcokenny/ocx/main/docs/PROFILES.md) - profile layout, exclude/include behavior, config merge
- [OCX CLI Reference](https://raw.githubusercontent.com/kdcokenny/ocx/main/docs/CLI.md) - commands and JSON output options
- [OCX Registry Protocol](https://raw.githubusercontent.com/kdcokenny/ocx/main/docs/REGISTRY_PROTOCOL.md) - component types and registry endpoints
- [OpenWork README](https://raw.githubusercontent.com/different-ai/openwork/dev/README.md) - host mode, skills/plugins management
- [OpenCode Config](https://opencode.ai/docs/config/) - config locations and precedence
