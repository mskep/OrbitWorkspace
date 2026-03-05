import { create } from 'zustand';

const DEFAULT_USER_SETTINGS = { theme: 'dark', language: 'en', notifications_enabled: 1 };
const USER_SETTINGS_STORAGE_KEY = 'orbit.userSettings';

function readPersistedUserSettings() {
  if (typeof window === 'undefined') {
    return DEFAULT_USER_SETTINGS;
  }

  try {
    const raw = window.localStorage.getItem(USER_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_USER_SETTINGS;

    const parsed = JSON.parse(raw);
    return { ...DEFAULT_USER_SETTINGS, ...(parsed || {}) };
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

function persistUserSettings(settings) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(USER_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors (private mode / quota)
  }
}

export const useAppStore = create((set) => ({
  // Session
  session: null,
  isAuthenticated: false,
  needsUnlock: false,
  setSession: (session) =>
    set({
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
  userSettings: readPersistedUserSettings(),
  setUserSettings: (userSettings) =>
    set((state) => {
      const nextSettings = { ...state.userSettings, ...(userSettings || {}) };
      persistUserSettings(nextSettings);
      return { userSettings: nextSettings };
    }),

  // Inbox
  unreadInbox: 0,
  setUnreadInbox: (count) => set({ unreadInbox: count }),

  // Current route/page
  currentPage: 'home',
  setCurrentPage: (page) => set({ currentPage: page }),

  // Toasts
  toasts: [],
  showToast: (message, type = 'info', duration = 3000) =>
    set((state) => ({
      toasts: [...state.toasts, { id: Date.now() + Math.random(), message, type, duration }],
    })),
  closeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    })),

  // Cloud Sync
  syncStatus: {
    status: 'disconnected',
    connected: false,
    wsConnected: false,
    pendingOps: 0,
    lastError: null,
    serverUserId: null,
    deviceId: null,
  },
  setSyncStatus: (syncStatus) => set({ syncStatus }),
}));
