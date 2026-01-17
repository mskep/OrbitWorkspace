import { create } from 'zustand';

export const useAppStore = create((set) => ({
  // Session
  session: null,
  isAuthenticated: false,
  setSession: (session) => set({ session, isAuthenticated: !!session }),
  clearSession: () => set({ session: null, isAuthenticated: false }),

  // Profile
  profile: null,
  setProfile: (profile) => set({ profile }),

  // System status
  isOnline: true,
  setOnline: (isOnline) => set({ isOnline }),

  // Tools
  tools: [],
  setTools: (tools) => set({ tools }),

  // Current route/page
  currentPage: 'home',
  setCurrentPage: (page) => set({ currentPage: page })
}));
