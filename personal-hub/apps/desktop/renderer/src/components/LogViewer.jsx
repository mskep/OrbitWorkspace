import React, { useEffect, useState } from 'react';
import hubAPI from '../api/hubApi';

function LogViewer({ limit = 20 }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLogs();
  }, []);

  async function loadLogs() {
    try {
      const data = await hubAPI.logs.tail({ limit });
      setLogs(data || []);
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Loading logs...</div>;
  }

  return (
    <div className="log-viewer">
      <div className="log-header">
        <span>Recent Events</span>
        <button className="btn-secondary" onClick={loadLogs}>
          Refresh
        </button>
      </div>

      <div className="log-list">
        {logs.map((log) => (
          <div key={log.id} className={`log-entry log-${log.status}`}>
            <span className="log-time">
              {new Date(log.timestamp).toLocaleTimeString()}
            </span>
            <span className="log-type">{log.type}</span>
            {log.tool_id && <span className="log-tool">{log.tool_id}</span>}
            <span className={`log-status status-${log.status}`}>{log.status}</span>
          </div>
        ))}
      </div>

      {logs.length === 0 && <div className="empty-state">No logs available</div>}
    </div>
  );
}

export default LogViewer;
