"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.launchClaudePty = launchClaudePty;
const pty = __importStar(require("node-pty"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
function resolveCommand(profile) {
    if (profile?.mode === 'ccr') {
        return { cmd: 'ccr', args: ['code'] };
    }
    if (profile?.mode === 'codex') {
        return { cmd: 'codex', args: [] };
    }
    return { cmd: 'claude', args: [] };
}
function buildEnv(profile) {
    const env = {};
    for (const [key, value] of Object.entries(process.env)) {
        if (typeof value === 'string') {
            env[key] = value;
        }
    }
    if (!profile || profile.mode !== 'env')
        return env;
    for (const [key, value] of Object.entries(profile.env)) {
        if (typeof value !== 'string')
            continue;
        if (value.startsWith('$')) {
            const resolved = process.env[value.slice(1)];
            if (resolved)
                env[key] = resolved;
        }
        else {
            env[key] = value;
        }
    }
    return env;
}
function quoteShellArg(arg) {
    if (!arg)
        return '""';
    return /[\s"&<>|^]/.test(arg) ? `"${arg.replace(/"/g, '\\"')}"` : arg;
}
function normalizeCwd(projectPath, cwd) {
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
function launchClaudePty(options) {
    const { projectPath, profile, args: extraArgs = [], cols = 120, rows = 40 } = options;
    const { cmd, args } = resolveCommand(profile);
    const env = buildEnv(profile);
    const cwd = normalizeCwd(projectPath, options.cwd);
    const fullArgs = [...args, ...extraArgs];
    const commandLine = [cmd, ...fullArgs.map(quoteShellArg)].join(' ');
    console.log(`[claude-launcher] Starting PTY: ${commandLine} in ${cwd}`);
    let shellCmd;
    let shellArgs;
    if (process.platform === 'win32') {
        shellCmd = process.env.ComSpec || 'cmd.exe';
        shellArgs = ['/d'];
    }
    else {
        shellCmd = cmd;
        shellArgs = fullArgs;
    }
    const spawnOptions = {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env,
        ...(process.platform === 'win32' ? { useConpty: true } : {}),
    };
    let ptyProcess;
    try {
        ptyProcess = pty.spawn(shellCmd, shellArgs, spawnOptions);
        console.log(`[claude-launcher] PTY spawned with pid ${ptyProcess.pid}`);
    }
    catch (err) {
        console.error('[claude-launcher] pty.spawn failed:', err);
        throw err;
    }
    if (process.platform === 'win32') {
        setTimeout(() => {
            ptyProcess.write(`${commandLine}\r`);
        }, 80);
    }
    let hasExited = false;
    const result = {
        pid: ptyProcess.pid,
        onData: (callback) => {
            return ptyProcess.onData((data) => callback(data));
        },
        onExit: (callback) => {
            return ptyProcess.onExit(({ exitCode }) => {
                hasExited = true;
                callback(exitCode);
            });
        },
        write: (data) => {
            ptyProcess.write(data);
        },
        resize: (newCols, newRows) => {
            try {
                ptyProcess.resize(newCols, newRows);
            }
            catch {
                // Some PTY implementations don't support resize
            }
        },
        kill: () => {
            try {
                if (hasExited)
                    return;
                if (process.platform === 'win32') {
                    ptyProcess.write('\x03');
                    ptyProcess.write('exit\r');
                    return;
                }
                ptyProcess.kill();
            }
            catch {
                // Already dead
            }
        },
        forceKill: () => {
            try {
                if (!hasExited)
                    ptyProcess.kill();
            }
            catch {
                // Already dead
            }
        },
        exited: () => hasExited,
    };
    return result;
}
//# sourceMappingURL=claude-launcher.js.map