import { create } from 'zustand';
import type { SkillInfo } from '../types/shared';
import { matchesSkillCnQuery } from '../utils/skill-cn';

interface SkillsState {
  skills: SkillInfo[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedSkill: SkillInfo | null;
  usageCounts: Record<string, number>;

  loadSkills: (projectPath?: string) => Promise<void>;
  setSearchQuery: (query: string) => void;
  selectSkill: (skill: SkillInfo | null) => void;
  recordSkillUse: (skillName: string) => void;
  filteredSkills: () => SkillInfo[];
}

export type { SkillInfo };

export const useSkillsStore = create<SkillsState>((set, get) => ({
  skills: [],
  loading: false,
  error: null,
  searchQuery: '',
  selectedSkill: null,
  usageCounts: (() => {
    try {
      return JSON.parse(localStorage.getItem('ccodex.skillUsage') || '{}') as Record<string, number>;
    } catch {
      return {};
    }
  })(),

  loadSkills: async (projectPath?: string) => {
    set({ loading: true, error: null });
    try {
      const result = await window.ccodex.scanSkills(projectPath);
      if (result.success) {
        set({ skills: result.data!, loading: false });
      } else {
        set({ error: result.error || 'Unknown error', loading: false });
      }
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },

  setSearchQuery: (query) => set({ searchQuery: query }),
  selectSkill: (skill) => set({ selectedSkill: skill }),
  recordSkillUse: (skillName) =>
    set((state) => {
      const usageCounts = {
        ...state.usageCounts,
        [skillName]: (state.usageCounts[skillName] || 0) + 1,
      };
      localStorage.setItem('ccodex.skillUsage', JSON.stringify(usageCounts));
      return { usageCounts };
    }),

  filteredSkills: () => {
    const { skills, searchQuery } = get();
    if (!searchQuery.trim()) return skills;
    return skills.filter((skill) => matchesSkillCnQuery(skill, searchQuery));
  },
}));
