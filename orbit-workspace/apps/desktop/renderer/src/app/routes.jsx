import React from 'react';
import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from '../state/store';

// Pages
import Auth from '../pages/Auth';
import Unlock from '../pages/Unlock';
import Home from '../pages/Home';
import Tools from '../pages/Tools';
import SecretVault from '../pages/SecretVault';
import Notes from '../pages/Notes';
import Links from '../pages/Links';
import InboxPage from '../pages/Inbox';
import Profile from '../pages/Profile';
import Settings from '../pages/Settings';
import AdminPanel from '../pages/AdminPanel';
import Offline from '../pages/Offline';

// Layout
import Sidebar from './layout/Sidebar';
import Workspace from './layout/Workspace';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);
  const needsUnlock = useAppStore((state) => state.needsUnlock);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (needsUnlock) {
    return <Navigate to="/unlock" replace />;
  }

  return children;
}

function AdminRoute({ children }) {
  const profile = useAppStore((state) => state.profile);
  const role = profile?.role;

  if (role !== 'ADMIN' && role !== 'DEV') {
    return <Navigate to="/home" replace />;
  }

  return children;
}

function AppRoutes() {
  const Router = window.location.protocol === 'file:' ? HashRouter : BrowserRouter;

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Auth />} />
        <Route path="/unlock" element={<Unlock />} />

        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <div style={{ display: 'flex', height: 'calc(100vh - 32px)' }}>
                <Sidebar />
                <Workspace>
                  <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/home" element={<Home />} />
                    <Route path="/tools" element={<Tools />} />
                    <Route path="/tools/:toolId" element={<Tools />} />
                    <Route path="/vault" element={<SecretVault />} />
                    <Route path="/notes" element={<Notes />} />
                    <Route path="/links" element={<Links />} />
                    <Route path="/inbox" element={<InboxPage />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
                    <Route path="/admin" element={<AdminRoute><AdminPanel /></AdminRoute>} />
                    <Route path="/offline" element={<Offline />} />
                  </Routes>
                </Workspace>
              </div>
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}

export default AppRoutes;
