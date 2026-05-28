import type { ProjectSummary, SkillInfo, ModelProfile, ProjectContext, IpcResult } from './shared';

interface CCodexAPI {
  // Sessions
  scanProjects: () => Promise<IpcResult<ProjectSummary[]>>;
  readSession: (jsonlPath: string) => Promise<IpcResult<object[]>>;

  // Skills
  scanSkills: (projectPath?: string) => Promise<IpcResult<SkillInfo[]>>;
  searchLocalSkills: (query: string) => Promise<IpcResult<SkillInfo[]>>;

  // Terminal (node-pty)
  terminalCreate: (options: {
    projectPath: string;
    profileId?: string;
    resumeSessionId?: string;
    resumeEngine?: 'claude' | 'codex';
    cols?: number;
    rows?: number;
  }) => Promise<IpcResult<{ pid: number }>>;
  terminalInput: (data: string) => void;
  terminalResize: (cols: number, rows: number) => void;
  terminalKill: () => Promise<void>;
  onTerminalData: (callback: (data: string) => void) => () => void;
  onTerminalExit: (callback: (code: number) => void) => () => void;

  // Model Profiles
  loadProfiles: () => Promise<IpcResult<ModelProfile[]>>;
  setActiveProfile: (profileId: string) => Promise<IpcResult<ModelProfile>>;
  upsertProfile: (profile: ModelProfile) => Promise<IpcResult<ModelProfile[]>>;
  deleteProfile: (profileId: string) => Promise<IpcResult<ModelProfile[]>>;
  detectCCR: () => Promise<IpcResult<{ installed: boolean; configPath: string }>>;

  // App Info
  getAppPaths: () => Promise<Record<string, string>>;
  selectDirectory: () => Promise<string | null>;
  openExternal: (url: string) => Promise<void>;
  getProjectContext: (projectPath: string) => Promise<IpcResult<ProjectContext>>;
  readTextFile: (filePath: string, projectPath?: string) => Promise<IpcResult<{ path: string; text: string }>>;

  // Menu Events
  onMenuAction: (callback: (action: string) => void) => () => void;
}

declare global {
  interface Window {
    ccodex: CCodexAPI;
  }
}

export {};
