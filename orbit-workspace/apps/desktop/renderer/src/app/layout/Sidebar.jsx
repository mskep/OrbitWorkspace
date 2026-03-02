import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Wrench,
  LockKeyhole,
  FileText,
  Link,
  Inbox,
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
import { useI18n } from '../../i18n';
import { playNotificationSound } from '../../utils/notificationSound';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useAppStore((state) => state.isOnline);
  const profile = useAppStore((state) => state.profile);
  const activeWorkspace = useAppStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useAppStore((state) => state.setActiveWorkspace);
  const unreadInbox = useAppStore((state) => state.unreadInbox);
  const setUnreadInbox = useAppStore((state) => state.setUnreadInbox);
  const userSettings = useAppStore((state) => state.userSettings);
  const { t } = useI18n();

  // Workspace state
  const [workspaces, setWorkspaces] = useState([]);
  const [creating, setCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, workspaceId: null, workspaceName: '' });
  const [workspaceExpanded, setWorkspaceExpanded] = useState(false);

  // Check if user is admin or developer
  const isAdminOrDev = profile?.role === 'ADMIN' || profile?.role === 'DEV';

  const loadUnreadCount = useCallback(async () => {
    try {
      const result = await hubAPI.inbox.getUnreadCount();
      if (result.success) {
        setUnreadInbox(result.count);
      }
    } catch (err) {
      console.error('Failed to load unread count:', err);
    }
  }, [setUnreadInbox]);

  const loadWorkspaces = useCallback(async () => {
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
  }, [setActiveWorkspace]);

  useEffect(() => {
    loadWorkspaces();
    loadUnreadCount();
  }, [loadWorkspaces, loadUnreadCount]);

  // Real-time inbox push listener
  useEffect(() => {
    const cleanup = hubAPI.inbox.onNewMessage(() => {
      loadUnreadCount();
      // Play notification sound if enabled
      if (userSettings.sound_enabled) {
        playNotificationSound();
      }
    });
    return cleanup;
  }, [loadUnreadCount, userSettings.sound_enabled]);

  const handleSwitchWorkspace = async (workspaceId) => {
    try {
      const result = await hubAPI.workspaces.switch({ workspaceId });
      if (result.success) {
        setActiveWorkspace(result.workspace);
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
        setWorkspaces(workspaces.filter((w) => w.id !== deleteModal.workspaceId));

        if (activeWorkspace?.id === deleteModal.workspaceId && workspaces.length > 1) {
          const nextWorkspace = workspaces.find((w) => w.id !== deleteModal.workspaceId);
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
    { id: 'home', label: t('common.dashboard'), icon: <Home size={20} />, path: '/home' },
    { id: 'tools', label: t('common.myTools'), icon: <Wrench size={20} />, path: '/tools' },
    { id: 'vault', label: t('common.secretVault'), icon: <LockKeyhole size={20} />, path: '/vault' },
    { id: 'notes', label: t('common.notes'), icon: <FileText size={20} />, path: '/notes' },
    { id: 'links', label: t('common.quickLinks'), icon: <Link size={20} />, path: '/links' },
    { id: 'inbox', label: t('common.inbox'), icon: <Inbox size={20} />, path: '/inbox' },
    { id: 'profile', label: t('common.profile'), icon: <User size={20} />, path: '/profile' },
    { id: 'settings', label: t('common.settings'), icon: <Settings size={20} />, path: '/settings' }
  ];

  // Admin section - only for ADMIN and DEV roles
  const adminItems = isAdminOrDev
    ? [{ id: 'admin', label: t('common.adminPanel'), icon: <Shield size={20} />, path: '/admin', isAdmin: true }]
    : [];

  const isActive = (path) => location.pathname.startsWith(path);
  const getWorkspaceInitial = (name) => {
    const value = typeof name === 'string' ? name.trim() : '';
    return value ? value.charAt(0).toUpperCase() : '#';
  };

  const workspaceCount = workspaces.length;
  const activeWorkspaceInitial = getWorkspaceInitial(activeWorkspace?.name);

  return (
    <div className="sidebar">
      <div className="sidebar-header" style={{ paddingTop: '12px', paddingBottom: '12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '8px'
          }}
        >
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
            {t('common.offline')}
          </div>
        )}
      </div>

      {/* Workspace Manager */}
      <div className={`workspace-panel ${workspaceExpanded ? 'expanded' : ''}`}>
        <button
          type="button"
          className="workspace-panel-trigger"
          onClick={() => setWorkspaceExpanded((prev) => !prev)}
        >
          <div className="workspace-panel-main">
            <span className="workspace-panel-avatar">{activeWorkspaceInitial}</span>
            <div className="workspace-panel-text">
              <span className="workspace-panel-title">{activeWorkspace?.name || t('sidebar.noWorkspace')}</span>
            </div>
          </div>

          <div className="workspace-panel-actions">
            <span className="workspace-panel-count">{workspaceCount}</span>
            {workspaceExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
          </div>
        </button>

        {workspaceExpanded && (
          <div className="workspace-panel-body">
            <div className="workspace-panel-toolbar">
              <span className="workspace-panel-label">{t('sidebar.allWorkspaces')}</span>
              <button
                type="button"
                className={`workspace-create-toggle ${creating ? 'active' : ''}`}
                onClick={() => setCreating((prev) => !prev)}
              >
                <Plus size={13} />
                {creating ? t('common.cancel') : t('common.new')}
              </button>
            </div>

            {creating && (
              <form className="workspace-create-form" onSubmit={handleCreateWorkspace}>
                <input
                  className="workspace-create-input"
                  type="text"
                  value={newWorkspaceName}
                  onChange={(e) => setNewWorkspaceName(e.target.value)}
                  placeholder={t('sidebar.workspaceNamePlaceholder')}
                  autoFocus
                />
                <button
                  type="submit"
                  className="workspace-create-submit"
                  disabled={!newWorkspaceName.trim()}
                >
                  {t('common.create')}
                </button>
              </form>
            )}

            <div className="workspace-list">
              {workspaceCount === 0 ? (
                <div className="workspace-empty">{t('sidebar.noWorkspaces')}</div>
              ) : (
                workspaces.map((workspace) => {
                  const isCurrentWorkspace = workspace.id === activeWorkspace?.id;

                  return (
                    <div
                      key={workspace.id}
                      className={`workspace-item-card ${isCurrentWorkspace ? 'active' : ''}`}
                      onClick={() => !isCurrentWorkspace && handleSwitchWorkspace(workspace.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(event) => {
                        if (isCurrentWorkspace) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          handleSwitchWorkspace(workspace.id);
                        }
                      }}
                    >
                      <div className="workspace-item-main">
                        <span className="workspace-item-avatar">{getWorkspaceInitial(workspace.name)}</span>
                        <span className="workspace-item-name">{workspace.name}</span>
                      </div>

                      {isCurrentWorkspace ? (
                        <Check size={14} className="workspace-item-check" />
                      ) : (
                        workspaces.length > 1 && (
                          <button
                            type="button"
                            className="workspace-delete-btn"
                            onClick={(event) => {
                              event.stopPropagation();
                              openDeleteModal(workspace.id, workspace.name);
                            }}
                            aria-label={t('common.delete')}
                          >
                            <Trash2 size={14} />
                          </button>
                        )
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
      <nav className="sidebar-nav">
        {/* Regular menu items */}
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            style={{ position: 'relative' }}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
            {item.id === 'inbox' && (
              <span className={`sidebar-inbox-badge ${unreadInbox > 0 ? 'visible' : ''}`}>
                {unreadInbox > 99 ? '99+' : unreadInbox}
              </span>
            )}
          </button>
        ))}

        {/* Admin section separator */}
        {adminItems.length > 0 && (
          <div
            style={{
              height: '1px',
              backgroundColor: 'var(--border-default)',
              margin: '12px 16px'
            }}
          />
        )}

        {/* Admin menu items */}
        {adminItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
            style={{
              background: isActive(item.path)
                ? 'var(--accent-glow)'
                : 'transparent',
              borderLeft: isActive(item.path) ? '3px solid var(--accent-primary)' : 'none'
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
        title={t('sidebar.deleteWorkspaceTitle')}
        message={t('sidebar.deleteWorkspaceMessage', { workspaceName: deleteModal.workspaceName })}
        type="confirm"
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
      />
    </div>
  );
}

export default Sidebar;
