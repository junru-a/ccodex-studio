import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as fsSync from 'fs';
import { scanProjects, readSessionJsonl } from './services/session-manager';
import { scanAllSkills, searchLocalSkills } from './services/skills-scanner';
import {
  launchClaudePty,
  PtyProcess,
} from './services/claude-launcher';
import {
  loadProfiles,
  getActiveProfile,
  setActiveProfile,
  upsertProfile,
  deleteProfile,
  detectCCR,
} from './services/model-profiles';
import { PATHS } from './paths';
import { getProjectContext } from './services/project-context';

let currentPty: PtyProcess | null = null;
let terminalInputSeen = false;
let terminalGeneration = 0;
let terminalCreateQueue: Promise<unknown> = Promise.resolve();
let currentPtyDisposables: Array<{ dispose: () => void }> = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBlockedLocalFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/').toLowerCase();
  return (
    /(^|\/)(\.claude|\.agents|\.ccodex-studio|\.claude-code-router)(\/|$)/.test(normalized) ||
    /\.(jsonl|db|sqlite)$/i.test(filePath) ||
    /(^|\/)\.env(\.|$)/i.test(normalized)
  );
}

function resolveReadableFile(filePath: string, projectPath?: string): string {
  const base = projectPath ? path.resolve(projectPath) : process.cwd();
  const target = path.isAbsolute(filePath)
    ? path.resolve(filePath)
    : path.resolve(base, filePath);

  if (projectPath) {
    const relative = path.relative(base, target);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('File is outside the current project.');
    }
  }

  if (isBlockedLocalFile(target)) {
    throw new Error('Refusing to read local configuration or private data file.');
  }

  return target;
}

