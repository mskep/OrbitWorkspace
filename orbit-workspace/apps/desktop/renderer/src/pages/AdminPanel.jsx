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

function AdminPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'notifications', label: 'Notifications', icon: Megaphone },
    { id: 'logs', label: 'System Logs', icon: Activity },
    { id: 'roles', label: 'Roles & Permissions', icon: Key }
  ];

  return (
    <div
      style={{
        padding: '32px',
        maxWidth: '1400px',
        margin: '0 auto'
      }}
    >
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '8px'
          }}
        >
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <Shield size={22} color="#fff" />
          </div>
          <div>
            <h1
              style={{
                fontSize: '28px',
                fontWeight: '700',
                margin: 0,
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent'
              }}
            >
              Admin Panel
            </h1>
            <p
              style={{
                fontSize: '14px',
                color: 'var(--text-tertiary)',
                margin: 0
              }}
            >
              System administration and management
            </p>
          </div>
        </div>
      </div>

      {/* Warning Badge */}
      <div
        style={{
          padding: '12px 16px',
          backgroundColor: 'rgba(245, 158, 11, 0.1)',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <AlertTriangle size={20} color="#f59e0b" />
        <div>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#f59e0b' }}>Administrator Access</div>
          <div style={{ fontSize: '13px', color: 'var(--text-tertiary)', marginTop: '2px' }}>
            You have full system access. Be careful with changes made here.
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '24px',
          overflowX: 'auto',
          paddingBottom: '8px'
        }}
      >
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeTab === section.id;

          return (
            <button
              key={section.id}
              onClick={() => setActiveTab(section.id)}
              className={`btn ${isActive ? 'btn-primary' : 'btn-ghost'} btn-sm`}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              <Icon size={16} />
              {section.label}
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
  if (loading) {
    return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>Loading stats...</div>;
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
      <Card>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Quick Stats</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <StatItem label="Total Users" value={stats?.totalUsers || 0} color="#667eea" />
          <StatItem label="Total Workspaces" value={stats?.totalWorkspaces || 0} color="#10b981" />
          <StatItem label="Total Notes" value={stats?.totalNotes || 0} color="#f59e0b" />
        </div>
      </Card>

      <Card>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Content Stats</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <StatItem label="Total Links" value={stats?.totalLinks || 0} color="#ec4899" />
          <StatItem label="File References" value={stats?.totalFileRefs || 0} color="#8b5cf6" />
          <StatItem label="Active Tools" value={stats?.activeTools || 0} color="#3b82f6" />
        </div>
      </Card>

      <Card>
        <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>System Health</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <StatItem label="Database Status" value="Healthy" color="#10b981" />
          <StatItem label="Total Badges" value={stats?.totalBadges || 0} color="#f59e0b" />
          <StatItem label="Total Inbox Items" value={stats?.totalInboxItems || 0} color="#6366f1" />
        </div>
      </Card>
    </div>
  );
}

function StatItem({ label, value, color }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: '16px', fontWeight: '600', color }}>{value}</span>
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
    if (value === 'success') { bg = 'rgba(16, 185, 129, 0.15)'; color = '#10b981'; }
    else if (value === 'error') { bg = 'rgba(239, 68, 68, 0.15)'; color = '#ef4444'; }
    else { bg = 'rgba(59, 130, 246, 0.15)'; color = '#3b82f6'; }
  } else {
    if (value === 'critical' || value === 'high' || value === 'error') { bg = 'rgba(239, 68, 68, 0.15)'; color = '#ef4444'; }
    else if (value === 'warn' || value === 'warning') { bg = 'rgba(245, 158, 11, 0.15)'; color = '#f59e0b'; }
    else { bg = 'rgba(16, 185, 129, 0.15)'; color = '#10b981'; }
  }
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 8px', borderRadius: '999px', fontSize: '11px', fontWeight: '600', backgroundColor: bg, color, textTransform: 'capitalize' }}>
      {value}
    </span>
  );
}

