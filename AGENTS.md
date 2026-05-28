# Repository Guidelines

## Project Structure & Module Organization

CCodex Studio is an Electron desktop app with a React renderer.

- `electron/` contains the main process, preload bridge, IPC handlers, path helpers, and local services for sessions, skills, profiles, project context, and PTY launch.
- `src/` contains the renderer app: React components, Zustand stores, shared types, utilities, and global CSS.
- `public/` contains the renderer HTML template.
- `scripts/` contains development and release helpers.
- `dist-electron/`, `dist-renderer/`, `release/`, and `node_modules/` are generated artifacts; do not edit them directly.

There is no dedicated test directory yet. Add future tests near the covered code or under `tests/`.

## Build, Test, and Development Commands

Run commands from `ccodex-studio/`.

- `npm install`: install dependencies.
- `npm run dev`: start the renderer dev server and Electron app.
- `npm run dev:renderer`: serve the renderer on port `9000`.
- `npm run dev:electron`: compile Electron TypeScript and launch Electron.
- `npm run build`: build renderer and Electron output.
- `npm run prepublish:check`: run release sanity checks.
- `npm run pack`: create an unpacked Electron build.
- `npm run dist`: create installer artifacts.

## Coding Style & Naming Conventions

Use TypeScript with strict types. Keep files ASCII unless existing content requires otherwise. Prefer two-space indentation, single quotes, semicolons, and explicit exported types for shared contracts.

Use `PascalCase` for React components, `camelCase` for variables/functions, and kebab-case filenames for modules such as `session-manager.ts`. Zustand stores live in `src/stores/*-store.ts`. Group IPC channels by domain, for example `terminal:create` or `profiles:load`.

## Testing Guidelines

No test framework is currently configured. Verify changes with `npm run build` and, when relevant, `npm run dev` on Windows. If adding tests, document the command in `package.json` and prefer focused tests for Electron services and renderer utilities.

## Commit & Pull Request Guidelines

The current Git history does not define a strict convention. Use short, imperative commit messages such as `Add project context refresh` or `Fix terminal resize cleanup`.

Pull requests should include a concise description, manual verification steps, linked issues when available, and screenshots or recordings for UI changes. Call out changes affecting local files, `~/.ccodex-studio`, Claude session access, or process launching.

## Security & Configuration Tips

This app reads local Claude/Codex metadata and launches local commands. Do not commit `.env`, `.claude/`, `.agents/`, `.ccodex-studio/`, session `.jsonl` files, generated builds, or API keys. Keep preload APIs narrow and validate file paths in Electron before exposing new filesystem access.
