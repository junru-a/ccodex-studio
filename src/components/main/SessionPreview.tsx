import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../../stores/app-store';
import { useSessionStore } from '../../stores/session-store';
import type { SessionMeta } from '../../types/shared';
import { buildSessionInsight, SessionInsight } from '../../utils/session-insights';
import { renderRichText } from '../../utils/rich-text';

type SessionPreviewProps = {
  mode?: 'standalone' | 'artifact';
};

type FileArtifact = {
  path: string;
  text: string;
};

const copy = {
  zh: {
    artifact: 'Artifact',
    historyPreview: '\u5386\u53f2\u9884\u89c8',
    selectSession: '\u7b49\u5f85\u53ef\u8bfb\u5185\u5bb9',
    selectHint: '\u5de6\u4fa7\u5355\u51fb\u4f1a\u8bdd\u53ef\u9605\u8bfb\u5386\u53f2\uff1b\u7ec8\u7aef\u4ea7\u751f\u65b0\u5185\u5bb9\u540e\uff0c\u8fd9\u91cc\u4f1a\u8f7b\u91cf\u5237\u65b0\u5f53\u524d\u4f1a\u8bdd\u3002',
    focusTerminal: '\u7ec8\u7aef\u4f18\u5148',
    focusReader: '\u9605\u8bfb\u4f18\u5148',
    resume: '\u6062\u590d\u4f1a\u8bdd',
    refresh: '\u5237\u65b0',
    rendered: 'Markdown / LaTeX \u9605\u8bfb\u7248',
    reading: '\u6b63\u5728\u8bfb\u53d6...',
    readFailed: '\u8bfb\u53d6\u4f1a\u8bdd\u5931\u8d25',
    summary: '\u6458\u8981',
    nextStep: '\u4e0b\u4e00\u6b65',
    files: '\u6587\u4ef6\u7ebf\u7d22',
    filePreview: '\u6587\u4ef6\u9884\u89c8',
    noTodos: '\u6ca1\u6709\u8bc6\u522b\u5230\u660e\u786e\u5f85\u529e\u3002',
    noFiles: '\u6682\u672a\u8bc6\u522b\u5230\u6587\u4ef6\u8def\u5f84\u3002',
    user: '\u4f60',
    assistant: '\u52a9\u624b',
    tool: '\u5de5\u5177',
    system: '\u7cfb\u7edf',
  },
  en: {
    artifact: 'Artifact',
    historyPreview: 'History',
    selectSession: 'Waiting for readable content',
    selectHint: 'Click a session in the sidebar to read it. The current session refreshes lightly as Claude Code writes.',
    focusTerminal: 'Terminal focus',
    focusReader: 'Reader focus',
    resume: 'Resume',
    refresh: 'Refresh',
    rendered: 'Markdown / LaTeX reader',
    reading: 'Reading...',
    readFailed: 'Failed to read session',
    summary: 'Summary',
    nextStep: 'Next',
    files: 'Files',
    filePreview: 'File preview',
    noTodos: 'No clear todo detected.',
    noFiles: 'No file path detected.',
    user: 'You',
    assistant: 'Assistant',
    tool: 'Tool',
    system: 'System',
  },
};

