import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, Bell, FileText, Link, LockKeyhole, X } from 'lucide-react';
import { useAppStore } from '../../state/store';
import hubAPI from '../../api/hubApi';
import { useI18n } from '../../i18n';

function Topbar({ title, actions }) {
  const navigate = useNavigate();
  const location = useLocation();
  const profile = useAppStore((state) => state.profile);
  const unreadInbox = useAppStore((state) => state.unreadInbox);
  const activeWorkspace = useAppStore((state) => state.activeWorkspace);
  const { t } = useI18n();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ notes: [], links: [], vault: [] });
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const searchRef = useRef(null);
  const containerRef = useRef(null);
  const debounceRef = useRef(null);

  const isActive = (path) => location.pathname.startsWith(path);
  const initial = profile?.username?.charAt(0)?.toUpperCase() || '?';

  // Ctrl+K shortcut
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
        searchRef.current?.blur();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Search with debounce
  const doSearch = useCallback(async (q) => {
    if (!q.trim() || !activeWorkspace?.id) {
      setResults({ notes: [], links: [], vault: [] });
      return;
    }
    setLoading(true);
    try {
      const params = { workspaceId: activeWorkspace.id, query: q.trim() };
      const [notesRes, linksRes, vaultRes] = await Promise.all([
        hubAPI.notes.search(params).catch(() => ({ success: false })),
        hubAPI.links.search(params).catch(() => ({ success: false })),
        hubAPI.vault.search(params).catch(() => ({ success: false }))
      ]);
      setResults({
        notes: notesRes.success ? (notesRes.notes || []).slice(0, 5) : [],
        links: linksRes.success ? (linksRes.links || []).slice(0, 5) : [],
        vault: vaultRes.success ? (vaultRes.items || []).slice(0, 5) : []
      });
    } catch {
      setResults({ notes: [], links: [], vault: [] });
    } finally {
      setLoading(false);
    }
  }, [activeWorkspace?.id]);

  const handleChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(val), 300);
  };

  const handleSelect = (type) => {
    setIsOpen(false);
    setQuery('');
    setResults({ notes: [], links: [], vault: [] });
    navigate(`/${type}`);
  };

  const hasResults = results.notes.length > 0 || results.links.length > 0 || results.vault.length > 0;
  const showDropdown = isOpen && query.trim().length > 0;

  const SECTIONS = [
    { key: 'notes', label: 'Notes', icon: FileText, route: 'notes', items: results.notes },
    { key: 'links', label: 'Links', icon: Link, route: 'links', items: results.links },
    { key: 'vault', label: 'Vault', icon: LockKeyhole, route: 'vault', items: results.vault }
  ];

  return (
    <div className="topbar">
      <h2 className="topbar-title">{title}</h2>
      {actions && <div className="topbar-actions">{actions}</div>}

      <div className="topbar-global">
        <div className="topbar-search-wrapper" ref={containerRef}>
          <div className={`topbar-search ${isOpen ? 'focused' : ''}`}>
            <Search size={13} className="topbar-search-icon" />
            <input
              ref={searchRef}
              className="topbar-search-input"
              type="text"
              placeholder="Search..."
              value={query}
              onChange={handleChange}
              onFocus={() => query.trim() && setIsOpen(true)}
            />
            {query ? (
              <button
                className="topbar-search-clear"
                onClick={() => { setQuery(''); setResults({ notes: [], links: [], vault: [] }); setIsOpen(false); }}
                type="button"
              >
                <X size={12} />
              </button>
            ) : (
              <kbd className="topbar-search-kbd">Ctrl+K</kbd>
            )}
          </div>

          {showDropdown && (
            <div className="topbar-search-dropdown">
              {loading && <div className="topbar-search-loading">Searching...</div>}
              {!loading && !hasResults && <div className="topbar-search-empty">No results</div>}
              {!loading && SECTIONS.map(({ key, label, icon: Icon, route, items }) =>
                items.length > 0 && (
                  <div key={key} className="topbar-search-group">
                    <div className="topbar-search-group-label">
                      <Icon size={12} />
                      {label}
                    </div>
                    {items.map((item) => (
                      <button
                        key={item.id}
                        className="topbar-search-result"
                        onClick={() => handleSelect(route)}
                        type="button"
                      >
                        <span className="topbar-search-result-title">{item.title}</span>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>

        <button
          className={`topbar-bell ${isActive('/inbox') ? 'active' : ''}`}
          onClick={() => navigate('/inbox')}
          aria-label={t('common.inbox')}
          type="button"
        >
          <Bell size={18} />
          <span className={`topbar-bell-badge ${unreadInbox > 0 ? 'visible' : ''}`}>
            {unreadInbox > 99 ? '99+' : unreadInbox}
          </span>
        </button>

        <button
          className={`topbar-avatar ${isActive('/profile') ? 'active' : ''}`}
          onClick={() => navigate('/profile')}
          aria-label={t('common.profile')}
          type="button"
        >
          {profile?.avatar || initial}
        </button>
      </div>
    </div>
  );
}

export default Topbar;
