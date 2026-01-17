# Updated Page Files - Ready to Apply

This document contains the complete updated code for each page component. Copy the code sections below to replace your existing page files.

---

## 1. HOME PAGE (Enhanced Dashboard)

**File**: `apps/desktop/renderer/src/pages/Home.jsx`

```jsx
import React, { useEffect, useState } from 'react';
import {
  Zap,
  Activity,
  Cpu,
  ShieldCheck,
  ArrowUpRight,
  Sparkles,
  Wifi,
  WifiOff
} from 'lucide-react';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import { useNavigate } from 'react-router-dom';
import Card from '../components/Card';
import Badge from '../components/Badge';
import Skeleton from '../components/Skeleton';

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
        hubAPI.logs.tail({ limit: 5 }),
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
        {/* Hero Section */}
        <section className="hero">
          <div className="hero-content">
            <Badge
              variant="primary"
              icon={<Sparkles size={14} />}
              size="md"
              className="mb-4"
              style={{ marginBottom: '16px' }}
            >
              SYSTEM READY
            </Badge>

            <h1 className="hero-title">Welcome back, User</h1>
            <p className="hero-subtitle">
              Your personal productivity hub is optimized and running smoothly.
              Manage your tools and workflows from one central dashboard.
            </p>
          </div>
        </section>

        {/* Dashboard Cards */}
        <div className="tool-grid">
          {/* System Status Card */}
          <Card padding="md" hover gradient>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                padding: '10px',
                background: 'var(--accent-glow)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-primary)',
                display: 'flex'
              }}>
                <Cpu size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>System Status</h3>
            </div>

            {isLoading ? (
              <Skeleton count={3} height="24px" />
            ) : systemStatus ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Connection</span>
                  <Badge
                    variant={systemStatus.online ? 'success' : 'error'}
                    icon={systemStatus.online ? <Wifi size={14} /> : <WifiOff size={14} />}
                  >
                    {systemStatus.online ? 'Online' : 'Offline'}
                  </Badge>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Platform</span>
                  <span style={{ fontWeight: 600, textTransform: 'capitalize' }}>
                    {systemStatus.platform}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px' }}>
                  <span style={{ color: 'var(--text-tertiary)' }}>Security</span>
                  <span style={{ color: 'var(--status-success)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={14} /> Active
                  </span>
                </div>
              </div>
            ) : (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>Unable to load status</p>
            )}
          </Card>

          {/* Recent Activity Card */}
          <Card padding="md" hover gradient>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                padding: '10px',
                background: 'var(--accent-glow)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-primary)',
                display: 'flex'
              }}>
                <Activity size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Recent Activity</h3>
            </div>

            {isLoading ? (
              <Skeleton count={5} height="20px" />
            ) : recentActions.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {recentActions.map((action, i) => (
                  <div key={i} style={{ fontSize: '13px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 500 }}>{action.type}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: '12px' }}>
                      {new Date(action.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--text-tertiary)', fontSize: '14px' }}>No recent activity</p>
            )}
          </Card>

          {/* Quick Actions Card */}
          <Card padding="md" hover gradient>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
              <div style={{
                padding: '10px',
                background: 'var(--accent-glow)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--accent-primary)',
                display: 'flex'
              }}>
                <Zap size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: '18px' }}>Quick Actions</h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={() => navigate('/tools')}
                className="btn btn-secondary btn-full"
                style={{ justifyContent: 'space-between' }}
              >
                Open My Tools <ArrowUpRight size={16} />
              </button>
              <button
                onClick={() => navigate('/store')}
                className="btn btn-secondary btn-full"
                style={{ justifyContent: 'space-between' }}
              >
                Browse Store <ArrowUpRight size={16} />
              </button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default Home;
```

---

## 2. TOOLS PAGE (Enhanced with Sorting & Empty State)

**File**: `apps/desktop/renderer/src/pages/Tools.jsx`

