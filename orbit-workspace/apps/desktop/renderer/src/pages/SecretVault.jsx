import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Archive,
  Copy,
  Eye,
  EyeOff,
  Pencil,
  Pin,
  Plus,
  Save,
  Shield,
  Trash2,
  X,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import Topbar from '../app/layout/Topbar';
import EmptyState from '../components/EmptyState';
import SearchBar from '../components/SearchBar';
import CustomSelect from '../components/CustomSelect';
import Modal from '../components/Modal';
import hubAPI from '../api/hubApi';
import { useI18n } from '../i18n';
import { useAppStore } from '../state/store';

const EMPTY_FORM = {
  title: '',
  type: 'password',
  secret: '',
  username: '',
  website: '',
  note: '',
  tags: '',
};

const COPY_CLEAR_DELAY_MS = 20000;

function maskSecret(value) {
  if (!value) return '';
  return '\u2022'.repeat(Math.max(10, value.length));
}

function formatDate(ts) {
  if (!ts) return '-';
  const date = new Date(ts * 1000);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString();
}

function isPinned(item) {
  return Boolean(item?.is_pinned);
}

function getTypeLabel(t, type) {
  switch (type) {
    case 'password':
      return t('vault.typePassword');
    case 'token':
      return t('vault.typeToken');
    case 'api_key':
      return t('vault.typeApiKey');
    case 'secure_note':
      return t('vault.typeSecureNote');
    default:
      return type || t('vault.typePassword');
  }
}

