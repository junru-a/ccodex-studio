import React, { Suspense, lazy, useCallback, useEffect, useMemo, useState } from 'react';
import { Topbar } from './components/topbar/Topbar';
import { Sidebar } from './components/sidebar/Sidebar';
import { TerminalView } from './components/main/TerminalView';
import { ProjectContextStrip } from './components/main/ProjectContextStrip';
import { useAppStore } from './stores/app-store';
import { useContextStore } from './stores/context-store';
import { useSessionStore } from './stores/session-store';
import { useSkillsStore } from './stores/skills-store';
import './styles/global.css';

const SessionPreview = lazy(() =>
  import('./components/main/SessionPreview').then((module) => ({ default: module.SessionPreview }))
);

const SkillsCenter = lazy(() =>
  import('./components/skills/SkillsCenter').then((module) => ({ default: module.SkillsCenter }))
);

export const App: React.FC = () => {
  const {
    sidebarVisible,
    skillsPanelVisible,
    detectCCR,
    loadProfiles,
    mainView,
    currentProjectPath,
  } = useAppStore();
  const loadProjects = useSessionStore((state) => state.loadProjects);
  const loadSkills = useSkillsStore((state) => state.loadSkills);
  const loadProjectContext = useContextStore((state) => state.loadProjectContext);
  const [sidebarWidth, setSidebarWidth] = useState(292);
  const [skillsWidth, setSkillsWidth] = useState(344);
  const [artifactWidth, setArtifactWidth] = useState(560);

  const layoutStyle = useMemo(() => ({
    '--sidebar-width': `${sidebarWidth}px`,
    '--skills-panel-width': `${skillsWidth}px`,
    '--artifact-width': `${artifactWidth}px`,
  }) as React.CSSProperties, [artifactWidth, sidebarWidth, skillsWidth]);

  const startResize = useCallback((pane: 'sidebar' | 'artifact' | 'skills') => {
    const move = (event: MouseEvent) => {
      const width = window.innerWidth;
      if (pane === 'sidebar') {
        setSidebarWidth(clamp(event.clientX, 220, 460));
      } else if (pane === 'skills') {
        setSkillsWidth(clamp(width - event.clientX, 280, 560));
      } else {
        const rightOffset = skillsPanelVisible ? skillsWidth : 0;
        setArtifactWidth(clamp(width - event.clientX - rightOffset, 320, 860));
      }
    };

    const up = () => {
      document.body.classList.remove('is-resizing-layout');
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
    };

    document.body.classList.add('is-resizing-layout');
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  }, [skillsPanelVisible, skillsWidth]);

  useEffect(() => {
    void loadProjects();
    void Promise.all([loadProfiles(), detectCCR()]);
  }, [detectCCR, loadProfiles, loadProjects]);

  useEffect(() => {
    return scheduleIdleTask(() => {
      void Promise.all([
        loadSkills(currentProjectPath || undefined),
        loadProjectContext(currentProjectPath),
      ]);
    }, 280);
  }, [currentProjectPath, loadProjectContext, loadSkills]);

  // Listen for menu actions from Electron main process
  useEffect(() => {
    const unsub = window.ccodex.onMenuAction((action: string) => {
      switch (action) {
        case 'toggle-sidebar':
          useAppStore.getState().toggleSidebar();
          break;
        case 'toggle-skills':
          useAppStore.getState().toggleSkillsPanel();
          break;
        case 'view-terminal':
          useAppStore.getState().setMainView('terminal');
          break;
        case 'view-preview':
          useAppStore.getState().setMainView('session-preview');
          break;
        case 'language-zh':
          useAppStore.getState().setLanguage('zh');
          break;
        case 'language-en':
          useAppStore.getState().setLanguage('en');
          break;
        case 'open-project':
          window.ccodex.selectDirectory().then((dir) => {
            if (dir) useAppStore.getState().setCurrentProjectPath(dir);
          });
          break;
        case 'settings':
          // P1: settings panel
          break;
        case 'new-session':
          useAppStore.getState().requestNewSession();
          break;
      }
    });
    return unsub;
  }, []);

  return (
    <div className="app-layout" style={layoutStyle}>
      <Topbar />
      <div className="app-body">
        <Sidebar visible={sidebarVisible} />
        {sidebarVisible && (
          <div
            className="layout-resizer layout-resizer--sidebar"
            role="separator"
            aria-orientation="vertical"
            onMouseDown={() => startResize('sidebar')}
          />
        )}
        <div className="main-content">
          <ProjectContextStrip />
          <div className={`main-workbench ${mainView === 'session-preview' ? 'main-workbench--reader-focus' : ''}`}>
            <div className="main-workbench__terminal">
              <TerminalView />
            </div>
            <div
              className="layout-resizer layout-resizer--artifact"
              role="separator"
              aria-orientation="vertical"
              onMouseDown={() => startResize('artifact')}
            />
            <Suspense fallback={<ArtifactSkeleton />}>
              <SessionPreview mode="artifact" />
            </Suspense>
          </div>
        </div>
        {skillsPanelVisible && (
          <div
            className="layout-resizer layout-resizer--skills"
            role="separator"
            aria-orientation="vertical"
            onMouseDown={() => startResize('skills')}
          />
        )}
        {skillsPanelVisible && (
          <Suspense fallback={<SkillsPanelSkeleton />}>
            <SkillsCenter visible={skillsPanelVisible} />
          </Suspense>
        )}
      </div>
    </div>
  );
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function scheduleIdleTask(task: () => void, fallbackDelay: number): () => void {
  if ('requestIdleCallback' in window) {
    const id = window.requestIdleCallback(task, { timeout: 1200 });
    return () => window.cancelIdleCallback(id);
  }

  const id = globalThis.setTimeout(task, fallbackDelay);
  return () => globalThis.clearTimeout(id);
}

const ArtifactSkeleton: React.FC = () => (
  <aside className="session-preview session-preview--artifact artifact-skeleton" aria-hidden="true">
    <div className="session-preview__toolbar">
      <div className="session-preview__toolbar-copy">
        <div className="skeleton-line skeleton-line--xs" />
        <div className="skeleton-line skeleton-line--title" />
        <div className="skeleton-line skeleton-line--medium" />
      </div>
      <div className="session-preview__actions">
        <div className="skeleton-button" />
        <div className="skeleton-button" />
      </div>
    </div>
    <div className="session-preview__grid session-preview__grid--artifact">
      <div className="context-card context-card--skeleton">
        <div className="skeleton-line skeleton-line--xs" />
        <div className="skeleton-line" />
        <div className="skeleton-line skeleton-line--wide" />
      </div>
      <div className="context-card context-card--skeleton">
        <div className="skeleton-line skeleton-line--xs" />
        <div className="skeleton-line skeleton-line--medium" />
      </div>
    </div>
  </aside>
);

const SkillsPanelSkeleton: React.FC = () => (
  <aside className="skills-panel skills-panel--skeleton" aria-hidden="true">
    <div className="skills-panel__header">
      <div className="skeleton-line skeleton-line--short" />
      <div className="skeleton-button skeleton-button--small" />
    </div>
    <div className="skills-panel__search">
      <div className="skeleton-input" />
    </div>
    <div className="skills-skeleton-list">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="skill-item skill-item--skeleton">
          <div className="skeleton-line skeleton-line--medium" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--wide" />
        </div>
      ))}
    </div>
  </aside>
);
