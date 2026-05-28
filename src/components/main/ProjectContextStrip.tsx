import React from 'react';
import { useAppStore } from '../../stores/app-store';
import { useContextStore } from '../../stores/context-store';

export const ProjectContextStrip: React.FC = () => {
  const { currentProjectPath } = useAppStore();
  const { projectContext, loading } = useContextStore();

  if (!currentProjectPath) return null;

  if (loading && !projectContext) {
    return (
      <div className="project-context-strip project-context-strip--skeleton" aria-hidden="true">
        <div className="skeleton-line skeleton-line--short" />
        <div className="skeleton-line skeleton-line--xs" />
        <div className="project-context-strip__spacer" />
        <div className="skeleton-button skeleton-button--small" />
      </div>
    );
  }

  if (!projectContext) return null;

  return (
    <div className="project-context-strip">
      <span className="context-chip context-chip--strong">{projectContext.name}</span>
      {projectContext.gitBranch && <span className="context-chip">git: {projectContext.gitBranch}</span>}
      {projectContext.packageManager && <span className="context-chip">{projectContext.packageManager}</span>}
      {projectContext.markers.slice(0, 4).map((marker) => (
        <span key={marker} className="context-chip">{marker}</span>
      ))}
      <div className="project-context-strip__spacer" />
      {projectContext.suggestedCommands.slice(0, 3).map((command) => (
        <button
          key={command}
          className="skill-item__action-btn"
          onClick={() => window.ccodex.terminalInput(`${command}\r`)}
          title="发送到当前终端"
        >
          {command}
        </button>
      ))}
    </div>
  );
};
