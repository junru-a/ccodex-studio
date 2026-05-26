import * as pty from 'node-pty';
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

function resolveCommand(profile?: ModelProfile): { cmd: string; args: string[] } {
  if (profile?.mode === 'ccr') {
    return { cmd: 'ccr', args: ['code'] };
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

  if (!profile || profile.mode !== 'env') return env;

  for (const [key, value] of Object.entries(profile.env)) {
    if (typeof value !== 'string') continue;
    if (value.startsWith('$')) {
      const resolved = process.env[value.slice(1)];
      if (resolved) env[key] = resolved;
    } else {
      env[key] = value;
    }
  }

  return env;
}

function quoteShellArg(arg: string): string {
  if (!arg) return '""';
  return /[\s"&<>|^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
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
  const { cmd, args } = resolveCommand(profile);
  const env = buildEnv(profile);
  const cwd = options.cwd || projectPath;

  const fullArgs = [...args, ...extraArgs];
  const commandLine = [cmd, ...fullArgs.map(quoteShellArg)].join(' ');

  console.log(
    `[claude-launcher] Starting PTY: ${commandLine} in ${cwd}`
  );

  let shellCmd: string;
  let shellArgs: string[];

  if (process.platform === 'win32') {
    shellCmd = process.env.ComSpec || 'cmd.exe';
    shellArgs = ['/d'];
  } else {
    shellCmd = cmd;
    shellArgs = fullArgs;
  }

  const ptyProcess = pty.spawn(shellCmd, shellArgs, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd,
    env,
  });

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
