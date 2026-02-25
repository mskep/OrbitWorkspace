import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader, LogOut, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAppStore } from '../state/store';
import hubAPI from '../api/hubApi';
import orbitLogo from '../assets/orbitlogo.png';

function Unlock() {
  const navigate = useNavigate();
  const { session, setSession, clearSession, setProfile } = useAppStore();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleUnlock = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await hubAPI.auth.unlockSession({ password });

      if (result.success) {
        const updatedSession = await hubAPI.auth.getSession();
        setSession(updatedSession);

        const profile = await hubAPI.profile.get();
        if (profile) setProfile(profile);

        navigate('/home');
      } else {
        setError(result.error || 'Incorrect password');
      }
    } catch (err) {
      setError('Failed to unlock. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await hubAPI.auth.logout();
    clearSession();
    navigate('/login');
  };

  return (
    <div className="auth-page">
      {/* Animated background */}
      <div className="auth-bg">
        <div className="auth-bg-orb auth-bg-orb-1" />
        <div className="auth-bg-orb auth-bg-orb-2" />
        <div className="auth-bg-orb auth-bg-orb-3" />
        <div className="auth-bg-grid" />
      </div>

      <div className="unlock-card">
        {/* Lock icon */}
        <div className="unlock-icon-ring">
          <div className="unlock-icon-inner">
            <Lock size={28} />
          </div>
        </div>

        {/* Logo & greeting */}
        <img src={orbitLogo} alt="Orbit" className="unlock-logo" />
        <h1 className="unlock-title">Session Locked</h1>
        <p className="unlock-subtitle">
          Welcome back{session?.username ? <>, <span className="unlock-username">{session.username}</span></> : ''}.
          Enter your password to continue.
        </p>

        {/* Error */}
        {error && (
          <div className="auth-alert auth-alert-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleUnlock} className="unlock-form">
          <div className="auth-input-group">
            <label>Password</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                placeholder="Enter your password"
                required
                autoFocus
              />
              <button
                type="button"
                className="auth-toggle-pw"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg btn-full auth-submit"
            disabled={loading || !password}
          >
            {loading ? (
              <><Loader size={18} className="auth-spinner" /> Unlocking...</>
            ) : (
              <><ShieldCheck size={18} /> Unlock</>
            )}
          </button>
        </form>

        {/* Sign out link */}
        <div className="unlock-footer">
          <button className="unlock-signout" onClick={handleLogout}>
            <LogOut size={14} />
            Sign out instead
          </button>
        </div>
      </div>
    </div>
  );
}

export default Unlock;
