import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield,
  Users,
  Key,
  Activity,
  Database,
  Settings as SettingsIcon,
  AlertTriangle,
  User,
  Clock,
  Search,
  ChevronUp,
  ChevronDown,
  Award,
  Plus,
  X,
  CheckCircle
} from 'lucide-react';
import Card from '../components/Card';
import { useAppStore } from '../state/store';
import hubAPI from '../api/hubApi';

function AdminPanel() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    try {
      setLoading(true);
      const [statsResult, usersResult] = await Promise.all([hubAPI.admin.getStats(), hubAPI.admin.getUsers()]);

      if (statsResult.success) {
        setStats(statsResult.stats);
      }

      if (usersResult.success) {
        setUsers(usersResult.users);
      }
    } catch (error) {
      console.error('Failed to load admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Sections disponibles
  const sections = [
    { id: 'overview', label: 'Overview', icon: Shield },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'roles', label: 'Roles & Permissions', icon: Key },
    { id: 'logs', label: 'System Logs', icon: Activity },
    { id: 'database', label: 'Database', icon: Database },
    { id: 'system', label: 'System Config', icon: SettingsIcon }
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
        {activeTab === 'roles' && <RolesSection />}
        {activeTab === 'logs' && <LogsSection />}
        {activeTab === 'database' && <DatabaseSection />}
        {activeTab === 'system' && <SystemSection />}
      </div>
    </div>
  );
}

// Overview Section
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

// Helper function to format dates safely
function formatDate(ts) {
  if (!ts || ts <= 0) return '—';
  const msTs = ts < 1e12 ? ts * 1000 : ts;
  return new Date(msTs).toLocaleDateString();
}

