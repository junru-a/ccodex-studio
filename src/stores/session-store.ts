import { create } from 'zustand';
import type { ProjectSummary, SessionMeta } from '../types/shared';

interface SessionState {
  projects: ProjectSummary[];
  loading: boolean;
  error: string | null;
  selectedProject: ProjectSummary | null;
  selectedSessionId: string | null;
  sessionSearchQuery: string;

  loadProjects: () => Promise<void>;
  selectProject: (project: ProjectSummary | null) => void;
  selectSession: (sessionId: string | null) => void;
  setSessionSearch: (query: string) => void;
  filteredProjects: () => ProjectSummary[];
}

export type { ProjectSummary, SessionMeta };

export const useSessionStore = create<SessionState>((set, get) => ({
  projects: [],
  loading: false,
  error: null,
  selectedProject: null,
  selectedSessionId: null,
  sessionSearchQuery: '',

  loadProjects: async () => {
    set({ loading: true, error: null });
    try {
      const result = await window.ccodex.scanProjects();
      if (result.success) {
        set({ projects: result.data!, loading: false });
      } else {
        set({ error: result.error || 'Unknown error', loading: false });
      }
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  selectProject: (project) => set({ selectedProject: project }),
  selectSession: (sessionId) => set({ selectedSessionId: sessionId }),
  setSessionSearch: (query) => set({ sessionSearchQuery: query }),

  filteredProjects: () => {
    const { projects, sessionSearchQuery } = get();
    if (!sessionSearchQuery.trim()) return projects;
    const q = sessionSearchQuery.toLowerCase();
    return projects
      .map((p) => ({
        ...p,
        sessions: p.sessions.filter(
          (s) =>
            s.title.toLowerCase().includes(q) ||
            p.name.toLowerCase().includes(q)
        ),
      }))
      .filter((p) => p.sessions.length > 0);
  },
}));
