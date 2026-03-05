import { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Star,
  Edit,
  Trash2,
  Save,
  X,
  Link as LinkIcon,
  ExternalLink,
  File,
  Folder,
  FolderOpen,
  FileText,
  FileArchive,
  Music,
  Image,
  Film,
  Code
} from 'lucide-react';
import hubAPI from '../api/hubApi';
import { useAppStore } from '../state/store';
import Topbar from '../app/layout/Topbar';
import EmptyState from '../components/EmptyState';
import Modal from '../components/Modal';
import { useI18n } from '../i18n';

/**
 * Links Page - Quick Links and File References management
 */
function Links() {
  const { t, language } = useI18n();
  const isFr = language === 'fr';
  const activeWorkspace = useAppStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useAppStore((state) => state.setActiveWorkspace);
  const showToast = useAppStore((state) => state.showToast);
  const [activeTab, setActiveTab] = useState('links'); // 'links' or 'files'
  const [links, setLinks] = useState([]);
  const [fileRefs, setFileRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, title: '', type: '' });

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    url: '',
    description: '',
    isFavorite: false
  });

  // File form state
  const [fileFormData, setFileFormData] = useState({
    name: '',
    path: '',
    description: '',
    type: 'file' // 'file' or 'folder'
  });

  useEffect(() => {
    loadWorkspaceAndData();
  }, [activeWorkspace?.id]);

  const loadWorkspaceAndData = async () => {
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

      // Load links and files
      await loadLinks(workspaceResult.workspace.id);
      await loadFileRefs(workspaceResult.workspace.id);
    } catch (err) {
      console.error('Failed to load workspace and data:', err);
      showToast(isFr ? 'Erreur de chargement' : 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadLinks = async (workspaceId) => {
    try {
      const result = await hubAPI.links.getAll({ workspaceId });
      if (result.success) {
        const sortedLinks = result.links.sort((a, b) => {
          if (a.is_favorite && !b.is_favorite) return -1;
          if (!a.is_favorite && b.is_favorite) return 1;
          return b.created_at - a.created_at;
        });
        setLinks(sortedLinks);
      }
    } catch (err) {
      console.error('Failed to load links:', err);
    }
  };

  const loadFileRefs = async (workspaceId) => {
    try {
      const result = await hubAPI.fileRefs.getAll({ workspaceId });
      if (result.success) {
        setFileRefs(result.fileRefs.sort((a, b) => b.created_at - a.created_at));
      }
    } catch (err) {
      console.error('Failed to load file references:', err);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim() || !activeWorkspace) {
      if (activeTab === 'links') {
        await loadLinks(activeWorkspace.id);
      } else {
        await loadFileRefs(activeWorkspace.id);
      }
      return;
    }

    try {
      if (activeTab === 'links') {
        const result = await hubAPI.links.search({
          workspaceId: activeWorkspace.id,
          query: searchQuery
        });
        if (result.success) {
          setLinks(result.links);
        }
      } else {
        const result = await hubAPI.fileRefs.search({
          workspaceId: activeWorkspace.id,
          query: searchQuery
        });
        if (result.success) {
          setFileRefs(result.fileRefs);
        }
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleCreateLink = () => {
    setIsEditing(true);
    setSelectedItem(null);
    setFormData({ title: '', url: '', description: '', isFavorite: false });
  };

  const handleCreateFileRef = () => {
    setIsEditing(true);
    setSelectedItem(null);
    setFileFormData({ name: '', path: '', description: '', type: 'file' });
  };

  const handleEditLink = (link) => {
    setIsEditing(true);
    setSelectedItem(link);
    setFormData({
      title: link.title,
      url: link.url_encrypted ? '********' : link.url,
      description: link.description || '',
      isFavorite: link.is_favorite
    });
  };

  const handleEditFileRef = (fileRef) => {
    setIsEditing(true);
    setSelectedItem(fileRef);
    setFileFormData({
      name: fileRef.name,
      path: fileRef.path || (fileRef.file_path_encrypted ? '********' : fileRef.file_path),
      description: fileRef.description || '',
      type: fileRef.type || 'file'
    });
  };

  const handleSaveLink = async () => {
    if (!formData.title.trim() || !formData.url.trim()) {
      showToast(isFr ? 'Titre et URL requis' : 'Title and URL are required', 'error');
      return;
    }

    try {
      if (selectedItem) {
        const result = await hubAPI.links.update({
          id: selectedItem.id,
          title: formData.title,
          url: formData.url,
          description: formData.description
        });

        if (result.success) {
          await loadLinks(activeWorkspace.id);
          setIsEditing(false);
          setSelectedItem(null);
          showToast(isFr ? 'Lien mis à jour' : 'Link updated', 'success');
        } else {
          showToast(result.error || (isFr ? 'Erreur de mise à jour' : 'Failed to update link'), 'error');
        }
      } else {
        const result = await hubAPI.links.create({
          workspaceId: activeWorkspace.id,
          title: formData.title,
          url: formData.url,
          description: formData.description,
          isFavorite: formData.isFavorite
        });

        if (result.success) {
          await loadLinks(activeWorkspace.id);
          setIsEditing(false);
          showToast(isFr ? 'Lien créé' : 'Link created', 'success');
        } else {
          showToast(result.error || (isFr ? 'Erreur de création' : 'Failed to create link'), 'error');
        }
      }
    } catch (err) {
      console.error('Failed to save link:', err);
      showToast(isFr ? 'Erreur de sauvegarde' : 'Failed to save link', 'error');
    }
  };

  const handleSaveFileRef = async () => {
    if (!fileFormData.name.trim() || !fileFormData.path.trim()) {
      showToast(isFr ? 'Nom et chemin requis' : 'Name and path are required', 'error');
      return;
    }

    try {
      if (selectedItem) {
        const result = await hubAPI.fileRefs.update({
          id: selectedItem.id,
          name: fileFormData.name,
          path: fileFormData.path,
          description: fileFormData.description
        });

        if (result.success) {
          await loadFileRefs(activeWorkspace.id);
          setIsEditing(false);
          setSelectedItem(null);
          showToast(isFr ? 'Fichier mis à jour' : 'File reference updated', 'success');
        } else {
          showToast(result.error || (isFr ? 'Erreur de mise à jour' : 'Failed to update file reference'), 'error');
        }
      } else {
        const result = await hubAPI.fileRefs.create({
          workspaceId: activeWorkspace.id,
          name: fileFormData.name,
          path: fileFormData.path,
          type: fileFormData.type,
          description: fileFormData.description
        });

        if (result.success) {
          await loadFileRefs(activeWorkspace.id);
          setIsEditing(false);
          showToast(isFr ? 'Fichier créé' : 'File reference created', 'success');
        } else {
          showToast(result.error || (isFr ? 'Erreur de création' : 'Failed to create file reference'), 'error');
        }
      }
    } catch (err) {
      console.error('Failed to save file reference:', err);
      showToast(isFr ? 'Erreur de sauvegarde' : 'Failed to save file reference', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      if (deleteModal.type === 'link') {
        const result = await hubAPI.links.delete({ id: deleteModal.id });
        if (result.success) {
          await loadLinks(activeWorkspace.id);
          showToast(isFr ? 'Lien supprimé' : 'Link deleted', 'success');
        } else {
          showToast(result.error || (isFr ? 'Erreur de suppression' : 'Failed to delete link'), 'error');
        }
      } else {
        const result = await hubAPI.fileRefs.delete({ id: deleteModal.id });
        if (result.success) {
          await loadFileRefs(activeWorkspace.id);
          showToast(isFr ? 'Fichier supprimé' : 'File reference deleted', 'success');
        } else {
          showToast(result.error || (isFr ? 'Erreur de suppression' : 'Failed to delete file reference'), 'error');
        }
      }
      setDeleteModal({ isOpen: false, id: null, title: '', type: '' });
    } catch (err) {
      console.error('Failed to delete:', err);
      showToast(isFr ? 'Erreur de suppression' : 'Failed to delete item', 'error');
    }
  };

  const handleToggleFavorite = async (linkId) => {
    try {
      const result = await hubAPI.links.toggleFavorite({ id: linkId });
      if (result.success) {
        await loadLinks(activeWorkspace.id);
      }
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleOpenFile = async (fileRefId) => {
    try {
      await hubAPI.fileRefs.open({ id: fileRefId });
    } catch (err) {
      console.error('Failed to open file:', err);
      showToast(isFr ? 'Impossible d\'ouvrir le fichier' : 'Failed to open file', 'error');
    }
  };

  const handleShowInFolder = async (fileRefId) => {
    try {
      await hubAPI.fileRefs.showInFolder({ id: fileRefId });
    } catch (err) {
      console.error('Failed to show in folder:', err);
      showToast(isFr ? 'Impossible d\'afficher dans le dossier' : 'Failed to show in folder', 'error');
    }
  };

  const handlePickFile = async () => {
    try {
      const path = await hubAPI.fs.pickFile();
      if (path) {
        setFileFormData({ ...fileFormData, path, type: 'file' });
      }
    } catch (err) {
      console.error('Failed to pick file:', err);
    }
  };

  const handlePickFolder = async () => {
    try {
      const path = await hubAPI.fs.pickFolder();
      if (path) {
        setFileFormData({ ...fileFormData, path, type: 'folder' });
      }
    } catch (err) {
      console.error('Failed to pick folder:', err);
    }
  };

  const openDeleteModal = (id, title, type) => {
    setDeleteModal({ isOpen: true, id, title, type });
  };

  if (loading) {
    return (
      <div className="page">
        <Topbar title={t('common.quickLinks')} />
        <div className="page-content loading-center">
          <div className="text-muted-center">{isFr ? 'Chargement...' : 'Loading...'}</div>
        </div>
      </div>
    );
  }

  if (!activeWorkspace) {
    return (
      <div className="page">
        <Topbar title={t('common.quickLinks')} />
        <div className="page-content">
          <EmptyState icon={LinkIcon} title={isFr ? 'Aucun espace actif' : 'No Active Workspace'} description={isFr ? 'Creez ou selectionnez un espace.' : 'Please create or select a workspace.'} />
        </div>
      </div>
    );
  }

  const currentData = activeTab === 'links' ? links : fileRefs;

  return (
    <div className="page">
      <Topbar title={t('common.quickLinks')} />

      <div className="page-content links-layout">
        {/* Tabs */}
        <div className="links-tabs">
          <button
            onClick={() => {
              setActiveTab('links');
              setIsEditing(false);
              setSelectedItem(null);
            }}
            className={`links-tab${activeTab === 'links' ? ' active' : ''}`}
          >
            <LinkIcon size={16} />
            {isFr ? 'Liens rapides' : 'Quick Links'} ({links.length})
          </button>
          <button
            onClick={() => {
              setActiveTab('files');
              setIsEditing(false);
              setSelectedItem(null);
            }}
            className={`links-tab${activeTab === 'files' ? ' active' : ''}`}
          >
            <File size={16} />
            {isFr ? 'Fichiers' : 'File References'} ({fileRefs.length})
          </button>
        </div>

        <div className="links-body">
          {/* List Sidebar */}
          <div className="links-sidebar">
            {/* Create Button */}
            <button
              onClick={activeTab === 'links' ? handleCreateLink : handleCreateFileRef}
              className="btn btn-primary btn-full flex-center flex-gap-2"
            >
              <Plus size={18} />
              {activeTab === 'links' ? (isFr ? 'Nouveau lien' : 'New Link') : (isFr ? 'Nouveau fichier' : 'New File Reference')}
            </button>

            {/* Search */}
            <div className="search-input-wrapper">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={activeTab === 'links' ? (isFr ? 'Rechercher des liens...' : 'Search links...') : (isFr ? 'Rechercher des fichiers...' : 'Search files...')}
              />
              <button onClick={handleSearch} className="search-icon-btn">
                <Search size={16} />
              </button>
            </div>

            {/* List */}
            <div className="links-sidebar-list">
              {currentData.length === 0 ? (
                <div className="empty-list-placeholder">
                  {searchQuery ? (activeTab === 'links' ? (isFr ? 'Aucun lien trouvé' : 'No links found') : (isFr ? 'Aucun fichier trouvé' : 'No files found')) : (activeTab === 'links' ? (isFr ? 'Aucun lien pour le moment' : 'No links yet') : (isFr ? 'Aucun fichier pour le moment' : 'No files yet'))}
                </div>
              ) : activeTab === 'links' ? (
                links.map((link) => (
                  <LinkCard
                    key={link.id}
                    link={link}
                    onEdit={() => handleEditLink(link)}
                    onDelete={() => openDeleteModal(link.id, link.title, 'link')}
                    onToggleFavorite={() => handleToggleFavorite(link.id)}
                  />
                ))
              ) : (
                fileRefs.map((fileRef) => (
                  <FileRefCard
                    key={fileRef.id}
                    fileRef={fileRef}
                    onEdit={() => handleEditFileRef(fileRef)}
                    onDelete={() => openDeleteModal(fileRef.id, fileRef.name, 'file')}
                    onOpen={() => handleOpenFile(fileRef.id)}
                    onShowInFolder={() => handleShowInFolder(fileRef.id)}
                  />
                ))
              )}
            </div>
          </div>

          {/* Editor/Content Area */}
          <div className="notes-content-area">
            {!isEditing ? (
              <EmptyState
                icon={activeTab === 'links' ? LinkIcon : File}
                title={activeTab === 'links' ? (isFr ? 'Aucun lien sélectionné' : 'No link selected') : (isFr ? 'Aucun fichier sélectionné' : 'No file selected')}
                description={activeTab === 'links' ? (isFr ? 'Créez ou sélectionnez un lien pour commencer' : 'Create or select a link to get started') : (isFr ? 'Créez ou sélectionnez un fichier pour commencer' : 'Create or select a file reference to get started')}
              />
            ) : activeTab === 'links' ? (
              <LinkEditor
                formData={formData}
                setFormData={setFormData}
                onSave={handleSaveLink}
                onCancel={() => {
                  setIsEditing(false);
                  setSelectedItem(null);
                }}
                isNew={!selectedItem}
              />
            ) : (
              <FileRefEditor
                formData={fileFormData}
                setFormData={setFileFormData}
                onSave={handleSaveFileRef}
                onCancel={() => {
                  setIsEditing(false);
                  setSelectedItem(null);
                }}
                isNew={!selectedItem}
                onPickFile={handlePickFile}
                onPickFolder={handlePickFolder}
              />
            )}
          </div>
        </div>
      </div>

      {/* Delete Modal */}
      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null, title: '', type: '' })}
        onConfirm={handleDelete}
        title={`Delete ${deleteModal.type === 'link' ? 'Link' : 'File Reference'}`}
        message={`Are you sure you want to delete "${deleteModal.title}"? This action cannot be undone.`}
        type="confirm"
        confirmText="Delete"
        cancelText="Cancel"
      />
    </div>
  );
}

// Link Card Component
function LinkCard({ link, onEdit, onDelete, onToggleFavorite }) {
  return (
    <div className="item-card">
      <div className="flex-between mb-2" style={{ alignItems: 'start' }}>
        <h4 className="item-card-title">{link.title}</h4>
        <button
          onClick={onToggleFavorite}
          className={`btn-icon-ghost${link.is_favorite ? ' active' : ''}`}
        >
          <Star size={14} fill={link.is_favorite ? 'currentColor' : 'none'} />
        </button>
      </div>

      {link.description && <p className="item-card-desc">{link.description}</p>}

      <div className="flex-between">
        <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-url">
          <ExternalLink size={10} />
          {link.url}
        </a>
        <div className="flex-center" style={{ gap: '4px' }}>
          <button onClick={onEdit} className="btn-tiny"><Edit size={12} /></button>
          <button onClick={onDelete} className="btn-tiny danger"><Trash2 size={12} /></button>
        </div>
      </div>
    </div>
  );
}

// Helper function to get file icon and color based on extension
function getFileIcon(path, type) {
  // If it's explicitly a folder
  if (type === 'folder') {
    return { Icon: Folder, color: '#FFA500', bgColor: 'rgba(255, 165, 0, 0.1)' };
  }

  // Guard against invalid path - return generic file icon
  if (!path || typeof path !== 'string') {
    return { Icon: File, color: '#6366F1', bgColor: 'rgba(99, 102, 241, 0.1)' };
  }

  // Get the filename from path
  const filename = path.split(/[/\\]/).pop() || '';

  // Check if it looks like a folder (no extension in the last part)
  // Also check for common folder indicators
  if (!filename.includes('.') || path.endsWith('/') || path.endsWith('\\')) {
    return { Icon: Folder, color: '#FFA500', bgColor: 'rgba(255, 165, 0, 0.1)' };
  }

  // Get file extension
  const ext = filename.split('.').pop()?.toLowerCase() || '';

  // Image files
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp', 'ico', 'tiff', 'raw'].includes(ext)) {
    return { Icon: Image, color: '#10B981', bgColor: 'rgba(16, 185, 129, 0.1)' };
  }

  // Video files
  if (['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm', 'm4v'].includes(ext)) {
    return { Icon: Film, color: '#8B5CF6', bgColor: 'rgba(139, 92, 246, 0.1)' };
  }

  // Audio files
  if (['mp3', 'wav', 'ogg', 'flac', 'm4a', 'aac', 'wma'].includes(ext)) {
    return { Icon: Music, color: '#EC4899', bgColor: 'rgba(236, 72, 153, 0.1)' };
  }

  // Code files
  if (
    [
      'js',
      'jsx',
      'ts',
      'tsx',
      'py',
      'java',
      'c',
      'cpp',
      'cs',
      'php',
      'rb',
      'go',
      'rs',
      'swift',
      'kt',
      'html',
      'css',
      'scss',
      'json',
      'xml',
      'yaml',
      'yml',
      'sh',
      'bat',
      'ps1'
    ].includes(ext)
  ) {
    return { Icon: Code, color: '#3B82F6', bgColor: 'rgba(59, 130, 246, 0.1)' };
  }

  // Archive files
  if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz'].includes(ext)) {
    return { Icon: FileArchive, color: '#F59E0B', bgColor: 'rgba(245, 158, 11, 0.1)' };
  }

  // Text/Document files
  if (['txt', 'md', 'doc', 'docx', 'pdf', 'rtf', 'odt', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
    return { Icon: FileText, color: '#6366F1', bgColor: 'rgba(99, 102, 241, 0.1)' };
  }

  // Default file icon - always return a visible icon
  return { Icon: File, color: '#6366F1', bgColor: 'rgba(99, 102, 241, 0.1)' };
}

// File Reference Card Component
function FileRefCard({ fileRef, onEdit, onDelete, onOpen, onShowInFolder }) {
  const { Icon, color, bgColor } = getFileIcon(fileRef.path, fileRef.type);

  return (
    <div className="item-card" onClick={onShowInFolder}>
      <div className="flex-center flex-gap-3" style={{ alignItems: 'start' }}>
        <div className="file-icon-badge" style={{ backgroundColor: bgColor }}>
          <Icon size={20} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4 className="item-card-title" style={{ paddingRight: 0, whiteSpace: 'nowrap' }}>{fileRef.name}</h4>
          {fileRef.description && <p className="item-card-desc">{fileRef.description}</p>}
          <div className="flex-center flex-gap-2" style={{ marginTop: 'var(--space-2)' }}>
            <button onClick={(e) => { e.stopPropagation(); onOpen(); }} className="btn btn-primary btn-sm flex-center flex-gap-2">
              <ExternalLink size={12} /> Open
            </button>
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="btn-tiny"><Edit size={12} /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="btn-tiny danger"><Trash2 size={12} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Link Editor Component
function LinkEditor({ formData, setFormData, onSave, onCancel, isNew }) {
  const { language } = useI18n();
  const isFr = language === 'fr';
  return (
    <div className="editor-panel">
      <div className="flex-between mb-6">
        <h3 className="section-heading" style={{ margin: 0 }}>
          {isNew ? (isFr ? 'Nouveau lien' : 'New Link') : (isFr ? 'Modifier le lien' : 'Edit Link')}
        </h3>
        <div className="flex-center flex-gap-2">
          <button onClick={onCancel} className="btn btn-secondary btn-sm flex-center flex-gap-2">
            <X size={16} /> Cancel
          </button>
          <button onClick={onSave} className="btn btn-primary btn-sm flex-center flex-gap-2">
            <Save size={16} /> Save
          </button>
        </div>
      </div>

      <div className="flex-col" style={{ gap: 'var(--space-4)' }}>
        <div className="form-group">
          <label>Title *</label>
          <input type="text" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Enter link title..." autoFocus />
        </div>

        <div className="form-group">
          <label>URL *</label>
          <input type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} placeholder="https://example.com" />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description..." rows={3} style={{ resize: 'vertical' }} />
        </div>

        {isNew && (
          <div className="flex-center flex-gap-2">
            <input type="checkbox" id="favorite" checked={formData.isFavorite} onChange={(e) => setFormData({ ...formData, isFavorite: e.target.checked })} />
            <label htmlFor="favorite" style={{ fontSize: 'var(--text-sm)', cursor: 'pointer' }}>Add to favorites</label>
          </div>
        )}
      </div>
    </div>
  );
}

// File Reference Editor Component
function FileRefEditor({ formData, setFormData, onSave, onCancel, isNew, onPickFile, onPickFolder }) {
  const { language } = useI18n();
  const isFr = language === 'fr';
  return (
    <div className="editor-panel">
      <div className="flex-between mb-6">
        <h3 className="section-heading" style={{ margin: 0 }}>
          {isNew ? (isFr ? 'Nouveau fichier' : 'New File Reference') : (isFr ? 'Modifier le fichier' : 'Edit File Reference')}
        </h3>
        <div className="flex-center flex-gap-2">
          <button onClick={onCancel} className="btn btn-secondary btn-sm flex-center flex-gap-2">
            <X size={16} /> Cancel
          </button>
          <button onClick={onSave} className="btn btn-primary btn-sm flex-center flex-gap-2">
            <Save size={16} /> Save
          </button>
        </div>
      </div>

      <div className="flex-col" style={{ gap: 'var(--space-4)' }}>
        <div className="form-group">
          <label>Name *</label>
          <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Enter file name..." autoFocus />
        </div>

        <div className="form-group">
          <label>File/Folder Path *</label>
          <div className="browse-btns">
            <button onClick={onPickFile} type="button" className="btn btn-secondary">
              <File size={16} /> Browse File
            </button>
            <button onClick={onPickFolder} type="button" className="btn btn-secondary">
              <FolderOpen size={16} /> Browse Folder
            </button>
          </div>
          <input type="text" value={formData.path} onChange={(e) => setFormData({ ...formData, path: e.target.value })} placeholder="C:\path\to\file.txt or use browse buttons above" style={{ fontFamily: 'monospace' }} />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Optional description..." rows={3} style={{ resize: 'vertical' }} />
        </div>
      </div>
    </div>
  );
}

export default Links;
