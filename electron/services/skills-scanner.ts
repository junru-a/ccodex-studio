import * as fs from 'fs/promises';
import type { Dirent } from 'fs';
import * as path from 'path';
import { PATHS } from '../paths';

const SKILLS_CACHE_VERSION = 1;
const SKILLS_CACHE_PATH = path.join(PATHS.appData, 'skills-cache.json');
const SCAN_YIELD_INTERVAL = 50;

interface SkillsCacheEntry {
  updatedAt: number;
  skills: SkillInfo[];
}

interface SkillsCacheFile {
  version: number;
  entries: Record<string, SkillsCacheEntry>;
}

const skillsRefreshPromises = new Map<string, Promise<SkillInfo[]>>();
let skillsCacheWriteQueue: Promise<void> = Promise.resolve();

// Debug flag — enables verbose logging for P0 troubleshooting
const DEBUG = true;
function log(...args: unknown[]) {
  if (DEBUG) console.log('[skills-scanner]', ...args);
}

export interface SkillInfo {
  name: string;
  description: string;
  scope: 'global' | 'project' | 'plugin';
  origin?: 'claude' | 'codex' | 'agents' | 'project';
  path: string;
  source: string;          // directory name containing SKILL.md
  argumentHint?: string;
  allowedTools?: string[];
  disableModelInvocation?: boolean;
  hasScripts: boolean;
  skillMdContent: string;  // raw SKILL.md content (for preview)
}

interface SkillFrontmatter {
  name?: string;
  description?: string;
  'argument-hint'?: string;
  'allowed-tools'?: string;
  'disable-model-invocation'?: boolean;
}

/**
 * Scan all installed skills from global, project-local, and plugin directories.
 */
export async function scanAllSkills(projectPath?: string): Promise<SkillInfo[]> {
  const cacheKey = skillsCacheKey(projectPath);
  const cachedSkills = await readSkillsCache(cacheKey);
  if (cachedSkills) {
    refreshSkillsCacheInBackground(projectPath);
    log('Returning cached skills:', cachedSkills.length, 'for', cacheKey);
    return cachedSkills;
  }

  return startSkillsRefresh(projectPath);
}

async function refreshSkillsCache(projectPath?: string): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];

  // 1. Global skills (~/.claude/skills/)
  const globalSkills = await scanSkillsDir(PATHS.claudeSkills, 'global', 'claude');
  skills.push(...globalSkills);

  // 2. Also scan ~/.agents/skills/ (where skills CLI actually installs)
  if (await pathExists(PATHS.skillsCliGlobalDir)) {
    const cliSkills = await scanSkillsDir(PATHS.skillsCliGlobalDir, 'global', 'agents');
    // Deduplicate by name
    for (const sk of cliSkills) {
      if (!skills.find((s) => s.name === sk.name)) {
        skills.push(sk);
      }
    }
  }

  // 3. Codex skills (~/.codex/skills/) are shown to both engines.
  if (await pathExists(PATHS.codexSkills)) {
    const codexSkills = [
      ...(await scanSkillsDir(PATHS.codexSkills, 'global', 'codex')),
      ...(await scanSkillsDir(path.join(PATHS.codexSkills, '.system'), 'global', 'codex')),
    ];
    for (const sk of codexSkills) {
      if (!skills.find((s) => s.name === sk.name)) {
        skills.push(sk);
      }
    }
  }

  // 4. Project-local skills (.claude/skills/)
  if (projectPath) {
    const projectSkillsDir = PATHS.projectSkills(projectPath);
    const projectSkills = await scanSkillsDir(projectSkillsDir, 'project', 'project');
    skills.push(...projectSkills);
  }

  const sortedSkills = skills.sort((a, b) => a.name.localeCompare(b.name));
  await writeSkillsCache(skillsCacheKey(projectPath), sortedSkills);
  return sortedSkills;
}

function refreshSkillsCacheInBackground(projectPath?: string): void {
  void startSkillsRefresh(projectPath).catch((err) => {
    log('Background skills scan failed:', err);
  });
}

