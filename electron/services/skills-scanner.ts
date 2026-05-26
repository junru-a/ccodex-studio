import * as fs from 'fs';
import * as path from 'path';
import { PATHS } from '../paths';

// Debug flag — enables verbose logging for P0 troubleshooting
const DEBUG = true;
function log(...args: unknown[]) {
  if (DEBUG) console.log('[skills-scanner]', ...args);
}

export interface SkillInfo {
  name: string;
  description: string;
  scope: 'global' | 'project' | 'plugin';
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
  const skills: SkillInfo[] = [];

  // 1. Global skills (~/.claude/skills/)
  const globalSkills = scanSkillsDir(PATHS.claudeSkills, 'global');
  skills.push(...globalSkills);

  // 2. Also scan ~/.agents/skills/ (where skills CLI actually installs)
  if (fs.existsSync(PATHS.skillsCliGlobalDir)) {
    const cliSkills = scanSkillsDir(PATHS.skillsCliGlobalDir, 'global');
    // Deduplicate by name
    for (const sk of cliSkills) {
      if (!skills.find((s) => s.name === sk.name)) {
        skills.push(sk);
      }
    }
  }

  // 3. Project-local skills (.claude/skills/)
  if (projectPath) {
    const projectSkillsDir = PATHS.projectSkills(projectPath);
    const projectSkills = scanSkillsDir(projectSkillsDir, 'project');
    skills.push(...projectSkills);
  }

  return skills.sort((a, b) => a.name.localeCompare(b.name));
}

function scanSkillsDir(dir: string, scope: 'global' | 'project'): SkillInfo[] {
  const skills: SkillInfo[] = [];

  if (!fs.existsSync(dir)) {
    log('Skills dir does not exist:', dir);
    return skills;
  }

  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    log('Error reading skills dir:', dir, err);
    return skills;
  }

  log(`Scanning ${entries.length} entries in ${dir}`);

  for (const entry of entries) {
    // On Windows with MSYS2, symlinks may appear as regular files or
    // directories. We check the actual path with stat to resolve.
    const entryPath = path.join(dir, entry.name);
    let isSkillDir = entry.isDirectory() || entry.isSymbolicLink();

    // Fallback: if Dirent says it's not a dir/symlink, check with stat
    if (!isSkillDir) {
      try {
        const st = fs.statSync(entryPath);
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
      findFile(skillPath, ['SKILL.md', 'skill.md', 'README.md']);

    if (!skillMdPath) {
      log('No SKILL.md found in', skillPath);
      continue;
    }

    try {
      const rawContent = fs.readFileSync(skillMdPath, 'utf-8');
      // Normalize line endings for cross-platform frontmatter parsing
      const content = rawContent.replace(/\r\n/g, '\n');
      const frontmatter = parseFrontmatter(content);
      const hasScripts = fs.existsSync(path.join(skillPath, 'scripts'));

      skills.push({
        name: frontmatter.name || realName,
        description: frontmatter.description || '',
        scope,
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

function findFile(dir: string, candidates: string[]): string | null {
  for (const name of candidates) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) return p;
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