```jsx
import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowUpDown, Package } from 'lucide-react';
import hubAPI from '../api/hubApi';
import Topbar from '../app/layout/Topbar';
import ToolCard from '../components/ToolCard';
import SearchBar from '../components/SearchBar';
import TagFilter from '../components/TagFilter';
import EmptyState from '../components/EmptyState';
import Skeleton from '../components/Skeleton';

function Tools() {
  const { toolId } = useParams();
  const [tools, setTools] = useState([]);
  const [filteredTools, setFilteredTools] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [sortBy, setSortBy] = useState('name');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTools();
  }, []);

  useEffect(() => {
    filterAndSortTools();
  }, [tools, searchQuery, selectedTags, sortBy]);

  async function loadTools() {
    try {
      const toolsList = await hubAPI.tools.list();
      setTools(toolsList || []);

      // Extract unique tags
      const tags = new Set();
      toolsList.forEach((tool) => {
        if (tool.tags) {
          tool.tags.forEach((tag) => tags.add(tag));
        }
      });
      setAllTags(Array.from(tags));
    } catch (error) {
      console.error('Error loading tools:', error);
    } finally {
      setIsLoading(false);
    }
  }

  function filterAndSortTools() {
    let filtered = [...tools];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (tool) =>
          tool.name.toLowerCase().includes(query) ||
          tool.description?.toLowerCase().includes(query) ||
          tool.tags?.some((tag) => tag.toLowerCase().includes(query))
      );
    }

    // Tag filter
    if (selectedTags.length > 0) {
      filtered = filtered.filter((tool) =>
        selectedTags.every((tag) => tool.tags?.includes(tag))
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    setFilteredTools(filtered);
  }

  function handleTagToggle(tag) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  if (toolId) {
    // Show specific tool page
    return (
      <div className="page">
        <Topbar title="Tool Details" />
        <div className="page-content">
          <p>Tool page for: {toolId}</p>
          <p>Tool UI will be loaded here</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <Topbar title="My Tools" />

      <div className="page-content">
        <div className="tools-header">
          <div className="tools-controls">
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search tools..."
            />

            <div className="sort-dropdown">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="sort-button"
                style={{
                  appearance: 'none',
                  background: 'var(--bg-tertiary) url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'12\' height=\'12\' viewBox=\'0 0 12 12\'%3e%3cpath fill=\'%2394a3b8\' d=\'M6 9L1 4h10z\'/%3e%3c/svg%3e") no-repeat right 12px center',
                  paddingRight: '32px'
                }}
              >
                <option value="name">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
              </select>
            </div>
          </div>

          {allTags.length > 0 && (
            <TagFilter
              tags={allTags}
              selectedTags={selectedTags}
              onTagToggle={handleTagToggle}
            />
          )}
        </div>

        {isLoading ? (
          <div className="tools-grid">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} style={{
                background: 'var(--bg-secondary)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                border: '1px solid var(--border-default)'
              }}>
                <Skeleton width="100%" height="40px" style={{ marginBottom: '16px' }} />
                <Skeleton count={3} height="16px" />
              </div>
            ))}
          </div>
        ) : filteredTools.length > 0 ? (
          <div className="tools-grid">
            {filteredTools.map((tool) => (
              <ToolCard key={tool.id} tool={tool} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Package size={64} />}
            title={searchQuery || selectedTags.length > 0 ? 'No tools found' : 'No tools installed'}
            description={
              searchQuery || selectedTags.length > 0
                ? 'Try adjusting your search or filters'
                : 'Browse the store to install your first tool'
            }
            action={
              <button
                className="btn btn-primary"
                onClick={() => window.location.href = '/store'}
              >
                Browse Store
              </button>
            }
          />
        )}
      </div>
    </div>
  );
}

export default Tools;
```

---

## 3. STORE PAGE (Complete Implementation)

**File**: `apps/desktop/renderer/src/pages/Store.jsx`

