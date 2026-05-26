# CCodex Studio

A Codex-style desktop workbench for Claude Code and Agent Skills.

CCodex Studio keeps Claude Code as the execution engine, but wraps it with a desktop workflow: project/session sidebar, embedded terminal, Chinese Skills Center, session preview/resume, model profiles, and lightweight project context. By default it launches the user's existing `claude` command without overriding model settings, so it can work with official Claude Code, claude-code-router, ccswitch-style workflows, or environment-based providers.

> Status: alpha. Windows is the primary tested platform.

## Features

- Embedded Claude Code terminal via `node-pty` and `xterm.js`
- Project and session discovery from the current user's `~/.claude/projects`
- Single-click session preview and double-click `claude --resume`
- Chinese Skills Center for installed skills from:
  - `~/.claude/skills`
  - `~/.agents/skills`
  - project `.claude/skills`
- Skill recommendation based on project context, terminal output, and usage history
- Project context strip with git branch, package manager, stack markers, and runnable scripts
- Model profiles that can either reuse the user's existing Claude Code configuration or apply optional environment overrides
- Terminal error capture with a "fix recent error" prompt shortcut

## What This App Does Locally

The app reads local Claude Code metadata and starts local processes:

- Reads `~/.claude/projects` session JSONL files
- Reads installed skills from Claude/agent skill directories
- Starts `claude` or `ccr code` in an embedded pseudo-terminal
- Stores app profiles under `~/.ccodex-studio`
- Does not upload session contents or API keys

## Path Discovery

CCodex Studio does not hard-code the original developer's machine paths. At runtime it resolves paths from the current user's home directory and selected project folder:

- Claude projects: `~/.claude/projects`
- Claude skills: `~/.claude/skills`
- Agent skills: `~/.agents/skills`
- Project skills: `<selected-project>/.claude/skills`
- App data: `~/.ccodex-studio`
- Claude Code Router config: `~/.claude-code-router/config.json`

This means a cloned copy should adapt to each user's own Claude Code installation and project folders.

## Requirements

- Windows 10/11 recommended
- Node.js 22+ or 24+
- Claude Code CLI installed and available on PATH
- Optional: DeepSeek API key in `DEEPSEEK_API_KEY` if you use the bundled DeepSeek profile
- Optional: claude-code-router or ccswitch if your local Claude Code workflow uses them

## Quick Start

```powershell
git clone https://github.com/junru-a/ccodex-studio.git
cd ccodex-studio
npm install
npm run dev
```

By default, CCodex Studio uses your existing Claude Code configuration. If you use DeepSeek:

```powershell
# Set DEEPSEEK_API_KEY in your shell first, then start the app.
npm run dev
```

The optional DeepSeek profile references `$DEEPSEEK_API_KEY` and does not store the key value.

## Usage

- Choose a project from the left sidebar or use **Open Project**
- Click **Launch Claude Code** to start a fresh session
- Single-click a session to preview it
- Double-click a session, or use **Resume**, to run `claude --resume <session-id>`
- Use the right Skills panel to search, insert, copy, or drag skills into the terminal

## Privacy and Safety

This app is designed for local-first use. Still, it can read local session history and launch commands through Claude Code, so review the code and your installed skills before running it.

Do not commit:

- `.env`
- `~/.ccodex-studio`
- `.claude`
- session `.jsonl`
- generated `dist-*` output
- `node_modules`

## Roadmap

- Settings UI for model profiles and path overrides
- skills.sh search/install/update/remove integration
- Editable `skills.zh.json` cache for custom Chinese descriptions
- Better static transcript renderer for Claude Code JSONL
- Installer builds for Windows/macOS/Linux
- Safer skill risk audit before install/use

## Known Issues

- Windows ConPTY can occasionally fail when switching sessions very quickly. The app adds a short restart delay, but this area still needs hardening.
- macOS and Linux are not yet deeply tested.
- Claude Code itself may show native installer/update notices inside the terminal.

## License

MIT
