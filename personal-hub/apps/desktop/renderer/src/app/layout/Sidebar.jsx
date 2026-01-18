import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Home,
  Wrench,
  Link,
  ShoppingBag,
  User,
  Settings,
  WifiOff
} from 'lucide-react';
import { useAppStore } from '../../state/store';
import orbitLogo from '../../assets/orbitlogo.png';

function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isOnline = useAppStore((state) => state.isOnline);

  const menuItems = [
    { id: 'home', label: 'Dashboard', icon: <Home size={20} />, path: '/home' },
    { id: 'tools', label: 'My Tools', icon: <Wrench size={20} />, path: '/tools' },
    { id: 'links', label: 'Quick Links', icon: <Link size={20} />, path: '/links' },
    { id: 'store', label: 'Tool Store', icon: <ShoppingBag size={20} />, path: '/store' },
    { id: 'profile', label: 'Profile', icon: <User size={20} />, path: '/profile' },
    { id: 'settings', label: 'Settings', icon: <Settings size={20} />, path: '/settings' }
  ];

  const isActive = (path) => location.pathname.startsWith(path);

  return (
    <div className="sidebar">
      <div className="sidebar-header" style={{ paddingTop: '12px', paddingBottom: '12px' }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '8px'
        }}>
          <img
            src={orbitLogo}
            alt="Orbit Logo"
            style={{
              height: '64px',
              filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))'
            }}
          />
        </div>
        {!isOnline && (
          <div className="offline-indicator">
            <WifiOff size={12} style={{ marginRight: '4px' }} />
            Offline
          </div>
        )}
      </div>

      <nav className="sidebar-nav">
        {menuItems.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${isActive(item.path) ? 'active' : ''}`}
            onClick={() => navigate(item.path)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            <span className="sidebar-label">{item.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

export default Sidebar;
