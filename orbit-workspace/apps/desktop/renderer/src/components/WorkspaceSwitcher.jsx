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
    return <div className="ws-loading">Loading workspaces...</div>;
  }

  return (
    <div className="ws-container">
      {/* Header */}
      <div className="ws-header">
        <h3 className="ws-title">Workspaces</h3>
        <button
          onClick={() => setCreating(!creating)}
          className={`ws-new-btn ${creating ? 'active' : ''}`}
        >
          <Plus size={16} />
          {creating ? 'Cancel' : 'New'}
        </button>
      </div>

      {/* Error Message */}
      {error && <div className="alert alert-error">{error}</div>}

      {/* Create Workspace Form */}
      {creating && (
        <form onSubmit={handleCreateWorkspace} className="ws-form">
          <input
            type="text"
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            placeholder="Workspace name..."
            autoFocus
            className="ws-input"
          />
          <button type="submit" disabled={!newWorkspaceName.trim()} className="ws-submit">
            Create Workspace
          </button>
        </form>
      )}

      {/* Workspaces List */}
      <div className="ws-list">
        {workspaces.length === 0 ? (
          <div className="ws-empty">No workspaces yet. Create one to get started!</div>
        ) : (
          workspaces.map((workspace) => {
            const isActive = activeWorkspace?.id === workspace.id;

            return (
              <div
                key={workspace.id}
                className={`ws-item ${isActive ? 'active' : ''}`}
                onClick={() => !isActive && handleSwitchWorkspace(workspace.id)}
              >
                <div className="ws-item-info">
                  {isActive && <Check size={18} color="#fff" />}
                  <span className="ws-item-name">{workspace.name}</span>
                </div>

                {/* Delete button (only show if not active and more than 1 workspace) */}
                {!isActive && workspaces.length > 1 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteWorkspace(workspace.id, workspace.name);
                    }}
                    className="ws-delete-btn"
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
