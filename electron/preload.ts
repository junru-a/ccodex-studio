import { contextBridge, ipcRenderer } from 'electron';

const IPC_API = {
  // ── Sessions ──────────────────────────────────────────
  scanProjects: (): Promise<unknown> =>
    ipcRenderer.invoke('session:scanProjects'),

  readSession: (jsonlPath: string): Promise<unknown> =>
    ipcRenderer.invoke('session:read', jsonlPath),

  // ── Skills ────────────────────────────────────────────
  scanSkills: (projectPath?: string): Promise<unknown> =>
    ipcRenderer.invoke('skills:scan', projectPath),

  searchLocalSkills: (query: string): Promise<unknown> =>
    ipcRenderer.invoke('skills:searchLocal', query),

  // ── Terminal (node-pty) ───────────────────────────────
  terminalCreate: (options: {
    projectPath: string;
    profileId?: string;
    resumeSessionId?: string;
    cols?: number;
    rows?: number;
  }): Promise<unknown> =>
    ipcRenderer.invoke('terminal:create', options),

  terminalInput: (data: string): void =>
    ipcRenderer.send('terminal:input', data),

  terminalResize: (cols: number, rows: number): void =>
    ipcRenderer.send('terminal:resize', cols, rows),

  terminalKill: (): Promise<void> =>
    ipcRenderer.invoke('terminal:kill'),

  onTerminalData: (callback: (data: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, data: string) =>
      callback(data);
    ipcRenderer.on('terminal:data', handler);
    return () => ipcRenderer.removeListener('terminal:data', handler);
  },

  onTerminalExit: (callback: (code: number) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, code: number) =>
      callback(code);
    ipcRenderer.on('terminal:exit', handler);
    return () => ipcRenderer.removeListener('terminal:exit', handler);
  },

  // ── Model Profiles ────────────────────────────────────
  loadProfiles: (): Promise<unknown> =>
    ipcRenderer.invoke('profiles:load'),

  setActiveProfile: (profileId: string): Promise<unknown> =>
    ipcRenderer.invoke('profiles:setActive', profileId),

  upsertProfile: (profile: unknown): Promise<unknown> =>
    ipcRenderer.invoke('profiles:upsert', profile),

  deleteProfile: (profileId: string): Promise<unknown> =>
    ipcRenderer.invoke('profiles:delete', profileId),

  detectCCR: (): Promise<unknown> =>
    ipcRenderer.invoke('profiles:detectCCR'),

  // ── App Info ──────────────────────────────────────────
  getAppPaths: (): Promise<unknown> =>
    ipcRenderer.invoke('app:paths'),

  selectDirectory: (): Promise<string | null> =>
    ipcRenderer.invoke('app:selectDirectory'),

  openExternal: (url: string): Promise<void> =>
    ipcRenderer.invoke('app:openExternal', url),

  getProjectContext: (projectPath: string): Promise<unknown> =>
    ipcRenderer.invoke('project:context', projectPath),

  readTextFile: (filePath: string, projectPath?: string): Promise<unknown> =>
    ipcRenderer.invoke('file:readText', filePath, projectPath),

  // ── Menu Events ───────────────────────────────────────
  onMenuAction: (callback: (action: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, action: string) =>
      callback(action);
    ipcRenderer.on('menu:action', handler);
    return () => ipcRenderer.removeListener('menu:action', handler);
  },
} as const;

contextBridge.exposeInMainWorld('ccodex', IPC_API);

export type CCodexAPI = typeof IPC_API;
