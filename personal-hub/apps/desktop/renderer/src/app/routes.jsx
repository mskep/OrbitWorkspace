import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAppStore } from '../state/store';

// Pages
import Login from '../pages/Login';
import Home from '../pages/Home';
import Tools from '../pages/Tools';
import Links from '../pages/Links';
import Store from '../pages/Store';
import Profile from '../pages/Profile';
import Settings from '../pages/Settings';
import Offline from '../pages/Offline';

// Layout
import Sidebar from './layout/Sidebar';
import Workspace from './layout/Workspace';

function ProtectedRoute({ children }) {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function AppRoutes() {
  const isAuthenticated = useAppStore((state) => state.isAuthenticated);

  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />

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
                    <Route path="/links" element={<Links />} />
                    <Route path="/store" element={<Store />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/settings" element={<Settings />} />
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
