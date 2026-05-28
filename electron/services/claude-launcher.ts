import * as pty from 'node-pty';
import * as childProcess from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ModelProfile } from './model-profiles';

export interface LaunchOptions {
  projectPath: string;
  profile?: ModelProfile;
  cwd?: string;
  args?: string[];
  cols?: number;
  rows?: number;
}

export interface PtyProcess {
  pid: number;
  onData: (callback: (data: string) => void) => { dispose: () => void };
  onExit: (callback: (code: number) => void) => { dispose: () => void };
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  kill: () => void;
  forceKill: () => void;
  exited: () => boolean;
}

const WINDOWS_COMMAND_EXTENSIONS = ['.cmd', '.exe', '.bat'];

function getEnvValue(env: Record<string, string>, key: string): string | undefined {
  if (Object.prototype.hasOwnProperty.call(env, key)) {
    return env[key];
  }

  if (process.platform !== 'win32') return undefined;
  const found = Object.keys(env).find((envKey) => envKey.toLowerCase() === key.toLowerCase());
  return found ? env[found] : undefined;
}

function setEnvValue(env: Record<string, string>, key: string, value: string): void {
  const existingKey = Object.keys(env).find((envKey) =>
    process.platform === 'win32' ? envKey.toLowerCase() === key.toLowerCase() : envKey === key
  );
  const targetKey = existingKey || key;

  if (process.platform === 'win32') {
    for (const envKey of Object.keys(env)) {
      if (envKey !== targetKey && envKey.toLowerCase() === key.toLowerCase()) {
        delete env[envKey];
      }
    }
  }

  env[targetKey] = value;
}

function splitPathList(value?: string): string[] {
  if (!value) return [];
  return value.split(process.platform === 'win32' ? ';' : ':').filter(Boolean);
}

function uniquePaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const entry of paths) {
    const trimmed = entry.trim();
    if (!trimmed) continue;

    const normalized = path.resolve(trimmed);
    const key = process.platform === 'win32' ? normalized.toLowerCase() : normalized;
    if (seen.has(key)) continue;

    seen.add(key);
    result.push(normalized);
  }

  return result;
}

function expandWindowsPathValue(value: string, env: Record<string, string>): string {
  let expanded = value.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

  expanded = expanded.replace(/%([^%]+)%/g, (_match, key: string) => getEnvValue(env, key) || '');
  expanded = expanded.replace(/\$\{([^}]+)\}/g, (_match, key: string) => getEnvValue(env, key) || '');

  if (expanded === '~') {
    return getEnvValue(env, 'USERPROFILE') || getEnvValue(env, 'HOME') || expanded;
  }
  if (expanded.startsWith('~/') || expanded.startsWith('~\\')) {
    const home = getEnvValue(env, 'USERPROFILE') || getEnvValue(env, 'HOME');
    if (home) return path.join(home, expanded.slice(2));
  }

  return expanded;
}

function quoteWindowsShellArg(arg: string): string {
  if (!arg) return '""';
  return /[\s"&<>|^]/.test(arg)
    ? `"${arg.replace(/(["^&<>|])/g, '^$1')}"`
    : arg;
}

function fileExists(filePath: string): boolean {
  try {
    return fs.statSync(filePath).isFile();
  } catch {
    return false;
  }
}

function directoryExists(dirPath: string): boolean {
  try {
    return fs.statSync(dirPath).isDirectory();
  } catch {
    return false;
  }
}

function readNpmPrefixFromConfig(configPath: string, env: Record<string, string>): string | undefined {
  if (!fileExists(configPath)) return undefined;

  try {
    const content = fs.readFileSync(configPath, 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) continue;

      const match = /^prefix\s*=\s*(.+)$/i.exec(trimmed);
      if (match) {
        return expandWindowsPathValue(match[1], env);
      }
    }
  } catch {
    // Ignore unreadable npm config files.
  }

  return undefined;
}

