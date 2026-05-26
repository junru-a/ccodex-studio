import React, { useEffect, useRef, useState } from 'react';
import { useSessionStore } from '../../stores/session-store';
import { useAppStore } from '../../stores/app-store';

const i18n = {
  zh: {
    newChat: '\u65b0\u5bf9\u8bdd',
    search: '\u641c\u7d22',
    searchTitle: '\u641c\u7d22\u9879\u76ee\u548c\u5386\u53f2\u4f1a\u8bdd',
    newChatTitle: '\u542f\u52a8\u4e00\u4e2a\u65b0\u7684 Claude Code \u4f1a\u8bdd',
    searchPlaceholder: '\u641c\u7d22\u9879\u76ee\u6216\u5386\u53f2\u4f1a\u8bdd...',
    projects: '\u9879\u76ee',
    chats: '\u5bf9\u8bdd',
    loading: '\u6b63\u5728\u8bfb\u53d6\u5386\u53f2\u4f1a\u8bdd...',
    empty: '\u6682\u65e0 Claude Code \u5386\u53f2\u3002',
    emptyHint: '\u5728\u9879\u76ee\u91cc\u8fd0\u884c claude \u540e\u4f1a\u51fa\u73b0\u5728\u8fd9\u91cc\u3002',
    session: '\u6761\u4f1a\u8bdd',
    msg: '\u6761',
    minute: '\u5206',
    hour: '\u5c0f\u65f6',
    day: '\u5929',
    previewHint: '\u5355\u51fb\u9884\u89c8\uff0c\u53cc\u51fb\u6062\u590d\u5230 Claude Code',
    chatsHint: '\u9009\u62e9\u5386\u53f2\u53ef\u9884\u89c8\uff0c\u53cc\u51fb\u53ef\u6062\u590d\u3002',
  },
  en: {
    newChat: 'New chat',
    search: 'Search',
    searchTitle: 'Search projects and session history',
    newChatTitle: 'Start a fresh Claude Code session',
    searchPlaceholder: 'Search projects or sessions...',
    projects: 'Projects',
    chats: 'Chats',
    loading: 'Loading session history...',
    empty: 'No Claude Code history found.',
    emptyHint: 'Run claude in a project and it will appear here.',
    session: 'sessions',
    msg: 'msgs',
    minute: 'm',
    hour: 'h',
    day: 'd',
    previewHint: 'Click to preview, double-click to resume in Claude Code',
    chatsHint: 'Select history to preview. Double-click to resume.',
  },
};

