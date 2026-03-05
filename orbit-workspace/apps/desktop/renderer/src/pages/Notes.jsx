import React, { useState, useEffect } from 'react';
import { Plus, Search, Pin, Edit, Trash2, Save, FileText, Tag, X } from 'lucide-react';
import hubAPI from '../api/hubApi';
import { useAppStore } from '../state/store';
import Topbar from '../app/layout/Topbar';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import BlockNoteEditor from '../components/BlockNoteEditor';
import { extractPlainText } from '../utils/noteUtils';
import { useI18n } from '../i18n';

/**
 * Notes Page - Full CRUD for notes with BlockNote editor
 */
function Notes() {
  const { t, language } = useI18n();
  const isFr = language === 'fr';
  const activeWorkspace = useAppStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useAppStore((state) => state.setActiveWorkspace);
  const showToast = useAppStore((state) => state.showToast);
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNote, setSelectedNote] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
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
        showToast(isFr ? 'Aucun espace actif' : 'No active workspace', 'error');
        setLoading(false);
        return;
      }

      setActiveWorkspace(workspaceResult.workspace);

      // Load notes
      await loadNotes(workspaceResult.workspace.id);
    } catch (err) {
      console.error('Failed to load workspace and notes:', err);
      showToast(isFr ? 'Erreur de chargement' : 'Failed to load notes', 'error');
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
  };

  const handleEditNote = (note) => {
    setIsEditing(true);
    setSelectedNote(note);
    setFormData({
      title: note.title,
      content: note.content,
      tags: note.tags || ''
    });
  };

  const handleSaveNote = async () => {
    if (!formData.title.trim()) {
      showToast(isFr ? 'Le titre est requis' : 'Title is required', 'error');
      return;
    }

    try {
      if (selectedNote) {
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
          showToast(isFr ? 'Note sauvegardée' : 'Note saved', 'success');
        } else {
          showToast(result.error || (isFr ? 'Erreur de mise à jour' : 'Failed to update note'), 'error');
        }
      } else {
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
          showToast(isFr ? 'Note créée' : 'Note created', 'success');
        } else {
          showToast(result.error || (isFr ? 'Erreur de création' : 'Failed to create note'), 'error');
        }
      }
    } catch (err) {
      console.error('Failed to save note:', err);
      showToast(isFr ? 'Erreur de sauvegarde' : 'Failed to save note', 'error');
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
        showToast(isFr ? 'Note supprimée' : 'Note deleted', 'success');
      } else {
        showToast(result.error || (isFr ? 'Erreur de suppression' : 'Failed to delete note'), 'error');
      }
    } catch (err) {
      console.error('Failed to delete note:', err);
      showToast(isFr ? 'Erreur de suppression' : 'Failed to delete note', 'error');
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
                if (!selectedNote) {
                  setFormData({ title: '', content: '', tags: '' });
                }
              }}
              isNew={!selectedNote}
              noteId={selectedNote?.id}
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
        {extractPlainText(note.content) || 'No content'}
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

// Note Editor Component with BlockNote
function NoteEditor({ formData, setFormData, onSave, onCancel, isNew, noteId }) {
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

      {/* BlockNote Editor */}
      <div className="note-blocknote-wrapper">
        <BlockNoteEditor
          key={noteId || 'new'}
          initialContent={formData.content}
          onChange={(json) => setFormData((prev) => ({ ...prev, content: json }))}
          editable={true}
        />
      </div>
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

      {/* Content - BlockNote read-only */}
      <div className="note-blocknote-wrapper note-blocknote-viewer">
        <BlockNoteEditor
          key={note.id}
          initialContent={note.content || ''}
          editable={false}
        />
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
