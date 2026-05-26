import { create } from 'zustand';
import type { ProjectContext } from '../types/shared';

interface ContextState {
  projectContext: ProjectContext | null;
  loading: boolean;
  error: string | null;
  loadProjectContext: (projectPath: string | null) => Promise<void>;
}

export const useContextStore = create<ContextState>((set) => ({
  projectContext: null,
  loading: false,
  error: null,

  loadProjectContext: async (projectPath) => {
    if (!projectPath) {
      set({ projectContext: null, error: null, loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
      const result = await window.ccodex.getProjectContext(projectPath);
      if (result.success && result.data) {
        set({ projectContext: result.data, loading: false });
      } else {
        set({ error: result.error || '项目上下文读取失败', loading: false });
      }
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));
