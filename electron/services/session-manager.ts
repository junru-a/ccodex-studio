import * as fs from 'fs';
import * as path from 'path';
import { PATHS } from '../paths';

export interface SessionMeta {
  id: string;
  jsonlPath: string;
  projectKey: string;
  projectPath: string;
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

/**
 * Scan ~/.claude/projects/ for all project directories and their sessions.
 */
export async function scanProjects(): Promise<ProjectSummary[]> {
  const projectsDir = PATHS.claudeProjects;
  console.log('[session-manager] Scanning projects dir:', projectsDir);
  if (!fs.existsSync(projectsDir)) {
    console.log('[session-manager] Projects dir does not exist');
    return [];
  }

  const entries = fs.readdirSync(projectsDir, { withFileTypes: true });
  console.log('[session-manager] Found', entries.length, 'entries');
  const projects: ProjectSummary[] = [];

  for (const entry of entries) {
    // Accept both directories and anything that might be a directory
    // (MSYS2 symlinks may not report correctly on Windows)
    const entryPath = path.join(projectsDir, entry.name);
    let isDir = entry.isDirectory();
    if (!isDir) {
      try {
        isDir = fs.statSync(entryPath).isDirectory();
      } catch {
        continue;
      }
    }
    if (!isDir) continue;

    const projectKey = entry.name;
    const projectDir = entryPath;
    console.log('[session-manager] Scanning project:', projectKey);
    const sessions = await scanSessions(projectKey, projectDir);
    console.log('[session-manager] Project', projectKey, 'has', sessions.length, 'sessions');

    if (sessions.length === 0) continue;

    const projectPath = decodeProjectPath(projectKey);
    const lastOpenedAt = Math.max(...sessions.map((s) => s.updatedAt));

    projects.push({
      key: projectKey,
      name: projectPath ? path.basename(projectPath) : projectKey,
      path: projectPath || '',
      lastOpenedAt,
      sessionCount: sessions.length,
      sessions: sessions.sort((a, b) => b.updatedAt - a.updatedAt),
    });
  }

  console.log('[session-manager] Total projects with sessions:', projects.length);
  return projects.sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);
}

async function scanSessions(
  projectKey: string,
  projectDir: string
): Promise<SessionMeta[]> {
  const sessions: SessionMeta[] = [];
  let entries: fs.Dirent[];

  try {
    entries = fs.readdirSync(projectDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
    const jsonlPath = path.join(projectDir, entry.name);
    const id = entry.name.replace(/\.jsonl$/, '');

    try {
      const stat = fs.statSync(jsonlPath);
      const meta = extractSessionMetaSync(id, jsonlPath, projectKey, stat);
      if (meta) sessions.push(meta);
    } catch (err) {
      console.error('[session-manager] Error reading session', jsonlPath, err);
    }
  }

  return sessions;
}

/**
 * Read session metadata synchronously (avoid async readline issues in Electron).
 *
 * Claude Code JSONL format: each line is a JSON object with:
 *   {"type":"user","message":{"role":"user","content":[...]}}
 *   {"type":"assistant","message":{"role":"assistant","content":[...],"model":"..."}}
 *   {"type":"file-history-snapshot",...}
 */
function extractSessionMetaSync(
  id: string,
  jsonlPath: string,
  projectKey: string,
  stat: fs.Stats
): SessionMeta | null {
  if (stat.size === 0) return null;

  // Read first 32KB of the file — enough to find the first user message
  const fd = fs.openSync(jsonlPath, 'r');
  const buf = Buffer.alloc(Math.min(stat.size, 32768));
  fs.readSync(fd, buf, 0, buf.length, 0);
  fs.closeSync(fd);

  const content = buf.toString('utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());

  if (lines.length === 0) return null;

  let firstUserPrompt = '';
  let model: string | undefined;

  for (const line of lines) {
    try {
      const msg = JSON.parse(line);

      // Claude Code JSONL: top-level "type" indicates role
      // User messages: {"type":"user","message":{"role":"user","content":[...]}}
      if (msg.type === 'user' && !firstUserPrompt) {
        // Content can be at msg.message.content or msg.content
        const content = msg.message?.content || msg.content;
        const text = extractTextContent(content);
        if (text) firstUserPrompt = text;
      }

      // Model info is in assistant messages: msg.message.model
      if (!model && msg.message?.model) {
        model = msg.message.model;
      }
    } catch {
      // Skip unparseable lines
    }
  }

  // Approximate total message count from file size
  const avgLineSize = stat.size / Math.max(lines.length, 1);
  const messageCount = Math.max(lines.length, Math.floor(stat.size / Math.max(avgLineSize, 1)));

  return {
    id,
    jsonlPath,
    projectKey,
    projectPath: decodeProjectPath(projectKey),
    title: firstUserPrompt
      ? firstUserPrompt.slice(0, 80) + (firstUserPrompt.length > 80 ? '...' : '')
      : 'Empty session',
    createdAt: stat.birthtimeMs,
    updatedAt: stat.mtimeMs,
    messageCount,
    model,
  };
}

function extractTextContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((b: { type?: string }) => b.type === 'text')
      .map((b: { text?: string }) => b.text || '')
      .join(' ');
  }
  return '';
}

/**
 * Decode Claude Code's project directory key back to a real filesystem path.
 */
function decodeProjectPath(key: string): string {
  // Windows paths: D--example-project -> D:\example\project
  const winDriveMatch = key.match(/^([A-Z])--(.*)$/);
  if (winDriveMatch) {
    const drive = winDriveMatch[1];
    const rest = winDriveMatch[2].replace(/-/g, '\\');
    return `${drive}:\\${rest}`;
  }

  // Unix paths
  const unixPath = key.replace(/-/g, '/');
  if (key.startsWith('-')) {
    return '/' + unixPath.slice(1);
  }
  return unixPath;
}

/**
 * Read the full JSONL content of a session.
 */
export async function readSessionJsonl(jsonlPath: string): Promise<object[]> {
  const messages: object[] = [];
  if (!fs.existsSync(jsonlPath)) return messages;

  const content = fs.readFileSync(jsonlPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());

  for (const line of lines) {
    try {
      messages.push(JSON.parse(line));
    } catch {
      // skip malformed lines
    }
  }
  return messages;
}

export function encodeProjectPath(realPath: string): string {
  const normalized = path.normalize(realPath);

  if (process.platform === 'win32') {
    const drive = normalized.charAt(0).toUpperCase();
    const rest = normalized.slice(3).replace(/\\/g, '-');
    return `${drive}--${rest}`;
  }

  return normalized.replace(/\//g, '-');
}