function SecretVault() {
  const { t } = useI18n();
  const activeWorkspace = useAppStore((state) => state.activeWorkspace);
  const setActiveWorkspace = useAppStore((state) => state.setActiveWorkspace);

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [revealedIds, setRevealedIds] = useState(() => new Set());
  const [copyState, setCopyState] = useState({ id: null, status: 'idle' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null, title: '' });
  const copyClearTimerRef = useRef(null);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId],
  );

  const typeOptions = useMemo(
    () => [
      { value: 'all', label: t('vault.allTypes') },
      { value: 'password', label: t('vault.typePassword') },
      { value: 'token', label: t('vault.typeToken') },
      { value: 'api_key', label: t('vault.typeApiKey') },
      { value: 'secure_note', label: t('vault.typeSecureNote') },
    ],
    [t],
  );

  const isSecureNoteType = formData.type === 'secure_note';
  const noteFieldLabel = isSecureNoteType
    ? t('vault.typeSecureNote')
    : t('vault.fieldSecureDescription');

  useEffect(() => {
    loadWorkspaceAndItems();
  }, [activeWorkspace?.id]);

  useEffect(() => {
    if (!activeWorkspace?.id) return;

    const timer = setTimeout(() => {
      loadItems(activeWorkspace.id).catch((err) => {
        console.error('Vault filter refresh failed:', err);
      });
    }, 220);

    return () => clearTimeout(timer);
  }, [activeWorkspace?.id, searchQuery, typeFilter, includeArchived]);

  useEffect(() => {
    return () => {
      if (copyClearTimerRef.current) {
        clearTimeout(copyClearTimerRef.current);
      }
    };
  }, []);

  async function loadWorkspaceAndItems() {
    setLoading(true);
    setError('');

    try {
      const workspaceResult = await hubAPI.workspaces.getActive();
      if (!workspaceResult?.success || !workspaceResult.workspace?.id) {
        setLoading(false);
        return;
      }

      setActiveWorkspace(workspaceResult.workspace);
      await loadItems(workspaceResult.workspace.id);
    } catch (err) {
      console.error('Failed to load vault workspace:', err);
      setError('Failed to load Secret Vault');
    } finally {
      setLoading(false);
    }
  }

  async function loadItems(workspaceId, preferredSelectedId = null) {
    try {
      const query = searchQuery.trim();
      const payload = {
        workspaceId,
        includeArchived,
        type: typeFilter,
      };

      const result = query
        ? await hubAPI.vault.search({ ...payload, query })
        : await hubAPI.vault.getAll(payload);

      if (!result?.success) {
        setError(result?.error || 'Failed to load vault items');
        setItems([]);
        return;
      }

      const nextItems = Array.isArray(result.items) ? result.items : [];
      setItems(nextItems);

      const targetId = preferredSelectedId || selectedId;
      if (targetId && nextItems.some((item) => item.id === targetId)) {
        setSelectedId(targetId);
      } else if (!isEditing && nextItems.length > 0) {
        setSelectedId(nextItems[0].id);
      } else if (nextItems.length === 0) {
        setSelectedId(null);
      }
    } catch (err) {
      console.error('Failed to load vault items:', err);
      setError('Failed to load vault items');
      setItems([]);
    }
  }

  function handleCreateNew() {
    setIsEditing(true);
    setSelectedId(null);
    setFormData({
      ...EMPTY_FORM,
      type: typeFilter === 'all' ? 'password' : typeFilter,
    });
    setError('');
  }

  function handleEditSelected() {
    if (!selectedItem) return;

    setFormData({
      title: selectedItem.title || '',
      type: selectedItem.type || 'password',
      secret: selectedItem.secret || '',
      username: selectedItem.username || '',
      website: selectedItem.website || '',
      note: selectedItem.note || '',
      tags: selectedItem.tags || '',
    });
    setIsEditing(true);
    setError('');
  }

  function handleCancelEdit() {
    setIsEditing(false);
    setError('');
    setFormData(EMPTY_FORM);
  }

  async function handleSave() {
    if (!formData.title.trim()) {
      setError(t('vault.requiredTitle'));
      return;
    }

    if (!activeWorkspace?.id) {
      setError(t('vault.emptyWorkspaceDesc'));
      return;
    }

    setSaving(true);
    setError('');

    try {
      const payload = {
        workspaceId: activeWorkspace.id,
        title: formData.title.trim(),
        type: formData.type,
        secret: formData.type === 'secure_note' ? '' : formData.secret,
        username: formData.type === 'secure_note' ? '' : formData.username,
        website: formData.type === 'secure_note' ? '' : formData.website,
        note: formData.note,
        tags: formData.tags,
      };

      const result = selectedId
        ? await hubAPI.vault.update({ id: selectedId, ...payload })
        : await hubAPI.vault.create(payload);

      if (!result?.success) {
        setError(result?.error || t('vault.saveError'));
        return;
      }

      const updated = result.item;
      setIsEditing(false);
      setFormData(EMPTY_FORM);
      await loadItems(activeWorkspace.id, updated?.id || selectedId);
    } catch (err) {
      console.error('Vault save failed:', err);
      setError(t('vault.saveError'));
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteConfirmed() {
    if (!deleteModal.id) return;

    try {
      const result = await hubAPI.vault.delete({ id: deleteModal.id });
      if (!result?.success) {
        setError(result?.error || 'Failed to delete vault item');
        return;
      }

      const deletedId = deleteModal.id;
      setDeleteModal({ isOpen: false, id: null, title: '' });

      if (selectedId === deletedId) {
        setSelectedId(null);
      }

      if (activeWorkspace?.id) {
        await loadItems(activeWorkspace.id);
      }
    } catch (err) {
      console.error('Vault delete failed:', err);
      setError('Failed to delete vault item');
    }
  }

  async function handleToggleArchived(item) {
    try {
      const result = await hubAPI.vault.toggleArchived({ id: item.id });
      if (!result?.success) {
        setError(result?.error || 'Failed to update archive state');
        return;
      }

      if (activeWorkspace?.id) {
        await loadItems(activeWorkspace.id, item.id);
      }
    } catch (err) {
      console.error('Vault archive toggle failed:', err);
      setError('Failed to update archive state');
    }
  }

  async function handleTogglePinned(item) {
    try {
      const result = await hubAPI.vault.togglePin({ id: item.id });
      if (!result?.success) {
        setError(result?.error || 'Failed to update pin state');
        return;
      }

      if (activeWorkspace?.id) {
        await loadItems(activeWorkspace.id, item.id);
      }
    } catch (err) {
      console.error('Vault pin toggle failed:', err);
      setError('Failed to update pin state');
    }
  }

  function toggleReveal(itemId) {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  async function handleCopy(item) {
    const value = item.type === 'secure_note' ? item.note : item.secret;
    if (!value) return;

    try {
      await navigator.clipboard.writeText(value);
      setCopyState({ id: item.id, status: 'copied' });

      if (copyClearTimerRef.current) {
        clearTimeout(copyClearTimerRef.current);
      }

      copyClearTimerRef.current = setTimeout(async () => {
        try {
          await navigator.clipboard.writeText('');
        } catch {
          // ignore clipboard clear failures
        }
      }, COPY_CLEAR_DELAY_MS);
    } catch (err) {
      console.error('Copy secret failed:', err);
      setCopyState({ id: item.id, status: 'error' });
    }

    setTimeout(() => {
      setCopyState({ id: null, status: 'idle' });
    }, 1800);
  }

  if (loading) {
    return (
      <div className="page">
        <Topbar title={t('common.secretVault')} />
        <div className="page-content vault-loading">{t('common.loading')}</div>
      </div>
    );
  }

  if (!activeWorkspace?.id) {
    return (
      <div className="page">
        <Topbar title={t('common.secretVault')} />
        <div className="page-content vault-page-content">
          <EmptyState
            icon={Shield}
            title={t('vault.emptyWorkspaceTitle')}
            description={t('vault.emptyWorkspaceDesc')}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Topbar title={t('common.secretVault')} />

      <div className="page-content vault-page-content">
        <div className="vault-shell">
          <aside className="vault-sidebar card card-padding-md">
            <button type="button" className="btn btn-secondary btn-sm vault-create-btn" onClick={handleCreateNew}>
              <Plus size={14} />
              {t('vault.createNew')}
            </button>

            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder={t('vault.searchPlaceholder')}
            />

            <div className="vault-filter-row">
              <CustomSelect
                value={typeFilter}
                onChange={setTypeFilter}
                options={typeOptions}
                size="sm"
              />

              <button
                type="button"
                className={`vault-archive-btn ${includeArchived ? 'active' : ''}`}
                onClick={() => setIncludeArchived((prev) => !prev)}
              >
                <Archive size={13} />
                {t('vault.includeArchived')}
              </button>
            </div>

            <div className="vault-list">
              {items.length === 0 ? (
                <div className="vault-empty-list">
                  <p>{t('vault.noItems')}</p>
                  <span>{t('vault.noItemsDesc')}</span>
                </div>
              ) : (
                items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`vault-item ${selectedId === item.id ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedId(item.id);
                      setIsEditing(false);
                      setError('');
                    }}
                  >
                    <div className="vault-item-header">
                      <strong>{item.title}</strong>
                      <span className="vault-item-icons">
                        {isPinned(item) ? <Pin size={13} className="vault-pin-active" /> : null}
                        {item.is_archived ? <Archive size={13} /> : null}
                      </span>
                    </div>
                    <div className="vault-item-meta">
                      <span>{getTypeLabel(t, item.type)}</span>
                      <span>{formatDate(item.updated_at)}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="vault-main">
            {error ? <div className="vault-error">{error}</div> : null}

            {isEditing ? (
              <div className="vault-editor card card-padding-lg">
                <div className="vault-editor-header">
                  <h3>{selectedId ? t('vault.editItem') : t('vault.createNew')}</h3>
                  <div className="vault-editor-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleCancelEdit}>
                      <X size={14} />
                      {t('common.cancel')}
                    </button>
                    <button type="button" className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
                      <Save size={14} />
                      {saving ? t('common.loading') : t('vault.save')}
                    </button>
                  </div>
                </div>

                <div className={`vault-form-grid ${isSecureNoteType ? 'secure-note-mode' : ''}`}>
                  <div className="form-group">
                    <label>{t('vault.fieldTitle')}</label>
                    <input
                      type="text"
                      value={formData.title}
                      onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))}
                      placeholder={t('vault.fieldTitlePlaceholder')}
                    />
                  </div>

                  <div className="form-group">
                    <label>{t('vault.fieldType')}</label>
                    <CustomSelect
                      value={formData.type}
                      onChange={(value) => setFormData((prev) => ({ ...prev, type: value }))}
                      options={typeOptions.filter((opt) => opt.value !== 'all')}
                    />
                  </div>

                  {formData.type !== 'secure_note' && (
                    <>
                      <div className="form-group">
                        <label>{t('vault.fieldSecret')}</label>
                        <input
                          type="text"
                          value={formData.secret}
                          onChange={(event) => setFormData((prev) => ({ ...prev, secret: event.target.value }))}
                          placeholder={t('vault.fieldSecretPlaceholder')}
                        />
                      </div>

                      <div className="form-group">
                        <label>{t('vault.fieldUsername')}</label>
                        <input
                          type="text"
                          value={formData.username}
                          onChange={(event) => setFormData((prev) => ({ ...prev, username: event.target.value }))}
                          placeholder={t('vault.fieldUsernamePlaceholder')}
                        />
                      </div>

                      <div className="form-group">
                        <label>{t('vault.fieldWebsite')}</label>
                        <input
                          type="text"
                          value={formData.website}
                          onChange={(event) => setFormData((prev) => ({ ...prev, website: event.target.value }))}
                          placeholder={t('vault.fieldWebsitePlaceholder')}
                        />
                      </div>
                    </>
                  )}

                  <div className="form-group vault-form-note">
                    <label>{noteFieldLabel}</label>
                    <textarea
                      rows={5}
                      value={formData.note}
                      onChange={(event) => setFormData((prev) => ({ ...prev, note: event.target.value }))}
                      placeholder={t('vault.fieldNotePlaceholder')}
                    />
                  </div>

                  <div className="form-group vault-form-tags">
                    <label>{t('vault.fieldTags')}</label>
                    <input
                      type="text"
                      value={formData.tags}
                      onChange={(event) => setFormData((prev) => ({ ...prev, tags: event.target.value }))}
                      placeholder={t('vault.fieldTagsPlaceholder')}
                    />
                  </div>
                </div>
              </div>
            ) : selectedItem ? (
              <div className="vault-view card card-padding-lg">
                <div className="vault-view-header">
                  <div>
                    <h3>{selectedItem.title}</h3>
                    <p>{getTypeLabel(t, selectedItem.type)}</p>
                  </div>

                  <div className="vault-view-actions">
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleTogglePinned(selectedItem)}>
                      <Pin size={14} fill={isPinned(selectedItem) ? 'currentColor' : 'none'} />
                      {isPinned(selectedItem) ? t('vault.unpin') : t('vault.pin')}
                    </button>

                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleEditSelected}>
                      <Pencil size={14} />
                      {t('vault.editItem')}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleToggleArchived(selectedItem)}
                    >
                      <Archive size={14} />
                      {selectedItem.is_archived ? t('vault.unarchive') : t('vault.archive')}
                    </button>

                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => {
                        setDeleteModal({ isOpen: true, id: selectedItem.id, title: selectedItem.title });
                      }}
                    >
                      <Trash2 size={14} />
                      {t('common.delete')}
                    </button>
                  </div>
                </div>

                {selectedItem.type !== 'secure_note' ? (
                  <>
                    <div className="vault-secret-box">
                      <label>{t('vault.fieldSecret')}</label>
                      <div className="vault-secret-value">
                        <code>{revealedIds.has(selectedItem.id) ? (selectedItem.secret || '-') : maskSecret(selectedItem.secret)}</code>
                        <div className="vault-secret-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => toggleReveal(selectedItem.id)}
                          >
                            {revealedIds.has(selectedItem.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                            {revealedIds.has(selectedItem.id) ? t('vault.hide') : t('vault.reveal')}
                          </button>

                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleCopy(selectedItem)}
                            disabled={!selectedItem.secret}
                          >
                            <Copy size={14} />
                            {copyState.id === selectedItem.id
                              ? (copyState.status === 'copied' ? t('vault.copied') : t('vault.copyFailed'))
                              : t('vault.copy')}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="vault-meta-grid">
                      <div>
                        <span>{t('vault.fieldUsername')}</span>
                        <strong>{selectedItem.username || '-'}</strong>
                      </div>
                      <div>
                        <span>{t('vault.fieldWebsite')}</span>
                        <strong>{selectedItem.website || '-'}</strong>
                      </div>
                    </div>
                  </>
                ) : null}

                <div className="vault-note-box">
                  <label>{selectedItem.type === 'secure_note' ? t('vault.typeSecureNote') : t('vault.fieldSecureDescription')}</label>
                  {selectedItem.note ? (
                    <div className="vault-note-markdown markdown-body">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{selectedItem.note}</ReactMarkdown>
                    </div>
                  ) : (
                    <p>-</p>
                  )}
                </div>

                {selectedItem.tags ? (
                  <div className="vault-tags">
                    {selectedItem.tags.split(',').map((rawTag) => {
                      const tag = rawTag.trim();
                      if (!tag) return null;
                      return <span key={`${selectedItem.id}-${tag}`}>{tag}</span>;
                    })}
                  </div>
                ) : null}

                <div className="vault-timestamps">
                  <span>{t('vault.createdAt')}: {formatDate(selectedItem.created_at)}</span>
                  <span>{t('vault.updatedAt')}: {formatDate(selectedItem.updated_at)}</span>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Shield}
                title={t('vault.noSelection')}
                description={t('vault.noSelectionDesc')}
              />
            )}
          </section>
        </div>
      </div>

      <Modal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, id: null, title: '' })}
        onConfirm={handleDeleteConfirmed}
        title={t('vault.deleteTitle')}
        message={t('vault.deleteMessage', { title: deleteModal.title || '' })}
        type="confirm"
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
      />
    </div>
  );
}

export default SecretVault;