export const Sidebar: React.FC<{ visible: boolean }> = ({ visible }) => {
  const {
    projects,
    loading,
    error,
    sessionSearchQuery,
    loadProjects,
    selectProject,
    selectSession,
    setSessionSearch,
  } = useSessionStore();
  const {
    setCurrentProjectPath,
    requestResumeSession,
    requestNewSession,
    currentProjectPath,
    language,
  } = useAppStore();

  const t = i18n[language];
  const searchRef = useRef<HTMLInputElement>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  const q = sessionSearchQuery.trim().toLowerCase();
  const displayProjects = q
    ? projects
        .map((p) => ({
          ...p,
          sessions: p.sessions.filter(
            (s) => s.title.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)
          ),
        }))
        .filter((p) => p.sessions.length > 0)
    : projects;

  const handleProjectClick = (project: (typeof projects)[number]) => {
    selectProject(project);
    setCurrentProjectPath(project.path);
    setExpandedKey((prev) => (prev === project.key ? null : project.key));
  };

  const handleSessionClick = (session: (typeof projects)[number]['sessions'][number]) => {
    selectSession(session.id);
    setCurrentProjectPath(session.projectPath);
    useAppStore.getState().setMainView('session-preview');
    setActiveSessionId(session.id);
  };

  const handleSessionDoubleClick = (session: (typeof projects)[number]['sessions'][number]) => {
    selectSession(session.id);
    setActiveSessionId(session.id);
    requestResumeSession(session.id, session.projectPath);
  };

  return (
    <aside className={`sidebar ${!visible ? 'hidden' : ''}`}>
      <nav className="sidebar__quick-actions" aria-label="Quick actions">
        <button className="sidebar-action" onClick={requestNewSession} title={t.newChatTitle}>
          <span className="sidebar-action__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14" /><path d="M16.5 4.5h-9a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h9a3 3 0 0 0 3-3v-9" /></svg>
          </span>
          <span>{t.newChat}</span>
        </button>
        <button className="sidebar-action" onClick={() => searchRef.current?.focus()} title={t.searchTitle}>
          <span className="sidebar-action__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          </span>
          <span>{t.search}</span>
        </button>
      </nav>

      <div className="sidebar__search">
        <input
          ref={searchRef}
          type="text"
          placeholder={t.searchPlaceholder}
          value={sessionSearchQuery}
          onChange={(e) => setSessionSearch(e.target.value)}
        />
      </div>

      {error && <div className="error-banner">{error}</div>}

      <div className="sidebar__list">
        <div className="sidebar__section-header">{t.projects}</div>

        {loading && <div className="loading-spinner">{t.loading}</div>}

        {!loading && displayProjects.length === 0 && (
          <div className="sidebar__empty">
            {t.empty}<br />
            {t.emptyHint}
          </div>
        )}

        {displayProjects.map((project) => {
          const isExpanded = expandedKey === project.key;
          const isCurrent = currentProjectPath === project.path;
          return (
            <div key={project.key} className="project-group">
              <button
                className={`project-item ${isExpanded ? 'active' : ''} ${isCurrent ? 'current' : ''}`}
                onClick={() => handleProjectClick(project)}
                title={project.path}
              >
                <span className="project-item__icon">{isExpanded ? '\u25be' : '\u25b8'}</span>
                <span className="project-item__folder" aria-hidden="true">
                  <svg viewBox="0 0 24 24"><path d="M3.5 7.5h6l2 2h9v8a2 2 0 0 1-2 2h-15a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z" /><path d="M3.5 7.5V5.8a1.8 1.8 0 0 1 1.8-1.8h4.2l2 2h7.2a1.8 1.8 0 0 1 1.8 1.8v1.7" /></svg>
                </span>
                <span className="project-item__info">
                  <span className="project-item__name">{project.name}</span>
                  <span className="project-item__meta">
                    {project.sessionCount} {t.session}{project.path ? ` · ${project.path}` : ''}
                  </span>
                </span>
              </button>

              {isExpanded &&
                project.sessions.map((session) => (
                  <button
                    key={session.id}
                    className={`session-item ${activeSessionId === session.id ? 'active' : ''}`}
                    onClick={() => handleSessionClick(session)}
                    onDoubleClick={() => handleSessionDoubleClick(session)}
                    title={t.previewHint}
                  >
                    <span className="session-item__content">
                      <span className="session-item__title">{session.title}</span>
                      <span className="session-item__meta">
                        <span>{formatDate(session.updatedAt, language)}</span>
                        <span>{session.messageCount} {t.msg}</span>
                        {session.model && <span>{session.model}</span>}
                      </span>
                    </span>
                  </button>
                ))}
            </div>
          );
        })}

        <div className="sidebar__section-header sidebar__section-header--bottom">{t.chats}</div>
        <div className="sidebar__empty sidebar__empty--compact">{t.chatsHint}</div>
      </div>
    </aside>
  );
};

function formatDate(ts: number, language: 'zh' | 'en'): string {
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();

  if (diff < 3600000) {
    const value = Math.max(1, Math.floor(diff / 60000));
    return language === 'zh' ? `${value} \u5206` : `${value}m`;
  }
  if (diff < 86400000) {
    const value = Math.floor(diff / 3600000);
    return language === 'zh' ? `${value} \u5c0f\u65f6` : `${value}h`;
  }
  if (diff < 604800000) {
    const value = Math.floor(diff / 86400000);
    return language === 'zh' ? `${value} \u5929` : `${value}d`;
  }
  return d.toLocaleDateString();
}
