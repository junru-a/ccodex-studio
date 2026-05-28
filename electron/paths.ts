import * as path from 'path';
import * as os from 'os';

const HOME = os.homedir();

// Platform-aware path resolver
function resolveHome(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(HOME, p.slice(2));
  }
  return p;
}

export const PATHS = {
  home: HOME,

  // Claude Code paths
  claudeProjects: resolveHome('~/.claude/projects'),
  claudeSkills: resolveHome('~/.claude/skills'),
  claudeSettings: resolveHome('~/.claude/settings.json'),
  claudeMemory: (projectKey: string) =>
    path.join(resolveHome('~/.claude/projects'), projectKey, 'memory'),

  // Codex paths
  codexHome: resolveHome('~/.codex'),
  codexSessions: resolveHome('~/.codex/sessions'),
  codexHistory: resolveHome('~/.codex/history.jsonl'),
  codexSkills: resolveHome('~/.codex/skills'),

  // Claude Code Router
  ccrConfig: resolveHome('~/.claude-code-router/config.json'),

  // Skills CLI
  skillsCliGlobalDir: resolveHome('~/.agents/skills'), // skills CLI uses ~/.agents/skills
  skillsCliProjectDir: (projectPath: string) =>
    path.join(projectPath, '.agents', 'skills'),

  // App data
  appData: path.join(HOME, '.ccodex-studio'),
  appProfiles: path.join(HOME, '.ccodex-studio', 'profiles.json'),
  appDb: path.join(HOME, '.ccodex-studio', 'studio.db'),

  // Project-local skills
  projectSkills: (projectPath: string) =>
    path.join(projectPath, '.claude', 'skills'),
} as const;

export function resolvePath(p: string): string {
  return resolveHome(p);
}
