import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Wrench,
  FileText,
  Link,
  ShoppingBag,
  User,
  Settings,
  WifiOff,
  Shield,
  Plus,
  Check,
  Trash2
} from 'lucide-react';
import { useAppStore } from '../../state/store';
import hubAPI from '../../api/hubApi';
import orbitLogo from '../../assets/orbitlogo.png';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useAppStore((state) => state.isOnline);
  const profile = useAppStore((state) => state.profile);

  // Workspace state
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [creating, setCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');

  // Check if user is admin or developer
  const isAdminOrDev = profile?.role === 'ADMIN' || profile?.role === 'DEVELOPER';

  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      const result = await hubAPI.workspaces.getAll();
      if (result.success) {
        setWorkspaces(result.workspaces);
      }

      const activeResult = await hubAPI.workspaces.getActive();
      if (activeResult.success) {
        setActiveWorkspace(activeResult.workspace);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
    }
  };

  const handleSwitchWorkspace = async (workspaceId) => {
    try {
      const result = await hubAPI.workspaces.switch({ workspaceId });
      if (result.success) {
        setActiveWorkspace(result.workspace);
        window.location.reload(); // Refresh to update all workspace-dependent data
      }
    } catch (err) {
      console.error('Failed to switch workspace:', err);
    }
  };

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    if (!newWorkspaceName.trim()) return;

    try {
      const result = await hubAPI.workspaces.create({ name: newWorkspaceName });
      if (result.success) {
        setWorkspaces([...workspaces, result.workspace]);
        setNewWorkspaceName('');
        setCreating(false);
        await handleSwitchWorkspace(result.workspace.id);
      }
    } catch (err) {
      console.error('Failed to create workspace:', err);
    }
  };

  const handleDeleteWorkspace = async (workspaceId, workspaceName) => {
    if (!confirm(`Delete workspace "${workspaceName}"? This will delete all notes, links, and files in this workspace.`)) {
      return;
    }

    try {
      const result = await hubAPI.workspaces.delete({ id: workspaceId });
      if (result.success) {
        setWorkspaces(workspaces.filter(w => w.id !== workspaceId));

        if (activeWorkspace?.id === workspaceId && workspaces.length > 1) {
          const nextWorkspace = workspaces.find(w => w.id !== workspaceId);
          if (nextWorkspace) {
            await handleSwitchWorkspace(nextWorkspace.id);
          }
        }
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
    }
  };

  const menuItems = [
    { id: 'home', label: 'Dashboard', icon: <Home size={20} />, path: '/home' },
    { id: 'tools', label: 'My Tools', icon: <Wrench size={20} />, path: '/tools' },
    { id: 'notes', label: 'Notes', icon: <FileText size={20} />, path: '/notes' },
    { id: 'links', label: 'Quick Links', icon: <Link size={20} />, path: '/links' },
    { id: 'store', label: 'Tool Store', icon: <ShoppingBag size={20} />, path: '/store' },
    { id: 'profile', label: 'Profile', icon: <User size={20} />, path: '/profile' },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} />, path: '/settings' }
  ];

  // Admin section - only for ADMIN and DEVELOPER roles
  const adminItems = isAdminOrDev ? [
    { id: 'admin', label: 'Admin Panel', icon: <Shield size={20} />, path: '/admin', isAdmin: true }
  ] : [];

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="sidebar">
      <div className="sidebar-header" style={{ paddingTop: '12px', paddingBottom: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '8px'
        }}>
          <img
            src={orbitLogo}
            alt="Orbit Logo"
            style={{
              height: '64px',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
            }}
          />
        </div>
        {!isOnline && (
          <div className="offline-indicator">
            <WifiOff size={12} style={{ marginRight: '4px' }} />
            Offline
          </div>
        )}
      </div>

      {/* Workspace Switcher */}
      <div style={{ padding: '0 12px 12px 12px' }}>
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          padding: '12px',
          border: '1px solid var(--border-default)'
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '8px'
          }}>
            <span style={{
              fontSize: '11px',
              fontWeight: '700',
              textTransform: 'uppercase',
              color: 'var(--text-tertiary)',
              letterSpacing: '0.5px'
            }}>
              Workspace
            </span>
            <button
              onClick={() => setCreating(!creating)}
              style={{
                padding: '4px',
                backgroundColor: 'transparent',
                color: 'var(--accent)',
                border: 'none',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Plus size={14} />
            </button>
          </div>

          {creating && (
            <form onSubmit={handleCreateWorkspace} style={{ marginBottom: '8px' }}>
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(e) => setNewWorkspaceName(e.target.value)}
                placeholder="Workspace name..."
                autoFocus
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  boxSizing: 'border-box',
                  marginBottom: '4px'
                }}
              />
              <button
                type="submit"
                disabled={!newWorkspaceName.trim()}
                style={{
                  width: '100%',
                  padding: '6px',
                  backgroundColor: 'var(--accent)',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: newWorkspaceName.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '12px',
                  fontWeight: '500',
                  opacity: newWorkspaceName.trim() ? 1 : 0.5
                }}
              >
                Create
              </button>
            </form>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {workspaces.map(workspace => {
              const isActive = activeWorkspace?.id === workspace.id;
              return (
                <div
                  key={workspace.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px',
                    backgroundColor: isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'transparent'}`,
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => !isActive && handleSwitchWorkspace(workspace.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
                    {isActive && <Check size={14} color="#fff" />}
                    <span style={{
                      fontSize: '13px',
                      fontWeight: isActive ? '600' : '500',
                      color: isActive ? '#fff' : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {workspace.name}
                    </span>
                  </div>
                  {!isActive && workspaces.length > 1 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteWorkspace(workspace.id, workspace.name);
                      }}
                      style={{
                        padding: '4px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-tertiary)'
                      }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <nav className="sidebar-nav">
        {/* Regular menu items */}
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}

        {/* Admin section separator */}
        {adminItems.length > 0 && (
          <div style={{
            height: '1px',
            backgroundColor: 'var(--border-default)',
            margin: '12px 16px'
          }} />
        )}

        {/* Admin menu items */}
        {adminItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            style={{
              background: isActive(item.path)
                ? 'linear-gradient(135deg, rgba(102, 126, 234, 0.15) 0%, rgba(118, 75, 162, 0.15) 100%)'
                : 'transparent',
              borderLeft: isActive(item.path) ? '3px solid #667eea' : 'none'
            }}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
