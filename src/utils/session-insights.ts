import type { SessionMeta } from '../types/shared';

export type SessionPreviewMessage = {
  role: 'user' | 'assistant' | 'tool' | 'system';
  text: string;
};

export type SessionInsight = {
  title: string;
  summary: string;
  todos: string[];
  changedFiles: string[];
  keywords: string[];
  messages: SessionPreviewMessage[];
};

const ZH = {
  toolCall: '\u8c03\u7528\u5de5\u5177',
  history: '\u5386\u53f2\u4f1a\u8bdd',
  frontend: '\u524d\u7aef',
  docs: '\u6587\u6863',
  paper: '\u8bba\u6587',
  debug: '\u8c03\u8bd5',
  data: '\u6570\u636e\u5206\u6790',
  skills: 'Skills',
};

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';

  return content
    .map((block) => {
      if (!block || typeof block !== 'object') return '';
      const typed = block as { type?: string; text?: string; name?: string; content?: unknown };
      if (typed.type === 'text') return typed.text || '';
      if (typed.type === 'tool_use') return `${ZH.toolCall} ${typed.name || 'tool'}`;
      if (typed.type === 'tool_result') return textFromContent(typed.content);
      return typed.text || '';
    })
    .filter(Boolean)
    .join('\n');
}

function classifyRole(msg: Record<string, unknown>): SessionPreviewMessage['role'] {
  const type = String(msg.type || '');
  if (type === 'user') return 'user';
  if (type === 'assistant') return 'assistant';
  if (type.includes('tool') || type.includes('result')) return 'tool';
  return 'system';
}

function collectKeywords(text: string): string[] {
  const rules: Array<[RegExp, string]> = [
    [/react|tsx|component|css|ui|frontend|\u9875\u9762|\u7ec4\u4ef6|\u754c\u9762/i, ZH.frontend],
    [/pdf|docx|pptx|xlsx|excel|word|\u6587\u6863|\u8868\u683c/i, ZH.docs],
    [/paper|literature|citation|\u8bba\u6587|\u6587\u732e|\u7efc\u8ff0/i, ZH.paper],
    [/test|build|tsc|webpack|error|failed|\u62a5\u9519|\u7f16\u8bd1/i, ZH.debug],
    [/github|pull request|commit|ci|actions/i, 'GitHub'],
    [/data|analysis|plot|\u7edf\u8ba1|\u5206\u6790|\u53ef\u89c6\u5316/i, ZH.data],
    [/skill|skills|\u63d2\u4ef6|\u6280\u80fd/i, ZH.skills],
  ];

  return rules.filter(([pattern]) => pattern.test(text)).map(([, label]) => label).slice(0, 6);
}

function collectTodos(text: string): string[] {
  const todos = new Set<string>();
  const lines = text.split(/\r?\n/);
  const todoPrefix = /^(todo|\u5f85\u529e|\u4e0b\u4e00\u6b65|next|fix|\u4fee\u590d|\u9700\u8981)[:\uff1a-]/i;
  const suggestLine = /\u9700\u8981|\u5efa\u8bae|\u4e0b\u4e00\u6b65|\u8fd8\u8981|\u5f85\u9a8c\u8bc1/;

  for (const line of lines) {
    const trimmed = line.trim();
    if (todoPrefix.test(trimmed)) {
      todos.add(trimmed.replace(todoPrefix, '').trim());
    }
    if (suggestLine.test(trimmed) && trimmed.length < 120) {
      todos.add(trimmed);
    }
    if (todos.size >= 5) break;
  }
  return Array.from(todos);
}

function collectChangedFiles(text: string): string[] {
  return collectReadableFiles(text);
}

function collectReadableFiles(text: string): string[] {
  const extensions = 'tsx|ts|js|jsx|css|json|md|markdown|py|txt';
  const absoluteWindowsPath = new RegExp(
    `[A-Za-z]:[\\\\/](?:[^\\\\/:*?"<>|\\r\\n\\s，。；、]+[\\\\/])*[^\\\\/:*?"<>|\\r\\n\\s，。；、]+\\.(${extensions})\\b`,
    'gi'
  );
  const relativePath = new RegExp(
    `(?:\\.{1,2}[\\\\/])?(?:[\\w.-]+[\\\\/])+[\\w.-]+\\.(${extensions})\\b|\\b[\\w.-]+\\.(${extensions})\\b`,
    'gi'
  );

  const absoluteMatches = [...text.matchAll(absoluteWindowsPath)]
    .map((match) => cleanReadableFile(match[0]));
  const relativeMatches = [...text.matchAll(relativePath)]
    .map((match) => cleanReadableFile(match[0]))
    .filter((match) => !absoluteMatches.some((absolute) => normalizeReadableFile(absolute).endsWith(normalizeReadableFile(match))));
  const matches = [...absoluteMatches, ...relativeMatches];

  return Array.from(new Set(matches.filter(Boolean))).slice(0, 8);
}

function cleanReadableFile(value: string): string {
  return value.trim().replace(/[),.;:，。；、）】》]+$/g, '');
}

function normalizeReadableFile(value: string): string {
  return value.replace(/\\/g, '/').toLowerCase();
}

export function buildSessionInsight(session: SessionMeta | null, rawMessages: object[]): SessionInsight {
  const messages: SessionPreviewMessage[] = [];

  for (const raw of rawMessages) {
    const msg = raw as Record<string, unknown>;
    const role = classifyRole(msg);
    const message = msg.message as Record<string, unknown> | undefined;
    const text = textFromContent(message?.content ?? msg.content);
    if (!text.trim()) continue;
    messages.push({ role, text: text.trim().slice(0, 2000) });
    if (messages.length >= 80) break;
  }

  const joined = messages.map((m) => m.text).join('\n');
  const firstUser = messages.find((m) => m.role === 'user')?.text || session?.title || ZH.history;
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')?.text || '';
  const summary = lastAssistant
    ? lastAssistant.split(/\r?\n/).find((line) => line.trim().length > 8)?.trim().slice(0, 180) || lastAssistant.slice(0, 180)
    : firstUser.slice(0, 180);

  return {
    title: session?.title || firstUser.slice(0, 80),
    summary,
    todos: collectTodos(joined),
    changedFiles: collectChangedFiles(joined),
    keywords: collectKeywords(joined),
    messages,
  };
}
