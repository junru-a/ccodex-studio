import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Topbar } from './components/topbar/Topbar';
import { Sidebar } from './components/sidebar/Sidebar';
import { TerminalView } from './components/main/TerminalView';
import { SessionPreview } from './components/main/SessionPreview';
import { ProjectContextStrip } from './components/main/ProjectContextStrip';
import { SkillsCenter } from './components/skills/SkillsCenter';
import { useAppStore } from './stores/app-store';
import './styles/global.css';

export const App: React.FC = () => {
  const {
    sidebarVisible,
    skillsPanelVisible,
    detectCCR,
    loadProfiles,
    mainView,
  } = useAppStore();
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
    loadProfiles();
    detectCCR();
  }, [loadProfiles, detectCCR]);

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
            <SessionPreview mode="artifact" />
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
        <SkillsCenter visible={skillsPanelVisible} />
      </div>
    </div>
  );
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
