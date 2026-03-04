import React, { useState, useEffect } from 'react';
import { Plus, Search, Pin, Edit, Trash2, Save, X, FileText, Tag, Eye, Code } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import hubAPI from '../api/hubApi';
import { useAppStore } from '../state/store';
import Topbar from '../app/layout/Topbar';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useI18n } from '../i18n';

/**
 * Notes Page - Full CRUD for notes with markdown editor
 */
function Notes() {
  const { t, language } = useI18n();
  const isFr = language === 'fr';
  const activeWorkspace = useAppStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useAppStore((state) => state.setActiveWorkspace);
  const [notes, setNotes] = useState([]);
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
  }, [activeWorkspace?.id]);

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
        <Topbar title={t('common.notes')} />
        <div className="page-content loading-center">
          <div className="text-muted-center">{isFr ? 'Chargement des notes...' : 'Loading notes...'}</div>
        </div>
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="page">
        <Topbar title={t('common.notes')} />
        <div className="page-content">
          <EmptyState
            icon={FileText}
            title={isFr ? 'Aucun espace actif' : 'No Active Workspace'}
            description={isFr ? 'Creez ou selectionnez un espace pour commencer a prendre des notes.' : 'Please create or select a workspace to start taking notes.'}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Topbar title={t('common.notes')} />

      <div className="page-content notes-layout">
        {/* Notes List Sidebar */}
        <div className="notes-sidebar">
          {/* Create Button */}
          <button
            onClick={handleCreateNote}
            className="btn btn-primary btn-full flex-center flex-gap-2"
          >
            <Plus size={18} />
            {isFr ? 'Nouvelle note' : 'New Note'}
          </button>

          {/* Search */}
          <div className="search-input-wrapper">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={isFr ? 'Rechercher des notes...' : 'Search notes...'}
            />
            <button onClick={handleSearch} className="search-icon-btn">
              <Search size={16} />
            </button>
          </div>

          {/* Notes Count */}
          <div className="notes-count">
            {notes.length} {notes.length === 1 ? 'Note' : 'Notes'}
          </div>

          {/* Notes List */}
          <div className="notes-sidebar-list">
            {notes.length === 0 ? (
              <div className="empty-list-placeholder">
                {searchQuery ? (isFr ? 'Aucune note trouvee' : 'No notes found') : (isFr ? 'Aucune note pour le moment. Cree ta premiere note.' : 'No notes yet. Create your first note!')}
              </div>
            ) : (
              notes.map((note) => (
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
        <div className="notes-content-area">
          {error && (
            <div className="alert alert-error flex-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="btn-icon-ghost btn-icon-danger">
                <X size={16} />
              </button>
            </div>
          )}

          {!selectedNote && !isEditing ? (
            <EmptyState
              icon={FileText}
              title={isFr ? 'Aucune note sélectionnée' : 'No note selected'}
              description={isFr ? 'Sélectionnez une note dans la liste ou créez-en une nouvelle' : 'Select a note from the list or create a new one'}
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
    <div onClick={onSelect} className={`item-card${isSelected ? ' active' : ''}`}>
      <div className="flex-between mb-2" style={{ alignItems: 'start' }}>
        <h4 className={`note-card-title${isSelected ? ' active' : ''}`}>
          {note.title}
        </h4>
        <button
          onClick={(e) => { e.stopPropagation(); onTogglePin(); }}
          className={`btn-icon-ghost${note.is_pinned ? ' active' : ''}`}
          title={note.is_pinned ? 'Unpin' : 'Pin'}
        >
          <Pin size={14} fill={note.is_pinned ? 'currentColor' : 'none'} />
        </button>
      </div>

      <p className="note-card-excerpt">
        {note.content || 'No content'}
      </p>

      {note.tags && (
        <div className="note-card-tags">
          {note.tags.split(',').slice(0, 3).map((tag, i) => (
            <span key={i} className="note-tag">{tag.trim()}</span>
          ))}
          {note.tags.split(',').length > 3 && (
            <span className="note-tag">+{note.tags.split(',').length - 3}</span>
          )}
        </div>
      )}

      <div className="note-card-date">
        {new Date(note.updated_at * 1000).toLocaleDateString()}
      </div>
    </div>
  );
}

// Note Editor Component with Markdown preview
function NoteEditor({ formData, setFormData, onSave, onCancel, isNew }) {
  const [showPreview, setShowPreview] = useState(false);
  const { language } = useI18n();
  const isFr = language === 'fr';

  return (
    <div className="notes-panel">
      {/* Header */}
      <div className="flex-between">
        <h3 className="section-heading" style={{ margin: 0 }}>
          {isNew ? (isFr ? 'Nouvelle note' : 'New Note') : (isFr ? 'Modifier la note' : 'Edit Note')}
        </h3>
        <div className="flex-center flex-gap-2">
          <button
            onClick={() => setShowPreview(!showPreview)}
            className={`btn btn-secondary btn-sm flex-center flex-gap-2${showPreview ? ' active' : ''}`}
            style={showPreview ? { backgroundColor: 'var(--accent-glow)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)' } : undefined}
          >
            {showPreview ? <Code size={16} /> : <Eye size={16} />}
            {showPreview ? 'Editor' : 'Preview'}
          </button>
          <button onClick={onCancel} className="btn btn-secondary btn-sm flex-center flex-gap-2">
            <X size={16} />
            Cancel
          </button>
          <button onClick={onSave} className="btn btn-primary btn-sm flex-center flex-gap-2">
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      {/* Title */}
      <input
        type="text"
        className="note-title-input"
        value={formData.title}
        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
        placeholder="Note title..."
        autoFocus
      />

      {/* Tags */}
      <div className="note-tags-input-wrapper">
        <Tag size={16} className="tag-icon" />
        <input
          type="text"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          placeholder="Tags (comma separated)..."
        />
      </div>

      {/* Content: Editor or Preview */}
      {showPreview ? (
        <div className="markdown-body note-markdown-preview">
          {formData.content ? (
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{formData.content}</ReactMarkdown>
          ) : (
            <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>Nothing to preview</span>
          )}
        </div>
      ) : (
        <textarea
          className="note-textarea"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          placeholder="Write in Markdown... (# headings, **bold**, *italic*, - lists, ```code```)"
          onKeyDown={(e) => {
            if (e.key === 'Tab') {
              e.preventDefault();
              const start = e.target.selectionStart;
              const end = e.target.selectionEnd;
              const newContent = formData.content.substring(0, start) + '  ' + formData.content.substring(end);
              setFormData({ ...formData, content: newContent });
              requestAnimationFrame(() => {
                e.target.selectionStart = e.target.selectionEnd = start + 2;
              });
            }
          }}
        />
      )}
    </div>
  );
}

// Note Viewer Component
function NoteViewer({ note, onEdit, onDelete, onTogglePin }) {
  return (
    <div className="notes-panel notes-panel-viewer">
      {/* Header */}
      <div className="flex-between" style={{ alignItems: 'start', gap: 'var(--space-4)' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 className="note-viewer-title">{note.title}</h1>
          {note.tags && (
            <div className="flex-center flex-gap-2" style={{ flexWrap: 'wrap' }}>
              {note.tags.split(',').map((tag, i) => (
                <span key={i} className="note-tag-viewer">
                  <Tag size={12} />
                  {tag.trim()}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="flex-center flex-gap-2" style={{ flexShrink: 0 }}>
          <button
            onClick={onTogglePin}
            className="btn btn-secondary btn-icon-pad"
            style={note.is_pinned ? { backgroundColor: 'var(--accent-glow)', color: 'var(--accent-primary)', border: '1px solid var(--accent-primary)' } : undefined}
            title={note.is_pinned ? 'Unpin' : 'Pin'}
          >
            <Pin size={18} fill={note.is_pinned ? 'currentColor' : 'none'} />
          </button>
          <button onClick={onEdit} className="btn btn-secondary btn-icon-pad" title="Edit">
            <Edit size={18} />
          </button>
          <button onClick={onDelete} className="btn btn-secondary btn-icon-pad btn-icon-danger" title="Delete">
            <Trash2 size={18} />
          </button>
        </div>
      </div>

      {/* Content - Rendered as Markdown */}
      <div className="markdown-body note-markdown-content">
        {note.content ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{note.content}</ReactMarkdown>
        ) : (
          <span style={{ color: 'var(--text-tertiary)', fontStyle: 'italic' }}>No content</span>
        )}
      </div>

      {/* Metadata */}
      <div className="note-metadata">
        <div>
          <strong>Created:</strong> {new Date(note.created_at * 1000).toLocaleString()}
        </div>
        <div>
          <strong>Updated:</strong> {new Date(note.updated_at * 1000).toLocaleString()}
        </div>
      </div>
    </div>
  );
}

export default Notes;