// ── Users Section ────────────────────────────────────────
function UsersSection({ users = [], loading, onRefresh }) {
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
      <th
        onClick={() => handleSort(sortKey)}
        style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: isActive ? 'var(--accent)' : 'var(--text-tertiary)', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {label}
          {isActive && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
        </div>
      </th>
    );
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>Loading users...</div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>User Management</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
            Manage user accounts, roles, and badges
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ padding: '8px 12px 8px 34px', fontSize: '13px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', width: '220px', outline: 'none' }}
            />
          </div>
        </div>
      </div>

      {filteredAndSortedUsers.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
          <Users size={48} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>
            {searchQuery ? 'No users found matching your search' : 'No users found'}
          </p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <SortableHeader label="User" sortKey="username" />
                <SortableHeader label="Email" sortKey="email" />
                <SortableHeader label="Role" sortKey="role" />
                <SortableHeader label="Status" sortKey="status" />
                <SortableHeader label="Created" sortKey="created_at" />
                <th style={{ padding: '12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)' }}>
                  Badges
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredAndSortedUsers.map((user) => {
                const isCurrentUser = isSelf(user.id);
                const isActive = user.status === 'active';
                const badgeCount = (userBadges[user.id] || []).length;
                return (
                  <React.Fragment key={user.id}>
                    <tr style={{ borderBottom: '1px solid var(--border-default)', opacity: isCurrentUser ? 0.7 : 1 }}>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--accent-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <User size={16} color="var(--accent)" />
                          </div>
                          <div>
                            <span style={{ fontSize: '14px', fontWeight: '500' }}>{user.username}</span>
                            {isCurrentUser && (
                              <span style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--accent)', fontWeight: '600' }}>(You)</span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>{user.email}</td>
                      <td style={{ padding: '12px' }}>
                        <CustomSelect
                          value={user.role}
                          onChange={(val) => handleUpdateRole(user.id, val)}
                          disabled={updatingUser === user.id || isCurrentUser}
                          size="sm"
                          options={[
                            { value: 'USER', label: 'User' },
                            { value: 'PREMIUM', label: 'Premium' },
                            { value: 'DEV', label: 'Developer' },
                            { value: 'ADMIN', label: 'Admin' },
                          ]}
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <CustomSelect
                          value={user.status}
                          onChange={(val) => handleUpdateStatus(user.id, val)}
                          disabled={updatingUser === user.id || isCurrentUser}
                          size="sm"
                          options={[
                            { value: 'active', label: 'Active', color: '#10b981' },
                            { value: 'disabled', label: 'Disabled', color: '#ef4444' },
                          ]}
                        />
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: 'var(--text-tertiary)' }}>
                          <Clock size={14} />
                          {formatDate(user.created_at)}
                        </div>
                      </td>
                      <td style={{ padding: '12px' }}>
                        <div style={{ position: 'relative' }}>
                          <button
                            onClick={() => toggleExpand(user.id)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '3px 8px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-default)',
                              backgroundColor: expandedUser === user.id ? 'var(--accent-glow)' : 'var(--bg-tertiary)',
                              color: expandedUser === user.id ? 'var(--accent)' : 'var(--text-tertiary)',
                              fontSize: '11px',
                              fontWeight: '600',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              transition: 'all 150ms ease'
                            }}
                          >
                            <Award size={12} />
                            {badgeCount}
                          </button>
                          {expandedUser === user.id && (
                            <div
                              style={{
                                position: 'absolute',
                                right: 0,
                                top: '100%',
                                marginTop: '4px',
                                zIndex: 20,
                                backgroundColor: 'var(--bg-secondary)',
                                border: '1px solid var(--border-default)',
                                borderRadius: 'var(--radius-md)',
                                padding: '8px',
                                minWidth: '180px',
                                boxShadow: '0 8px 24px rgba(0,0,0,0.3)'
                              }}
                            >
                              {allBadges.map((badge) => {
                                const hasBadge = (userBadges[user.id] || []).includes(badge.id);
                                return (
                                  <button
                                    key={badge.id}
                                    onClick={() => handleToggleBadge(user.id, badge.id, hasBadge)}
                                    disabled={badgeLoading}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: '8px',
                                      width: '100%',
                                      padding: '6px 8px',
                                      borderRadius: 'var(--radius-sm)',
                                      border: 'none',
                                      backgroundColor: hasBadge ? `${badge.color}15` : 'transparent',
                                      color: hasBadge ? badge.color : 'var(--text-secondary)',
                                      fontSize: '12px',
                                      cursor: badgeLoading ? 'not-allowed' : 'pointer',
                                      fontFamily: 'inherit',
                                      transition: 'background-color 150ms ease',
                                      textAlign: 'left'
                                    }}
                                  >
                                    <span style={{ fontSize: '14px', lineHeight: 1 }}>{badge.icon}</span>
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

  // selectStyle no longer needed — replaced by CustomSelect

  const SortableHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th
        onClick={() => handleSort(sortKey)}
        style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: isActive ? 'var(--accent)' : 'var(--text-tertiary)', cursor: 'pointer', userSelect: 'none' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {label}
          {isActive && (sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />)}
        </div>
      </th>
    );
  };

  if (loading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-tertiary)' }}>Loading system logs...</div>
      </Card>
    );
  }

  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>System Logs</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
            Review security and system events ({summary?.total ?? logs.length} fetched)
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <CustomSelect
            value={limit}
            onChange={(val) => setLimit(Number(val))}
            size="sm"
            options={[
              { value: 100, label: '100 logs' },
              { value: 200, label: '200 logs' },
              { value: 500, label: '500 logs' },
            ]}
          />
          <button className="btn btn-ghost btn-sm" onClick={loadLogs} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <RefreshCw size={14} />
            Refresh
          </button>
          <button className="btn btn-primary btn-sm" onClick={handleExport} disabled={filteredLogs.length === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Download size={14} />
            Export
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px', marginBottom: '16px' }}>
        <StatItem label="Visible Logs" value={quickStats.total} color="var(--text-primary)" />
        <StatItem label="Errors" value={quickStats.errors} color="#ef4444" />
        <StatItem label="Warnings" value={quickStats.warnings} color="#f59e0b" />
        <StatItem label="Auth Events" value={quickStats.authEvents} color="#3b82f6" />
      </div>

      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <div style={{ position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Search user, action, error..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '8px 12px 8px 34px', fontSize: '13px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-default)', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)', width: '260px', outline: 'none' }}
          />
        </div>
        <CustomSelect
          value={statusFilter}
          onChange={setStatusFilter}
          size="sm"
          options={[
            { value: 'all', label: 'All status' },
            ...statusOptions.map((s) => ({ value: s, label: s })),
          ]}
        />
        <CustomSelect
          value={severityFilter}
          onChange={setSeverityFilter}
          size="sm"
          options={[
            { value: 'all', label: 'All severity' },
            ...severityOptions.map((s) => ({ value: s, label: s })),
          ]}
        />
        <CustomSelect
          value={categoryFilter}
          onChange={setCategoryFilter}
          size="sm"
          options={[
            { value: 'all', label: 'All categories' },
            ...categoryOptions.map((c) => ({ value: c, label: c })),
          ]}
        />
        <button className="btn btn-ghost btn-sm" onClick={handleResetFilters}>Reset</button>
      </div>

      {filteredLogs.length === 0 ? (
        <div style={{ padding: '40px', textAlign: 'center', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
          <Activity size={48} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>No logs match the current filters</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                <SortableHeader label="Time" sortKey="timestamp" />
                <SortableHeader label="User" sortKey="user" />
                <SortableHeader label="Action" sortKey="action" />
                <SortableHeader label="Status" sortKey="status" />
                <SortableHeader label="Severity" sortKey="severity" />
                <SortableHeader label="Category" sortKey="category" />
                <SortableHeader label="Duration" sortKey="duration" />
                <th style={{ padding: '12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)' }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.uuid || log.id} style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDateTime(log.timestamp)}</td>
                  <td style={{ padding: '12px', fontSize: '13px' }}>{log.user?.username || 'system'}</td>
                  <td style={{ padding: '12px', fontSize: '13px' }}>{log.action?.type || 'unknown'}</td>
                  <td style={{ padding: '12px' }}><Pill type="status" value={log.status || 'unknown'} /></td>
                  <td style={{ padding: '12px' }}><Pill type="severity" value={log.meta?.severity || 'info'} /></td>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{log.meta?.category || 'system'}</td>
                  <td style={{ padding: '12px', fontSize: '13px', color: 'var(--text-secondary)' }}>{log.duration ? `${log.duration} ms` : '—'}</td>
                  <td style={{ padding: '12px', fontSize: '12px', color: 'var(--text-tertiary)', maxWidth: '280px' }}>{log.error || '—'}</td>
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
  { key: 'admin-broadcast', label: 'Announcement', icon: Megaphone, color: '#ec4899' },
  { key: 'admin-maintenance', label: 'Maintenance', icon: Wrench, color: '#f59e0b' },
  { key: 'admin-update', label: 'Update', icon: Download, color: '#10b981' },
  { key: 'admin-security', label: 'Security', icon: ShieldAlert, color: '#ef4444' }
];

const BROADCAST_TEMPLATES = [
  { label: 'Maintenance', category: 'admin-maintenance', title: 'Scheduled Maintenance', message: 'Orbit will undergo scheduled maintenance on [DATE] from [TIME] to [TIME].\nDuring this period, some features may be temporarily unavailable.\nWe apologize for the inconvenience.' },
  { label: 'Update', category: 'admin-update', title: 'New Update Available', message: 'Orbit [VERSION] is now available!\nThis update includes new features and improvements.\nPlease restart the app to apply the update.' },
  { label: 'Security Alert', category: 'admin-security', title: 'Security Notice', message: 'For your security, please note the following:\n\n[Details about the security notice]\n\nIf you have any concerns, please contact an administrator.' }
];

function NotificationsSection({ users = [] }) {
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

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: '13px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-default)',
    backgroundColor: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    outline: 'none',
    fontFamily: 'inherit',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s'
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Send Notification Card */}
      <Card>
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Send Notification</h3>
          <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
            Broadcast a message to all users or send to a specific user
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
          {/* Category selector */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Category
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {BROADCAST_CATEGORIES.map((cat) => {
                const CatIcon = cat.icon;
                const isSelected = category === cat.key;
                return (
                  <button
                    key={cat.key}
                    onClick={() => setCategory(cat.key)}
                    style={{
                      padding: '8px 14px',
                      fontSize: '12px',
                      fontWeight: '600',
                      borderRadius: 'var(--radius-md)',
                      border: `1px solid ${isSelected ? cat.color : 'var(--border-default)'}`,
                      backgroundColor: isSelected ? `${cat.color}15` : 'var(--bg-tertiary)',
                      color: isSelected ? cat.color : 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = `${cat.color}80`;
                        e.currentTarget.style.color = cat.color;
                        e.currentTarget.style.backgroundColor = `${cat.color}08`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = 'var(--border-default)';
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                      }
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <FileText size={14} />
              Quick Templates
            </label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {BROADCAST_TEMPLATES.map((tpl) => {
                const catConfig = BROADCAST_CATEGORIES.find((c) => c.key === tpl.category);
                const TplIcon = catConfig?.icon || Megaphone;
                const tplColor = catConfig?.color || '#ec4899';
                return (
                  <button
                    key={tpl.label}
                    onClick={() => applyTemplate(tpl)}
                    style={{
                      padding: '6px 12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-default)',
                      backgroundColor: 'var(--bg-tertiary)',
                      color: 'var(--text-secondary)',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = tplColor;
                      e.currentTarget.style.color = tplColor;
                      e.currentTarget.style.backgroundColor = `${tplColor}08`;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--border-default)';
                      e.currentTarget.style.color = 'var(--text-secondary)';
                      e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                    }}
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
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Recipient
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => { setTarget('all'); setSelectedUserId(''); }}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${target === 'all' ? 'var(--accent)' : 'var(--border-default)'}`,
                  backgroundColor: target === 'all' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-tertiary)',
                  color: target === 'all' ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <Users size={16} />
                All Users
              </button>
              <button
                onClick={() => setTarget('user')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: 'var(--radius-md)',
                  border: `1px solid ${target === 'user' ? 'var(--accent)' : 'var(--border-default)'}`,
                  backgroundColor: target === 'user' ? 'rgba(99, 102, 241, 0.08)' : 'var(--bg-tertiary)',
                  color: target === 'user' ? 'var(--accent)' : 'var(--text-secondary)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <User size={16} />
                Specific User
              </button>
            </div>
          </div>

          {/* User selector */}
          {target === 'user' && (
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                Select User
              </label>
              <CustomSelect
                value={selectedUserId}
                onChange={setSelectedUserId}
                placeholder="Choose a user..."
                options={users.map((u) => ({
                  value: u.id,
                  label: `${u.username} (${u.email})`,
                }))}
              />
            </div>
          )}

          {/* Title */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title..."
              maxLength={100}
              style={inputStyle}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
            />
          </div>

          {/* Message */}
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '6px' }}>
              Message
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message... (line breaks are supported)"
              maxLength={500}
              rows={4}
              style={{ ...inputStyle, resize: 'vertical', minHeight: '80px' }}
              onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
              onBlur={(e) => { e.target.style.borderColor = 'var(--border-default)'; }}
            />
            <div style={{ textAlign: 'right', fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
              {message.length}/500
            </div>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <PreviewIcon size={14} color={pc} />
                <span style={{ fontSize: '12px', fontWeight: '600', color: pc }}>Preview — {previewCat.label}</span>
              </div>
              <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '2px' }}>{title}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{message}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px' }}>
                To: {targetLabel}
              </div>
            </div>
            );
          })()}

          {/* Send button */}
          <button
            onClick={() => setConfirmModal(true)}
            disabled={!canSend || sending}
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '12px',
              fontSize: '14px',
              fontWeight: '600',
              opacity: canSend && !sending ? 1 : 0.5,
              cursor: canSend && !sending ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s'
            }}
          >
            <Send size={16} />
            {sending ? 'Sending...' : 'Send Notification'}
          </button>
        </div>

        {/* Confirm modal */}
        <Modal
          isOpen={confirmModal}
          onClose={() => setConfirmModal(false)}
          onConfirm={handleSend}
          title="Confirm Send"
          message={`Are you sure you want to send "${title}" to ${targetLabel}? This action cannot be undone.`}
          type="confirm"
          confirmText="Send"
          cancelText="Cancel"
        />

        {/* Result modal */}
        <Modal
          isOpen={resultModal.isOpen}
          onClose={() => setResultModal({ isOpen: false, success: false, text: '' })}
          title={resultModal.success ? 'Notification Sent' : 'Error'}
          message={resultModal.text}
          type={resultModal.success ? 'info' : 'alert'}
          confirmText="OK"
        />
      </Card>

      {/* Broadcast History Card */}
      <Card>
        <div
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          onClick={() => {
            if (!showHistory) loadHistory();
            setShowHistory(!showHistory);
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <History size={18} color="var(--text-secondary)" />
            <div>
              <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Broadcast History</h3>
              <p style={{ fontSize: '13px', color: 'var(--text-tertiary)', margin: '2px 0 0 0' }}>
                View past broadcast notifications
              </p>
            </div>
          </div>
          {showHistory ? <ChevronUp size={18} color="var(--text-tertiary)" /> : <ChevronDown size={18} color="var(--text-tertiary)" />}
        </div>

        {showHistory && (
          <div style={{ marginTop: '16px' }}>
            {historyLoading ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                Loading history...
              </div>
            ) : history.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '13px' }}>
                No broadcasts sent yet
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {history.map((item, idx) => {
                  const histCat = BROADCAST_CATEGORIES.find((c) => c.key === item.type) || BROADCAST_CATEGORIES[0];
                  const HistIcon = histCat.icon;
                  const hc = histCat.color;
                  const date = new Date(item.created_at * 1000);
                  const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <div
                      key={idx}
                      style={{
                        padding: '12px 14px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-default)',
                        backgroundColor: 'var(--bg-secondary)',
                        transition: 'border-color 0.2s'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = `${hc}50`; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-default)'; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <HistIcon size={14} color={hc} />
                          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>{item.title}</span>
                          <span style={{
                            fontSize: '10px',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            backgroundColor: `${hc}12`,
                            color: hc,
                            fontWeight: '600'
                          }}>
                            {histCat.label}
                          </span>
                        </div>
                        <span style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: `${hc}12`,
                          color: hc,
                          fontWeight: '600'
                        }}>
                          {item.recipient_count} recipient{item.recipient_count > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: '4px 0', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                        {item.message}
                      </p>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
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
    color: '#667eea',
    description: 'Full system access, user management, all permissions',
    permissions: ['NET_ACCESS', 'FS_READ', 'FS_WRITE', 'FS_PICKER', 'RUN_TOOL', 'SPAWN_PROCESS', 'CLIPBOARD', 'NOTIFICATIONS', 'TRAY_CONTROL', 'PREMIUM_TOOLS', 'MANAGE_USERS', 'VIEW_ALL_LOGS', 'SYSTEM_CONFIG', 'INSTALL_TOOLS']
  },
  {
    role: 'DEV',
    label: 'Developer',
    color: '#f5576c',
    description: 'Extended access, log viewing, tool installation',
    permissions: ['NET_ACCESS', 'FS_READ', 'FS_WRITE', 'FS_PICKER', 'RUN_TOOL', 'SPAWN_PROCESS', 'CLIPBOARD', 'NOTIFICATIONS', 'TRAY_CONTROL', 'PREMIUM_TOOLS', 'VIEW_ALL_LOGS', 'INSTALL_TOOLS']
  },
  {
    role: 'PREMIUM',
    label: 'Premium',
    color: '#f59e0b',
    description: 'Standard access with premium tools',
    permissions: ['NET_ACCESS', 'FS_READ', 'FS_WRITE', 'FS_PICKER', 'RUN_TOOL', 'SPAWN_PROCESS', 'CLIPBOARD', 'NOTIFICATIONS', 'TRAY_CONTROL', 'PREMIUM_TOOLS']
  },
  {
    role: 'USER',
    label: 'User',
    color: '#10b981',
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

function RolesSection() {
  return (
    <Card>
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Roles & Permissions</h3>
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', margin: '4px 0 0 0' }}>
          Permissions are role-driven. Assign roles in User Management to change what users can do.
        </p>
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
              <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: '13px', fontWeight: '600', color: 'var(--text-tertiary)', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)', minWidth: '120px' }}>
                Permission
              </th>
              {ROLE_DATA.map((r) => (
                <th key={r.role} style={{ padding: '10px 12px', textAlign: 'center', fontSize: '13px', fontWeight: '600', color: r.color, minWidth: '100px' }}>
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ALL_PERMISSIONS.map((perm) => (
              <tr key={perm} style={{ borderBottom: '1px solid var(--border-default)' }}>
                <td style={{ padding: '8px 12px', fontSize: '13px', color: 'var(--text-secondary)', position: 'sticky', left: 0, backgroundColor: 'var(--bg-secondary)' }}>
                  {PERM_LABELS[perm] || perm}
                </td>
                {ROLE_DATA.map((r) => {
                  const has = r.permissions.includes(perm);
                  return (
                    <td key={r.role} style={{ padding: '8px 12px', textAlign: 'center' }}>
                      {has ? (
                        <CheckCircle size={16} style={{ color: r.color }} />
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '16px' }}>—</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px', marginTop: '20px' }}>
        {ROLE_DATA.map((r) => (
          <div
            key={r.role}
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${r.color}30`,
              backgroundColor: `${r.color}08`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: r.color }}>{r.label}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{r.role}</span>
            </div>
            <p style={{ fontSize: '12px', color: 'var(--text-tertiary)', margin: 0 }}>{r.description}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default AdminPanel;
