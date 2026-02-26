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
  const [activeTab, setActiveTab] = useState('links'); // 'links' or 'files'
  const [links, setLinks] = useState([]);
  const [fileRefs, setFileRefs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [error, setError] = useState('');
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
        setError('No active workspace. Please create a workspace first.');
        setLoading(false);
        return;
      }

      setActiveWorkspace(workspaceResult.workspace);

      // Load links and files
      await loadLinks(workspaceResult.workspace.id);
      await loadFileRefs(workspaceResult.workspace.id);
    } catch (err) {
      console.error('Failed to load workspace and data:', err);
      setError('Failed to load data');
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
    setError('');
  };

  const handleCreateFileRef = () => {
    setIsEditing(true);
    setSelectedItem(null);
    setFileFormData({ name: '', path: '', description: '', type: 'file' });
    setError('');
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
    setError('');
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
    setError('');
  };

  const handleSaveLink = async () => {
    if (!formData.title.trim() || !formData.url.trim()) {
      setError('Title and URL are required');
      return;
    }

    try {
      if (selectedItem) {
        // Update
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
          setError('');
        } else {
          setError(result.error || 'Failed to update link');
        }
      } else {
        // Create
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
          setError('');
        } else {
          setError(result.error || 'Failed to create link');
        }
      }
    } catch (err) {
      console.error('Failed to save link:', err);
      setError('Failed to save link');
    }
  };

  const handleSaveFileRef = async () => {
    if (!fileFormData.name.trim() || !fileFormData.path.trim()) {
      setError('Name and path are required');
      return;
    }

    try {
      if (selectedItem) {
        // Update
        const result = await hubAPI.fileRefs.update({
          id: selectedItem.id,
          name: fileFormData.name,
          path: fileFormData.path, // Changed from filePath to path
          description: fileFormData.description
        });

        if (result.success) {
          await loadFileRefs(activeWorkspace.id);
          setIsEditing(false);
          setSelectedItem(null);
          setError('');
        } else {
          setError(result.error || 'Failed to update file reference');
        }
      } else {
        // Create
        const result = await hubAPI.fileRefs.create({
          workspaceId: activeWorkspace.id,
          name: fileFormData.name,
          path: fileFormData.path, // Changed from filePath to path
          type: fileFormData.type, // Use type from form (file or folder)
          description: fileFormData.description
        });

        if (result.success) {
          await loadFileRefs(activeWorkspace.id);
          setIsEditing(false);
          setError('');
        } else {
          setError(result.error || 'Failed to create file reference');
        }
      }
    } catch (err) {
      console.error('Failed to save file reference:', err);
      setError('Failed to save file reference');
    }
  };

  const handleDelete = async () => {
    try {
      if (deleteModal.type === 'link') {
        const result = await hubAPI.links.delete({ id: deleteModal.id });
        if (result.success) {
          await loadLinks(activeWorkspace.id);
        } else {
          setError(result.error || 'Failed to delete link');
        }
      } else {
        const result = await hubAPI.fileRefs.delete({ id: deleteModal.id });
        if (result.success) {
          await loadFileRefs(activeWorkspace.id);
        } else {
          setError(result.error || 'Failed to delete file reference');
        }
      }
      setDeleteModal({ isOpen: false, id: null, title: '', type: '' });
    } catch (err) {
      console.error('Failed to delete:', err);
      setError('Failed to delete item');
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
      setError('Failed to open file');
    }
  };

  const handleShowInFolder = async (fileRefId) => {
    try {
      await hubAPI.fileRefs.showInFolder({ id: fileRefId });
    } catch (err) {
      console.error('Failed to show in folder:', err);
      setError('Failed to show in folder');
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
        <div className="page-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', color: 'var(--text-tertiary)' }}>{isFr ? 'Chargement...' : 'Loading...'}</div>
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

      <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {/* Tabs */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            borderBottom: '1px solid var(--border-default)',
            paddingBottom: '12px'
          }}
        >
          <button
            onClick={() => {
              setActiveTab('links');
              setIsEditing(false);
              setSelectedItem(null);
            }}
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === 'links' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'links' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
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
            style={{
              padding: '10px 20px',
              backgroundColor: activeTab === 'files' ? 'var(--accent)' : 'transparent',
              color: activeTab === 'files' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s'
            }}
          >
            <File size={16} />
            {isFr ? 'Fichiers' : 'File References'} ({fileRefs.length})
          </button>
        </div>

        <div style={{ display: 'flex', gap: '20px' }}>
          {/* List Sidebar */}
          <div
            style={{
              width: '350px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              flexShrink: 0
            }}
          >
            {/* Create Button */}
            <button
              onClick={activeTab === 'links' ? handleCreateLink : handleCreateFileRef}
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
              {activeTab === 'links' ? (isFr ? 'Nouveau lien' : 'New Link') : (isFr ? 'Nouveau fichier' : 'New File Reference')}
            </button>

            {/* Search */}
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder={activeTab === 'links' ? (isFr ? 'Rechercher des liens...' : 'Search links...') : (isFr ? 'Rechercher des fichiers...' : 'Search files...')}
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

            {/* List */}
            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                paddingRight: '4px'
              }}
            >
              {currentData.length === 0 ? (
                <div
                  style={{
                    textAlign: 'center',
                    padding: '40px 20px',
                    color: 'var(--text-tertiary)',
                    fontSize: '13px'
                  }}
                >
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
          <div style={{ flex: 1, minWidth: 0 }}>
            {error && (
              <div
                style={{
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
                }}
              >
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
                  setError('');
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
                  setError('');
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
    <div
      style={{
        padding: '12px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-hover)';
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-default)';
        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '8px' }}>
        <h4
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            paddingRight: '8px'
          }}
        >
          {link.title}
        </h4>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={onToggleFavorite}
            style={{
              padding: '4px',
              background: 'none',
              border: 'none',
              color: link.is_favorite ? 'var(--accent)' : 'var(--text-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <Star size={14} fill={link.is_favorite ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>

      {link.description && (
        <p
          style={{
            margin: '0 0 8px 0',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          {link.description}
        </p>
      )}

      <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center' }}>
        <a
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: '11px',
            color: 'var(--accent)',
            textDecoration: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          <ExternalLink size={10} />
          {link.url}
        </a>
        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={onEdit}
            style={{
              padding: '4px 8px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '11px',
              color: 'var(--text-primary)'
            }}
          >
            <Edit size={12} />
          </button>
          <button
            onClick={onDelete}
            style={{
              padding: '4px 8px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontSize: '11px',
              color: '#ef4444'
            }}
          >
            <Trash2 size={12} />
          </button>
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
    <div
      style={{
        padding: '12px',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        transition: 'all 0.2s',
        cursor: 'pointer'
      }}
      onClick={onShowInFolder}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-hover)';
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border-default)';
        e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
        <div
          style={{
            padding: '8px',
            backgroundColor: bgColor,
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <Icon size={20} color={color} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h4
            style={{
              margin: '0 0 4px 0',
              fontSize: '14px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {fileRef.name}
          </h4>
          {fileRef.description && (
            <p
              style={{
                margin: '0 0 4px 0',
                fontSize: '12px',
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {fileRef.description}
            </p>
          )}
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen();
              }}
              style={{
                padding: '6px 12px',
                backgroundColor: 'var(--accent)',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                gap: '6px'
              }}
            >
              <ExternalLink size={12} />
              Open
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              style={{
                padding: '4px 8px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '11px',
                color: 'var(--text-primary)'
              }}
            >
              <Edit size={12} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              style={{
                padding: '4px 8px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-sm)',
                cursor: 'pointer',
                fontSize: '11px',
                color: '#ef4444'
              }}
            >
              <Trash2 size={12} />
            </button>
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
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        padding: '24px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        animation: 'fadeIn 0.3s ease-in-out'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
          {isNew ? (isFr ? 'Nouveau lien' : 'New Link') : (isFr ? 'Modifier le lien' : 'Edit Link')}
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
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
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '8px'
            }}
          >
            Title *
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Enter link title..."
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '8px'
            }}
          >
            URL *
          </label>
          <input
            type="url"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://example.com"
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '8px'
            }}
          >
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>

        {isNew && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="favorite"
              checked={formData.isFavorite}
              onChange={(e) => setFormData({ ...formData, isFavorite: e.target.checked })}
              style={{ cursor: 'pointer' }}
            />
            <label htmlFor="favorite" style={{ fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer' }}>
              Add to favorites
            </label>
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
    <div
      style={{
        backgroundColor: 'var(--bg-secondary)',
        padding: '24px',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-default)',
        animation: 'fadeIn 0.3s ease-in-out'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>
          {isNew ? (isFr ? 'Nouveau fichier' : 'New File Reference') : (isFr ? 'Modifier le fichier' : 'Edit File Reference')}
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={onCancel}
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
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
              fontSize: '13px',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Save size={16} />
            Save
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '8px'
            }}
          >
            Name *
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Enter file name..."
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '8px'
            }}
          >
            File/Folder Path *
          </label>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
            <button
              onClick={onPickFile}
              type="button"
              style={{
                flex: 1,
                padding: '10px 16px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              }}
            >
              <File size={16} />
              Browse File
            </button>
            <button
              onClick={onPickFolder}
              type="button"
              style={{
                flex: 1,
                padding: '10px 16px',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '600',
                color: 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent)';
                e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-default)';
                e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
              }}
            >
              <FolderOpen size={16} />
              Browse Folder
            </button>
          </div>
          <input
            type="text"
            value={formData.path}
            onChange={(e) => setFormData({ ...formData, path: e.target.value })}
            placeholder="C:\path\to\file.txt or use browse buttons above"
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'monospace',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: '600',
              color: 'var(--text-secondary)',
              marginBottom: '8px'
            }}
          >
            Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="Optional description..."
            rows={3}
            style={{
              width: '100%',
              padding: '12px 16px',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              fontSize: '14px',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'inherit',
              resize: 'vertical',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default Links;
