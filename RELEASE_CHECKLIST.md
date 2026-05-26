# Release Checklist

Run this before publishing or pushing a public branch.

## Local Safety

- [ ] `npm run prepublish:check`
- [ ] `npm run build`
- [ ] Confirm `.env` is not present or not tracked
- [ ] Confirm `.claude/`, `.agents/`, `*.jsonl`, `profiles.json`, and app data are not tracked
- [ ] Confirm no API keys are present in source, docs, screenshots, or terminal captures
- [ ] Confirm screenshots do not expose private repo names, usernames, tokens, or proprietary code

## Repo Contents

Commit source files and metadata:

- `electron/`
- `src/`
- `public/`
- `scripts/`
- `package.json`
- `package-lock.json`
- `tsconfig*.json`
- `webpack.renderer.config.js`
- `.gitignore`
- `.env.example`
- `README.md`
- `SECURITY.md`
- `LICENSE`

Do not commit:

- `node_modules/`
- `dist-electron/`
- `dist-renderer/`
- `release/`
- `.claude/`
- `.agents/`
- `*.jsonl`
- `.env`
- `profiles.json`

## Suggested First Tag

Use an alpha tag until installers and cross-platform behavior are tested:

```bash
git tag v0.1.0-alpha.1
```
