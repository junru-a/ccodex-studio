import * as fs from 'fs/promises';
import type { Dirent, Stats } from 'fs';
import * as path from 'path';
import { PATHS } from '../paths';

const SESSION_CACHE_VERSION = 1;
const SESSION_CACHE_PATH = path.join(PATHS.appData, 'session-cache.json');
const CLAUDE_META_READ_BYTES = 32768;
const CODEX_META_READ_BYTES = 262144;
const SCAN_YIELD_INTERVAL = 50;

interface SessionCacheFile {
  version: number;
  updatedAt: number;
  projects: ProjectSummary[];
}

let projectsRefreshPromise: Promise<ProjectSummary[]> | null = null;

export interface SessionMeta {
  id: string;
  jsonlPath: string;
  projectKey: string;
  projectPath: string;
  engine: 'claude' | 'codex';
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
 * Scan Claude Code and Codex session directories.
 */
export async function scanProjects(): Promise<ProjectSummary[]> {
  const cachedProjects = await readProjectsCache();
  if (cachedProjects) {
    refreshProjectsCacheInBackground();
    console.log('[session-manager] Returning cached projects:', cachedProjects.length);
    return cachedProjects;
  }

  return startProjectsRefresh();
}

async function refreshProjectsCache(): Promise<ProjectSummary[]> {
  const projectsByKey = new Map<string, ProjectSummary>();
  for (const project of await scanClaudeProjects()) {
    addProjectSummary(projectsByKey, project);
  }

  for (const project of await scanCodexProjects()) {
    addProjectSummary(projectsByKey, project);
  }

  const projects = Array.from(projectsByKey.values())
    .map((project) => ({
      ...project,
      sessions: project.sessions.sort((a, b) => b.updatedAt - a.updatedAt),
      sessionCount: project.sessions.length,
      lastOpenedAt: Math.max(...project.sessions.map((s) => s.updatedAt)),
    }))
    .sort((a, b) => b.lastOpenedAt - a.lastOpenedAt);

  console.log('[session-manager] Total merged projects with sessions:', projects.length);
  await writeProjectsCache(projects);
  return projects;
}

function refreshProjectsCacheInBackground(): void {
  void startProjectsRefresh().catch((err) => {
    console.error('[session-manager] Background project scan failed', err);
  });
}

function startProjectsRefresh(): Promise<ProjectSummary[]> {
  if (!projectsRefreshPromise) {
    projectsRefreshPromise = refreshProjectsCache()
      .finally(() => {
        projectsRefreshPromise = null;
      });
  }

  return projectsRefreshPromise;
}

async function readProjectsCache(): Promise<ProjectSummary[] | null> {
  try {
    const content = await fs.readFile(SESSION_CACHE_PATH, 'utf-8');
    const cache = JSON.parse(content) as SessionCacheFile;
    if (cache.version !== SESSION_CACHE_VERSION || !isProjectSummaryArray(cache.projects)) {
      return null;
    }
    return cache.projects;
  } catch {
    return null;
  }
}

async function writeProjectsCache(projects: ProjectSummary[]): Promise<void> {
  const cache: SessionCacheFile = {
    version: SESSION_CACHE_VERSION,
    updatedAt: Date.now(),
    projects,
  };
  const tempPath = `${SESSION_CACHE_PATH}.${process.pid}.${Date.now()}.tmp`;

  try {
    await fs.mkdir(PATHS.appData, { recursive: true });
    await fs.writeFile(tempPath, JSON.stringify(cache), 'utf-8');
    await fs.rename(tempPath, SESSION_CACHE_PATH);
  } catch (err) {
    console.error('[session-manager] Failed to write project cache', err);
    try {
      await fs.unlink(tempPath);
    } catch {
      // Best effort cleanup.
    }
  }
}

function isProjectSummaryArray(value: unknown): value is ProjectSummary[] {
  return Array.isArray(value) && value.every((project) => {
    if (!project || typeof project !== 'object') return false;
    const candidate = project as Partial<ProjectSummary>;
    return (
      typeof candidate.key === 'string' &&
      typeof candidate.name === 'string' &&
      typeof candidate.path === 'string' &&
      typeof candidate.lastOpenedAt === 'number' &&
      typeof candidate.sessionCount === 'number' &&
      Array.isArray(candidate.sessions)
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

function addProjectSummary(projectsByKey: Map<string, ProjectSummary>, project: ProjectSummary): void {
  const mapKey = projectMapKey(project);
  const normalizedProject = {
    ...project,
    path: normalizeProjectPath(project.path),
  };
  normalizedProject.sessions = normalizedProject.sessions.map((session) => ({
    ...session,
    projectPath: normalizeProjectPath(session.projectPath || normalizedProject.path),
  }));
  const existing = projectsByKey.get(mapKey);

  if (!existing) {
    projectsByKey.set(mapKey, normalizedProject);
    return;
  }

  const sessions = [...existing.sessions, ...normalizedProject.sessions]
    .sort((a, b) => b.updatedAt - a.updatedAt);

  projectsByKey.set(mapKey, {
    ...existing,
    path: existing.path || normalizedProject.path,
    lastOpenedAt: Math.max(existing.lastOpenedAt, normalizedProject.lastOpenedAt),
    sessionCount: sessions.length,
    sessions,
  });
}

function projectMapKey(project: ProjectSummary): string {
  const normalizedPath = normalizeProjectPath(project.path);
  return normalizedPath
    ? normalizedPath.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
    : project.key;
}

function normalizeProjectPath(projectPath: string): string {
  if (!projectPath) return '';

  try {
    return path.resolve(projectPath);
  } catch {
    return projectPath.replace(/[\\/]+$/, '');
  }
}

async function scanClaudeProjects(): Promise<ProjectSummary[]> {
  const projectsDir = PATHS.claudeProjects;
  console.log('[session-manager] Scanning projects dir:', projectsDir);
  if (!(await pathExists(projectsDir))) {
    console.log('[session-manager] Projects dir does not exist');
    return [];
  }

  const entries = await fs.readdir(projectsDir, { withFileTypes: true });
  console.log('[session-manager] Found', entries.length, 'entries');
  const projects: ProjectSummary[] = [];

  for (let i = 0; i < entries.length; i += 1) {
    await yieldAfterChunk(i);
    const entry = entries[i];
    // Accept both directories and anything that might be a directory
    // (MSYS2 symlinks may not report correctly on Windows)
    const entryPath = path.join(projectsDir, entry.name);
    let isDir = entry.isDirectory();
    if (!isDir) {
      try {
        isDir = (await fs.stat(entryPath)).isDirectory();
      } catch {
        continue;
      }
    }
    if (!isDir) continue;

    const projectKey = entry.name;
    const projectDir = entryPath;
    console.log('[session-manager] Scanning project:', projectKey);
    const sessions = await scanClaudeSessions(projectKey, projectDir);
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

async function scanClaudeSessions(
  projectKey: string,
  projectDir: string
): Promise<SessionMeta[]> {
  const sessions: SessionMeta[] = [];
  let entries: Dirent[];

  try {
    entries = await fs.readdir(projectDir, { withFileTypes: true });
  } catch {
    return [];
  }

  for (let i = 0; i < entries.length; i += 1) {
    await yieldAfterChunk(i);
    const entry = entries[i];
    if (!entry.isFile() || !entry.name.endsWith('.jsonl')) continue;
    const jsonlPath = path.join(projectDir, entry.name);
    const id = entry.name.replace(/\.jsonl$/, '');

    try {
      const stat = await fs.stat(jsonlPath);
      const meta = await extractClaudeSessionMeta(id, jsonlPath, projectKey, stat);
      if (meta) sessions.push(meta);
    } catch (err) {
      console.error('[session-manager] Error reading session', jsonlPath, err);
    }
  }

  return sessions;
}

/**
 * Read enough Claude Code JSONL metadata to identify the session.
 */
async function extractClaudeSessionMeta(
  id: string,
  jsonlPath: string,
  projectKey: string,
  stat: Stats
): Promise<SessionMeta | null> {
  if (stat.size === 0) return null;

  const buf = await readFilePrefix(jsonlPath, Math.min(stat.size, CLAUDE_META_READ_BYTES));

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
    engine: 'claude',
    title: firstUserPrompt
      ? firstUserPrompt.slice(0, 80) + (firstUserPrompt.length > 80 ? '...' : '')
      : 'Empty session',
    createdAt: stat.birthtimeMs,
    updatedAt: stat.mtimeMs,
    messageCount,
    model,
  };
}

async function scanCodexProjects(): Promise<ProjectSummary[]> {
  const sessionsDir = PATHS.codexSessions;
  console.log('[session-manager] Scanning Codex sessions dir:', sessionsDir);
  if (!(await pathExists(sessionsDir))) {
    console.log('[session-manager] Codex sessions dir does not exist');
    return [];
  }

  const history = await readCodexHistory();
  const projectsByKey = new Map<string, ProjectSummary>();
  const jsonlPaths = await walkJsonlFiles(sessionsDir);

  for (let i = 0; i < jsonlPaths.length; i += 1) {
    await yieldAfterChunk(i);
    const jsonlPath = jsonlPaths[i];
    try {
      const stat = await fs.stat(jsonlPath);
      const meta = await extractCodexSessionMeta(jsonlPath, stat, history);
      if (!meta) continue;

      const existing = projectsByKey.get(meta.projectKey);
      if (existing) {
        existing.sessions.push(meta);
        existing.sessionCount = existing.sessions.length;
        existing.lastOpenedAt = Math.max(existing.lastOpenedAt, meta.updatedAt);
      } else {
        projectsByKey.set(meta.projectKey, {
          key: meta.projectKey,
          name: meta.projectPath ? path.basename(meta.projectPath) : meta.projectKey,
          path: meta.projectPath,
          lastOpenedAt: meta.updatedAt,
          sessionCount: 1,
          sessions: [meta],
        });
      }
    } catch (err) {
      console.error('[session-manager] Error reading Codex session', jsonlPath, err);
    }
  }

  const projects = Array.from(projectsByKey.values());
  for (const project of projects) {
    project.sessions.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  console.log('[session-manager] Total Codex projects with sessions:', projects.length);
  return projects;
}

async function extractCodexSessionMeta(
  jsonlPath: string,
  stat: Stats,
  history: Map<string, string>
): Promise<SessionMeta | null> {
  if (stat.size === 0) return null;

  const id = extractCodexSessionId(jsonlPath);
  if (!id) return null;

  const buf = await readFilePrefix(jsonlPath, Math.min(stat.size, CODEX_META_READ_BYTES));

  const content = buf.toString('utf-8');
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  let cwd = '';
  let firstPrompt = history.get(id) || '';
  let model: string | undefined;
  let messageCount = 0;

  for (const line of lines) {
    try {
      const msg = JSON.parse(line);
      if (msg.type === 'session_meta') {
        cwd = msg.payload?.cwd || cwd;
        model = msg.payload?.model || msg.payload?.model_provider || model;
      }
      if (msg.type === 'event_msg' && msg.payload?.type === 'user_message') {
        messageCount += 1;
        if (!firstPrompt && typeof msg.payload.message === 'string') {
          firstPrompt = msg.payload.message;
        }
      }
      if (msg.type === 'response_item' && msg.payload?.type === 'message') {
        const role = msg.payload.role;
        if (role === 'user' || role === 'assistant') messageCount += 1;
        if (!firstPrompt && role === 'user') {
          firstPrompt = extractTextContent(msg.payload.content);
        }
      }
    } catch {
      // Skip unparseable lines.
    }
  }

  const projectPath = normalizeProjectPath(cwd || path.dirname(jsonlPath));
  const projectKey = encodeProjectPath(projectPath);

  return {
    id,
    jsonlPath,
    projectKey,
    projectPath,
    engine: 'codex',
    title: firstPrompt
      ? firstPrompt.slice(0, 80) + (firstPrompt.length > 80 ? '...' : '')
      : 'Codex session',
    createdAt: stat.birthtimeMs,
    updatedAt: stat.mtimeMs,
    messageCount: Math.max(messageCount, 1),
    model,
  };
}

function extractCodexSessionId(jsonlPath: string): string | null {
  const base = path.basename(jsonlPath, '.jsonl');
  const match = base.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i);
  return match?.[1] || null;
}

async function readFilePrefix(filePath: string, length: number): Promise<Buffer> {
  const handle = await fs.open(filePath, 'r');
  try {
    const buf = Buffer.alloc(length);
    const { bytesRead } = await handle.read(buf, 0, buf.length, 0);
    return bytesRead === buf.length ? buf : buf.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

async function walkJsonlFiles(dir: string): Promise<string[]> {
  const result: string[] = [];
  let entries: Dirent[];

  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return result;
  }

  for (let i = 0; i < entries.length; i += 1) {
    await yieldAfterChunk(i);
    const entry = entries[i];
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      result.push(...await walkJsonlFiles(entryPath));
    } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      result.push(entryPath);
    }
  }

  return result;
}

async function readCodexHistory(): Promise<Map<string, string>> {
  const history = new Map<string, string>();
  const historyPath = PATHS.codexHistory;
  if (!(await pathExists(historyPath))) return history;

  try {
    const content = await fs.readFile(historyPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try {
        const row = JSON.parse(line);
        if (typeof row.session_id === 'string' && typeof row.text === 'string' && !history.has(row.session_id)) {
          history.set(row.session_id, row.text);
        }
      } catch {
        // Skip malformed history rows.
      }
    }
  } catch {
    return history;
  }

  return history;
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
  if (!(await pathExists(jsonlPath))) return messages;

  const content = await fs.readFile(jsonlPath, 'utf-8');
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
