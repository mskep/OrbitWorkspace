import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Shield,
  Users,
  Key,
  Activity,
  AlertTriangle,
  User,
  Clock,
  Search,
  ChevronUp,
  ChevronDown,
  Award,
  CheckCircle,
  RefreshCw,
  Download,
  Megaphone,
  Send,
  FileText,
  History,
  Wrench,
  ShieldAlert
} from 'lucide-react';
import Card from '../components/Card';
import Modal from '../components/Modal';
import CustomSelect from '../components/CustomSelect';
import { useAppStore } from '../state/store';
import hubAPI from '../api/hubApi';
import { useI18n } from '../i18n';

function AdminPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t, language } = useI18n();
  const isFr = language === 'fr';

  const loadAdminData = useCallback(async () => {
    try {
      setLoading(true);
      const [statsResult, usersResult] = await Promise.all([hubAPI.admin.getStats(), hubAPI.admin.getUsers()]);

      if (statsResult.success) {
        setStats(statsResult.stats);
      }

      if (usersResult.success) {
        setUsers(Array.isArray(usersResult.users) ? usersResult.users : []);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAdminData();
  }, [loadAdminData]);

  const sections = [
    { id: 'overview', label: t('admin.overview'), icon: Shield, accent: '#0ea5e9', surface: 'rgba(14, 165, 233, 0.16)' },
    { id: 'users', label: t('admin.users'), icon: Users, accent: 'var(--status-success)', surface: 'var(--status-success-glow)' },
    { id: 'notifications', label: t('admin.notifications'), icon: Megaphone, accent: 'var(--status-warning)', surface: 'var(--status-warning-glow)' },
    { id: 'logs', label: t('admin.logs'), icon: Activity, accent: 'var(--status-error)', surface: 'var(--status-error-glow)' },
    { id: 'roles', label: t('admin.roles'), icon: Key, accent: '#14b8a6', surface: 'rgba(20, 184, 166, 0.16)' }
  ];

  return (
    <div className="admin-container">
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div className="admin-header-row">
          <div className="admin-header-icon">
            <Shield size={22} color="#fff" />
          </div>
          <div>
            <h1 className="admin-title">{t('admin.title')}</h1>
            <p className="admin-subtitle">{t('admin.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Warning Badge */}
      <div className="admin-warning">
        <AlertTriangle size={20} color="#f59e0b" />
        <div>
          <div className="admin-warning-title">{isFr ? 'Accès administrateur' : 'Administrator Access'}</div>
          <div className="admin-warning-desc">
            {isFr ? 'Vous avez un accès complet au système. Faites attention aux changements.' : 'You have full system access. Be careful with changes made here.'}
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="admin-tabs">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeTab === section.id;

          return (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              className={`admin-tab ${isActive ? 'active' : ''}`}
              style={{
                border: `1px solid ${isActive ? section.accent : 'var(--border-default)'}`,
                background: isActive
                  ? `linear-gradient(135deg, ${section.surface} 0%, rgba(15, 23, 42, 0.45) 100%)`
                  : 'var(--bg-secondary)',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: isActive ? `0 8px 20px ${section.surface}` : 'none'
              }}
            >
              <span
                className="admin-tab-icon"
                style={{
                  backgroundColor: isActive ? section.surface : 'var(--bg-tertiary)',
                  border: `1px solid ${isActive ? `${section.accent}66` : 'var(--border-default)'}`
                }}
              >
                <Icon size={16} color={isActive ? section.accent : 'var(--text-tertiary)'} />
              </span>
              <span className="admin-tab-label" style={{ fontWeight: isActive ? '700' : '600' }}>{section.label}</span>
              {isActive && (
                <span
                  className="admin-tab-dot"
                  style={{ backgroundColor: section.accent, boxShadow: `0 0 12px ${section.accent}` }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Content Area */}
      <div>
        {activeTab === 'overview' && <OverviewSection stats={stats} loading={loading} />}
        {activeTab === 'users' && <UsersSection users={users} loading={loading} onRefresh={loadAdminData} />}
        {activeTab === 'notifications' && <NotificationsSection users={users} />}
        {activeTab === 'logs' && <SystemLogsSection />}
        {activeTab === 'roles' && <RolesSection />}
      </div>
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────
function OverviewSection({ stats, loading }) {
  const { language } = useI18n();
  const isFr = language === 'fr';
  if (loading) {
    return <div className="admin-loading">{isFr ? 'Chargement des statistiques...' : 'Loading stats...'}</div>;
  }

  return (
    <div className="admin-stats-grid">
      <Card>
        <h3 className="admin-card-heading">{isFr ? 'Statistiques rapides' : 'Quick Stats'}</h3>
        <div className="flex-col flex-gap-3">
          <StatItem label={isFr ? 'Utilisateurs totaux' : 'Total Users'} value={stats?.totalUsers || 0} color="var(--accent-primary)" />
          <StatItem label={isFr ? 'Espaces totaux' : 'Total Workspaces'} value={stats?.totalWorkspaces || 0} color="var(--status-success)" />
          <StatItem label={isFr ? 'Notes totales' : 'Total Notes'} value={stats?.totalNotes || 0} color="var(--status-warning)" />
        </div>
      </Card>

      <Card>
        <h3 className="admin-card-heading">{isFr ? 'Stats de contenu' : 'Content Stats'}</h3>
        <div className="flex-col flex-gap-3">
          <StatItem label={isFr ? 'Liens totaux' : 'Total Links'} value={stats?.totalLinks || 0} color="var(--accent-tertiary)" />
          <StatItem label={isFr ? 'Références fichiers' : 'File References'} value={stats?.totalFileRefs || 0} color="var(--accent-secondary)" />
          <StatItem label={isFr ? 'Outils actifs' : 'Active Tools'} value={stats?.activeTools || 0} color="var(--status-info)" />
        </div>
      </Card>

      <Card>
        <h3 className="admin-card-heading">{isFr ? 'Santé système' : 'System Health'}</h3>
        <div className="flex-col flex-gap-3">
          <StatItem label={isFr ? 'État base de données' : 'Database Status'} value={isFr ? 'Sain' : 'Healthy'} color="var(--status-success)" />
          <StatItem label={isFr ? 'Badges totaux' : 'Total Badges'} value={stats?.totalBadges || 0} color="var(--status-warning)" />
          <StatItem label={isFr ? 'Éléments boîte total' : 'Total Inbox Items'} value={stats?.totalInboxItems || 0} color="var(--accent-primary)" />
        </div>
      </Card>
    </div>
  );
}

function StatItem({ label, value, color }) {
  return (
    <div className="admin-stat-item">
      <span className="admin-stat-label">{label}</span>
      <span className="admin-stat-value" style={{ color }}>{value}</span>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────
function formatDate(ts) {
  if (!ts || ts <= 0) return '—';
  const msTs = ts < 1e12 ? ts * 1000 : ts;
  return new Date(msTs).toLocaleDateString();
}

function formatDateTime(ts) {
  if (!ts || ts <= 0) return '—';
  const msTs = ts < 1e12 ? ts * 1000 : ts;
  return new Date(msTs).toLocaleString();
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function Pill({ type, value }) {
  let bg, color;
  if (type === 'status') {
    if (value === 'success') { bg = 'var(--status-success-glow)'; color = 'var(--status-success)'; }
    else if (value === 'error') { bg = 'var(--status-error-glow)'; color = 'var(--status-error)'; }
    else { bg = 'var(--status-info-glow)'; color = 'var(--status-info)'; }
  } else {
    if (value === 'critical' || value === 'high' || value === 'error') { bg = 'var(--status-error-glow)'; color = 'var(--status-error)'; }
    else if (value === 'warn' || value === 'warning') { bg = 'var(--status-warning-glow)'; color = 'var(--status-warning)'; }
    else { bg = 'var(--status-success-glow)'; color = 'var(--status-success)'; }
  }
  return (
    <span className="admin-pill" style={{ backgroundColor: bg, color }}>{value}</span>
  );
}

// ── Users Section ────────────────────────────────────────
function UsersSection({ users = [], loading, onRefresh }) {
  const { language } = useI18n();
  const isFr = language === 'fr';
  const profile = useAppStore((state) => state.profile);
  const [updatingUser, setUpdatingUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [expandedUser, setExpandedUser] = useState(null);
  const [allBadges, setAllBadges] = useState([]);
  const [userBadges, setUserBadges] = useState({});
  const [badgeLoading, setBadgeLoading] = useState(false);

  const loadInitialData = useCallback(async () => {
    try {
      const badgesResult = await hubAPI.badges.getAll();
      if (badgesResult.success) {
        setAllBadges(Array.isArray(badgesResult.badges) ? badgesResult.badges : []);
      }

      // Load badge counts for all users in parallel
      const badgeCounts = {};
      await Promise.all(
        users.map(async (user) => {
          try {
            const result = await hubAPI.badges.getUserBadges({ userId: user.id });
            if (result.success) {
              badgeCounts[user.id] = Array.isArray(result.badges) ? result.badges.map((b) => b.id) : [];
            }
          } catch { /* ignore */ }
        })
      );
      setUserBadges(badgeCounts);
    } catch (err) {
      console.error('Failed to load badges:', err);
    }
  }, [users]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const loadUserBadges = async (userId) => {
    try {
      const result = await hubAPI.badges.getUserBadges({ userId });
      if (result.success) {
        const badgeIds = Array.isArray(result.badges) ? result.badges.map((b) => b.id) : [];
        setUserBadges((prev) => ({
          ...prev,
          [userId]: badgeIds
        }));
      }
    } catch (err) {
      console.error('Failed to load user badges:', err);
    }
  };

  const toggleExpand = async (userId) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
      await loadUserBadges(userId);
    }
  };

  const handleToggleBadge = async (userId, badgeId, hasIt) => {
    try {
      setBadgeLoading(true);
      if (hasIt) {
        await hubAPI.badges.revoke({ userId, badgeId });
      } else {
        await hubAPI.badges.assign({ userId, badgeId });
      }
      await loadUserBadges(userId);
    } catch (err) {
      console.error('Failed to toggle badge:', err);
    } finally {
      setBadgeLoading(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      setUpdatingUser(userId);
      const result = await hubAPI.admin.updateUserRole({ userId, role: newRole });
      if (result.success) onRefresh();
    } catch (error) {
      console.error('Failed to update user role:', error);
    } finally {
      setUpdatingUser(null);
    }
  };

  const handleUpdateStatus = async (userId, newStatus) => {
    try {
      setUpdatingUser(userId);
      const result = await hubAPI.admin.updateUserStatus({ userId, status: newStatus });
      if (result.success) onRefresh();
    } catch (error) {
      console.error('Failed to update user status:', error);
    } finally {
      setUpdatingUser(null);
    }
  };

  const isSelf = (userId) => profile?.id === userId;

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) => user.username?.toLowerCase().includes(query) || user.email?.toLowerCase().includes(query)
      );
    }
    result.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase();
        bVal = bVal?.toLowerCase() || '';
      }
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [users, searchQuery, sortConfig]);

  const SortableHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th onClick={() => handleSort(sortKey)} className={`admin-th ${isActive ? 'active' : ''}`}>
        <div className="admin-th-content">
          {label}
          {isActive && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
        </div>
      </th>
    );
  };

  if (loading) {
    return (
      <Card>
        <div className="admin-loading">{isFr ? 'Chargement des utilisateurs...' : 'Loading users...'}</div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="admin-section-header">
        <div>
          <h3 className="admin-card-title">{isFr ? 'Gestion des utilisateurs' : 'User Management'}</h3>
          <p className="admin-card-subtitle">
            {isFr ? 'Gérer les comptes, rôles et badges utilisateurs' : 'Manage user accounts, roles, and badges'}
          </p>
        </div>
        <div className="admin-actions-row">
          <div className="admin-search-wrapper">
            <Search size={16} className="admin-search-icon" />
            <input
              type="text"
              placeholder={isFr ? 'Rechercher par nom ou email...' : 'Search by name or email...'}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="admin-search-input"
              style={{ width: '220px' }}
            />
          </div>
        </div>
      </div>

      {filteredAndSortedUsers.length === 0 ? (
        <div className="admin-empty-state">
          <Users size={48} color="var(--text-tertiary)" className="admin-empty-icon" />
          <p className="admin-empty-text">
            {searchQuery ? (isFr ? 'Aucun utilisateur ne correspond à la recherche' : 'No users found matching your search') : (isFr ? 'Aucun utilisateur trouvé' : 'No users found')}
          </p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <SortableHeader label={isFr ? 'Utilisateur' : 'User'} sortKey="username" />
                <SortableHeader label={isFr ? 'Email' : 'Email'} sortKey="email" />
                <SortableHeader label={isFr ? 'Role' : 'Role'} sortKey="role" />
                <SortableHeader label={isFr ? 'Statut' : 'Status'} sortKey="status" />
                <SortableHeader label={isFr ? 'Créé' : 'Created'} sortKey="created_at" />
                <th className="admin-th-center">Badges</th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.map((user) => {
                const isCurrentUser = isSelf(user.id);
                const badgeCount = (userBadges[user.id] || []).length;
                return (
                  <React.Fragment key={user.id}>
                    <tr style={{ opacity: isCurrentUser ? 0.7 : 1 }}>
                      <td>
                        <div className="admin-user-cell">
                          <div className="admin-user-avatar">
                            <User size={16} color="var(--accent-primary)" />
                          </div>
                          <div>
                            <span className="admin-user-name">{user.username}</span>
                            {isCurrentUser && (
                              <span className="admin-user-self">({isFr ? 'Vous' : 'You'})</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="admin-td-text">{user.email}</td>
                      <td>
                        <CustomSelect
                          value={user.role}
                          onChange={(val) => handleUpdateRole(user.id, val)}
                          disabled={updatingUser === user.id || isCurrentUser}
                          size="sm"
                          options={[
                            { value: 'USER', label: isFr ? 'Utilisateur' : 'User' },
                            { value: 'PREMIUM', label: isFr ? 'Premium' : 'Premium' },
                            { value: 'DEV', label: isFr ? 'Développeur' : 'Developer' },
                            { value: 'ADMIN', label: isFr ? 'Admin' : 'Admin' },
                          ]}
                        />
                      </td>
                      <td>
                        <CustomSelect
                          value={user.status}
                          onChange={(val) => handleUpdateStatus(user.id, val)}
                          disabled={updatingUser === user.id || isCurrentUser}
                          size="sm"
                          options={[
                            { value: 'active', label: isFr ? 'Actif' : 'Active', color: 'var(--status-success)' },
                            { value: 'disabled', label: isFr ? 'Désactivé' : 'Disabled', color: 'var(--status-error)' },
                          ]}
                        />
                      </td>
                      <td>
                        <div className="admin-date-cell">
                          <Clock size={14} />
                          {formatDate(user.created_at)}
                        </div>
                      </td>
                      <td>
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => toggleExpand(user.id)}
                            className="admin-badge-btn"
                            style={{
                              backgroundColor: expandedUser === user.id ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                              color: expandedUser === user.id ? 'var(--accent-primary)' : 'var(--text-tertiary)'
                            }}
                          >
                            <Award size={12} />
                            {badgeCount}
                          </button>
                          {expandedUser === user.id && (
                            <div className="admin-badge-dropdown">
                              {allBadges.map((badge) => {
                                const hasBadge = (userBadges[user.id] || []).includes(badge.id);
                                return (
                                  <button
                                    key={badge.id}
                                    onClick={() => handleToggleBadge(user.id, badge.id, hasBadge)}
                                    disabled={badgeLoading}
                                    className="admin-badge-item"
                                    style={{
                                      backgroundColor: hasBadge ? `${badge.color}15` : 'transparent',
                                      color: hasBadge ? badge.color : 'var(--text-secondary)',
                                      cursor: badgeLoading ? 'not-allowed' : 'pointer'
                                    }}
                                  >
                                    <span className="admin-badge-icon">{badge.icon}</span>
                                    <span style={{ flex: 1 }}>{badge.display_name}</span>
                                    {hasBadge && (
                                      <CheckCircle size={12} style={{ color: badge.color, flexShrink: 0 }} />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── System Logs Section ──────────────────────────────────
function SystemLogsSection() {
  const { language } = useI18n();
  const isFr = language === 'fr';
  const [logs, setLogs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(200);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [severityFilter, setSeverityFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      const result = await hubAPI.admin.getAuditLogs({ limit });
      if (result.success) {
        setLogs(result.logs || []);
        setSummary(result.summary || null);
      }
    } catch (error) {
      console.error('Failed to load logs:', error);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const categoryOptions = useMemo(() => [...new Set(logs.map((log) => log.meta?.category).filter(Boolean))].sort(), [logs]);
  const severityOptions = useMemo(() => [...new Set(logs.map((log) => log.meta?.severity).filter(Boolean))].sort(), [logs]);
  const statusOptions = useMemo(() => [...new Set(logs.map((log) => log.status).filter(Boolean))].sort(), [logs]);

  const getSortValue = (log, key) => {
    if (key === 'timestamp') return log.timestamp || 0;
    if (key === 'user') return (log.user?.username || '').toLowerCase();
    if (key === 'action') return (log.action?.type || '').toLowerCase();
    if (key === 'status') return (log.status || '').toLowerCase();
    if (key === 'severity') return (log.meta?.severity || '').toLowerCase();
    if (key === 'category') return (log.meta?.category || '').toLowerCase();
    if (key === 'duration') return log.duration || 0;
    return '';
  };

  const filteredLogs = useMemo(() => {
    let result = [...logs];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((log) => {
        const username = log.user?.username?.toLowerCase() || '';
        const actionType = log.action?.type?.toLowerCase() || '';
        const errorText = log.error?.toLowerCase() || '';
        return username.includes(query) || actionType.includes(query) || errorText.includes(query);
      });
    }

    if (statusFilter !== 'all') result = result.filter((log) => log.status === statusFilter);
    if (severityFilter !== 'all') result = result.filter((log) => log.meta?.severity === severityFilter);
    if (categoryFilter !== 'all') result = result.filter((log) => log.meta?.category === categoryFilter);

    result.sort((a, b) => {
      const aVal = getSortValue(a, sortConfig.key);
      const bVal = getSortValue(b, sortConfig.key);
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [logs, searchQuery, statusFilter, severityFilter, categoryFilter, sortConfig]);

  const quickStats = useMemo(() => {
    const errors = filteredLogs.filter((log) => log.status === 'error').length;
    const warnings = filteredLogs.filter((log) => log.meta?.severity === 'warn' || log.meta?.severity === 'warning').length;
    const authEvents = filteredLogs.filter((log) => log.action?.type?.startsWith('auth:')).length;
    return { total: filteredLogs.length, errors, warnings, authEvents };
  }, [filteredLogs]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setSeverityFilter('all');
    setCategoryFilter('all');
    setSortConfig({ key: 'timestamp', direction: 'desc' });
  };

  const handleExport = () => {
    const exportRows = filteredLogs.map((log) => ({
      timestamp: new Date(log.timestamp).toISOString(),
      user: log.user?.username || 'system',
      actionType: log.action?.type || 'unknown',
      status: log.status || 'unknown',
      severity: log.meta?.severity || 'info',
      category: log.meta?.category || 'system',
      durationMs: log.duration || 0,
      error: log.error || null
    }));
    downloadJson(`system-logs-${Date.now()}.json`, exportRows);
  };

  const SortableHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th onClick={() => handleSort(sortKey)} className={`admin-th ${isActive ? 'active' : ''}`}>
        <div className="admin-th-content">
          {label}
          {isActive && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
        </div>
      </th>
    );
  };

  if (loading) {
    return (
      <Card>
        <div className="admin-loading">{isFr ? 'Chargement des journaux systeme...' : 'Loading system logs...'}</div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="admin-section-header-wrap">
        <div>
          <h3 className="admin-card-title">{isFr ? 'Journaux système' : 'System Logs'}</h3>
          <p className="admin-card-subtitle">
            {isFr ? `Revoir les événements sécurité/système (${summary?.total ?? logs.length} récupérés)` : `Review security and system events (${summary?.total ?? logs.length} fetched)`}
          </p>
        </div>
        <div className="admin-actions-row">
          <CustomSelect
            value={limit}
            onChange={(val) => setLimit(Number(val))}
            size="sm"
            options={[
              { value: 100, label: isFr ? '100 journaux' : '100 logs' },
              { value: 200, label: isFr ? '200 journaux' : '200 logs' },
              { value: 500, label: isFr ? '500 journaux' : '500 logs' },
            ]}
          />
          <button className="btn btn-ghost btn-sm flex-center flex-gap-2" onClick={loadLogs}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="btn btn-primary btn-sm flex-center flex-gap-2" onClick={handleExport} disabled={filteredLogs.length === 0}>
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="admin-quick-stats">
        <StatItem label={isFr ? 'Journaux visibles' : 'Visible Logs'} value={quickStats.total} color="var(--text-primary)" />
        <StatItem label={isFr ? 'Erreurs' : 'Errors'} value={quickStats.errors} color="var(--status-error)" />
        <StatItem label={isFr ? 'Avertissements' : 'Warnings'} value={quickStats.warnings} color="var(--status-warning)" />
        <StatItem label={isFr ? 'Événements auth' : 'Auth Events'} value={quickStats.authEvents} color="var(--status-info)" />
      </div>

      <div className="admin-filters-row">
        <div className="admin-search-wrapper">
          <Search size={16} className="admin-search-icon" />
          <input
            type="text"
            placeholder={isFr ? 'Rechercher utilisateur, action, erreur...' : 'Search user, action, error...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-search-input"
            style={{ width: '260px' }}
          />
        </div>
        <CustomSelect
          value={statusFilter}
          onChange={setStatusFilter}
          size="sm"
          options={[
            { value: 'all', label: isFr ? 'Tous statuts' : 'All status' },
            ...statusOptions.map((s) => ({ value: s, label: s })),
          ]}
        />
        <CustomSelect
          value={severityFilter}
          onChange={setSeverityFilter}
          size="sm"
          options={[
            { value: 'all', label: isFr ? 'Toutes severites' : 'All severity' },
            ...severityOptions.map((s) => ({ value: s, label: s })),
          ]}
        />
        <CustomSelect
          value={categoryFilter}
          onChange={setCategoryFilter}
          size="sm"
          options={[
            { value: 'all', label: isFr ? 'Toutes categories' : 'All categories' },
            ...categoryOptions.map((c) => ({ value: c, label: c })),
          ]}
        />
        <button className="btn btn-ghost btn-sm" onClick={handleResetFilters}>{isFr ? 'Réinitialiser' : 'Reset'}</button>
      </div>

      {filteredLogs.length === 0 ? (
        <div className="admin-empty-state">
          <Activity size={48} color="var(--text-tertiary)" className="admin-empty-icon" />
          <p className="admin-empty-text">{isFr ? 'Aucun journal ne correspond aux filtres actuels' : 'No logs match the current filters'}</p>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <SortableHeader label={isFr ? 'Heure' : 'Time'} sortKey="timestamp" />
                <SortableHeader label={isFr ? 'Utilisateur' : 'User'} sortKey="user" />
                <SortableHeader label={isFr ? 'Action' : 'Action'} sortKey="action" />
                <SortableHeader label={isFr ? 'Statut' : 'Status'} sortKey="status" />
                <SortableHeader label={isFr ? 'Sévérité' : 'Severity'} sortKey="severity" />
                <SortableHeader label={isFr ? 'Catégorie' : 'Category'} sortKey="category" />
                <SortableHeader label={isFr ? 'Durée' : 'Duration'} sortKey="duration" />
                <th className="admin-th-static">{isFr ? 'Details' : 'Details'}</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.uuid || log.id}>
                  <td className="admin-td-nowrap">{formatDateTime(log.timestamp)}</td>
                  <td className="admin-td-sm">{log.user?.username || 'system'}</td>
                  <td className="admin-td-sm">{log.action?.type || 'unknown'}</td>
                  <td><Pill type="status" value={log.status || 'unknown'} /></td>
                  <td><Pill type="severity" value={log.meta?.severity || 'info'} /></td>
                  <td className="admin-td-muted">{log.meta?.category || 'system'}</td>
                  <td className="admin-td-muted">{log.duration ? `${log.duration} ms` : '—'}</td>
                  <td className="admin-td-detail">{log.error || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ── Notifications Section ────────────────────────────────
const BROADCAST_CATEGORIES = [
  { key: 'admin-broadcast', label: 'Announcement', icon: Megaphone, color: 'var(--accent-tertiary)' },
  { key: 'admin-maintenance', label: 'Maintenance', icon: Wrench, color: 'var(--status-warning)' },
  { key: 'admin-update', label: 'Update', icon: Download, color: 'var(--status-success)' },
  { key: 'admin-security', label: 'Security', icon: ShieldAlert, color: 'var(--status-error)' }
];

const BROADCAST_TEMPLATES = [
  { label: 'Maintenance', category: 'admin-maintenance', title: 'Scheduled Maintenance', message: 'Orbit will undergo scheduled maintenance on [DATE] from [TIME] to [TIME].\nDuring this period, some features may be temporarily unavailable.\nWe apologize for the inconvenience.' },
  { label: 'Update', category: 'admin-update', title: 'New Update Available', message: 'Orbit [VERSION] is now available!\nThis update includes new features and improvements.\nPlease restart the app to apply the update.' },
  { label: 'Security Alert', category: 'admin-security', title: 'Security Notice', message: 'For your security, please note the following:\n\n[Details about the security notice]\n\nIf you have any concerns, please contact an administrator.' }
];

function NotificationsSection({ users = [] }) {
  const { language } = useI18n();
  const isFr = language === 'fr';
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [category, setCategory] = useState('admin-broadcast');
  const [target, setTarget] = useState('all');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [sending, setSending] = useState(false);
  const [confirmModal, setConfirmModal] = useState(false);
  const [resultModal, setResultModal] = useState({ isOpen: false, success: false, text: '' });
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const canSend = title.trim() && message.trim() && (target === 'all' || selectedUserId);

  const loadHistory = async () => {
    try {
      setHistoryLoading(true);
      const result = await hubAPI.admin.getBroadcastHistory();
      if (result.success) {
        setHistory(result.history);
      }
    } catch (err) {
      console.error('Failed to load broadcast history:', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleSend = async () => {
    setConfirmModal(false);
    try {
      setSending(true);
      const payload = { title: title.trim(), message: message.trim(), target, category };
      if (target === 'user') payload.userId = selectedUserId;

      const result = await hubAPI.admin.sendNotification(payload);
      if (result.success) {
        setResultModal({ isOpen: true, success: true, text: `Notification sent to ${result.sent} user${result.sent > 1 ? 's' : ''}.` });
        setTitle('');
        setMessage('');
        setCategory('admin-broadcast');
        setTarget('all');
        setSelectedUserId('');
        if (showHistory) loadHistory();
      } else {
        setResultModal({ isOpen: true, success: false, text: result.error || 'Failed to send' });
      }
    } catch (err) {
      setResultModal({ isOpen: true, success: false, text: 'An unexpected error occurred.' });
    } finally {
      setSending(false);
    }
  };

  const applyTemplate = (template) => {
    setTitle(template.title);
    setMessage(template.message);
    setCategory(template.category);
  };

  const targetLabel = target === 'all'
    ? `all ${users.length} users`
    : users.find((u) => u.id === selectedUserId)?.username || 'selected user';

  return (
    <div className="flex-col" style={{ gap: '20px' }}>
      {/* Send Notification Card */}
      <Card>
        <div style={{ marginBottom: '20px' }}>
          <h3 className="admin-card-title">{isFr ? 'Envoyer une notification' : 'Send Notification'}</h3>
          <p className="admin-card-subtitle">
            {isFr ? 'Diffuser un message à tous les utilisateurs ou à un utilisateur spécifique' : 'Broadcast a message to all users or send to a specific user'}
          </p>
        </div>

        <div className="admin-form-col">
          {/* Category selector */}
          <div>
            <label className="admin-form-label" style={{ marginBottom: '8px' }}>
              {isFr ? 'Catégorie' : 'Category'}
            </label>
            <div className="admin-cat-btns">
              {BROADCAST_CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                const isSelected = category === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    className="admin-cat-btn"
                    style={{
                      border: `1px solid ${isSelected ? cat.color : 'var(--border-default)'}`,
                      backgroundColor: isSelected ? `${cat.color}15` : 'var(--bg-tertiary)',
                      color: isSelected ? cat.color : 'var(--text-secondary)'
                    }}
                  >
                    <CatIcon size={14} />
                    {cat.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Templates */}
          <div>
            <label className="admin-form-label-flex">
              <FileText size={14} />
              {isFr ? 'Modèles rapides' : 'Quick Templates'}
            </label>
            <div className="admin-cat-btns">
              {BROADCAST_TEMPLATES.map((tpl) => {
                const catConfig = BROADCAST_CATEGORIES.find((c) => c.key === tpl.category);
                const TplIcon = catConfig?.icon || Megaphone;
                return (
                  <button
                    key={tpl.label}
                    onClick={() => applyTemplate(tpl)}
                    className="admin-tpl-btn"
                  >
                    <TplIcon size={13} />
                    {tpl.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Target */}
          <div>
            <label className="admin-form-label">
              {isFr ? 'Destinataire' : 'Recipient'}
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setTarget('all'); setSelectedUserId(''); }}
                className="admin-target-btn"
                style={{
                  border: `1px solid ${target === 'all' ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                  backgroundColor: target === 'all' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-tertiary)',
                  color: target === 'all' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
              >
                <Users size={16} />
                {isFr ? 'Tous les utilisateurs' : 'All Users'}
              </button>
              <button
                onClick={() => setTarget('user')}
                className="admin-target-btn"
                style={{
                  border: `1px solid ${target === 'user' ? 'var(--accent-primary)' : 'var(--border-default)'}`,
                  backgroundColor: target === 'user' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-tertiary)',
                  color: target === 'user' ? 'var(--accent-primary)' : 'var(--text-secondary)'
                }}
              >
                <User size={16} />
                {isFr ? 'Utilisateur spécifique' : 'Specific User'}
              </button>
            </div>
          </div>

          {/* User selector */}
          {target === 'user' && (
            <div>
              <label className="admin-form-label">
                {isFr ? 'Sélectionner un utilisateur' : 'Select User'}
              </label>
              <CustomSelect
                value={selectedUserId}
                onChange={setSelectedUserId}
                placeholder={isFr ? 'Choisir un utilisateur...' : 'Choose a user...'}
                options={users.map((u) => ({
                  value: u.id,
                  label: `${u.username} (${u.email})`,
                }))}
              />
            </div>
          )}

          {/* Title */}
          <div>
            <label className="admin-form-label">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={isFr ? 'Titre de la notification...' : 'Notification title...'}
              maxLength={100}
              className="admin-input"
            />
          </div>

          {/* Message */}
          <div>
            <label className="admin-form-label">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={isFr ? 'Écrivez votre message... (retours à la ligne supportés)' : 'Write your message... (line breaks are supported)'}
              maxLength={500}
              rows={4}
              className="admin-textarea"
            />
            <div className="admin-char-count">{message.length}/500</div>
          </div>

          {/* Preview */}
          {canSend && (() => {
            const previewCat = BROADCAST_CATEGORIES.find((c) => c.key === category) || BROADCAST_CATEGORIES[0];
            const PreviewIcon = previewCat.icon;
            const pc = previewCat.color;
            return (
            <div style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${pc}33`,
              backgroundColor: `${pc}0a`,
            }}>
              <div className="flex-center flex-gap-2" style={{ marginBottom: '6px' }}>
                <PreviewIcon size={14} color={pc} />
                <span style={{ fontSize: '12px', fontWeight: '600', color: pc }}>{isFr ? 'Aperçu' : 'Preview'} — {previewCat.label}</span>
              </div>
              <div className="admin-preview-title">{title}</div>
              <div className="admin-preview-body">{message}</div>
              <div className="admin-preview-footer">
                {isFr ? 'A:' : 'To:'} {targetLabel}
              </div>
            </div>
            );
          })()}

          {/* Send button */}
          <button
            onClick={() => setConfirmModal(true)}
            disabled={!canSend || sending}
            className="btn btn-primary admin-send-btn"
            style={{
              opacity: canSend && !sending ? 1 : 0.5,
              cursor: canSend && !sending ? 'pointer' : 'not-allowed'
            }}
          >
            <Send size={16} />
            {sending ? (isFr ? 'Envoi...' : 'Sending...') : (isFr ? 'Envoyer la notification' : 'Send Notification')}
          </button>
        </div>

        {/* Confirm modal */}
        <Modal
          isOpen={confirmModal}
          onClose={() => setConfirmModal(false)}
          onConfirm={handleSend}
          title={isFr ? 'Confirmer l\'envoi' : 'Confirm Send'}
          message={`Are you sure you want to send "${title}" to ${targetLabel}? This action cannot be undone.`}
          type="confirm"
          confirmText={isFr ? 'Envoyer' : 'Send'}
          cancelText={isFr ? 'Annuler' : 'Cancel'}
        />

        {/* Result modal */}
        <Modal
          isOpen={resultModal.isOpen}
          onClose={() => setResultModal({ isOpen: false, success: false, text: '' })}
          title={resultModal.success ? (isFr ? 'Notification envoyée' : 'Notification Sent') : (isFr ? 'Erreur' : 'Error')}
          message={resultModal.text}
          type={resultModal.success ? 'info' : 'alert'}
          confirmText={isFr ? 'OK' : 'OK'}
        />
      </Card>

      {/* Broadcast History Card */}
      <Card>
        <div
          className="admin-history-toggle"
          onClick={() => {
            if (!showHistory) loadHistory();
            setShowHistory(!showHistory);
          }}
        >
          <div className="admin-history-row">
            <History size={18} color="var(--text-secondary)" />
            <div>
              <h3 className="admin-card-title">{isFr ? 'Historique des diffusions' : 'Broadcast History'}</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '2px 0 0 0' }}>
                {isFr ? 'Voir les anciennes notifications diffusées' : 'View past broadcast notifications'}
              </p>
            </div>
          </div>
          {showHistory ? <ChevronUp size={18} color="var(--text-tertiary)" /> : <ChevronDown size={18} color="var(--text-tertiary)" />}
        </div>

        {showHistory && (
          <div style={{ marginTop: '16px' }}>
            {historyLoading ? (
              <div className="admin-history-loading">
                {isFr ? 'Chargement de l\'historique...' : 'Loading history...'}
              </div>
            ) : history.length === 0 ? (
              <div className="admin-history-loading">
                {isFr ? 'Aucune diffusion envoyée pour le moment' : 'No broadcasts sent yet'}
              </div>
            ) : (
              <div className="flex-col" style={{ gap: '8px' }}>
                {history.map((item, idx) => {
                  const histCat = BROADCAST_CATEGORIES.find((c) => c.key === item.type) || BROADCAST_CATEGORIES[0];
                  const HistIcon = histCat.icon;
                  const hc = histCat.color;
                  const date = new Date(item.created_at * 1000);
                  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div key={idx} className="admin-history-item">
                      <div className="admin-history-header">
                        <div className="admin-history-title-row">
                          <HistIcon size={14} color={hc} />
                          <span className="admin-history-title">{item.title}</span>
                          <span className="admin-history-pill" style={{ backgroundColor: `${hc}12`, color: hc }}>
                            {histCat.label}
                          </span>
                        </div>
                        <span className="admin-history-badge" style={{ backgroundColor: `${hc}12`, color: hc }}>
                          {item.recipient_count} recipient{item.recipient_count > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="admin-history-msg">{item.message}</p>
                      <div className="admin-history-meta">
                        <span>{dateStr} at {timeStr}</span>
                        {item.metadata?.sentBy && <span>by {item.metadata.sentBy}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Roles & Permissions Section ──────────────────────────
const ROLE_DATA = [
  {
    role: 'ADMIN',
    label: 'Administrator',
    color: 'var(--accent-primary)',
    description: 'Full system access, user management, all permissions',
    permissions: ['NET_ACCESS', 'FS_READ', 'FS_WRITE', 'FS_PICKER', 'RUN_TOOL', 'SPAWN_PROCESS', 'CLIPBOARD', 'NOTIFICATIONS', 'TRAY_CONTROL', 'PREMIUM_TOOLS', 'MANAGE_USERS', 'VIEW_ALL_LOGS', 'SYSTEM_CONFIG', 'INSTALL_TOOLS']
  },
  {
    role: 'DEV',
    label: 'Developer',
    color: 'var(--status-error)',
    description: 'Extended access, log viewing, tool installation',
    permissions: ['NET_ACCESS', 'FS_READ', 'FS_WRITE', 'FS_PICKER', 'RUN_TOOL', 'SPAWN_PROCESS', 'CLIPBOARD', 'NOTIFICATIONS', 'TRAY_CONTROL', 'PREMIUM_TOOLS', 'VIEW_ALL_LOGS', 'INSTALL_TOOLS']
  },
  {
    role: 'PREMIUM',
    label: 'Premium',
    color: 'var(--status-warning)',
    description: 'Standard access with premium tools',
    permissions: ['NET_ACCESS', 'FS_READ', 'FS_WRITE', 'FS_PICKER', 'RUN_TOOL', 'SPAWN_PROCESS', 'CLIPBOARD', 'NOTIFICATIONS', 'TRAY_CONTROL', 'PREMIUM_TOOLS']
  },
  {
    role: 'USER',
    label: 'User',
    color: 'var(--status-success)',
    description: 'Basic access with standard permissions',
    permissions: ['NET_ACCESS', 'FS_READ', 'FS_PICKER', 'RUN_TOOL', 'CLIPBOARD', 'NOTIFICATIONS']
  }
];

const ALL_PERMISSIONS = [
  'NET_ACCESS', 'FS_READ', 'FS_WRITE', 'FS_PICKER', 'RUN_TOOL', 'SPAWN_PROCESS',
  'CLIPBOARD', 'NOTIFICATIONS', 'TRAY_CONTROL', 'PREMIUM_TOOLS',
  'MANAGE_USERS', 'VIEW_ALL_LOGS', 'SYSTEM_CONFIG', 'INSTALL_TOOLS'
];

const PERM_LABELS = {
  NET_ACCESS: 'Network Access',
  FS_READ: 'Read Files',
  FS_WRITE: 'Write Files',
  FS_PICKER: 'File Picker',
  RUN_TOOL: 'Run Tools',
  SPAWN_PROCESS: 'Spawn Processes',
  CLIPBOARD: 'Clipboard',
  NOTIFICATIONS: 'Notifications',
  TRAY_CONTROL: 'Tray Control',
  PREMIUM_TOOLS: 'Premium Tools',
  MANAGE_USERS: 'Manage Users',
  VIEW_ALL_LOGS: 'View All Logs',
  SYSTEM_CONFIG: 'System Config',
  INSTALL_TOOLS: 'Install Tools'
};

const ROLE_LABELS_FR = {
  ADMIN: 'Administrateur',
  DEV: 'Développeur',
  PREMIUM: 'Premium',
  USER: 'Utilisateur'
};

const ROLE_DESCRIPTIONS_FR = {
  ADMIN: 'Accès complet au système, gestion des utilisateurs et permissions globales',
  DEV: 'Accès étendu, visibilité des journaux et installation d\'outils',
  PREMIUM: 'Accès standard avec outils premium',
  USER: 'Accès de base avec permissions standard'
};

const PERM_LABELS_FR = {
  NET_ACCESS: 'Accès réseau',
  FS_READ: 'Lecture de fichiers',
  FS_WRITE: 'Écriture de fichiers',
  FS_PICKER: 'Sélecteur de fichiers',
  RUN_TOOL: 'Exécuter les outils',
  SPAWN_PROCESS: 'Lancer des processus',
  CLIPBOARD: 'Presse-papiers',
  NOTIFICATIONS: 'Notifications',
  TRAY_CONTROL: 'Contrôle de la zone de notification',
  PREMIUM_TOOLS: 'Outils premium',
  MANAGE_USERS: 'Gérer les utilisateurs',
  VIEW_ALL_LOGS: 'Voir tous les journaux',
  SYSTEM_CONFIG: 'Configuration système',
  INSTALL_TOOLS: 'Installer des outils'
};

function RolesSection() {
  const { language } = useI18n();
  const isFr = language === 'fr';
  const roleData = isFr
    ? ROLE_DATA.map((role) => ({
        ...role,
        label: ROLE_LABELS_FR[role.role] || role.label,
        description: ROLE_DESCRIPTIONS_FR[role.role] || role.description,
      }))
    : ROLE_DATA;
  const permLabels = isFr ? PERM_LABELS_FR : PERM_LABELS;

  return (
    <Card>
      <div style={{ marginBottom: '16px' }}>
        <h3 className="admin-card-title">
          {isFr ? 'Rôles et permissions' : 'Roles & Permissions'}
        </h3>
        <p className="admin-card-subtitle">
          {isFr
            ? 'Les permissions dépendent des rôles. Assignez les rôles dans la gestion des utilisateurs pour modifier ce que chacun peut faire.'
            : 'Permissions are role-driven. Assign roles in User Management to change what users can do.'}
        </p>
      </div>

      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th className="admin-perm-th">
                {isFr ? 'Permission' : 'Permission'}
              </th>
              {roleData.map((r) => (
                <th key={r.role} className="admin-perm-role-th" style={{ color: r.color }}>
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((perm) => (
              <tr key={perm}>
                <td className="admin-perm-td">
                  {permLabels[perm] || perm}
                </td>
                {roleData.map((r) => {
                  const has = r.permissions.includes(perm);
                  return (
                    <td key={r.role} className="admin-perm-check">
                      {has ? (
                        <CheckCircle size={16} style={{ color: r.color }} />
                      ) : (
                        <span className="admin-dash">—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="admin-roles-grid">
        {roleData.map((r) => (
          <div
            key={r.role}
            className="admin-role-card"
            style={{
              border: `1px solid ${r.color}30`,
              backgroundColor: `${r.color}08`
            }}
          >
            <div className="admin-role-header">
              <span className="admin-role-label" style={{ color: r.color }}>{r.label}</span>
              <span className="admin-role-key">{r.role}</span>
            </div>
            <p className="admin-role-desc">{r.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default AdminPanel;
