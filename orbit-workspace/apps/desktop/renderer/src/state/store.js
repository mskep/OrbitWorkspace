import { create } from 'zustand';

export const useAppStore = create((set) => ({
  // Session
  session: null,
  isAuthenticated: false,
  needsUnlock: false,
  setSession: (session) => set({
    session,
    isAuthenticated: !!session,
    needsUnlock: !!session?.needsUnlock,
  }),
  clearSession: () => set({ session: null, isAuthenticated: false, needsUnlock: false }),

  // Profile
  profile: null,
  setProfile: (profile) => set({ profile }),

  // System status
  isOnline: true,
  setOnline: (isOnline) => set({ isOnline }),

  // Tools
  tools: [],
  setTools: (tools) => set({ tools }),

  // Active workspace
  activeWorkspace: null,
  setActiveWorkspace: (workspace) => set({ activeWorkspace: workspace }),

  // User Settings
  userSettings: { theme: 'dark', language: 'en', notifications_enabled: 1 },
  setUserSettings: (userSettings) => set({ userSettings }),

  // Inbox
  unreadInbox: 0,
  setUnreadInbox: (count) => set({ unreadInbox: count }),

  // Current route/page
  currentPage: 'home',
  setCurrentPage: (page) => set({ currentPage: page }),

  // Cloud Sync
  syncStatus: {
    status: 'disconnected',
    connected: false,
    wsConnected: false,
    pendingOps: 0,
    lastError: null,
    serverUserId: null,
  },
  setSyncStatus: (syncStatus) => set({ syncStatus })
}));
