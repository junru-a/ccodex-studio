// ── Shared types between stores and IPC ──

export type SessionEngine = 'claude' | 'codex';

export interface SessionMeta {
  id: string;
  jsonlPath: string;
  projectKey: string;
  projectPath: string;
  engine: SessionEngine;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  model?: string;
}

export interface ProjectSummary {
  key: string;
  name: string;
  path: string;
  lastOpenedAt: number;
  sessionCount: number;
  sessions: SessionMeta[];
}

export interface SkillInfo {
  name: string;
  description: string;
  scope: 'global' | 'project' | 'plugin';
  origin?: 'claude' | 'codex' | 'agents' | 'project';
  path: string;
  source: string;
  argumentHint?: string;
  allowedTools?: string[];
  disableModelInvocation?: boolean;
  hasScripts: boolean;
  skillMdContent: string;
}

export interface ModelProfile {
  id: string;
  name: string;
  mode: 'env' | 'ccr' | 'codex';
  env: Record<string, string>;
  active: boolean;
  createdAt: number;
}

export interface ProjectContext {
  path: string;
  name: string;
  gitBranch?: string;
  packageManager?: string;
  scripts: Array<{ name: string; command: string }>;
  markers: string[];
  suggestedCommands: string[];
}

// IPC response wrapper
export interface IpcResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