function runNpmConfigPrefix(env: Record<string, string>): string | undefined {
  const npmCmd = findWindowsExecutable('npm', getWindowsBaseSearchDirs(env));
  if (!npmCmd) return undefined;

  const result = runWindowsCommand(npmCmd, ['config', 'get', 'prefix'], env, 3000);
  const prefix = result.trim();
  if (prefix && prefix !== 'undefined' && prefix !== 'null') {
    return expandWindowsPathValue(prefix, env);
  }

  return undefined;
}

function getWindowsBaseSearchDirs(env: Record<string, string>): string[] {
  const appData = getEnvValue(env, 'APPDATA');
  const userProfile = getEnvValue(env, 'USERPROFILE') || getEnvValue(env, 'HOME');
  const systemRoot = getEnvValue(env, 'SystemRoot') || getEnvValue(env, 'WINDIR') || 'C:\\Windows';
  const programFiles = getEnvValue(env, 'ProgramFiles') || 'C:\\Program Files';
  const programFilesX86 = getEnvValue(env, 'ProgramFiles(x86)');

  return uniquePaths([
    ...splitPathList(getEnvValue(env, 'PATH')),
    ...splitPathList(getEnvValue(env, 'Path')),
    appData ? path.join(appData, 'npm') : '',
    userProfile ? path.join(userProfile, 'AppData', 'Roaming', 'npm') : '',
    path.join(programFiles, 'nodejs'),
    programFilesX86 ? path.join(programFilesX86, 'nodejs') : '',
    path.join(systemRoot, 'System32'),
    systemRoot,
  ]);
}

function getWindowsNpmPrefixDirs(env: Record<string, string>): string[] {
  const appData = getEnvValue(env, 'APPDATA');
  const userProfile = getEnvValue(env, 'USERPROFILE') || getEnvValue(env, 'HOME');
  const configFiles = uniquePaths([
    getEnvValue(env, 'NPM_CONFIG_USERCONFIG') || '',
    userProfile ? path.join(userProfile, '.npmrc') : '',
    getEnvValue(env, 'NPM_CONFIG_GLOBALCONFIG') || '',
    appData ? path.join(appData, 'npm', 'etc', 'npmrc') : '',
  ]);

  const configPrefixes = configFiles
    .map((configPath) => readNpmPrefixFromConfig(configPath, env))
    .filter((prefix): prefix is string => Boolean(prefix));

  return uniquePaths([
    getEnvValue(env, 'NPM_CONFIG_PREFIX') || '',
    getEnvValue(env, 'npm_config_prefix') || '',
    ...configPrefixes,
    runNpmConfigPrefix(env) || '',
    appData ? path.join(appData, 'npm') : '',
    userProfile ? path.join(userProfile, 'AppData', 'Roaming', 'npm') : '',
  ]);
}

function getWindowsCommandSearchDirs(env: Record<string, string>): string[] {
  const npmPrefixDirs = getWindowsNpmPrefixDirs(env);
  return uniquePaths([
    ...npmPrefixDirs,
    ...getWindowsBaseSearchDirs(env),
  ]);
}

function augmentWindowsPath(env: Record<string, string>): void {
  const pathDirs = uniquePaths([
    ...getWindowsNpmPrefixDirs(env),
    ...getWindowsBaseSearchDirs(env),
  ]);

  setEnvValue(env, 'Path', pathDirs.join(';'));
}

function findWindowsExecutable(baseName: string, dirs: string[]): string | undefined {
  for (const dir of dirs) {
    if (!directoryExists(dir)) continue;

    for (const ext of WINDOWS_COMMAND_EXTENSIONS) {
      const candidate = path.join(dir, `${baseName}${ext}`);
      if (fileExists(candidate)) {
        return candidate;
      }
    }
  }

  return undefined;
}