function startSkillsRefresh(projectPath?: string): Promise<SkillInfo[]> {
  const cacheKey = skillsCacheKey(projectPath);
  const existing = skillsRefreshPromises.get(cacheKey);
  if (existing) return existing;

  const refreshPromise = refreshSkillsCache(projectPath).finally(() => {
    skillsRefreshPromises.delete(cacheKey);
  });
  skillsRefreshPromises.set(cacheKey, refreshPromise);
  return refreshPromise;
}

function skillsCacheKey(projectPath?: string): string {
  if (!projectPath) return 'global';

  const normalizeKeyPath = (value: string) =>
    process.platform === 'win32' ? value.toLowerCase() : value;

  try {
    return normalizeKeyPath(path.resolve(projectPath).replace(/\\/g, '/'));
  } catch {
    return normalizeKeyPath(projectPath.replace(/\\/g, '/'));
  }
}

async function readSkillsCache(cacheKey: string): Promise<SkillInfo[] | null> {
  try {
    const content = await fs.readFile(SKILLS_CACHE_PATH, 'utf-8');
    const cache = JSON.parse(content) as SkillsCacheFile;
    const entry = cache.version === SKILLS_CACHE_VERSION ? cache.entries?.[cacheKey] : undefined;
    if (!entry || !isSkillInfoArray(entry.skills)) return null;
    return entry.skills;
  } catch {
    return null;
  }
}

async function readSkillsCacheFile(): Promise<SkillsCacheFile> {
  try {
    const content = await fs.readFile(SKILLS_CACHE_PATH, 'utf-8');
    const cache = JSON.parse(content) as SkillsCacheFile;
    if (cache.version === SKILLS_CACHE_VERSION && cache.entries && typeof cache.entries === 'object') {
      return cache;
    }
  } catch {
    // Missing or malformed cache is replaced on write.
  }

  return {
    version: SKILLS_CACHE_VERSION,
    entries: {},
  };
}

async function writeSkillsCache(cacheKey: string, skills: SkillInfo[]): Promise<void> {
  skillsCacheWriteQueue = skillsCacheWriteQueue
    .catch(() => undefined)
    .then(() => writeSkillsCacheNow(cacheKey, skills));

  return skillsCacheWriteQueue;
}

