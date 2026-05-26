import * as fs from 'fs';
import { PATHS } from '../paths';

export type ProfileMode = 'env' | 'ccr';

export interface ModelProfile {
  id: string;
  name: string;
  mode: ProfileMode;
  env: Record<string, string>;
  active: boolean;
  createdAt: number;
}

const CLAUDE_CODE_DEFAULT: ModelProfile = {
  id: 'claude-code-default',
  name: 'Claude Code Default',
  mode: 'env',
  env: {},
  active: true,
  createdAt: Date.now(),
};

/**
 * Default DeepSeek profile — values reference env vars, never store keys.
 */
const DEEPSEEK_DEFAULT: ModelProfile = {
  id: 'deepseek-default',
  name: 'DeepSeek V4 Pro',
  mode: 'env',
  env: {
    ANTHROPIC_BASE_URL: 'https://api.deepseek.com/anthropic',
    ANTHROPIC_AUTH_TOKEN: '$DEEPSEEK_API_KEY',
    ANTHROPIC_MODEL: 'deepseek-v4-pro',
    ANTHROPIC_DEFAULT_OPUS_MODEL: 'deepseek-v4-pro',
    ANTHROPIC_DEFAULT_SONNET_MODEL: 'deepseek-v4-pro',
    ANTHROPIC_DEFAULT_HAIKU_MODEL: 'deepseek-v4-flash',
    CLAUDE_CODE_SUBAGENT_MODEL: 'deepseek-v4-flash',
    CLAUDE_CODE_EFFORT_LEVEL: 'max',
  },
  active: false,
  createdAt: Date.now(),
};

function defaultProfiles(): ModelProfile[] {
  return [CLAUDE_CODE_DEFAULT, DEEPSEEK_DEFAULT];
}

/**
 * Load all model profiles from disk.
 */
export function loadProfiles(): ModelProfile[] {
  const profilesPath = PATHS.appProfiles;

  if (!fs.existsSync(profilesPath)) {
    // Ensure the app data directory exists
    const dir = PATHS.appData;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const defaults = defaultProfiles();
    saveProfiles(defaults);
    return defaults;
  }

  try {
    const raw = fs.readFileSync(profilesPath, 'utf-8');
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch {
    // Corrupted file — reset to defaults
  }

  const defaults = defaultProfiles();
  saveProfiles(defaults);
  return defaults;
}

/**
 * Save model profiles to disk.
 */
export function saveProfiles(profiles: ModelProfile[]): void {
  const dir = PATHS.appData;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(PATHS.appProfiles, JSON.stringify(profiles, null, 2), 'utf-8');
}

/**
 * Get the currently active profile.
 */
export function getActiveProfile(): ModelProfile | undefined {
  return loadProfiles().find((p) => p.active);
}

/**
 * Set a profile as active (deactivates others).
 */
export function setActiveProfile(profileId: string): ModelProfile | undefined {
  const profiles = loadProfiles();
  let found: ModelProfile | undefined;

  for (const p of profiles) {
    p.active = p.id === profileId;
    if (p.active) found = p;
  }

  saveProfiles(profiles);
  return found;
}

/**
 * Add or update a profile.
 */
export function upsertProfile(profile: ModelProfile): ModelProfile[] {
  const profiles = loadProfiles();
  const idx = profiles.findIndex((p) => p.id === profile.id);

  if (idx >= 0) {
    profiles[idx] = { ...profiles[idx], ...profile };
  } else {
    profile.createdAt = Date.now();
    profiles.push(profile);
  }

  saveProfiles(profiles);
  return profiles;
}

/**
 * Delete a profile by ID.
 */
export function deleteProfile(profileId: string): ModelProfile[] {
  let profiles = loadProfiles();
  profiles = profiles.filter((p) => p.id !== profileId);

  // If we deleted the active profile, activate the first available
  if (profiles.length > 0 && !profiles.find((p) => p.active)) {
    profiles[0].active = true;
  }

  saveProfiles(profiles);
  return profiles;
}

/**
 * Detect if claude-code-router is installed and configured.
 */
export function detectCCR(): { installed: boolean; configPath: string } {
  const configPath = PATHS.ccrConfig;
  const installed = fs.existsSync(configPath);
  return { installed, configPath };
}
