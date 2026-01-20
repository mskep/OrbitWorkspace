import React, { useState, useEffect } from 'react';
import { Plus, Search, Pin, Edit, Trash2, Save, X, FileText, Tag } from 'lucide-react';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';

/**
 * Notes Page - Full CRUD for notes with markdown editor
 */
function Notes() {
  const [notes, setNotes] = useState([]);
  const [activeWorkspace, setActiveWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, noteId: null, noteTitle: '' });

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    tags: ''
  });

  useEffect(() => {
    loadWorkspaceAndNotes();
  }, []);

  const loadWorkspaceAndNotes = async () => {
    try {
      setLoading(true);

      // Get active workspace
      const workspaceResult = await hubAPI.workspaces.getActive();
      if (!workspaceResult.success) {
        setError('No active workspace. Please create a workspace first.');
        setLoading(false);
        return;
      }

      setActiveWorkspace(workspaceResult.workspace);

      // Load notes
      await loadNotes(workspaceResult.workspace.id);
    } catch (err) {
      console.error('Failed to load workspace and notes:', err);
      setError('Failed to load notes');
    } finally {
      setLoading(false);
    }
  };

  const loadNotes = async (workspaceId) => {
    try {
      const result = await hubAPI.notes.getAll({ workspaceId });
      if (result.success) {
        // Sort: pinned first, then by updated_at
        const sortedNotes = result.notes.sort((a, b) => {
          if (a.is_pinned && !b.is_pinned) return -1;
          if (!a.is_pinned && b.is_pinned) return 1;
          return b.updated_at - a.updated_at;
        });
        setNotes(sortedNotes);
      }
    } catch (err) {
      console.error('Failed to load notes:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !activeWorkspace) {
      await loadNotes(activeWorkspace.id);
      return;
    }

    try {
      const result = await hubAPI.notes.search({
        workspaceId: activeWorkspace.id,
        query: searchQuery
      });

      if (result.success) {
        setNotes(result.notes);
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleCreateNote = () => {
    setIsEditing(true);
    setSelectedNote(null);
    setFormData({ title: '', content: '', tags: '' });
    setError('');
  };

  const handleEditNote = (note) => {
    setIsEditing(true);
    setSelectedNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      tags: note.tags || ''
    });
    setError('');
  };

  const handleSaveNote = async () => {
    if (!formData.title.trim()) {
      setError('Title is required');
      return;
    }

    try {
      if (selectedNote) {
        // Update existing note
        const result = await hubAPI.notes.update({
          id: selectedNote.id,
          title: formData.title,
          content: formData.content,
          tags: formData.tags
        });

        if (result.success) {
          await loadNotes(activeWorkspace.id);
          setIsEditing(false);
          setSelectedNote(result.note);
          setError('');
        } else {
          setError(result.error || 'Failed to update note');
        }
      } else {
        // Create new note
        const result = await hubAPI.notes.create({
          workspaceId: activeWorkspace.id,
          title: formData.title,
          content: formData.content,
          tags: formData.tags,
          isPinned: false
        });

        if (result.success) {
          await loadNotes(activeWorkspace.id);
          setIsEditing(false);
          setSelectedNote(result.note);
          setError('');
        } else {
          setError(result.error || 'Failed to create note');
        }
      }
    } catch (err) {
      console.error('Failed to save note:', err);
      setError('Failed to save note');
    }
  };

  const handleDeleteNote = async () => {
    try {
      const result = await hubAPI.notes.delete({ id: deleteModal.noteId });
      if (result.success) {
        await loadNotes(activeWorkspace.id);
        if (selectedNote?.id === deleteModal.noteId) {
          setSelectedNote(null);
          setIsEditing(false);
        }
        setDeleteModal({ isOpen: false, noteId: null, noteTitle: '' });
      } else {
        setError(result.error || 'Failed to delete note');
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
      setError('Failed to delete note');
    }
  };

  const openDeleteModal = (noteId, noteTitle) => {
    setDeleteModal({ isOpen: true, noteId, noteTitle });
  };

  const handleTogglePin = async (noteId) => {
    try {
      const result = await hubAPI.notes.togglePin({ id: noteId });
      if (result.success) {
        await loadNotes(activeWorkspace.id);
        if (selectedNote?.id === noteId) {
          setSelectedNote(result.note);
        }
      }
    } catch (err) {
      console.error('Failed to toggle pin:', err);
    }
  };

  const handleViewNote = (note) => {
    setSelectedNote(note);
    setIsEditing(false);
    setError('');
  };

  if (loading) {
    return (
      <div className="page">
        <Topbar title="Notes" />
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>
            Loading notes...
          </div>
        </div>
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="page">
        <Topbar title="Notes" />
        <div className="page-content">
          <EmptyState
            icon={FileText}
            title="No Active Workspace"
            description="Please create or select a workspace to start taking notes."
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Topbar title="Notes" />

      <div className="page-content" style={{ display: 'flex', gap: '20px', height: 'calc(100vh - 100px)' }}>
        {/* Notes List Sidebar */}
        <div style={{
          width: '320px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
          flexShrink: 0
        }}>
          {/* Create Button */}
          <button
            onClick={handleCreateNote}
            className="btn"
            style={{
              width: '100%',
              background: 'var(--accent)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            <Plus size={18} />
            New Note
          </button>

          {/* Search */}
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search notes..."
              style={{
                width: '100%',
                padding: '10px 40px 10px 12px',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
            <button
              onClick={handleSearch}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-tertiary)',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Search size={16} />
            </button>
          </div>

          {/* Notes Count */}
          <div style={{
            fontSize: '12px',
            color: 'var(--text-tertiary)',
            fontWeight: '500',
            textTransform: 'uppercase',
            letterSpacing: '0.5px'
          }}>
            {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
          </div>

          {/* Notes List */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            paddingRight: '4px'
          }}>
            {notes.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '40px 20px',
                color: 'var(--text-tertiary)',
                fontSize: '13px'
              }}>
                {searchQuery ? 'No notes found' : 'No notes yet. Create your first note!'}
              </div>
            ) : (
              notes.map(note => (
                <NoteCard
                  key={note.id}
                  note={note}
                  isSelected={selectedNote?.id === note.id}
                  onSelect={() => handleViewNote(note)}
                  onTogglePin={() => handleTogglePin(note.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* Note Content Area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-md)',
              marginBottom: '16px',
              fontSize: '13px',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <span>{error}</span>
              <button
                onClick={() => setError('')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  cursor: 'pointer',
                  padding: '4px'
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}

          {!selectedNote && !isEditing ? (
            <EmptyState
              icon={FileText}
              title="No note selected"
              description="Select a note from the list or create a new one"
            />
          ) : isEditing ? (
            <NoteEditor
              formData={formData}
              setFormData={setFormData}
              onSave={handleSaveNote}
              onCancel={() => {
                setIsEditing(false);
                setError('');
                if (!selectedNote) {
                  setFormData({ title: '', content: '', tags: '' });
                }
              }}
              isNew={!selectedNote}
            />
          ) : (
            <NoteViewer
              note={selectedNote}
              onEdit={() => handleEditNote(selectedNote)}
              onDelete={() => openDeleteModal(selectedNote.id, selectedNote.title)}
              onTogglePin={() => handleTogglePin(selectedNote.id)}
            />
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, noteId: null, noteTitle: '' })}
        onConfirm={handleDeleteNote}
        title="Delete Note"
        message={`Are you sure you want to delete "${deleteModal.noteTitle}"? This action cannot be undone.`}
        type="confirm"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

// Note Card Component
function NoteCard({ note, isSelected, onSelect, onTogglePin }) {
  return (
    <div
      onClick={onSelect}
      style={{
        padding: '12px',
        backgroundColor: isSelected ? 'var(--accent-glow)' : 'var(--bg-secondary)',
        border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-default)'}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative'
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--border-hover)';
          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--border-default)';
          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
        }
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
        <h4 style={{
          margin: 0,
          fontSize: '14px',
          fontWeight: '600',
          color: isSelected ? 'var(--accent-primary)' : 'var(--text-primary)',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          paddingRight: '8px'
        }}>
          {note.title}
        </h4>
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          style={{
            padding: '4px',
            background: 'none',
            border: 'none',
            color: note.is_pinned ? 'var(--accent)' : 'var(--text-tertiary)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            flexShrink: 0
          }}
          title={note.is_pinned ? 'Unpin' : 'Pin'}
        >
          <Pin size={14} fill={note.is_pinned ? 'currentColor' : 'none'} />
        </button>
      </div>

      <p style={{
        margin: '0 0 8px 0',
        fontSize: '12px',
        color: 'var(--text-secondary)',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: '-webkit-box',
        WebkitLineClamp: 2,
        WebkitBoxOrient: 'vertical',
        lineHeight: '1.5'
      }}>
        {note.content || 'No content'}
      </p>

      {note.tags && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
          {note.tags.split(',').slice(0, 3).map((tag, i) => (
            <span key={i} style={{
              padding: '2px 6px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              fontSize: '10px',
              color: 'var(--text-tertiary)',
              fontWeight: '500'
            }}>
              {tag.trim()}
            </span>
          ))}
          {note.tags.split(',').length > 3 && (
            <span style={{
              padding: '2px 6px',
              fontSize: '10px',
              color: 'var(--text-tertiary)'
            }}>
              +{note.tags.split(',').length - 3}
            </span>
          )}
        </div>
      )}

      <div style={{ fontSize: '10px', color: 'var(--text-tertiary)' }}>
        {new Date(note.updated_at * 1000).toLocaleDateString()}
      </div>
    </div>
  );
}

// Note Editor Component
function NoteEditor({ formData, setFormData, onSave, onCancel, isNew }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      backgroundColor: 'var(--bg-secondary)',
      padding: '24px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-default)',
      overflow: 'hidden'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
          {isNew ? 'New Note' : 'Edit Note'}
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            style={{
              padding: '8px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px'
            }}
          >
            <X size={16} />
            Cancel
          </button>
          <button
            onClick={onSave}
            className="btn"
            style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              fontWeight: '600'
            }}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        placeholder="Note title..."
        autoFocus
        style={{
          padding: '12px 16px',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          fontSize: '16px',
          fontWeight: '600',
          color: 'var(--text-primary)',
          outline: 'none'
        }}
      />

      {/* Tags */}
      <div style={{ position: 'relative' }}>
        <Tag size={16} style={{
          position: 'absolute',
          left: '12px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-tertiary)'
        }} />
        <input
          type="text"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          placeholder="Tags (comma separated)..."
          style={{
            width: '100%',
            padding: '10px 12px 10px 36px',
            backgroundColor: 'var(--bg-tertiary)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-md)',
            fontSize: '13px',
            color: 'var(--text-primary)',
            outline: 'none',
            boxSizing: 'border-box'
          }}
        />
      </div>

      {/* Content */}
      <textarea
        value={formData.content}
        onChange={(e) => setFormData({ ...formData, content: e.target.value })}
        placeholder="Write your note here..."
        style={{
          flex: 1,
          padding: '16px',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          fontSize: '14px',
          color: 'var(--text-primary)',
          outline: 'none',
          fontFamily: 'inherit',
          resize: 'none',
          lineHeight: '1.6'
        }}
      />
    </div>
  );
}

// Note Viewer Component
function NoteViewer({ note, onEdit, onDelete, onTogglePin }) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      gap: '20px',
      backgroundColor: 'var(--bg-secondary)',
      padding: '24px',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-default)',
      overflowY: 'auto'
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '16px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{
            margin: '0 0 12px 0',
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--text-primary)',
            wordBreak: 'break-word'
          }}>
            {note.title}
          </h1>
          {note.tags && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {note.tags.split(',').map((tag, i) => (
                <span key={i} style={{
                  padding: '6px 12px',
                  backgroundColor: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '12px',
                  color: 'var(--text-secondary)',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <Tag size={12} />
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
          <button
            onClick={onTogglePin}
            className="btn btn-secondary"
            style={{
              padding: '10px',
              backgroundColor: note.is_pinned ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
              color: note.is_pinned ? 'var(--accent)' : 'var(--text-primary)',
              border: `1px solid ${note.is_pinned ? 'var(--accent)' : 'var(--border-default)'}`,
              display: 'flex',
              alignItems: 'center'
            }}
            title={note.is_pinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={18} fill={note.is_pinned ? 'currentColor' : 'none'} />
          </button>
          <button
            onClick={onEdit}
            className="btn btn-secondary"
            style={{
              padding: '10px',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Edit"
          >
            <Edit size={18} />
          </button>
          <button
            onClick={onDelete}
            className="btn btn-secondary"
            style={{
              padding: '10px',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center'
            }}
            title="Delete"
          >
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        padding: '20px',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        fontSize: '15px',
        lineHeight: '1.8',
        color: 'var(--text-primary)',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word'
      }}>
        {note.content || (
          <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>
            No content
          </span>
        )}
      </div>

      {/* Metadata */}
      <div style={{
        padding: '16px',
        backgroundColor: 'var(--bg-tertiary)',
        borderRadius: 'var(--radius-md)',
        fontSize: '12px',
        color: 'var(--text-tertiary)',
        display: 'flex',
        gap: '24px',
        flexWrap: 'wrap'
      }}>
        <div>
          <span style={{ fontWeight: '600' }}>Created:</span> {new Date(note.created_at * 1000).toLocaleString()}
        </div>
        <div>
          <span style={{ fontWeight: '600' }}>Updated:</span> {new Date(note.updated_at * 1000).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export default Notes;