```jsx
import React, { useState } from 'react';
import { Store as StoreIcon, Star, TrendingUp, Download, Sparkles } from 'lucide-react';
import Topbar from '../app/layout/Topbar';
import Card from '../components/Card';
import Badge from '../components/Badge';

// Mock store data (replace with real API later)
const MOCK_TOOLS = [
  {
    id: 'video_downloader_pro',
    name: 'Video Downloader Pro',
    description: 'Download videos from multiple platforms with quality options',
    icon: '🎥',
    tags: ['media', 'download'],
    premium: true,
    featured: true,
    rating: 4.8,
    downloads: 12500
  },
  {
    id: 'advanced_pdf_tools',
    name: 'Advanced PDF Tools',
    description: 'Merge, split, compress, and convert PDF files',
    icon: '📄',
    tags: ['productivity', 'pdf'],
    premium: false,
    new: true,
    rating: 4.6,
    downloads: 8200
  },
  {
    id: 'image_optimizer',
    name: 'Image Optimizer',
    description: 'Batch compress and resize images without quality loss',
    icon: '🖼️',
    tags: ['media', 'optimization'],
    premium: false,
    popular: true,
    rating: 4.7,
    downloads: 15300
  },
  {
    id: 'code_formatter',
    name: 'Code Formatter',
    description: 'Auto-format code for multiple programming languages',
    icon: '💻',
    tags: ['development', 'tools'],
    premium: true,
    new: true,
    rating: 4.9,
    downloads: 6700
  },
  {
    id: 'link_manager',
    name: 'Link Manager',
    description: 'Organize and categorize your bookmarks efficiently',
    icon: '🔗',
    tags: ['productivity', 'organization'],
    premium: false,
    popular: true,
    rating: 4.5,
    downloads: 11400
  },
  {
    id: 'clipboard_history',
    name: 'Clipboard History',
    description: 'Never lose copied content with unlimited history',
    icon: '📋',
    tags: ['utility', 'productivity'],
    premium: true,
    featured: true,
    rating: 4.8,
    downloads: 9800
  }
];

function StoreToolCard({ tool }) {
  const [isInstalled, setIsInstalled] = useState(false);

  return (
    <Card padding="md" hover gradient>
      <div className="tool-card-header">
        <span className="tool-icon">{tool.icon}</span>
        {tool.premium && (
          <Badge variant="premium" size="sm">PRO</Badge>
        )}
        {tool.featured && !tool.premium && (
          <Badge variant="primary" icon={<Sparkles size={12} />} size="sm">Featured</Badge>
        )}
        {tool.new && (
          <Badge variant="success" size="sm">New</Badge>
        )}
      </div>

      <h3 className="tool-name">{tool.name}</h3>
      <p className="tool-description">{tool.description}</p>

      <div className="tool-tags">
        {tool.tags.map((tag) => (
          <span key={tag} className="tool-tag">{tag}</span>
        ))}
      </div>

      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '16px',
        paddingTop: '16px',
        borderTop: '1px solid var(--border-default)'
      }}>
        <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: 'var(--text-tertiary)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Star size={14} fill="var(--status-warning)" color="var(--status-warning)" />
            {tool.rating}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Download size={14} />
            {(tool.downloads / 1000).toFixed(1)}k
          </span>
        </div>

        <button
          className={`btn btn-${isInstalled ? 'secondary' : 'primary'} btn-sm`}
          onClick={() => setIsInstalled(!isInstalled)}
          disabled={isInstalled}
        >
          {isInstalled ? 'Installed' : 'Install'}
        </button>
      </div>
    </Card>
  );
}

function Store() {
  const featuredTools = MOCK_TOOLS.filter(t => t.featured);
  const newTools = MOCK_TOOLS.filter(t => t.new);
  const popularTools = MOCK_TOOLS.filter(t => t.popular);

  return (
    <div className="page">
      <Topbar title="Tool Store" />

      <div className="page-content">
        {/* Hero Section */}
        <div className="store-hero">
          <div className="store-hero-content">
            <Badge
              variant="primary"
              icon={<StoreIcon size={14} />}
              size="lg"
              style={{ marginBottom: '16px' }}
            >
              TOOL MARKETPLACE
            </Badge>

            <h1 style={{ fontSize: '36px', fontWeight: '800', marginBottom: '12px' }}>
              Discover Premium Tools
            </h1>
            <p style={{
              fontSize: '17px',
              color: 'var(--text-secondary)',
              maxWidth: '600px',
              margin: '0 auto 24px'
            }}>
              Extend your productivity hub with curated tools for video, PDF, images, and more.
            </p>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Badge variant="default">
                {MOCK_TOOLS.length} Tools Available
              </Badge>
              <Badge variant="success">
                {MOCK_TOOLS.filter(t => !t.premium).length} Free
              </Badge>
              <Badge variant="warning">
                {MOCK_TOOLS.filter(t => t.premium).length} Premium
              </Badge>
            </div>
          </div>
        </div>

        {/* Featured Section */}
        {featuredTools.length > 0 && (
          <div className="store-section">
            <div className="store-section-header">
              <h2 className="store-section-title">
                <Sparkles size={24} style={{ display: 'inline', marginRight: '8px', color: 'var(--accent-primary)' }} />
                Featured Tools
              </h2>
            </div>
            <div className="store-grid">
              {featuredTools.map((tool) => (
                <StoreToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        )}

        {/* New Section */}
        {newTools.length > 0 && (
          <div className="store-section">
            <div className="store-section-header">
              <h2 className="store-section-title">
                <Star size={24} style={{ display: 'inline', marginRight: '8px', color: 'var(--status-success)' }} />
                New Releases
              </h2>
            </div>
            <div className="store-grid">
              {newTools.map((tool) => (
                <StoreToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        )}

        {/* Popular Section */}
        {popularTools.length > 0 && (
          <div className="store-section">
            <div className="store-section-header">
              <h2 className="store-section-title">
                <TrendingUp size={24} style={{ display: 'inline', marginRight: '8px', color: 'var(--status-warning)' }} />
                Most Popular
              </h2>
            </div>
            <div className="store-grid">
              {popularTools.map((tool) => (
                <StoreToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Store;
```

