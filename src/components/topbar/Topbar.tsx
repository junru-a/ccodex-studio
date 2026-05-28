import React from 'react';
import { useAppStore } from '../../stores/app-store';
import { useSessionStore } from '../../stores/session-store';

const i18n = {
  zh: {
    noProject: '\u672a\u9009\u62e9\u9879\u76ee',
    open: '\u6253\u5f00',
    switch: '\u5207\u6362',
    terminal: '\u7ec8\u7aef',
    reading: '\u9605\u8bfb',
    engine: '\u5f15\u64ce',
    noProfiles: '\u6682\u65e0\u914d\u7f6e',
    toggleSidebar: '\u5207\u6362\u5de6\u4fa7\u9879\u76ee\u680f',
    toggleSkills: '\u5207\u6362\u53f3\u4fa7 Skills \u9762\u677f',
    pty: '\u5185\u5d4c node-pty \u7ec8\u7aef',
  },
  en: {
    noProject: 'No project',
    open: 'Open',
    switch: 'Switch',
    terminal: 'Terminal',
    reading: 'Reading',
    engine: 'Engine',
    noProfiles: 'No profiles',
    toggleSidebar: 'Toggle project sidebar',
    toggleSkills: 'Toggle Skills panel',
    pty: 'Embedded node-pty terminal',
  },
};

export const Topbar: React.FC = () => {
  const {
    activeProfileId,
    profiles,
    currentProjectPath,
    toggleSidebar,
    toggleSkillsPanel,
    setActiveProfile,
    setCurrentProjectPath,
    mainView,
    setMainView,
    language,
  } = useAppStore();

  const { loadProjects } = useSessionStore();
  const t = i18n[language];

  const handleSelectProject = async () => {
    const dir = await window.ccodex.selectDirectory();
    if (dir) {
      setCurrentProjectPath(dir);
      loadProjects();
    }
  };

  const handleProfileChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setActiveProfile(e.target.value);
  };

  const projectName = currentProjectPath
    ? currentProjectPath.split(/[/\\]/).pop() || currentProjectPath
    : t.noProject;

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <span className="topbar__mark">✶</span>
        <span className="topbar__title">CCodex Studio</span>
      </div>

      <div className="topbar__section topbar__section--tools">
        <button className="icon-btn" onClick={toggleSidebar} title={t.toggleSidebar} aria-label={t.toggleSidebar}>
          ☰
        </button>
        <button className="icon-btn" onClick={toggleSkillsPanel} title={t.toggleSkills} aria-label={t.toggleSkills}>
          ◇
        </button>
      </div>

      <button className="project-pill" onClick={handleSelectProject} title={currentProjectPath || t.open}>
        <span className="project-pill__label">{projectName}</span>
        <span className="project-pill__action">{currentProjectPath ? t.switch : t.open}</span>
      </button>

      <div className="view-switch" role="tablist" aria-label="Main view">
        <button
          className={`view-switch__item ${mainView === 'terminal' ? 'active' : ''}`}
          onClick={() => setMainView('terminal')}
        >
          {t.terminal}
        </button>
        <button
          className={`view-switch__item ${mainView === 'session-preview' ? 'active' : ''}`}
          onClick={() => setMainView('session-preview')}
        >
          {t.reading}
        </button>
      </div>

      <div className="topbar__spacer" />

      <div className="topbar__section">
        <span className="topbar__label">{t.engine}</span>
        <select className="topbar__select" value={activeProfileId || ''} onChange={handleProfileChange}>
          {profiles.length === 0 && <option value="">{t.noProfiles}</option>}
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name} ({profileModeLabel(p.mode)})
            </option>
          ))}
        </select>
      </div>

      <div className="runtime-pill" title={t.pty}>
        <span className="runtime-pill__dot" />
        PTY
      </div>
    </header>
  );
};

function profileModeLabel(mode: 'env' | 'ccr' | 'codex'): string {
  if (mode === 'ccr') return 'CCR';
  if (mode === 'codex') return 'Codex';
  return 'Claude';
}