async function writeSkillsCacheNow(cacheKey: string, skills: SkillInfo[]): Promise<void> {
  const tempPath = `${SKILLS_CACHE_PATH}.${process.pid}.${Date.now()}.tmp`;

  try {
    const cache = await readSkillsCacheFile();
    cache.entries[cacheKey] = {
      updatedAt: Date.now(),
      skills,
    };

    await fs.mkdir(PATHS.appData, { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(cache), 'utf-8');
    await fs.rename(tempPath, SKILLS_CACHE_PATH);
  } catch (err) {
    log('Failed to write skills cache:', err);
    try {
      await fs.unlink(tempPath);
    } catch {
      // Best effort cleanup.
    }
  }
}

function isSkillInfoArray(value: unknown): value is SkillInfo[] {
  return Array.isArray(value) && value.every((skill) => {
    if (!skill || typeof skill !== 'object') return false;
    const candidate = skill as Partial<SkillInfo>;
    return (
      typeof candidate.name === 'string' &&
      typeof candidate.description === 'string' &&
      (candidate.scope === 'global' || candidate.scope === 'project' || candidate.scope === 'plugin') &&
      typeof candidate.path === 'string' &&
      typeof candidate.source === 'string' &&
      typeof candidate.hasScripts === 'boolean' &&
      typeof candidate.skillMdContent === 'string'
    );
  });
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function yieldToEventLoop(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

async function yieldAfterChunk(index: number): Promise<void> {
  if (index > 0 && index % SCAN_YIELD_INTERVAL === 0) {
    await yieldToEventLoop();
  }
}

async function scanSkillsDir(
  dir: string,
  scope: 'global' | 'project',
  origin: NonNullable<SkillInfo['origin']>
): Promise<SkillInfo[]> {
  const skills: SkillInfo[] = [];

  if (!(await pathExists(dir))) {
    log('Skills dir does not exist:', dir);
    return skills;
  }

  let entries: Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    log('Error reading skills dir:', dir, err);
    return skills;
  }

  log(`Scanning ${entries.length} entries in ${dir}`);

  for (let i = 0; i < entries.length; i += 1) {
    await yieldAfterChunk(i);
    const entry = entries[i];
    // On Windows with MSYS2, symlinks may appear as regular files or
    // directories. We check the actual path with stat to resolve.
    const entryPath = path.join(dir, entry.name);
    let isSkillDir = entry.isDirectory() || entry.isSymbolicLink();

    // Fallback: if Dirent says it's not a dir/symlink, check with stat
    if (!isSkillDir) {
      try {
        const st = await fs.stat(entryPath);
        isSkillDir = st.isDirectory();
      } catch {
        continue;
      }
    }

    if (!isSkillDir) continue;

    const skillDir = entry.name;
    const realName = skillDir.replace(/@$/, '');
    const skillPath = entryPath;

    // Try SKILL.md first, then skill.md, then README.md
    const skillMdPath =
      await findFile(skillPath, ['SKILL.md', 'skill.md', 'README.md']);

    if (!skillMdPath) {
      log('No SKILL.md found in', skillPath);
      continue;
    }

    try {
      const rawContent = await fs.readFile(skillMdPath, 'utf-8');
      // Normalize line endings for cross-platform frontmatter parsing
      const content = rawContent.replace(/\r\n/g, '\n');
      const frontmatter = parseFrontmatter(content);
      const hasScripts = await pathExists(path.join(skillPath, 'scripts'));

      skills.push({
        name: frontmatter.name || realName,
        description: frontmatter.description || '',
        scope,
        origin,
        path: skillPath,
        source: realName,
        argumentHint: frontmatter['argument-hint'],
        allowedTools: frontmatter['allowed-tools']
          ? frontmatter['allowed-tools']
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : undefined,
        disableModelInvocation: frontmatter['disable-model-invocation'] || false,
        hasScripts,
        skillMdContent: content,
      });
    } catch (err) {
      log('Error reading skill from', skillPath, err);
    }
  }

  log(`Found ${skills.length} skills in ${dir}`);
  return skills;
}

async function findFile(dir: string, candidates: string[]): Promise<string | null> {
  for (const name of candidates) {
    const p = path.join(dir, name);
    if (await pathExists(p)) return p;
  }
  return null;
}

function parseFrontmatter(content: string): SkillFrontmatter {
  const result: SkillFrontmatter = {};

  // Strip UTF-8 BOM if present
  const cleaned = content.replace(/^\uFEFF/, '');

  // Match YAML frontmatter between --- markers
  // Uses multiline flag + handles optional whitespace around delimiters
  const match = cleaned.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!match) {
    log('No frontmatter match in content starting with:', cleaned.slice(0, 80));
    return result;
  }

  const yaml = match[1];
  const lines = yaml.split('\n');

  for (const line of lines) {
    // Skip empty lines and comment lines
    if (!line.trim() || line.trim().startsWith('#')) continue;

    // Match key: value (simple YAML scalar)
    const kv = line.match(/^([a-zA-Z_-]+):\s*(.*)$/);
    if (!kv) continue;

    const key = kv[1].trim();
    let value: string | boolean = kv[2].trim();

    // Remove quotes
    if ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    // Remove trailing whitespace and carriage returns
    if (typeof value === 'string') {
      value = value.replace(/\r$/, '');
    }

    // Handle booleans
    if (value === 'true') value = true;
    else if (value === 'false') value = false;

    (result as Record<string, string | boolean>)[key] = value;
  }

  return result;
}

/**
 * Search local skills by name or description.
 */
export function searchLocalSkills(
  skills: SkillInfo[],
  query: string
): SkillInfo[] {
  const q = query.toLowerCase();
  return skills.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q)
  );
}
