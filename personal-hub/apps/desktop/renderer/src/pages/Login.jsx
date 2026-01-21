import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../state/store';
import hubAPI from '../api/hubApi';
import orbitLogo from '../assets/orbitlogo.png';

function Login() {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const { setSession, setProfile } = useAppStore();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await hubAPI.auth.login({ username, password, rememberMe });

      if (result.success) {
        setSession(result.session);

        // Load profile
        const profile = await hubAPI.profile.get();
        setProfile(profile);

        // Smooth transition before navigation
        await new Promise((resolve) => setTimeout(resolve, 300));
        navigate('/home');
      } else {
        setError(result.error || 'Login failed');
        setLoading(false);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      console.error('Login error:', err);
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <img
            src={orbitLogo}
            alt="Orbit Logo"
            style={{
              height: '160px',
              marginBottom: '24px',
              filter: 'drop-shadow(0 4px 12px rgba(0, 0, 0, 0.1))'
            }}
          />
          <p className="login-subtitle">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="form-group">
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                disabled={loading}
                style={{ margin: 0 }}
              />
              <span>Remember me</span>
            </label>
          </div>

          {error && <div className="error-message">{error}</div>}

          <button type="submit" className="btn btn-primary" disabled={loading} style={{ width: '100%' }}>
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;
