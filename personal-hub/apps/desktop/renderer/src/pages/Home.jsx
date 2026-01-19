import React, { useEffect, useState } from 'react';
import {
  Zap,
  Activity,
  Cpu,
  ShieldCheck,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import { useNavigate } from 'react-router-dom';

function Home() {
  const [recentActions, setRecentActions] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [actions, status] = await Promise.all([
        hubAPI.logs.tail({ limit: 3 }),
        hubAPI.system.getStatus()
      ]);

      setRecentActions(actions || []);
      setSystemStatus(status);
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="page">
      <Topbar title="Dashboard" />

      <div className="page-content">
        <section className="hero">
          <div className="hero-content">
            <div className="badge-premium" style={{ 
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px', 
              background: 'var(--accent-glow)', 
              color: 'var(--accent-primary)',
              padding: '4px 12px',
              borderRadius: 'var(--radius-full)',
              fontSize: '12px',
              fontWeight: '700',
              marginBottom: '16px'
            }}>
              <Sparkles size={14} />
              SYSTEM READY
            </div>
            <h1 className="hero-title">Welcome back, User</h1>
            <p className="hero-subtitle">
              Your personal productivity hub is optimized and running smoothly. 
              Manage your tools and workflows from one central dashboard.
            </p>
          </div>
        </section>

        <div className="tool-grid">
          <div className="tool-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '10px', background: 'var(--accent-glow)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
                <Cpu size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>System Status</h3>
            </div>
            
            {isLoading ? (
              <div className="skeleton" style={{ height: '100px', width: '100%' }}></div>
            ) : systemStatus ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Connection</span>
                  <span style={{ color: systemStatus.online ? 'var(--status-success)' : 'var(--status-error)', fontWeight: 600 }}>
                    {systemStatus.online ? 'Online' : 'Offline'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Platform</span>
                  <span style={{ fontWeight: 600 }}>{systemStatus.platform}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Security</span>
                  <span style={{ color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} /> Active
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="tool-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '10px', background: 'var(--accent-glow)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
                <Activity size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Recent Activity</h3>
            </div>
            
            {isLoading ? (
              <div className="skeleton" style={{ height: '100px', width: '100%' }}></div>
            ) : recentActions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentActions.map((action, i) => (
                  <div key={i} style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 500 }}>{action.type}</span>
                    <span style={{ color: 'var(--text-tertiary)' }}>{new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>No recent activity</p>
            )}
          </div>

          <div className="tool-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{ padding: '10px', background: 'var(--accent-glow)', borderRadius: 'var(--radius-md)', color: 'var(--accent-primary)' }}>
                <Zap size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Quick Actions</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button onClick={() => navigate('/tools')} className="btn btn-secondary" style={{ justifyContent: 'space-between', width: '100%' }}>
                Open My Tools <ArrowUpRight size={16} />
              </button>
              <button onClick={() => navigate('/store')} className="btn btn-secondary" style={{ justifyContent: 'space-between', width: '100%' }}>
                Browse Store <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
