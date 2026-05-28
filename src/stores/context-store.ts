import { create } from 'zustand';
import type { ProjectContext } from '../types/shared';

interface ContextState {
  projectContext: ProjectContext | null;
  loading: boolean;
  error: string | null;
  loadProjectContext: (projectPath: string | null) => Promise<void>;
}

let contextRequest: Promise<void> | null = null;
let lastRequestedProjectPath: string | null = null;

export const useContextStore = create<ContextState>((set) => ({
  projectContext: null,
  loading: false,
  error: null,

  loadProjectContext: async (projectPath) => {
    if (!projectPath) {
      lastRequestedProjectPath = null;
      set({ projectContext: null, error: null, loading: false });
      return;
    }

    if (contextRequest && lastRequestedProjectPath === projectPath) return contextRequest;
    lastRequestedProjectPath = projectPath;
    set({ loading: true, error: null });
    contextRequest = (async () => {
      try {
        const result = await window.ccodex.getProjectContext(projectPath);
        if (lastRequestedProjectPath !== projectPath) return;
        if (result.success && result.data) {
          set({ projectContext: result.data, loading: false });
        } else {
          set({ error: result.error || '项目上下文读取失败', loading: false });
        }
      } catch (err) {
        if (lastRequestedProjectPath === projectPath) {
          set({ error: String(err), loading: false });
        }
      } finally {
        if (lastRequestedProjectPath === projectPath) {
          contextRequest = null;
        }
      }
    })();

    return contextRequest;
  },
}));