function runWindowsCommand(
  commandPath: string,
  args: string[],
  env: Record<string, string>,
  timeout: number
): string {
  const ext = path.extname(commandPath).toLowerCase();
  const isShellScript = ext === '.cmd' || ext === '.bat';
  const systemRoot = getEnvValue(env, 'SystemRoot') || getEnvValue(env, 'WINDIR') || 'C:\\Windows';
  const comSpec = getEnvValue(env, 'ComSpec') || path.join(systemRoot, 'System32', 'cmd.exe');

  try {
    const result = isShellScript
      ? childProcess.spawnSync(comSpec, [
          '/d',
          '/s',
          '/c',
          `""${commandPath}" ${args.map(quoteWindowsShellArg).join(' ')}"`,
        ], { env, encoding: 'utf8', timeout, windowsHide: true })
      : childProcess.spawnSync(
          commandPath,
          args,
          { env, encoding: 'utf8', timeout, windowsHide: true }
        );

    return `${result.stdout || ''}${result.stderr || ''}`;
  } catch {
    return '';
  }
}

function isClaudeCodeCommand(commandPath: string, env: Record<string, string>): boolean {
  const normalized = commandPath.replace(/\\/g, '/').toLowerCase();
  if (normalized.includes('/node_modules/@anthropic-ai/claude-code/bin/claude.exe')) {
    return true;
  }

  const ext = path.extname(commandPath).toLowerCase();
  if (ext !== '.exe') {
    try {
      const stat = fs.statSync(commandPath);
      if (stat.size < 64 * 1024) {
        const content = fs.readFileSync(commandPath, 'utf8');
        if (/@anthropic-ai[\\/]+claude-code|@anthropic-ai\/claude-code/i.test(content)) {
          return true;
        }
      }
    } catch {
      // Fall back to --version probing below.
    }
  }

  return /\bClaude Code\b/i.test(runWindowsCommand(commandPath, ['--version'], env, 5000));
}

function resolveClaudeCodeCommand(env: Record<string, string>): string {
  const searchDirs = getWindowsCommandSearchDirs(env);
  const candidates: string[] = [];

  for (const dir of searchDirs) {
    candidates.push(path.join(dir, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe'));
  }

  for (const dir of searchDirs) {
    for (const ext of WINDOWS_COMMAND_EXTENSIONS) {
      candidates.push(path.join(dir, `claude${ext}`));
    }
  }

  const uniqueCandidates = uniquePaths(candidates);
  const existingCandidates = uniqueCandidates.filter(fileExists);

  for (const candidate of existingCandidates) {
    if (isClaudeCodeCommand(candidate, env)) {
      return candidate;
    }
  }

  const found = existingCandidates.length > 0
    ? ` Found candidates: ${existingCandidates.join(', ')}.`
    : '';
  throw new Error(
    `Claude Code executable not found. Install it with "npm install -g @anthropic-ai/claude-code" or add the npm global directory that contains claude.cmd to PATH.${found}`
  );
}

function resolveCommand(profile: ModelProfile | undefined, env: Record<string, string>): { cmd: string; args: string[] } {
  if (profile?.mode === 'ccr') {
    if (process.platform === 'win32') {
      return { cmd: findWindowsExecutable('ccr', getWindowsCommandSearchDirs(env)) || 'ccr.cmd', args: ['code'] };
    }
    return { cmd: 'ccr', args: ['code'] };
  }
  if (profile?.mode === 'codex') {
    if (process.platform === 'win32') {
      return { cmd: findWindowsExecutable('codex', getWindowsCommandSearchDirs(env)) || 'codex.cmd', args: [] };
    }
    return { cmd: 'codex', args: [] };
  }
  if (process.platform === 'win32') {
    return { cmd: resolveClaudeCodeCommand(env), args: [] };
  }
  return { cmd: 'claude', args: [] };
}

function buildEnv(profile?: ModelProfile): Record<string, string> {
  const env: Record<string, string> = {};

  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value === 'string') {
      env[key] = value;
    }
  }

  if (profile?.mode === 'env') {
    for (const [key, value] of Object.entries(profile.env)) {
      if (typeof value !== 'string') continue;
      if (value.startsWith('$')) {
        const resolved = getEnvValue(env, value.slice(1));
        if (resolved) env[key] = resolved;
      } else {
        env[key] = value;
      }
    }
  }

  if (process.platform === 'win32') {
    augmentWindowsPath(env);
  }

  return env;
}