// Users Section
function UsersSection({ users, loading, onRefresh }) {
  const profile = useAppStore((state) => state.profile);
  const [updatingUser, setUpdatingUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'created_at', direction: 'desc' });
  const [expandedUser, setExpandedUser] = useState(null); // userId or null
  const [allBadges, setAllBadges] = useState([]);
  const [userBadges, setUserBadges] = useState({}); // { userId: [badgeId, ...] }
  const [badgeLoading, setBadgeLoading] = useState(false);

  useEffect(() => {
    loadBadges();
  }, []);

  const loadBadges = async () => {
    try {
      const result = await hubAPI.badges.getAll();
      if (result.success) setAllBadges(result.badges);
    } catch (err) {
      console.error('Failed to load badges:', err);
    }
  };

  const loadUserBadges = async (userId) => {
    try {
      const result = await hubAPI.badges.getUserBadges({ userId });
      if (result.success) {
        setUserBadges((prev) => ({
          ...prev,
          [userId]: result.badges.map((b) => b.id)
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
      if (!userBadges[userId]) {
        await loadUserBadges(userId);
      }
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
      if (result.success) {
        onRefresh();
      }
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
      if (result.success) {
        onRefresh();
      }
    } catch (error) {
      console.error('Failed to update user status:', error);
    } finally {
      setUpdatingUser(null);
    }
  };

  // Check if user is the current admin (can't modify self)
  const isSelf = (userId) => profile?.id === userId;

  // Handle sorting
  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Filter and sort users
  const filteredAndSortedUsers = useMemo(() => {
    let result = [...users];

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (user) => user.username?.toLowerCase().includes(query) || user.email?.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      let aVal = a[sortConfig.key];
      let bVal = b[sortConfig.key];

      // Handle string comparison
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

  // Sortable header component
  const SortableHeader = ({ label, sortKey }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th
        onClick={() => handleSort(sortKey)}
        style={{
          padding: '12px',
          textAlign: 'left',
          fontSize: '13px',
          fontWeight: '600',
          color: isActive ? 'var(--accent)' : 'var(--text-tertiary)',
          cursor: 'pointer',
          userSelect: 'none'
        }}
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
            Manage user accounts, roles, and permissions
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ position: 'relative' }}>
            <Search
              size={16}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-tertiary)'
              }}
            />
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                padding: '8px 12px 8px 34px',
                fontSize: '13px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                backgroundColor: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                width: '220px',
                outline: 'none'
              }}
            />
          </div>
        </div>
      </div>

      {filteredAndSortedUsers.length === 0 ? (
        <div
          style={{
            padding: '40px',
            textAlign: 'center',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-md)'
          }}
        >
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
                return (
                  <React.Fragment key={user.id}>
                  <tr
                    style={{ borderBottom: '1px solid var(--border-default)', opacity: isCurrentUser ? 0.7 : 1 }}
                  >
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            backgroundColor: 'var(--accent-glow)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          <User size={16} color="var(--accent)" />
                        </div>
                        <div>
                          <span style={{ fontSize: '14px', fontWeight: '500' }}>{user.username}</span>
                          {isCurrentUser && (
                            <span
                              style={{ marginLeft: '8px', fontSize: '11px', color: 'var(--accent)', fontWeight: '600' }}
                            >
                              (You)
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>{user.email}</td>
                    <td style={{ padding: '12px' }}>
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                        disabled={updatingUser === user.id || isCurrentUser}
                        title={isCurrentUser ? 'You cannot modify your own role' : ''}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-default)',
                          backgroundColor: 'var(--bg-tertiary)',
                          color: 'var(--text-primary)',
                          cursor: updatingUser === user.id || isCurrentUser ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <option value="USER">User</option>
                        <option value="PREMIUM">Premium</option>
                        <option value="DEV">Developer</option>
                        <option value="ADMIN">Admin</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <select
                        value={user.status}
                        onChange={(e) => handleUpdateStatus(user.id, e.target.value)}
                        disabled={updatingUser === user.id || isCurrentUser}
                        title={isCurrentUser ? 'You cannot modify your own status' : ''}
                        style={{
                          padding: '4px 8px',
                          fontSize: '12px',
                          fontWeight: '600',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-default)',
                          backgroundColor: isActive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          color: isActive ? '#10b981' : '#ef4444',
                          cursor: updatingUser === user.id || isCurrentUser ? 'not-allowed' : 'pointer'
                        }}
                      >
                        <option value="active">Active</option>
                        <option value="disabled">Disabled</option>
                      </select>
                    </td>
                    <td style={{ padding: '12px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '13px',
                          color: 'var(--text-tertiary)'
                        }}
                      >
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
                          {(userBadges[user.id] || []).length || 0}
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

// Roles Section
function RolesSection() {
  return (
    <Card>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Roles & Permissions</h3>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
        Configure roles and manage permissions
      </p>
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <Key size={48} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Role management features coming soon</p>
      </div>
    </Card>
  );
}

// Logs Section
function LogsSection() {
  return (
    <Card>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>System Logs</h3>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
        View and analyze system logs
      </p>
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <Activity size={48} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Advanced log viewer coming soon</p>
      </div>
    </Card>
  );
}

// Database Section
function DatabaseSection() {
  return (
    <Card>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Database Management</h3>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
        Manage database, backups, and maintenance
      </p>
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <Database size={48} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>Database tools coming soon</p>
      </div>
    </Card>
  );
}

// System Section
function SystemSection() {
  return (
    <Card>
      <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>System Configuration</h3>
      <p style={{ fontSize: '14px', color: 'var(--text-tertiary)', marginBottom: '20px' }}>
        Configure system settings and preferences
      </p>
      <div
        style={{
          padding: '40px',
          textAlign: 'center',
          backgroundColor: 'var(--bg-tertiary)',
          borderRadius: 'var(--radius-md)'
        }}
      >
        <SettingsIcon size={48} color="var(--text-tertiary)" style={{ marginBottom: '16px' }} />
        <p style={{ fontSize: '14px', color: 'var(--text-tertiary)' }}>System configuration coming soon</p>
      </div>
    </Card>
  );
}

export default AdminPanel;
