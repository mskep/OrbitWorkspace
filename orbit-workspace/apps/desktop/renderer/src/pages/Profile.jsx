import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import { useAppStore } from '../state/store';
import { useI18n } from '../i18n';
import {
  User,
  Shield,
  Star,
  Activity,
  Calendar,
  CheckCircle,
  XCircle,
  Crown,
  Settings as SettingsIcon,
  LogOut,
} from 'lucide-react';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Skeleton from '../components/Skeleton';
import Button from '../components/Button';

const PERMISSION_LABELS = {
  NET_ACCESS: 'Network Access',
  FS_READ: 'Read Files',
  FS_WRITE: 'Write Files',
  FS_PICKER: 'File Picker',
  RUN_TOOL: 'Run Tools',
  SPAWN_PROCESS: 'Spawn Processes',
  CLIPBOARD: 'Clipboard Access',
  NOTIFICATIONS: 'Notifications',
  TRAY_CONTROL: 'Tray Control',
  PREMIUM_TOOLS: 'Premium Tools',
  MANAGE_USERS: 'Manage Users',
  VIEW_ALL_LOGS: 'View All Logs',
  SYSTEM_CONFIG: 'System Config',
  INSTALL_TOOLS: 'Install Tools'
};

const ROLE_CONFIG = {
  ADMIN: {
    label: 'Administrator',
    color: 'danger',
    icon: Shield,
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  DEV: {
    label: 'Developer',
    color: 'primary',
    icon: SettingsIcon,
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  PREMIUM: {
    label: 'Premium',
    color: 'warning',
    icon: Crown,
    gradient: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
  },
  USER: {
    label: 'User',
    color: 'default',
    icon: User,
    gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
  }
};

function Profile() {
  const navigate = useNavigate();
  const { profile, setProfile, setSession } = useAppStore();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  // User badges
  const [userBadges, setUserBadges] = useState([]);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    try {
      const [profileData, badgesResult] = await Promise.all([
        hubAPI.profile.get(),
        hubAPI.badges.getUserBadges({})
      ]);
      setProfile(profileData);
      if (badgesResult.success) {
        setUserBadges(badgesResult.badges);
      }
    } catch (error) {
      console.error('Error loading profile:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await hubAPI.auth.logout();
      setSession(null);
      setProfile(null);
      navigate('/login');
    } catch (error) {
      console.error('Error logging out:', error);
      setLoggingOut(false);
    }
  }

  function getInitials(username) {
    return username
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }

  if (loading) {
    return (
      <div className="page">
        <Topbar title={t('profile.title')} />
        <div className="page-content">
          <div className="container-lg">
            <Skeleton variant="rect" style={{ height: '200px', marginBottom: '24px' }} />
            <div className="profile-skeleton-grid">
              <Skeleton variant="rect" style={{ height: '120px' }} />
              <Skeleton variant="rect" style={{ height: '120px' }} />
              <Skeleton variant="rect" style={{ height: '120px' }} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="page">
        <Topbar title={t('profile.title')} />
        <div className="page-content">
          <p>{t('profile.noProfileData')}</p>
        </div>
      </div>
    );
  }

  const roleConfig = ROLE_CONFIG[profile.role] || ROLE_CONFIG.USER;
  const RoleIcon = roleConfig.icon;

  return (
    <div className="page">
      <Topbar title={t('profile.title')} />

      <div className="page-content">
        <div className="container-lg">
          {/* Profile Header Card */}
          <Card className="mb-6" style={{ overflow: 'visible' }}>
            <div className="profile-banner" style={{ background: roleConfig.gradient }} />

            <div className="profile-card-body">
              {/* Avatar */}
              <div className="profile-avatar-lg" style={{ background: roleConfig.gradient }}>
                {profile.avatar || getInitials(profile.username)}
              </div>

              {/* Profile Info */}
              <div className="profile-info-block">
                <div className="profile-name-row">
                  <h2 className="profile-username">{profile.username}</h2>
                  <Badge variant={roleConfig.color}>
                    <RoleIcon size={12} className="icon-mr" />
                    {roleConfig.label}
                  </Badge>
                  {profile.premiumEnabled && (
                    <Badge variant="premium">
                      <Star size={12} className="icon-mr" />
                      Premium
                    </Badge>
                  )}
                  {userBadges.map((badge) => (
                    <span
                      key={badge.id}
                      title={badge.description}
                      className="profile-badge-pill"
                      style={{
                        backgroundColor: `${badge.color}15`,
                        color: badge.color,
                        border: `1px solid ${badge.color}30`
                      }}
                    >
                      <span>{badge.icon}</span>
                      {badge.display_name}
                    </span>
                  ))}
                  <div className="ml-auto">
                    <Button variant="danger" size="sm" onClick={handleLogout} disabled={loggingOut}>
                      <LogOut size={14} />
                      {loggingOut ? t('profile.loggingOut') : t('profile.logout')}
                    </Button>
                  </div>
                </div>

                <div className="profile-details">
                  {profile.email && (
                    <div className="profile-detail-row">
                      <User size={14} />
                      {profile.email}
                    </div>
                  )}
                  <div className="profile-detail-group">
                    <div className="profile-detail-row">
                      <Calendar size={14} />
                      {t('profile.joined')}{' '}
                      {(() => {
                        const ts = profile.createdAt;
                        if (!ts || ts <= 0) return '—';
                        const msTs = ts < 1e12 ? ts * 1000 : ts;
                        return new Date(msTs).toLocaleDateString();
                      })()}
                    </div>
                    {profile.status && (
                      <div className="profile-detail-row">
                        <Activity size={14} />
                        {t('profile.status')}{' '}
                        <span
                          className="profile-status-text"
                          style={{ color: profile.status === 'active' ? 'var(--status-success)' : 'var(--status-error)' }}
                        >
                          {profile.status}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Stats Grid */}
          <div className="profile-stats-grid">
            <Card>
              <div className="profile-stat-card">
                <div className="profile-stat-icon" style={{ background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))' }}>
                  <Activity size={28} color="#fff" />
                </div>
                <div>
                  <div className="profile-stat-value">{profile.stats?.totalActions || 0}</div>
                  <div className="profile-stat-label">{t('profile.totalActions')}</div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="profile-stat-card">
                <div className="profile-stat-icon" style={{ background: 'linear-gradient(135deg, #f093fb, #f5576c)' }}>
                  <SettingsIcon size={28} color="#fff" />
                </div>
                <div>
                  <div className="profile-stat-value">{profile.stats?.toolsUsed || 0}</div>
                  <div className="profile-stat-label">{t('profile.toolsUsed')}</div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="profile-stat-card">
                <div className="profile-stat-icon" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }}>
                  <User size={28} color="#fff" />
                </div>
                <div>
                  <div className="profile-stat-value">{profile.stats?.loginCount || 1}</div>
                  <div className="profile-stat-label">{t('profile.loginCount')}</div>
                </div>
              </div>
            </Card>
          </div>

          {/* Permissions Section (read-only, derived from role) */}
          <Card>
            <h3 className="section-heading" style={{ marginBottom: '8px' }}>
              <Shield size={20} />
              {t('profile.permissionsAccess')}
            </h3>
            <p className="profile-perm-desc">
              {t('profile.permissionsDesc', { role: roleConfig.label })}
            </p>

            <div className="profile-perm-grid">
              {Object.entries(PERMISSION_LABELS).map(([key, label]) => {
                const isEnabled = profile.permissions.includes(key);
                return (
                  <div key={key} className={`profile-perm-card ${isEnabled ? 'enabled' : 'disabled'}`}>
                    <div className={`profile-perm-icon ${isEnabled ? 'enabled' : 'disabled'}`}>
                      {isEnabled ? (
                        <CheckCircle size={16} color="#fff" />
                      ) : (
                        <XCircle size={16} color="var(--text-tertiary)" />
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className={`profile-perm-label ${isEnabled ? 'enabled' : 'disabled'}`}>
                        {label}
                      </div>
                      <div className="profile-perm-status">
                        {isEnabled ? t('profile.granted') : t('profile.notAvailable')}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Profile;
