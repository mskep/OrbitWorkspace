export const colors = {
  // Background & Surfaces
  bg: {
    primary: '#0f1115', // Deep space
    secondary: '#161920', // Card/Sidebar
    tertiary: '#1e222b', // Hover/Elevation
    hover: 'rgba(255, 255, 255, 0.05)'
  },

  // Text Hierarchy
  text: {
    primary: '#f8fafc', // Slate 50
    secondary: '#94a3b8', // Slate 400
    tertiary: '#64748b', // Slate 500
    disabled: '#334155' // Slate 700
  },

  // Premium Accents
  accent: {
    primary: '#6366f1', // Indigo 500
    secondary: '#8b5cf6', // Violet 500
    gradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
    hover: '#818cf8',
    active: '#4f46e5',
    glow: 'rgba(99, 102, 241, 0.2)'
  },

  // Semantic Status
  status: {
    success: '#10b981', // Emerald 500
    error: '#ef4444', // Red 500
    warning: '#f59e0b', // Amber 500
    info: '#3b82f6' // Blue 500
  },

  // Borders & Dividers
  border: {
    default: 'rgba(255, 255, 255, 0.08)',
    light: 'rgba(255, 255, 255, 0.04)',
    focus: '#6366f1'
  }
};

export const spacing = {
  xs: '4px',
  sm: '8px',
  md: '16px',
  lg: '24px',
  xl: '32px',
  xxl: '48px'
};

export const borderRadius = {
  sm: '6px',
  md: '12px',
  lg: '18px',
  xl: '24px',
  full: '9999px'
};

export const shadows = {
  sm: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -2px rgba(0, 0, 0, 0.1)',
  lg: '0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.2)',
  glow: '0 0 20px rgba(99, 102, 241, 0.15)'
};

export const transitions = {
  fast: '150ms cubic-bezier(0.4, 0, 0.2, 1)',
  default: '250ms cubic-bezier(0.4, 0, 0.2, 1)',
  slow: '400ms cubic-bezier(0.4, 0, 0.2, 1)'
};
