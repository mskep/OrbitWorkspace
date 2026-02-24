import { useState, useEffect, useCallback, useRef } from 'react';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import { useAppStore } from '../state/store';
import { Inbox, MailOpen, Award, Shield, Bell, Megaphone, CheckCheck, RefreshCw, Wrench, Download, ShieldAlert } from 'lucide-react';

const TYPE_CONFIG = {
  'badge-assigned': { icon: Award, color: '#f59e0b', label: 'Badge Awarded' },
  'badge-revoked': { icon: Award, color: '#ef4444', label: 'Badge Removed' },
  'role-changed': { icon: Shield, color: '#8b5cf6', label: 'Role Updated' },
  'system-notification': { icon: Bell, color: 'var(--accent)', label: 'System' },
  'admin-broadcast': { icon: Megaphone, color: '#ec4899', label: 'Announcement' },
  'admin-maintenance': { icon: Wrench, color: '#f59e0b', label: 'Maintenance' },
  'admin-update': { icon: Download, color: '#10b981', label: 'Update' },
  'admin-security': { icon: ShieldAlert, color: '#ef4444', label: 'Security' }
};

function formatTimeAgo(timestamp) {
  const now = Math.floor(Date.now() / 1000);
  const diff = now - timestamp;

  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function InboxPage() {
  const setUnreadInbox = useAppStore((state) => state.setUnreadInbox);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [newMessageIds, setNewMessageIds] = useState(new Set());
  const knownIdsRef = useRef(new Set());

  const loadMessages = useCallback(async () => {
    try {
      const result = await hubAPI.inbox.getAll();
      if (result.success) {
        // Detect newly arrived messages
        const incoming = new Set(result.messages.map((m) => m.id));
        const freshIds = new Set();
        if (knownIdsRef.current.size > 0) {
          for (const id of incoming) {
            if (!knownIdsRef.current.has(id)) freshIds.add(id);
          }
        }
        knownIdsRef.current = incoming;

        if (freshIds.size > 0) {
          setNewMessageIds(freshIds);
          setTimeout(() => setNewMessageIds(new Set()), 600);
        }

        setMessages(result.messages);
        setUnreadInbox(result.messages.filter((m) => !m.is_read).length);
      }
    } catch (err) {
      console.error('Failed to load inbox:', err);
    } finally {
      setLoading(false);
    }
  }, [setUnreadInbox]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Real-time inbox push listener
  useEffect(() => {
    const cleanup = hubAPI.inbox.onNewMessage(() => {
      loadMessages();
    });
    return cleanup;
  }, [loadMessages]);

  const handleMarkRead = async (id) => {
    try {
      const result = await hubAPI.inbox.markRead({ id });
      if (result.success) {
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === id ? { ...m, is_read: 1, read_at: Math.floor(Date.now() / 1000) } : m
          );
          setUnreadInbox(updated.filter((m) => !m.is_read).length);
          return updated;
        });
      }
    } catch (err) {
      console.error('Failed to mark read:', err);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      const result = await hubAPI.inbox.markAllRead();
      if (result.success) {
        setMessages((prev) =>
          prev.map((m) => (m.is_read ? m : { ...m, is_read: 1, read_at: Math.floor(Date.now() / 1000) }))
        );
        setUnreadInbox(0);
      }
    } catch (err) {
      console.error('Failed to mark all read:', err);
    }
  };

  const filtered = messages.filter((m) => {
    if (filter === 'unread') return !m.is_read;
    if (filter === 'read') return m.is_read;
    return true;
  });

  const unreadCount = messages.filter((m) => !m.is_read).length;
  const readCount = messages.filter((m) => m.is_read).length;

  const filters = [
    { key: 'all', label: 'All', count: messages.length },
    { key: 'unread', label: 'Unread', count: unreadCount },
    { key: 'read', label: 'Read', count: readCount }
  ];

  return (
    <div className="page">
      <Topbar
        title="Inbox"
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button onClick={loadMessages} title="Refresh" className="inbox-action-btn">
              <RefreshCw size={14} />
            </button>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} className="inbox-action-btn">
                <CheckCheck size={14} />
                <span>Mark all read</span>
              </button>
            )}
          </div>
        }
      />

      <div className="page-content">
        {/* Filter tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {filters.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`inbox-filter-tab ${filter === tab.key ? 'active' : ''}`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={`inbox-filter-count ${filter === tab.key ? 'active' : ''} ${tab.key === 'unread' && tab.count > 0 ? 'has-unread' : ''}`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Messages list */}
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2, 3].map((i) => (
              <div key={i} className="inbox-skeleton" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="inbox-empty">
            {filter === 'unread' ? (
              <>
                <CheckCheck size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <span style={{ fontSize: '15px', fontWeight: '600' }}>All caught up</span>
                <span style={{ fontSize: '13px', marginTop: '4px', opacity: 0.6 }}>No unread messages</span>
              </>
            ) : (
              <>
                <Inbox size={48} style={{ marginBottom: '16px', opacity: 0.3 }} />
                <span style={{ fontSize: '15px', fontWeight: '600' }}>No messages</span>
                <span style={{ fontSize: '13px', marginTop: '4px', opacity: 0.6 }}>
                  {filter === 'read' ? 'No read messages' : 'Your inbox is empty'}
                </span>
              </>
            )}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {filtered.map((msg) => {
              const config = TYPE_CONFIG[msg.type] || TYPE_CONFIG['system-notification'];
              const Icon = config.icon;
              const isUnread = !msg.is_read;

              return (
                <div
                  key={msg.id}
                  className={`inbox-message ${isUnread ? 'unread' : 'read'}${newMessageIds.has(msg.id) ? ' inbox-message-enter' : ''}`}
                  style={{ borderLeftColor: isUnread ? config.color : 'transparent' }}
                  onClick={() => isUnread && handleMarkRead(msg.id)}
                >
                  {/* Type icon */}
                  <div className="inbox-message-icon" style={{ backgroundColor: `${config.color}12` }}>
                    <Icon size={18} style={{ color: config.color }} />
                  </div>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: isUnread ? '700' : '500',
                          color: 'var(--text-primary)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {msg.title}
                      </span>
                      <span
                        className="inbox-unread-dot"
                        style={{
                          backgroundColor: config.color,
                          transform: isUnread ? 'scale(1)' : 'scale(0)',
                          opacity: isUnread ? 1 : 0
                        }}
                      />
                    </div>
                    <p className="inbox-message-text">{msg.message}</p>
                    <div className="inbox-message-meta">
                      <span
                        className="inbox-type-pill"
                        style={{ backgroundColor: `${config.color}12`, color: config.color }}
                      >
                        {config.label}
                      </span>
                      <span>{formatTimeAgo(msg.created_at)}</span>
                    </div>
                  </div>

                  {/* Mark read button */}
                  {isUnread && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(msg.id);
                      }}
                      title="Mark as read"
                      className="inbox-mark-read-btn"
                    >
                      <MailOpen size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default InboxPage;
