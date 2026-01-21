import React, { useEffect, useState, useRef } from 'react';
import hubAPI from '../api/hubApi';
import {
  RefreshCw,
  Download,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  Settings as SettingsIcon,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';
import Button from './Button';
import Skeleton from './Skeleton';
import EmptyState from './EmptyState';
import ErrorBoundary from './ErrorBoundary';

// Status configuration avec couleurs fixes
const STATUS_CONFIG = {
  success: {
    color: '#10b981',
    bg: 'rgba(16, 185, 129, 0.15)',
    icon: CheckCircle,
    label: 'Success'
  },
  error: {
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.15)',
    icon: XCircle,
    label: 'Error'
  },
  pending: {
    color: '#f59e0b',
    bg: 'rgba(245, 158, 11, 0.15)',
    icon: Clock,
    label: 'Pending'
  },
  failed: {
    color: '#ef4444',
    bg: 'rgba(239, 68, 68, 0.15)',
    icon: XCircle,
    label: 'Failed'
  }
};

// Safe log item component avec error handling
function LogItem({ log, isExpanded, onToggle }) {
  try {
    // Validation et normalisation des données
    if (!log) {
      console.warn('LogItem: log is null or undefined');
      return null;
    }

    const status = (log.status || 'pending').toString().toLowerCase();
    const statusConfig = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
    const StatusIcon = statusConfig.icon;

    return (
      <div
        style={{
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-default)',
          cursor: 'pointer',
          transition: 'all var(--transition-fast)'
        }}
        onClick={onToggle}
      >
        {/* Log Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}
        >
          {/* Status Icon Circle */}
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: statusConfig.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <StatusIcon size={16} color="#fff" />
          </div>

          {/* Log Details */}
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div
              style={{
                fontWeight: '600',
                fontSize: '14px',
                marginBottom: '4px'
              }}
            >
              {(log.type || 'Unknown Action').toString()}
            </div>
            <div
              style={{
                fontSize: '12px',
                color: 'var(--text-tertiary)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                flexWrap: 'wrap'
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Clock size={12} />
                {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown time'}
              </span>
              {log.tool_id && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <SettingsIcon size={12} />
                  {log.tool_id.toString()}
                </span>
              )}
            </div>
          </div>

          {/* Status Badge & Chevron */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                padding: '4px 10px',
                borderRadius: '12px',
                fontSize: '11px',
                fontWeight: '600',
                backgroundColor: statusConfig.bg,
                color: statusConfig.color
              }}
            >
              {statusConfig.label}
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
          <div
            style={{
              marginTop: '16px',
              paddingTop: '16px',
              borderTop: '1px solid var(--border-default)',
              fontSize: '13px'
            }}
          >
            {/* Error Message */}
            {log.error && (
              <div
                style={{
                  marginBottom: '12px',
                  padding: '12px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  borderRadius: 'var(--radius-sm)',
                  borderLeft: '3px solid #ef4444'
                }}
              >
                <div
                  style={{
                    color: 'var(--text-tertiary)',
                    fontSize: '11px',
                    marginBottom: '4px',
                    fontWeight: '600'
                  }}
                >
                  Error Message
                </div>
                <div
                  style={{
                    color: '#ef4444',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    wordBreak: 'break-word'
                  }}
                >
                  {log.error.toString()}
                </div>
              </div>
            )}

            {/* Payload */}
            {log.payload && (
              <div>
                <div
                  style={{
                    color: 'var(--text-tertiary)',
                    fontSize: '11px',
                    marginBottom: '6px',
                    fontWeight: '600'
                  }}
                >
                  Payload
                </div>
                <pre
                  style={{
                    padding: '12px',
                    backgroundColor: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '11px',
                    overflow: 'auto',
                    margin: 0,
                    maxHeight: '200px'
                  }}
                >
                  {typeof log.payload === 'string' ? log.payload : JSON.stringify(log.payload, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error('Error rendering log item:', error, log);
    return (
      <div
        style={{
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444' }}>
          <AlertTriangle size={16} />
          <span style={{ fontSize: '14px', fontWeight: '600' }}>Failed to render log</span>
        </div>
      </div>
    );
  }
}

function LogViewer({ limit = 50, enableRealtime = true, showFilters = true }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
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
        console.log('[LogViewer] Connected to log stream');
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.event === 'log:new') {
            console.log('[LogViewer] New log received:', message.data);
            setLogs((prevLogs) => [message.data, ...prevLogs].slice(0, limit));
          }
        } catch (error) {
          console.error('[LogViewer] Failed to parse WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[LogViewer] WebSocket error:', error);
      };

      ws.onclose = () => {
        console.log('[LogViewer] Disconnected from log stream');
        setTimeout(() => {
          if (enableRealtime) {
            connectWebSocket();
          }
        }, 5000);
      };

      wsRef.current = ws;
    } catch (error) {
      console.error('[LogViewer] Failed to connect to WebSocket:', error);
    }
  }

  async function loadLogs() {
    try {
      setLoading(true);
      setError(null);
      console.log('[LogViewer] Loading logs with limit:', limit);

      const result = await hubAPI.logs.tail({ limit });
      console.log('[LogViewer] Logs result:', result);

      // Handle new format from logManager
      if (result && result.success && Array.isArray(result.logs)) {
        // Transform from new format to expected format
        const transformedLogs = result.logs.map((log) => ({
          id: log.id,
          type: log.action?.type || 'unknown',
          status: log.status || 'pending',
          timestamp: log.timestamp,
          tool_id: log.action?.tool?.id || null,
          error: log.error || null,
          payload: log.request || null,
          username: log.user?.username || null
        }));
        setLogs(transformedLogs);
      } else if (Array.isArray(result)) {
        // Old format - direct array
        setLogs(result);
      } else {
        console.warn('[LogViewer] Unexpected logs format:', result);
        setLogs([]);
      }
    } catch (err) {
      console.error('[LogViewer] Error loading logs:', err);
      setError(err.message || 'Failed to load logs');
      setLogs([]);
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
      a.download = `orbit-logs-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('[LogViewer] Failed to export logs:', error);
      alert('Failed to export logs: ' + error.message);
    }
  }

  // Filter logs avec protection contre les erreurs
  const filteredLogs = React.useMemo(() => {
    try {
      if (!Array.isArray(logs)) {
        console.warn('[LogViewer] Logs is not an array:', logs);
        return [];
      }

      return logs.filter((log) => {
        try {
          if (!log) return false;

          // Status filter
          if (filter !== 'all') {
            const logStatus = (log.status || 'pending').toString().toLowerCase();
            if (logStatus !== filter) {
              return false;
            }
          }

          // Search filter
          if (searchQuery) {
            const query = searchQuery.toLowerCase();
            const type = (log.type || '').toString().toLowerCase();
            const toolId = (log.tool_id || '').toString().toLowerCase();
            const error = (log.error || '').toString().toLowerCase();
            const payload = (log.payload || '').toString().toLowerCase();

            return type.includes(query) || toolId.includes(query) || error.includes(query) || payload.includes(query);
          }

          return true;
        } catch (err) {
          console.error('[LogViewer] Error filtering log:', err, log);
          return false;
        }
      });
    } catch (err) {
      console.error('[LogViewer] Error in filteredLogs:', err);
      return [];
    }
  }, [logs, filter, searchQuery]);

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

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center'
        }}
      >
        <div
          style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}
        >
          <AlertTriangle size={32} color="#ef4444" />
        </div>
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>Failed to load logs</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>{error}</p>
        <Button onClick={loadLogs}>
          <RefreshCw size={14} />
          Try Again
        </Button>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="log-viewer">
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            gap: '16px',
            flexWrap: 'wrap'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Activity size={18} />
              Activity Logs
            </h4>
            {enableRealtime && wsRef.current?.readyState === WebSocket.OPEN && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 10px',
                  borderRadius: '12px',
                  fontSize: '11px',
                  fontWeight: '600',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  color: '#10b981'
                }}
              >
                <div
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    animation: 'pulse 2s infinite'
                  }}
                />
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
          <div
            style={{
              display: 'flex',
              gap: '12px',
              marginBottom: '20px',
              flexWrap: 'wrap'
            }}
          >
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
              {['all', 'success', 'error', 'pending'].map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    console.log('[LogViewer] Filter changed to:', status);
                    setFilter(status);
                  }}
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
            if (!log || !log.id) {
              console.warn('[LogViewer] Invalid log entry:', log);
              return null;
            }

            return (
              <LogItem
                key={log.id}
                log={log}
                isExpanded={expandedLog === log.id}
                onToggle={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              />
            );
          })}
        </div>

        {/* Empty State */}
        {filteredLogs.length === 0 && (
          <EmptyState
            icon={Activity}
            title="No logs found"
            description={searchQuery || filter !== 'all' ? 'Try adjusting your filters' : 'No activity recorded yet'}
          />
        )}
      </div>
    </ErrorBoundary>
  );
}

export default LogViewer;