export const SessionPreview: React.FC<SessionPreviewProps> = ({ mode = 'standalone' }) => {
  const {
    currentProjectPath,
    language,
    mainView,
    setMainView,
    requestResumeSession,
    profiles,
    setActiveProfile,
  } = useAppStore();
  const { projects, selectedSessionId } = useSessionStore();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<object[]>([]);
  const [fileArtifact, setFileArtifact] = useState<FileArtifact | null>(null);

  const t = copy[language];

  const selectedSession = useMemo(() => {
    const selected = findSession(projects.flatMap((project) => project.sessions), selectedSessionId);
    if (selected) return selected;

    const normalizedCurrent = normalizePath(currentProjectPath);
    const project = projects.find((candidate) => normalizePath(candidate.path) === normalizedCurrent);
    const sessions = project?.sessions || [];
    return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)[0] || null;
  }, [currentProjectPath, projects, selectedSessionId]);

  const readSelectedSession = useCallback(async (session: SessionMeta | null, quiet = false) => {
    if (!session) {
      setMessages([]);
      return;
    }

    if (!quiet) setLoading(true);
    setError(null);
    try {
      const result = await window.ccodex.readSession(session.jsonlPath);
      if (result.success && result.data) {
        setMessages(result.data);
      } else {
        setError(result.error || t.readFailed);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [t.readFailed]);

  useEffect(() => {
    readSelectedSession(selectedSession);
  }, [readSelectedSession, selectedSession?.jsonlPath]);

  useEffect(() => {
    if (!selectedSession) return;
    const timer = window.setInterval(() => {
      readSelectedSession(selectedSession, true);
    }, 4000);
    return () => window.clearInterval(timer);
  }, [readSelectedSession, selectedSession]);

  const insight: SessionInsight | null = useMemo(
    () => selectedSession ? buildSessionInsight(selectedSession, messages) : null,
    [messages, selectedSession]
  );

  const preferredFile = useMemo(() => {
    if (!insight?.changedFiles.length) return null;
    return [...insight.changedFiles]
      .reverse()
      .find((file) => /\.(md|markdown|txt)$/i.test(file)) || null;
  }, [insight]);

  useEffect(() => {
    let cancelled = false;
    if (!preferredFile || !selectedSession) {
      setFileArtifact(null);
      return;
    }

    window.ccodex.readTextFile(preferredFile, currentProjectPath || selectedSession.projectPath)
      .then((result) => {
        if (cancelled) return;
        if (result.success && result.data) {
          setFileArtifact(result.data);
        } else {
          setFileArtifact(null);
        }
      })
      .catch(() => {
        if (!cancelled) setFileArtifact(null);
      });

    return () => {
      cancelled = true;
    };
  }, [currentProjectPath, preferredFile, selectedSession]);

  const className = mode === 'artifact'
    ? 'session-preview session-preview--artifact'
    : 'session-preview';

  if (!selectedSession || !insight) {
    return (
      <aside className={`${className} session-preview--empty`}>
        <div className="session-preview__eyebrow">{mode === 'artifact' ? t.artifact : t.historyPreview}</div>
        <div className="session-preview__title">{t.selectSession}</div>
        <div className="session-preview__summary">{t.selectHint}</div>
      </aside>
    );
  }

  const latestMessages = insight.messages.slice(-12);
  const handleResumeSelected = async () => {
    if (selectedSession.engine === 'codex') {
      const codexProfile = profiles.find((profile) => profile.mode === 'codex');
      if (codexProfile) await setActiveProfile(codexProfile.id);
    }
    requestResumeSession(selectedSession.id, selectedSession.projectPath, selectedSession.engine);
  };

  return (
    <aside className={className}>
      <div className="session-preview__toolbar">
        <div className="session-preview__toolbar-copy">
          <div className="session-preview__eyebrow">{mode === 'artifact' ? t.artifact : t.historyPreview}</div>
          <div className="session-preview__title">{fileArtifact ? fileName(fileArtifact.path) : insight.title}</div>
          <div className="session-preview__summary">{fileArtifact ? fileArtifact.path : t.rendered}</div>
        </div>
        <div className="session-preview__actions">
          <button className="btn btn--small" onClick={() => readSelectedSession(selectedSession)}>
            {t.refresh}
          </button>
          <button
            className="btn btn--small"
            onClick={() => setMainView(mainView === 'session-preview' ? 'terminal' : 'session-preview')}
          >
            {mainView === 'session-preview' ? t.focusTerminal : t.focusReader}
          </button>
          <button
            className="btn btn--primary btn--small"
            onClick={handleResumeSelected}
          >
            {t.resume}
          </button>
        </div>
      </div>

      {loading && <div className="loading-spinner">{t.reading}</div>}
      {error && <div className="error-banner">{error}</div>}

      {fileArtifact ? (
        <section className="artifact-file">
          <div className="artifact-file__header">
            <span>{t.filePreview}</span>
            <code>{fileName(fileArtifact.path)}</code>
          </div>
          <div className="artifact-file__body rich-text">
            {renderRichText(fileArtifact.text)}
          </div>
        </section>
      ) : (
        <div className="session-preview__grid session-preview__grid--artifact">
          <section className="context-card">
            <div className="context-card__label">{t.summary}</div>
            <div className="context-card__body">{insight.summary}</div>
            <div className="context-card__chips">
              {insight.keywords.map((keyword) => <span key={keyword} className="context-chip">{keyword}</span>)}
            </div>
          </section>

          <section className="context-card">
            <div className="context-card__label">{t.nextStep}</div>
            {insight.todos.length ? (
              insight.todos.map((todo) => <div key={todo} className="todo-line">{todo}</div>)
            ) : (
              <div className="context-card__muted">{t.noTodos}</div>
            )}
          </section>

          <section className="context-card">
            <div className="context-card__label">{t.files}</div>
            {insight.changedFiles.length ? (
              insight.changedFiles.map((file) => <div key={file} className="file-line">{file}</div>)
            ) : (
              <div className="context-card__muted">{t.noFiles}</div>
            )}
          </section>
        </div>
      )}

      <div className="transcript-list transcript-list--artifact">
        {latestMessages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`transcript-item transcript-item--${message.role}`}>
            <div className="transcript-item__role">{roleLabel(message.role, t)}</div>
            <div className="transcript-item__text rich-text">{renderRichText(message.text)}</div>
          </div>
        ))}
      </div>
    </aside>
  );
};

function findSession(sessions: SessionMeta[], sessionId: string | null): SessionMeta | null {
  if (!sessionId) return null;
  return sessions.find((session) => session.id === sessionId) || null;
}

function normalizePath(value: string | null | undefined): string {
  return (value || '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function fileName(value: string): string {
  return value.split(/[/\\]/).pop() || value;
}

function roleLabel(role: string, t: typeof copy.zh): string {
  if (role === 'user') return t.user;
  if (role === 'assistant') return t.assistant;
  if (role === 'tool') return t.tool;
  return t.system;
}
