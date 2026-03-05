import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, Eye, EyeOff, Loader, LogOut, ShieldCheck, AlertCircle } from 'lucide-react';
import { useAppStore } from '../state/store';
import hubAPI from '../api/hubApi';
import orbitLogo from '../assets/orbitlogo.png';
import { useI18n } from '../i18n';

function Unlock() {
  const navigate = useNavigate();
  const { session, setSession, clearSession, setProfile, setUserSettings } = useAppStore();
  const { t } = useI18n();
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

        const [profile, settingsResult] = await Promise.all([
          hubAPI.profile.get(),
          hubAPI.settings.get(),
        ]);
        if (profile) setProfile(profile);
        if (settingsResult?.success && settingsResult.settings) setUserSettings(settingsResult.settings);

        navigate('/home');
      } else {
        setError(result.error || t('unlock.incorrectPassword'));
      }
    } catch (err) {
      setError(t('unlock.unlockFailed'));
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
      <div className="auth-mesh" />

      <div className="unlock-card">
        {/* Lock icon */}
        <div className="unlock-icon-ring">
          <div className="unlock-icon-inner">
            <Lock size={28} />
          </div>
        </div>

        {/* Logo & greeting */}
        <img src={orbitLogo} alt="Orbit" className="unlock-logo" />
        <h1 className="unlock-title">{t('unlock.sessionLocked')}</h1>
        <p className="unlock-subtitle">
          {session?.username ? t('unlock.welcomeBack', { username: session.username }) : t('unlock.welcomeBackGeneric')}
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
            <label>{t('auth.password')}</label>
            <div className="auth-input-wrapper">
              <Lock size={18} className="auth-input-icon" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => { setPassword(e.target.value); setError(''); }}
                placeholder={t('auth.enterPassword')}
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
              <><Loader size={18} className="auth-spinner" /> {t('unlock.unlocking')}</>
            ) : (
              <><ShieldCheck size={18} /> {t('unlock.unlock')}</>
            )}
          </button>
        </form>

        {/* Sign out link */}
        <div className="unlock-footer">
          <button className="unlock-signout" onClick={handleLogout}>
            <LogOut size={14} />
            {t('unlock.signOutInstead')}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Unlock;