function enqueueTerminalTask<T>(task: () => Promise<T>): Promise<T> {
  const next = terminalCreateQueue.then(task, task);
  terminalCreateQueue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

function buildResumeArgs(
  profile: ReturnType<typeof getActiveProfile>,
  sessionId?: string,
  resumeEngine?: 'claude' | 'codex'
): string[] {
  if (!sessionId) return [];
  if (profile?.mode === 'codex') {
    return resumeEngine === 'codex' ? ['resume', sessionId] : ['resume', '--last'];
  }
  return ['--resume', sessionId];
}

function resolveLaunchProfile(
  profiles: ReturnType<typeof loadProfiles>,
  requestedProfileId?: string,
  resumeEngine?: 'claude' | 'codex'
) {
  if (resumeEngine === 'codex') {
    return profiles.find((p) => p.mode === 'codex')
      || (requestedProfileId ? profiles.find((p) => p.id === requestedProfileId) : undefined)
      || getActiveProfile();
  }

  if (resumeEngine === 'claude') {
    const requested = requestedProfileId ? profiles.find((p) => p.id === requestedProfileId) : undefined;
    if (requested && requested.mode !== 'codex') return requested;
    return profiles.find((p) => p.active && p.mode !== 'codex')
      || profiles.find((p) => p.mode !== 'codex')
      || requested
      || getActiveProfile();
  }

  return requestedProfileId
    ? profiles.find((p) => p.id === requestedProfileId)
    : getActiveProfile();
}

function resolveProjectPath(projectPath: string): string {
  const resolved = path.resolve(projectPath);
  const stat = fsSync.statSync(resolved);

  if (!stat.isDirectory()) {
    throw new Error(`Project path is not a directory: ${resolved}`);
  }

  return resolved;
}

async function disposeCurrentPty(): Promise<void> {
  terminalGeneration += 1;
  currentPtyDisposables.forEach((disposable) => {
    try {
      disposable.dispose();
    } catch {
      // Listener already disposed.
    }
  });
  currentPtyDisposables = [];

  if (currentPty) {
    const ptyToKill = currentPty;
    currentPty = null;
    try {
      ptyToKill.write('\x03');
      if (process.platform === 'win32') {
        ptyToKill.write('exit\r');
      }
    } catch {
      // PTY may already be gone.
    }
    await sleep(process.platform === 'win32' ? 800 : 150);
    if (!ptyToKill.exited()) {
      try {
        ptyToKill.forceKill();
      } catch {
        // PTY may already be gone.
      }
    }
    await sleep(process.platform === 'win32' ? 450 : 100);
  }
  terminalInputSeen = false;
}

export function registerIpcHandlers(mainWindow: BrowserWindow): void {
  // ── Sessions ──────────────────────────────────────────
  ipcMain.handle('session:scanProjects', async () => {
    try {
      return { success: true, data: await scanProjects() };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('session:read', async (_event, jsonlPath: string) => {
    try {
      const messages = await readSessionJsonl(jsonlPath);
      return { success: true, data: messages };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // ── Skills ────────────────────────────────────────────
  ipcMain.handle('skills:scan', async (_event, projectPath?: string) => {
    try {
      const skills = await scanAllSkills(projectPath);
      return { success: true, data: skills };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('skills:searchLocal', async (_event, query: string) => {
    try {
      const skills = await scanAllSkills();
      const results = searchLocalSkills(skills, query);
      return { success: true, data: results };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  // ── Terminal: Create PTY ──────────────────────────────
  ipcMain.handle(
    'terminal:create',
    async (_event, options: {
      projectPath: string;
      profileId?: string;
      resumeSessionId?: string;
      resumeEngine?: 'claude' | 'codex';
      cols?: number;
      rows?: number;
    }) => {
      return enqueueTerminalTask(async () => {
        try {
        const projectPath = resolveProjectPath(options.projectPath);
        console.log('[ipc] terminal:create request:', {
          ...options,
          projectPath,
          originalProjectPath: options.projectPath,
        });

        await disposeCurrentPty();
        const generation = terminalGeneration + 1;
        terminalGeneration = generation;

        const profiles = loadProfiles();
        const profile = resolveLaunchProfile(profiles, options.profileId, options.resumeEngine);

        const launchedPty = launchClaudePty({
          projectPath,
          profile,
          args: buildResumeArgs(profile, options.resumeSessionId, options.resumeEngine),
          cols: options.cols || 120,
          rows: options.rows || 40,
        });
        currentPty = launchedPty;

        // Forward PTY data to renderer
        const dataDisposable = launchedPty.onData((data: string) => {
          if (!mainWindow.isDestroyed() && currentPty === launchedPty && terminalGeneration === generation) {
            mainWindow.webContents.send('terminal:data', data);
          }
        });

        // Forward PTY exit to renderer
        const exitDisposable = launchedPty.onExit((code: number) => {
          if (!mainWindow.isDestroyed() && currentPty === launchedPty && terminalGeneration === generation) {
            mainWindow.webContents.send('terminal:exit', code);
            currentPty = null;
          }
        });
        currentPtyDisposables = [dataDisposable, exitDisposable];

        return { success: true, data: { pid: launchedPty.pid } };
      } catch (err) {
        console.error('[ipc] terminal:create error:', err);
        return { success: false, error: String(err) };
      }
      });
    }
  );

  // ── Terminal: Write input ─────────────────────────────
  ipcMain.on('terminal:input', (_event, data: string) => {
    if (currentPty) {
      if (!terminalInputSeen) {
        console.log('[ipc] terminal:input received first input');
        terminalInputSeen = true;
      }
      currentPty.write(data);
    }
  });

  // ── Terminal: Resize ──────────────────────────────────
  ipcMain.on('terminal:resize', (_event, cols: number, rows: number) => {
    if (currentPty) {
      currentPty.resize(cols, rows);
    }
  });

  // ── Terminal: Kill ────────────────────────────────────
  ipcMain.handle('terminal:kill', async () => {
    await enqueueTerminalTask(disposeCurrentPty);
  });

  // ── Model Profiles ────────────────────────────────────
  ipcMain.handle('profiles:load', async () => {
    return { success: true, data: loadProfiles() };
  });

  ipcMain.handle('profiles:setActive', async (_event, profileId: string) => {
    const profile = setActiveProfile(profileId);
    return { success: true, data: profile };
  });

  ipcMain.handle('profiles:upsert', async (_event, profile: unknown) => {
    const profiles = upsertProfile(profile as Parameters<typeof upsertProfile>[0]);
    return { success: true, data: profiles };
  });

  ipcMain.handle('profiles:delete', async (_event, profileId: string) => {
    const profiles = deleteProfile(profileId);
    return { success: true, data: profiles };
  });

  ipcMain.handle('profiles:detectCCR', async () => {
    return { success: true, data: detectCCR() };
  });

  // ── App Info ──────────────────────────────────────────
  ipcMain.handle('app:paths', async () => {
    return {
      claudeProjects: PATHS.claudeProjects,
      claudeSkills: PATHS.claudeSkills,
      appData: PATHS.appData,
      ccrConfig: PATHS.ccrConfig,
    };
  });

  ipcMain.handle('app:selectDirectory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
    });
    return result.canceled ? null : result.filePaths[0] || null;
  });

  ipcMain.handle('app:openExternal', async (_event, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle('project:context', async (_event, projectPath: string) => {
    try {
      return { success: true, data: getProjectContext(projectPath) };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });

  ipcMain.handle('file:readText', async (_event, filePath: string, projectPath?: string) => {
    try {
      const target = resolveReadableFile(filePath, projectPath);
      const stat = await fs.stat(target);
      if (!stat.isFile()) {
        return { success: false, error: 'Path is not a file.' };
      }
      if (stat.size > 1024 * 1024) {
        return { success: false, error: 'File is larger than 1 MB.' };
      }
      const text = await fs.readFile(target, 'utf8');
      return { success: true, data: { path: target, text } };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  });
}