---

## 4. PROFILE PAGE (Enhanced with Avatar & Tooltips)

**File**: `apps/desktop/renderer/src/pages/Profile.jsx`

**Instructions**: This update is more complex. The key changes are:
1. Add profile avatar component
2. Section headers with icons
3. Use Toast notifications for permission toggles

I recommend keeping your existing Profile.jsx as-is for now, or add the avatar element manually:

```jsx
// Add this before the existing profile sections
<div className="profile-header">
  <div className="profile-avatar">
    {profile?.username ? profile.username[0].toUpperCase() : 'U'}
  </div>
  <div className="profile-info">
    <h2 className="profile-name">{profile?.username || 'User'}</h2>
    <p className="profile-meta">
      {profile?.premium && <Badge variant="premium" size="sm">Premium</Badge>}
      {' '} Member since {new Date(profile?.created || Date.now()).toLocaleDateString()}
    </p>
  </div>
</div>
```

---

## 5. OFFLINE PAGE (Enhanced)

**File**: `apps/desktop/renderer/src/pages/Offline.jsx`

```jsx
import React from 'react';
import { WifiOff, RefreshCw } from 'lucide-react';
import EmptyState from '../components/EmptyState';

function Offline() {
  const handleRetry = () => {
    window.location.reload();
  };

  return (
    <div className="page">
      <div className="page-content" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%'
      }}>
        <EmptyState
          icon={<WifiOff size={96} />}
          title="You're Offline"
          description="Some features require an internet connection. Please check your network and try again."
          action={
            <button className="btn btn-primary" onClick={handleRetry}>
              <RefreshCw size={16} />
              Try Reconnecting
            </button>
          }
        />

        <div style={{ marginTop: '32px', maxWidth: '500px' }}>
          <h3 style={{ fontSize: '18px', marginBottom: '16px', textAlign: 'center' }}>
            What you can still do:
          </h3>
          <ul style={{
            listStyle: 'none',
            padding: 0,
            color: 'var(--text-secondary)',
            textAlign: 'left'
          }}>
            <li style={{ padding: '8px 0' }}>✓ Use installed tools (if they don't require internet)</li>
            <li style={{ padding: '8px 0' }}>✓ View your activity history</li>
            <li style={{ padding: '8px 0' }}>✓ Manage permissions and settings</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default Offline;
```

---

## Summary

All the code above is ready to copy-paste into your project. The CSS and component library are already in place, so these page updates will immediately benefit from:

- ✨ Modern card components with hover effects
- 🎨 Gradient accents and glows
- 💫 Smooth animations and transitions
- 🧩 Reusable Badge and EmptyState components
- 📱 Responsive grid layouts

Apply them one at a time and test in your running dev environment!
