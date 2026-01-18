import React, { useEffect, useState, useRef } from 'react';
import hubAPI from '../api/hubApi';
import {
  RefreshCw, Download, Search,
  CheckCircle, XCircle, Clock, Activity,
  User, Settings, ChevronDown
} from 'lucide-react';
import Button from './Button';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';

// Couleurs fixes - pas de variables CSS dynamiques
const STATUS_STYLES = {
  success: {
    bg: '#10b981',
    badge: 'badge-success',
    icon: CheckCircle
  },
  error: {
    bg: '#ef4444',
    badge: 'badge-error',
    icon: XCircle
  },
  pending: {
    bg: '#f59e0b',
    badge: 'badge-warning',
    icon: Clock
  }
};

function LogViewer({ limit = 50, enableRealtime = true, showFilters = true }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedLog, setExpandedLog] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    loadLogs();

    if (enableRealtime) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  function connectWebSocket() {
    try {
      const ws = new WebSocket('ws://localhost:9876');

      ws.onopen = () => {
        console.log('Connected to log stream');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.event === 'log:new') {
            setLogs(prevLogs => [message.data, ...prevLogs].slice(0, limit));
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('Disconnected from log stream');
        setTimeout(() => {
          if (enableRealtime) {
            connectWebSocket();
          }
        }, 5000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect to WebSocket:', error);
    }
  }

  async function loadLogs() {
    try {
      setLoading(true);
      const data = await hubAPI.logs.tail({ limit });
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleExport() {
    try {
      const data = await hubAPI.logs.tail({ limit: 1000 });
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `logs-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export logs:', error);
    }
  }

  const filteredLogs = logs.filter(log => {
    if (filter !== 'all' && log.status !== filter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.action_type?.toLowerCase().includes(query) ||
        log.tool_id?.toLowerCase().includes(query) ||
        log.username?.toLowerCase().includes(query) ||
        log.error_message?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Helper pour obtenir le style du status
  function getStatusStyle(status) {
    return STATUS_STYLES[status] || STATUS_STYLES.pending;
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Skeleton variant="rect" style={{ height: '60px' }} />
        <Skeleton variant="rect" style={{ height: '80px' }} />
        <Skeleton variant="rect" style={{ height: '80px' }} />
        <Skeleton variant="rect" style={{ height: '80px' }} />
      </div>
    );
  }

  return (
    <div className="log-viewer">
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={18} />
            Activity Logs
          </h4>
          {enableRealtime && wsRef.current?.readyState === WebSocket.OPEN && (
            <span className="badge badge-success">
              <div style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: 'currentColor',
                marginRight: '6px',
                animation: 'pulse 2s infinite'
              }} />
              Live
            </span>
          )}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="ghost" size="sm" onClick={loadLogs}>
            <RefreshCw size={14} />
            Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download size={14} />
            Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          flexWrap: 'wrap'
        }}>
          <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)'
              }}
            />
            <input
              type="text"
              placeholder="Search logs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input"
              style={{ paddingLeft: '36px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            {['all', 'success', 'error', 'pending'].map(status => (
              <button
                key={status}
                onClick={() => setFilter(status)}
                className={`btn ${filter === status ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              >
                {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Logs List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredLogs.map((log) => {
          const statusStyle = getStatusStyle(log.status);
          const StatusIcon = statusStyle.icon;
          const isExpanded = expandedLog === log.uuid;

          return (
            <div
              key={log.uuid || log.id}
              style={{
                padding: '16px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--bg-tertiary)',
                border: '1px solid var(--border-default)',
                cursor: 'pointer',
                transition: 'all var(--transition-fast)'
              }}
              onClick={() => setExpandedLog(isExpanded ? null : log.uuid)}
            >
              {/* Log Header */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap'
              }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: statusStyle.bg,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <StatusIcon size={16} color="#fff" />
                </div>

                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{
                    fontWeight: '600',
                    fontSize: '14px',
                    marginBottom: '4px'
                  }}>
                    {log.action_type || log.type || 'Unknown Action'}
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--text-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flexWrap: 'wrap'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {new Date(log.timestamp).toLocaleString()}
                    </span>
                    {log.username && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} />
                        {log.username}
                      </span>
                    )}
                    {log.tool_id && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Settings size={12} />
                        {log.tool_name || log.tool_id}
                      </span>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span className={statusStyle.badge}>
                    {log.status}
                  </span>
                  <ChevronDown
                    size={16}
                    style={{
                      transition: 'transform var(--transition-fast)',
                      transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                      color: 'var(--text-tertiary)'
                    }}
                  />
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div style={{
                  marginTop: '16px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-default)',
                  fontSize: '13px'
                }}>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '12px'
                  }}>
                    {log.user_role && (
                      <div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '4px' }}>
                          Role
                        </div>
                        <div style={{ fontWeight: '600' }}>{log.user_role}</div>
                      </div>
                    )}
                    {log.category && (
                      <div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '4px' }}>
                          Category
                        </div>
                        <div style={{ fontWeight: '600' }}>{log.category}</div>
                      </div>
                    )}
                    {log.duration_ms && (
                      <div>
                        <div style={{ color: 'var(--text-tertiary)', fontSize: '11px', marginBottom: '4px' }}>
                          Duration
                        </div>
                        <div style={{ fontWeight: '600' }}>{log.duration_ms}ms</div>
                      </div>
                    )}
                  </div>

                  {log.error_message && (
                    <div style={{
                      marginTop: '12px',
                      padding: '12px',
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: '3px solid #ef4444'
                    }}>
                      <div style={{
                        color: 'var(--text-tertiary)',
                        fontSize: '11px',
                        marginBottom: '4px'
                      }}>
                        Error Message
                      </div>
                      <div style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: '12px' }}>
                        {log.error_message}
                      </div>
                    </div>
                  )}

                  {log.payload && (
                    <div style={{ marginTop: '12px' }}>
                      <div style={{
                        color: 'var(--text-tertiary)',
                        fontSize: '11px',
                        marginBottom: '4px'
                      }}>
                        Payload
                      </div>
                      <pre style={{
                        padding: '12px',
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        overflow: 'auto',
                        margin: 0
                      }}>
                        {JSON.stringify(log.payload, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredLogs.length === 0 && (
        <EmptyState
          icon={Activity}
          title="No logs found"
          description={searchQuery || filter !== 'all' ? 'Try adjusting your filters' : 'No activity recorded yet'}
        />
      )}
    </div>
  );
}

export default LogViewer;
