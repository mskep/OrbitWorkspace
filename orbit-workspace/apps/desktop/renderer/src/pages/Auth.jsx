import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, LogIn, UserPlus, Loader, Download, ShieldCheck, FileKey, AlertCircle } from 'lucide-react';
import { useAppStore } from '../state/store';
import hubAPI from '../api/hubApi';
import orbitLogo from '../assets/orbitlogo.png';
import { useI18n } from '../i18n';

function Auth() {
  const navigate = useNavigate();
  const { setSession, setProfile, setUserSettings } = useAppStore();
  const { t } = useI18n();

  const [mode, setMode] = useState('login'); // 'login', 'register', 'recover'
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [recoveryPrompt, setRecoveryPrompt] = useState(null);

  const [formData, setFormData] = useState({
    identifier: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
  });

  // Recovery state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [recoveryFile, setRecoveryFile] = useState(null); // { filePath, fileName }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    if (error) setError('');
    if (success) setSuccess('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await hubAPI.auth.login({
        identifier: formData.identifier,
        password: formData.password,
      });

      if (result.success) {
        setSession(result.session);
        const [profileResult, settingsResult] = await Promise.all([
          hubAPI.profile.get(),
          hubAPI.settings.get(),
        ]);
        if (profileResult) setProfile(profileResult);
        if (settingsResult?.success && settingsResult.settings) setUserSettings(settingsResult.settings);

        if (result.cryptoMigrated && result.recoveryFileContent) {
          setRecoveryPrompt({
            content: result.recoveryFileContent,
            username: result.session.username
          });
        } else {
          navigate('/home');
        }
      } else {
        setError(result.error || t('auth.invalidCredentials'));
      }
    } catch (err) {
      setError(t('auth.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.password.length < 8) {
      setError(t('auth.passwordMin8'));
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordsNoMatch'));
      setLoading(false);
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(formData.username) || formData.username.length < 3) {
      setError(t('auth.usernameRule'));
      setLoading(false);
      return;
    }

    try {
      const result = await hubAPI.auth.register({
        email: formData.email,
        username: formData.username,
        password: formData.password
      });

      if (result.success) {
        // Session is already established by register — just fetch it
        const session = await hubAPI.auth.getSession();
        setSession(session);
        const [profileResult, settingsResult] = await Promise.all([
          hubAPI.profile.get(),
          hubAPI.settings.get(),
        ]);
        if (profileResult) setProfile(profileResult);
        if (settingsResult?.success && settingsResult.settings) setUserSettings(settingsResult.settings);

        if (result.recoveryFileContent) {
          setRecoveryPrompt({
            content: result.recoveryFileContent,
            username: formData.username
          });
        } else {
          navigate('/home');
        }
      } else {
        setError(result.error || t('auth.connectionError'));
      }
    } catch (err) {
      setError(t('auth.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  // Recovery: pick file first, then submit
  const handlePickRecoveryFile = async () => {
    try {
      const result = await hubAPI.crypto.pickRecoveryFile();
      if (result) {
        setRecoveryFile(result);
        if (error) setError('');
      }
    } catch (err) {
      setError(t('auth.recoveryOpenPickerFail'));
    }
  };

  const handleRecover = async (e) => {
    e.preventDefault();
    setError('');

    if (!recoveryFile) {
      setError(t('auth.recoverySelectFile'));
      return;
    }

    if (newPassword.length < 8) {
      setError(t('auth.passwordMin8'));
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError(t('auth.passwordsNoMatch'));
      return;
    }

    setLoading(true);

    try {
      const result = await hubAPI.crypto.recoverWithFile({
        newPassword: newPassword,
        filePath: recoveryFile.filePath
      });

      if (result.success) {
        setMode('login');
        setSuccess(t('auth.recoveryResetSuccess'));
        setNewPassword('');
        setConfirmNewPassword('');
        setRecoveryFile(null);
      } else {
        setError(result.error || t('auth.recoveryFail'));
      }
    } catch (err) {
      setError(t('auth.recoveryFail'));
    } finally {
      setLoading(false);
    }
  };

  const handleSaveRecoveryFile = async () => {
    if (!recoveryPrompt) return;
    try {
      await hubAPI.crypto.saveRecoveryFile({
        content: recoveryPrompt.content,
        username: recoveryPrompt.username
      });
    } catch (err) {
      console.error('Failed to save recovery file:', err);
    }
    setRecoveryPrompt(null);
    navigate('/home');
  };

  const handleSkipRecovery = () => {
    setRecoveryPrompt(null);
    navigate('/home');
  };

  const switchMode = (newMode) => {
    setMode(newMode);
    setError('');
    setSuccess('');
    setFormData({ identifier: '', email: '', username: '', password: '', confirmPassword: '' });
    setNewPassword('');
    setConfirmNewPassword('');
    setRecoveryFile(null);
  };

  const titles = {
    login: { title: t('auth.signIn'), subtitle: t('auth.brandSubtitle') },
    register: { title: t('auth.createAccount'), subtitle: t('auth.brandSubtitle') },
    recover: { title: t('auth.resetPassword'), subtitle: t('auth.recoveryInfo') },
  };

  return (
    <div className="auth-page">
      <div className="auth-mesh" />

      <div className="auth-card">
        {/* Header */}
        <img src={orbitLogo} alt="Orbit" className="auth-card-logo" />
        <h1 className="auth-card-title">{titles[mode].title}</h1>
        <p className="auth-card-subtitle">{titles[mode].subtitle}</p>

        {/* Tabs — only for login/register */}
        {mode !== 'recover' && (
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
              disabled={loading}
            >
              <LogIn size={15} />
              {t('auth.signIn')}
            </button>
            <button
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => switchMode('register')}
              disabled={loading}
            >
              <UserPlus size={15} />
              {t('auth.register')}
            </button>
          </div>
        )}

        {/* Alerts */}
        {error && (
          <div className="auth-alert auth-alert-error">
            <AlertCircle size={16} />
            {error}
          </div>
        )}
        {success && (
          <div className="auth-alert auth-alert-success">
            <ShieldCheck size={16} />
            {success}
          </div>
        )}

        {/* Login Form */}
        {mode === 'login' && (
          <form onSubmit={handleLogin} className="auth-form">
            <div className="auth-input-group">
              <label>{t('auth.emailOrUsername')}</label>
              <div className="auth-input-wrapper">
                <User size={18} className="auth-input-icon" />
                <input
                  type="text"
                  name="identifier"
                  placeholder={t('auth.enterEmailOrUsername')}
                  value={formData.identifier}
                  onChange={handleChange}
                  required
                  autoComplete="username"
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label>{t('auth.password')}</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder={t('auth.enterPassword')}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="current-password"
                />
                <button type="button" className="auth-toggle-pw" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="auth-options">
              <button type="button" className="auth-link" onClick={() => switchMode('recover')}>
                {t('auth.forgotPassword')}
              </button>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-full auth-submit" disabled={loading}>
              {loading ? (
                <><Loader size={18} className="auth-spinner" /> {t('auth.signingIn')}</>
              ) : (
                <><LogIn size={18} /> {t('auth.signIn')}</>
              )}
            </button>
          </form>
        )}

        {/* Register Form */}
        {mode === 'register' && (
          <form onSubmit={handleRegister} className="auth-form">
            <div className="auth-input-group">
              <label>{t('auth.email')}</label>
              <div className="auth-input-wrapper">
                <Mail size={18} className="auth-input-icon" />
                <input
                  type="email"
                  name="email"
                  placeholder="your@email.com"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                  autoFocus
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label>{t('auth.username')}</label>
              <div className="auth-input-wrapper">
                <User size={18} className="auth-input-icon" />
                <input
                  type="text"
                  name="username"
                  placeholder={t('auth.usernamePlaceholder')}
                  value={formData.username}
                  onChange={handleChange}
                  required
                  autoComplete="username"
                  pattern="[a-zA-Z0-9_\\-]{3,32}"
                  title={t('auth.usernameTitle')}
                />
              </div>
            </div>

            <div className="auth-input-group">
              <label>{t('auth.password')}</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder={t('auth.min8')}
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
                <button type="button" className="auth-toggle-pw" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="auth-input-group">
              <label>{t('auth.confirmPassword')}</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  placeholder={t('auth.repeatPassword')}
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-full auth-submit" disabled={loading}>
              {loading ? (
                <><Loader size={18} className="auth-spinner" /> {t('auth.creatingAccount')}</>
              ) : (
                <><UserPlus size={18} /> {t('auth.createAccount')}</>
              )}
            </button>
          </form>
        )}

        {/* Recovery Form */}
        {mode === 'recover' && (
          <form onSubmit={handleRecover} className="auth-form">
            <div className="auth-input-group">
              <label>{t('auth.recoveryFile')}</label>
              <button
                type="button"
                className={`auth-file-picker ${recoveryFile ? 'has-file' : ''}`}
                onClick={handlePickRecoveryFile}
              >
                <FileKey size={18} />
                <span>{recoveryFile ? recoveryFile.fileName : t('auth.selectRecoveryFile')}</span>
                {recoveryFile && <ShieldCheck size={16} className="auth-file-check" />}
              </button>
            </div>

            <div className="auth-input-group">
              <label>{t('auth.newPassword')}</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.min8')}
                  value={newPassword}
                  onChange={(e) => { setNewPassword(e.target.value); if (error) setError(''); }}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" className="auth-toggle-pw" onClick={() => setShowPassword(!showPassword)}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="auth-input-group">
              <label>{t('auth.confirmNewPassword')}</label>
              <div className="auth-input-wrapper">
                <Lock size={18} className="auth-input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder={t('auth.repeatNewPassword')}
                  value={confirmNewPassword}
                  onChange={(e) => { setConfirmNewPassword(e.target.value); if (error) setError(''); }}
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-lg btn-full auth-submit" disabled={loading}>
              {loading ? (
                <><Loader size={18} className="auth-spinner" /> {t('auth.recovering')}</>
              ) : (
                <><ShieldCheck size={18} /> {t('auth.resetPassword')}</>
              )}
            </button>

            <button type="button" className="auth-back-link" onClick={() => switchMode('login')}>
              {t('auth.backToSignIn')}
            </button>
          </form>
        )}

        {/* Footer */}
        <div className="auth-footer">
          Orbit v0.1.0
        </div>
      </div>

      {/* Recovery File Save Prompt */}
      {recoveryPrompt && (
        <div className="auth-overlay">
          <div className="auth-modal">
            <div className="auth-modal-icon">
              <ShieldCheck size={32} />
            </div>
            <h2>{t('auth.saveRecoveryTitle')}</h2>
            <p>{t('auth.saveRecoveryText')}</p>
            <button className="btn btn-primary btn-lg btn-full" onClick={handleSaveRecoveryFile}>
              <Download size={18} />
              {t('auth.downloadRecoveryFile')}
            </button>
            <button className="auth-skip-btn" onClick={handleSkipRecovery}>
              {t('auth.skipForNow')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Auth;
