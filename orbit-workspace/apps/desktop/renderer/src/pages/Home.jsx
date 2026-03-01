import React, { useEffect, useState } from 'react';
import { Zap, Activity, Cpu, ShieldCheck, ArrowUpRight, Sparkles } from 'lucide-react';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../state/store';
import { useI18n } from '../i18n';

function Home() {
  const [recentActions, setRecentActions] = useState([]);
  const [systemStatus, setSystemStatus] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const profile = useAppStore((state) => state.profile);
  const { t } = useI18n();

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      const [logsResult, status] = await Promise.all([hubAPI.logs.tail({ limit: 3 }), hubAPI.system.getStatus()]);

      // logs.tail returns { success, logs }
      if (logsResult?.success && logsResult.logs) {
        setRecentActions(logsResult.logs);
      } else {
        setRecentActions([]);
      }
      setSystemStatus(status);
    } catch (error) {
      console.error('Error loading home data:', error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="page">
      <Topbar title={t('common.dashboard')} />

      <div className="page-content">
        <section className="hero">
          <div className="hero-content">
            <div
              className="badge-premium"
              style={{
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
              }}
            >
              <Sparkles size={14} />
              {t('home.systemReady')}
            </div>
            <h1 className="hero-title">{profile?.username ? t('home.welcomeBack', { username: profile.username }) : t('home.welcomeBackGeneric')}</h1>
            <p className="hero-subtitle" style={{ maxWidth: '600px', wordWrap: 'break-word' }}>
              {t('home.subtitle')}
            </p>
          </div>
        </section>

        <div className="tool-grid">
          <div className="tool-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div
                style={{
                  padding: '10px',
                  background: 'var(--accent-glow)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--accent-primary)'
                }}
              >
                <Cpu size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>{t('home.systemStatus')}</h3>
            </div>

            {isLoading ? (
              <div className="skeleton" style={{ height: '100px', width: '100%' }}></div>
            ) : systemStatus ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{t('home.connection')}</span>
                  <span
                    style={{
                      color: systemStatus.online ? 'var(--status-success)' : 'var(--status-error)',
                      fontWeight: 600
                    }}
                  >
                    {systemStatus.online ? t('common.online') : t('common.offlineState')}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{t('common.platform')}</span>
                  <span style={{ fontWeight: 600 }}>{systemStatus.platform}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>{t('home.security')}</span>
                  <span style={{ color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} /> {t('common.active')}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="tool-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div
                style={{
                  padding: '10px',
                  background: 'var(--accent-glow)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--accent-primary)'
                }}
              >
                <Activity size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>{t('home.recentActivity')}</h3>
            </div>

            {isLoading ? (
              <div className="skeleton" style={{ height: '100px', width: '100%' }}></div>
            ) : recentActions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentActions.slice(0, 3).map((action, i) => (
                  <div
                    key={action.id || i}
                    style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                  >
                    <span
                      style={{
                        fontWeight: 500,
                        color: action.status === 'error' ? 'var(--status-error)' : 'var(--text-primary)'
                      }}
                    >
                      {action.type || action.action?.type || t('home.recentActivity')}
                    </span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                      {action.timestamp
                        ? new Date(
                          action.timestamp < 1e12 ? action.timestamp * 1000 : action.timestamp
                        ).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : ''}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>{t('home.noRecentActivity')}</p>
            )}
          </div>

          <div className="tool-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div
                style={{
                  padding: '10px',
                  background: 'var(--accent-glow)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--accent-primary)'
                }}
              >
                <Zap size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>{t('home.quickActions')}</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => navigate('/tools')}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', width: '100%' }}
              >
                {t('home.openMyTools')} <ArrowUpRight size={16} />
              </button>
              <button
                onClick={() => navigate('/inbox')}
                className="btn btn-secondary"
                style={{ justifyContent: 'space-between', width: '100%' }}
              >
                {t('home.viewInbox')} <ArrowUpRight size={16} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Home;
