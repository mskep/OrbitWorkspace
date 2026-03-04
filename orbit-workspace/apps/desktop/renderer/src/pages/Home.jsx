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
            <div className="home-badge">
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
            <div className="tool-card-header">
              <div className="tool-card-icon">
                <Cpu size={24} />
              </div>
              <h3 className="tool-card-title">{t('home.systemStatus')}</h3>
            </div>

            {isLoading ? (
              <div className="skeleton" style={{ height: '100px', width: '100%' }}></div>
            ) : systemStatus ? (
              <div className="flex-col flex-gap-3">
                <div className="stat-row">
                  <span className="stat-row-label">{t('home.connection')}</span>
                  <span className="stat-row-value" style={{ color: systemStatus.online ? 'var(--status-success)' : 'var(--status-error)' }}>
                    {systemStatus.online ? t('common.online') : t('common.offlineState')}
                  </span>
                </div>
                <div className="stat-row">
                  <span className="stat-row-label">{t('common.platform')}</span>
                  <span className="stat-row-value">{systemStatus.platform}</span>
                </div>
                <div className="stat-row">
                  <span className="stat-row-label">{t('home.security')}</span>
                  <span className="stat-row-value flex-center flex-gap-2" style={{ color: 'var(--status-success)' }}>
                    <ShieldCheck size={14} /> {t('common.active')}
                  </span>
                </div>
              </div>
            ) : null}
          </div>

          <div className="tool-card">
            <div className="tool-card-header">
              <div className="tool-card-icon">
                <Activity size={24} />
              </div>
              <h3 className="tool-card-title">{t('home.recentActivity')}</h3>
            </div>

            {isLoading ? (
              <div className="skeleton" style={{ height: '100px', width: '100%' }}></div>
            ) : recentActions.length > 0 ? (
              <div className="flex-col flex-gap-3">
                {recentActions.slice(0, 3).map((action, i) => (
                  <div key={action.id || i} className="stat-row" style={{ fontSize: 'var(--text-sm)' }}>
                    <span style={{ fontWeight: 500, color: action.status === 'error' ? 'var(--status-error)' : 'var(--text-primary)' }}>
                      {action.type || action.action?.type || t('home.recentActivity')}
                    </span>
                    <span className="stat-row-label" style={{ fontSize: 'var(--text-xs)' }}>
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
              <p className="stat-row-label">{t('home.noRecentActivity')}</p>
            )}
          </div>

          <div className="tool-card">
            <div className="tool-card-header">
              <div className="tool-card-icon">
                <Zap size={24} />
              </div>
              <h3 className="tool-card-title">{t('home.quickActions')}</h3>
            </div>

            <div className="flex-col flex-gap-3">
              <button onClick={() => navigate('/tools')} className="btn btn-secondary btn-full-between">
                {t('home.openMyTools')} <ArrowUpRight size={16} />
              </button>
              <button onClick={() => navigate('/inbox')} className="btn btn-secondary btn-full-between">
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
