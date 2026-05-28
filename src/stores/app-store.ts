import { create } from 'zustand';
import type { ModelProfile, SessionEngine } from '../types/shared';

type MainView = 'terminal' | 'session-preview';
type Language = 'zh' | 'en';

interface AppState {
  sidebarVisible: boolean;
  skillsPanelVisible: boolean;
  language: Language;

  claudeRunning: boolean;
  claudePid: number | null;
  terminalOutput: string;
  lastTerminalChunk: string;
  lastDetectedError: string | null;
  mainView: MainView;
  newSessionRequestId: number;

  profiles: ModelProfile[];
  activeProfileId: string | null;
  ccrDetected: boolean;

  currentProjectPath: string | null;
  pendingResumeSessionId: string | null;
  pendingResumeEngine: SessionEngine | null;

  toggleSidebar: () => void;
  toggleSkillsPanel: () => void;
  setLanguage: (language: Language) => void;

  setClaudeRunning: (running: boolean, pid?: number | null) => void;
  appendTerminalOutput: (data: string) => void;
  clearTerminalOutput: () => void;
  setMainView: (view: MainView) => void;
  requestNewSession: () => void;

  loadProfiles: (force?: boolean) => Promise<void>;
  setActiveProfile: (profileId: string) => Promise<void>;
  detectCCR: () => Promise<void>;

  setCurrentProjectPath: (path: string | null) => void;
  requestResumeSession: (sessionId: string, projectPath: string, engine?: SessionEngine) => void;
  clearPendingResumeSession: () => void;
}

export type { ModelProfile, Language };

let profilesRequest: Promise<void> | null = null;
let ccrRequest: Promise<void> | null = null;

export const useAppStore = create<AppState>((set, get) => ({
  sidebarVisible: true,
  skillsPanelVisible: true,
  language: 'zh',

  claudeRunning: false,
  claudePid: null,
  terminalOutput: '',
  lastTerminalChunk: '',
  lastDetectedError: null,
  mainView: 'terminal',
  newSessionRequestId: 0,

  profiles: [],
  activeProfileId: null,
  ccrDetected: false,

  currentProjectPath: null,
  pendingResumeSessionId: null,
  pendingResumeEngine: null,

  toggleSidebar: () => set((s) => ({ sidebarVisible: !s.sidebarVisible })),
  toggleSkillsPanel: () => set((s) => ({ skillsPanelVisible: !s.skillsPanelVisible })),
  setLanguage: (language) => set({ language }),

  setClaudeRunning: (running, pid = null) => set({ claudeRunning: running, claudePid: pid }),
  appendTerminalOutput: (data) =>
    set((s) => {
      const nextOutput = (s.terminalOutput + data).slice(-20000);
      const maybeError = /error|failed|exception|traceback|exit code [1-9]/i.test(data)
        ? data.slice(-1200)
        : s.lastDetectedError;
      return {
        terminalOutput: nextOutput,
        lastTerminalChunk: data,
        lastDetectedError: maybeError,
      };
    }),
  clearTerminalOutput: () => set({ terminalOutput: '', lastTerminalChunk: '', lastDetectedError: null }),
  setMainView: (view) => set({ mainView: view }),
  requestNewSession: () => set((s) => ({ mainView: 'terminal', pendingResumeSessionId: null, newSessionRequestId: s.newSessionRequestId + 1 })),

  loadProfiles: async (force = false) => {
    if (!force && profilesRequest) return profilesRequest;
    if (!force && get().profiles.length > 0) return;

    profilesRequest = (async () => {
      try {
        const result = await window.ccodex.loadProfiles();
        if (result.success && result.data) {
          const profiles = result.data;
          const active = profiles.find((p) => p.active);
          set({ profiles, activeProfileId: active?.id || null });
        }
      } catch (err) {
        console.error('Failed to load profiles:', err);
      } finally {
        profilesRequest = null;
      }
    })();

    return profilesRequest;
  },

  setActiveProfile: async (profileId) => {
    try {
      await window.ccodex.setActiveProfile(profileId);
      set({ activeProfileId: profileId });
      await get().loadProfiles(true);
    } catch (err) {
      console.error('Failed to set active profile:', err);
    }
  },

  detectCCR: async () => {
    if (ccrRequest) return ccrRequest;

    ccrRequest = (async () => {
      try {
        const result = await window.ccodex.detectCCR();
        if (result.success && result.data) {
          set({ ccrDetected: result.data.installed });
        }
      } catch {
        // Detection is optional.
      } finally {
        ccrRequest = null;
      }
    })();

    return ccrRequest;
  },

  setCurrentProjectPath: (path) => set({ currentProjectPath: path }),
  requestResumeSession: (sessionId, projectPath, engine = 'claude') =>
    set({ currentProjectPath: projectPath, pendingResumeSessionId: sessionId, pendingResumeEngine: engine, mainView: 'terminal' }),
  clearPendingResumeSession: () => set({ pendingResumeSessionId: null, pendingResumeEngine: null }),
}));
