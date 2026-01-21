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
  Trash2,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { useAppStore } from '../../state/store';
import hubAPI from '../../api/hubApi';
import Modal from '../../components/Modal';
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
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, workspaceId: null, workspaceName: '' });
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);

  // Check if user is admin or developer
  const isAdminOrDev = profile?.role === 'ADMIN' || profile?.role === 'DEV';

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

  const openDeleteModal = (workspaceId, workspaceName) => {
    setDeleteModal({ isOpen: true, workspaceId, workspaceName });
  };

  const handleDeleteWorkspace = async () => {
    try {
      const result = await hubAPI.workspaces.delete({ id: deleteModal.workspaceId });
      if (result.success) {
        setWorkspaces(workspaces.filter(w => w.id !== deleteModal.workspaceId));

        if (activeWorkspace?.id === deleteModal.workspaceId && workspaces.length > 1) {
          const nextWorkspace = workspaces.find(w => w.id !== deleteModal.workspaceId);
          if (nextWorkspace) {
            await handleSwitchWorkspace(nextWorkspace.id);
          }
        }
        setDeleteModal({ isOpen: false, workspaceId: null, workspaceName: '' });
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
              height: '72px',
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

      {/* Collapsible Workspace Switcher */}
      <div style={{ padding: '8px 16px 16px 16px' }}>
        <div style={{
          backgroundColor: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border-default)',
          overflow: 'hidden'
        }}>
          {/* Collapsed View - Active Workspace */}
          <div
            onClick={() => setWorkspaceExpanded(!workspaceExpanded)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 12px',
              cursor: 'pointer',
              backgroundColor: 'var(--bg-secondary)',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flex: 1,
              overflow: 'hidden'
            }}>
              <Check size={14} style={{ color: 'var(--accent)', flexShrink: 0 }} />
              <span style={{
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                {activeWorkspace?.name || 'No workspace'}
              </span>
            </div>
            {workspaceExpanded ? (
              <ChevronDown size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            ) : (
              <ChevronRight size={16} style={{ color: 'var(--text-tertiary)', flexShrink: 0 }} />
            )}
          </div>

          {/* Expanded View */}
          {workspaceExpanded && (
            <div style={{
              padding: '12px',
              borderTop: '1px solid var(--border-default)'
            }}>
              {/* Header with New Button */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px'
              }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  color: 'var(--text-tertiary)',
                  letterSpacing: '0.5px'
                }}>
                  All Workspaces
                </span>
                <button
                  onClick={() => setCreating(!creating)}
                  style={{
                    padding: '4px 8px',
                    backgroundColor: creating ? 'var(--accent)' : 'transparent',
                    color: creating ? '#fff' : 'var(--accent)',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: '600',
                    transition: 'all 0.2s'
                  }}
                >
                  <Plus size={14} />
                  {creating ? 'Cancel' : 'New'}
                </button>
              </div>

              {/* Create Form */}
              {creating && (
                <form onSubmit={handleCreateWorkspace} style={{ marginBottom: '12px' }}>
                  <input
                    type="text"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Workspace name..."
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '8px 10px',
                      backgroundColor: 'var(--bg-tertiary)',
                      border: '1px solid var(--border-default)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '13px',
                      color: 'var(--text-primary)',
                      outline: 'none',
                      boxSizing: 'border-box',
                      marginBottom: '8px'
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
                      fontWeight: '600',
                      opacity: newWorkspaceName.trim() ? 1 : 0.5,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    Create
                  </button>
                </form>
              )}

              {/* All Workspaces List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '240px', overflowY: 'auto' }}>
                {workspaces.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '16px',
                    color: 'var(--text-tertiary)',
                    fontSize: '12px'
                  }}>
                    No workspaces
                  </div>
                ) : (
                  workspaces.map(workspace => {
                    const isActive = workspace.id === activeWorkspace?.id;
                    return (
                      <div
                        key={workspace.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          backgroundColor: isActive ? 'var(--accent)' : 'var(--bg-tertiary)',
                          border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-default)'}`,
                          borderRadius: 'var(--radius-sm)',
                          cursor: isActive ? 'default' : 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => !isActive && handleSwitchWorkspace(workspace.id)}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.borderColor = 'var(--accent)';
                            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.borderColor = 'var(--border-default)';
                            e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                          }
                        }}
                      >
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          flex: 1,
                          overflow: 'hidden'
                        }}>
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
                        {workspaces.length > 1 && !isActive && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openDeleteModal(workspace.id, workspace.name);
                            }}
                            style={{
                              padding: '4px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: 'var(--text-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              borderRadius: 'var(--radius-sm)',
                              transition: 'all 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.color = '#ef4444';
                              e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.color = 'var(--text-tertiary)';
                              e.currentTarget.style.backgroundColor = 'transparent';
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
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

      {/* Delete Workspace Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, workspaceId: null, workspaceName: '' })}
        onConfirm={handleDeleteWorkspace}
        title="Delete Workspace"
        message={`Are you sure you want to delete "${deleteModal.workspaceName}"? This will permanently delete all notes, links, and files in this workspace. This action cannot be undone.`}
        type="confirm"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

export default Sidebar;
