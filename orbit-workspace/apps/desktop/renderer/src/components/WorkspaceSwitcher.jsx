import { useState, useEffect } from 'react';
import { Plus, Check, Trash2 } from 'lucide-react';
import hubAPI from '../api/hubApi';

/**
 * WorkspaceSwitcher - Component to switch between workspaces and manage them
 *
 * Features:
 * - Display all user workspaces
 * - Switch active workspace
 * - Create new workspace
 * - Rename workspace
 * - Delete workspace
 */
function WorkspaceSwitcher({ onWorkspaceChange }) {
  const [workspaces, setWorkspaces] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [error, setError] = useState('');

  // Load workspaces on mount
  useEffect(() => {
    loadWorkspaces();
  }, []);

  const loadWorkspaces = async () => {
    try {
      setLoading(true);

      // Get all workspaces
      const result = await hubAPI.workspaces.getAll();
      if (result.success) {
        setWorkspaces(result.workspaces);
      }

      // Get active workspace
      const activeResult = await hubAPI.workspaces.getActive();
      if (activeResult.success) {
        setActiveWorkspace(activeResult.workspace);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      setError('Failed to load workspaces');
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchWorkspace = async (workspaceId) => {
    try {
      const result = await hubAPI.workspaces.switch({ workspaceId });
      if (result.success) {
        setActiveWorkspace(result.workspace);
        if (onWorkspaceChange) {
          onWorkspaceChange(result.workspace);
        }
      } else {
        setError(result.error || 'Failed to switch workspace');
      }
    } catch (err) {
      console.error('Failed to switch workspace:', err);
      setError('Failed to switch workspace');
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

        // Switch to new workspace
        await handleSwitchWorkspace(result.workspace.id);
      } else {
        setError(result.error || 'Failed to create workspace');
      }
    } catch (err) {
      console.error('Failed to create workspace:', err);
      setError('Failed to create workspace');
    }
  };

  const handleDeleteWorkspace = async (workspaceId, workspaceName) => {
    if (
      !confirm(`Delete workspace "${workspaceName}"? This will delete all notes, links, and files in this workspace.`)
    ) {
      return;
    }

    try {
      const result = await hubAPI.workspaces.delete({ id: workspaceId });
      if (result.success) {
        setWorkspaces(workspaces.filter((w) => w.id !== workspaceId));

        // If deleted workspace was active, switch to first available
        if (activeWorkspace?.id === workspaceId && workspaces.length > 1) {
          const nextWorkspace = workspaces.find((w) => w.id !== workspaceId);
          if (nextWorkspace) {
            await handleSwitchWorkspace(nextWorkspace.id);
          }
        }
      } else {
        setError(result.error || 'Failed to delete workspace');
      }
    } catch (err) {
      console.error('Failed to delete workspace:', err);
      setError('Failed to delete workspace');
    }
  };

  if (loading) {
    return (
      <div
        style={{
          padding: '16px',
          textAlign: 'center',
          color: 'var(--text-tertiary)'
        }}
      >
        Loading workspaces...
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        padding: '16px',
        border: '1px solid var(--border-default)'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text-primary)'
          }}
        >
          Workspaces
        </h3>
        <button
          onClick={() => setCreating(!creating)}
          style={{
            padding: '6px 12px',
            backgroundColor: creating ? 'var(--bg-tertiary)' : 'var(--accent-primary)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Plus size={16} />
          {creating ? 'Cancel' : 'New'}
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '12px',
            backgroundColor: 'var(--status-error-glow)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: 'var(--radius-md)',
            marginBottom: '12px',
            fontSize: '14px',
            color: 'var(--status-error)'
          }}
        >
          {error}
        </div>
      )}

      {/* Create Workspace Form */}
      {creating && (
        <form onSubmit={handleCreateWorkspace} style={{ marginBottom: '16px' }}>
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="Workspace name..."
            autoFocus
            style={{
              width: '100%',
              padding: '10px 12px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
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
              padding: '10px',
              backgroundColor: 'var(--accent-primary)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: newWorkspaceName.trim() ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '500',
              opacity: newWorkspaceName.trim() ? 1 : 0.5
            }}
          >
            Create Workspace
          </button>
        </form>
      )}

      {/* Workspaces List */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}
      >
        {workspaces.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '32px',
              color: 'var(--text-tertiary)',
              fontSize: '14px'
            }}
          >
            No workspaces yet. Create one to get started!
          </div>
        ) : (
          workspaces.map((workspace) => {
            const isActive = activeWorkspace?.id === workspace.id;

            return (
              <div
                key={workspace.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  backgroundColor: isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
                  border: `1px solid ${isActive ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                  borderRadius: 'var(--radius-md)',
                  cursor: 'pointer',
                  transition: 'all var(--transition-fast)'
                }}
                onClick={() => !isActive && handleSwitchWorkspace(workspace.id)}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                    e.currentTarget.style.borderColor = 'var(--border-hover)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    e.currentTarget.style.borderColor = 'var(--border-default)';
                  }
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flex: 1
                  }}
                >
                  {isActive && <Check size={18} color="#fff" />}
                  <span
                    style={{
                      fontSize: '14px',
                      fontWeight: isActive ? '600' : '500',
                      color: isActive ? '#fff' : 'var(--text-primary)'
                    }}
                  >
                    {workspace.name}
                  </span>
                </div>

                {/* Delete button (only show if not active and more than 1 workspace) */}
                {!isActive && workspaces.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWorkspace(workspace.id, workspace.name);
                    }}
                    style={{
                      padding: '6px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      color: 'var(--text-tertiary)',
                      transition: 'color var(--transition-fast)'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--status-error)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default WorkspaceSwitcher;