function quoteShellArg(arg: string): string {
  if (!arg) return '""';
  if (process.platform === 'win32') {
    return quoteWindowsShellArg(arg);
  }
  return /[\s"&<>|^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}

function normalizeCwd(projectPath: string, cwd?: string): string {
  const target = path.resolve(cwd || projectPath);
  const stat = fs.statSync(target);

  if (!stat.isDirectory()) {
    throw new Error(`PTY cwd is not a directory: ${target}`);
  }

  return target;
}

/**
 * Launch Claude Code inside node-pty pseudo-terminal.
 *
 * node-pty creates a real TTY on all platforms:
 *   - Windows: conpty (Windows 10 1809+) via winpty
 *   - macOS/Linux: forkpty
 *
 * This gives Claude Code a genuine terminal environment, enabling
 * full interactive TUI (prompts, colors, cursor movement).
 */
export function launchClaudePty(options: LaunchOptions): PtyProcess {
  const { projectPath, profile, args: extraArgs = [], cols = 120, rows = 40 } = options;
  const env = buildEnv(profile);
  const { cmd, args } = resolveCommand(profile, env);
  const cwd = normalizeCwd(projectPath, options.cwd);

  const fullArgs = [...args, ...extraArgs];
  const commandLine = [quoteShellArg(cmd), ...fullArgs.map(quoteShellArg)].join(' ');

  console.log(
    `[claude-launcher] Starting PTY: ${commandLine} in ${cwd}`
  );

  let shellCmd: string;
  let shellArgs: string[];

  if (process.platform === 'win32') {
    shellCmd = getEnvValue(env, 'ComSpec') || process.env.ComSpec || 'cmd.exe';
    shellArgs = ['/d'];
  } else {
    shellCmd = cmd;
    shellArgs = fullArgs;
  }

  const spawnOptions: pty.IPtyForkOptions | pty.IWindowsPtyForkOptions = {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env,
    ...(process.platform === 'win32' ? { useConpty: true } : {}),
  };

  let ptyProcess: pty.IPty;
  try {
    ptyProcess = pty.spawn(shellCmd, shellArgs, spawnOptions);
    console.log(`[claude-launcher] PTY spawned with pid ${ptyProcess.pid}`);
  } catch (err) {
    console.error('[claude-launcher] pty.spawn failed:', err);
    throw err;
  }

  if (process.platform === 'win32') {
    setTimeout(() => {
      ptyProcess.write(`${commandLine}\r`);
    }, 80);
  }

  let hasExited = false;

  const result: PtyProcess = {
    pid: ptyProcess.pid,

    onData: (callback) => {
      return ptyProcess.onData((data: string) => callback(data));
    },

    onExit: (callback) => {
      return ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
        hasExited = true;
        callback(exitCode);
      });
    },

    write: (data: string) => {
      ptyProcess.write(data);
    },

    resize: (newCols: number, newRows: number) => {
      try {
        ptyProcess.resize(newCols, newRows);
      } catch {
        // Some PTY implementations don't support resize
      }
    },

    kill: () => {
      try {
        if (hasExited) return;
        if (process.platform === 'win32') {
          ptyProcess.write('\x03');
          ptyProcess.write('exit\r');
          return;
        }
        ptyProcess.kill();
      } catch {
        // Already dead
      }
    },

    forceKill: () => {
      try {
        if (!hasExited) ptyProcess.kill();
      } catch {
        // Already dead
      }
    },

    exited: () => hasExited,
  };

  return result;
}
