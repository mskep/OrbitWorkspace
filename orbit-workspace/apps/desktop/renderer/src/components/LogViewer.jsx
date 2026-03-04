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
    color: 'var(--status-success)',
    bg: 'var(--status-success-glow)',
    icon: CheckCircle,
    label: 'Success'
  },
  error: {
    color: 'var(--status-error)',
    bg: 'var(--status-error-glow)',
    icon: XCircle,
    label: 'Error'
  },
  pending: {
    color: 'var(--status-warning)',
    bg: 'var(--status-warning-glow)',
    icon: Clock,
    label: 'Pending'
  },
  failed: {
    color: 'var(--status-error)',
    bg: 'var(--status-error-glow)',
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
      <div className="log-item" onClick={onToggle}>
        {/* Log Header */}
        <div className="log-header">
          {/* Status Icon Circle */}
          <div className="log-status-circle" style={{ backgroundColor: statusConfig.color }}>
            <StatusIcon size={16} color="#fff" />
          </div>

          {/* Log Details */}
          <div className="log-details">
            <div className="log-type">{(log.type || 'Unknown Action').toString()}</div>
            <div className="log-meta">
              <span className="log-meta-item">
                <Clock size={12} />
                {log.timestamp ? new Date(log.timestamp).toLocaleString() : 'Unknown time'}
              </span>
              {log.tool_id && (
                <span className="log-meta-item">
                  <SettingsIcon size={12} />
                  {log.tool_id.toString()}
                </span>
              )}
            </div>
          </div>

          {/* Status Badge & Chevron */}
          <div className="log-badges">
            <span
              className="log-status-badge"
              style={{ backgroundColor: statusConfig.bg, color: statusConfig.color }}
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
          <div className="log-expanded">
            {/* Error Message */}
            {log.error && (
              <div className="log-error-block">
                <div className="log-detail-label">Error Message</div>
                <div className="log-error-text">{log.error.toString()}</div>
              </div>
            )}

            {/* Payload */}
            {log.payload && (
              <div>
                <div className="log-payload-label">Payload</div>
                <pre className="log-payload-pre">
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
      <div className="log-render-error">
        <div className="log-render-error-content">
          <AlertTriangle size={16} />
          <span className="log-render-error-text">Failed to render log</span>
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
      <div className="log-skeleton-list">
        <Skeleton variant="rect" style={{ height: '60px' }} />
        <Skeleton variant="rect" style={{ height: '80px' }} />
        <Skeleton variant="rect" style={{ height: '80px' }} />
        <Skeleton variant="rect" style={{ height: '80px' }} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="log-error-state">
        <div className="log-error-icon">
          <AlertTriangle size={32} color="var(--status-error)" />
        </div>
        <h3 className="log-error-title">Failed to load logs</h3>
        <p className="log-error-desc">{error}</p>
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
        <div className="log-viewer-header">
          <div className="log-viewer-title-row">
            <h4 className="log-viewer-title">
              <Activity size={18} />
              Activity Logs
            </h4>
            {enableRealtime && wsRef.current?.readyState === WebSocket.OPEN && (
              <span className="log-live-badge">
                <div className="log-live-dot" />
                Live
              </span>
            )}
          </div>

          <div className="log-viewer-actions">
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
          <div className="log-filters">
            <div className="log-search-wrapper">
              <Search size={16} className="log-search-icon" />
              <input
                type="text"
                placeholder="Search logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input"
                style={{ paddingLeft: '36px' }}
              />
            </div>

            <div className="log-filter-btns">
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
        <div className="log-list">
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
