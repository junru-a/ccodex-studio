# Security Policy

CCodex Studio is a local desktop wrapper around Claude Code. It can read local Claude Code sessions, inspect installed skills, and launch `claude` or `ccr code` in a pseudo-terminal.

## Sensitive Data

The repository should never include:

- API keys or tokens
- `.env` files
- Claude Code session JSONL files
- `~/.claude` or project `.claude` directories
- `~/.ccodex-studio` runtime data
- `node_modules` or generated build output

The default DeepSeek profile stores `ANTHROPIC_AUTH_TOKEN` as `$DEEPSEEK_API_KEY`, which means the real key is read from the environment at runtime.

## Local Files Read by the App

The app may read:

- `~/.claude/projects`
- `~/.claude/skills`
- `~/.agents/skills`
- `<project>/.claude/skills`
- project-level metadata such as `package.json` and `.git/HEAD`

## Command Execution

The app starts Claude Code through an embedded terminal. Claude Code and installed skills may execute commands depending on your Claude Code permissions and settings.

Review third-party skills before use, especially skills that include scripts, dynamic shell context, or broad tool permissions.

## Reporting Issues

Please open a GitHub issue with:

- OS and version
- Node and Electron versions
- Steps to reproduce
- Whether Claude Code runs normally in a standalone terminal

Do not paste API keys, private session logs, or proprietary source code into public issues.
