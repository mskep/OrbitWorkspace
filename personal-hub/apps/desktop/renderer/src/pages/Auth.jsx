import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, LogIn, UserPlus, Loader, Download, ShieldCheck, FileKey, AlertCircle } from 'lucide-react';
import { useAppStore } from '../state/store';
import hubAPI from '../api/hubApi';
import orbitLogo from '../assets/orbitlogo.png';

function Auth() {
  const navigate = useNavigate();
  const { setSession, setProfile } = useAppStore();

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
    rememberMe: false
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
        rememberMe: formData.rememberMe
      });

      if (result.success) {
        setSession(result.session);
        const profileResult = await hubAPI.profile.get();
        if (profileResult) setProfile(profileResult);

        if (result.cryptoMigrated && result.recoveryFileContent) {
          setRecoveryPrompt({
            content: result.recoveryFileContent,
            username: result.session.username
          });
        } else {
          navigate('/home');
        }
      } else {
        setError(result.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
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
        const loginResult = await hubAPI.auth.login({
          identifier: formData.username,
          password: formData.password,
          rememberMe: true
        });

        if (loginResult.success) {
          setSession(loginResult.session);
          const profileResult = await hubAPI.profile.get();
          if (profileResult) setProfile(profileResult);

          if (result.recoveryFileContent) {
            setRecoveryPrompt({
              content: result.recoveryFileContent,
              username: formData.username
            });
          } else {
            navigate('/home');
          }
        } else {
          setMode('login');
          setFormData((prev) => ({ ...prev, identifier: formData.username }));
          setSuccess('Account created! Please sign in.');
        }
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
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
      setError('Failed to open file picker.');
    }
  };

  const handleRecover = async (e) => {
    e.preventDefault();
    setError('');

    if (!recoveryFile) {
      setError('Please select your recovery file first.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setError('Passwords do not match');
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
        setSuccess('Password reset successful! Please sign in with your new password.');
        setNewPassword('');
        setConfirmNewPassword('');
        setRecoveryFile(null);
      } else {
        setError(result.error || 'Recovery failed. Check your file and try again.');
      }
    } catch (err) {
      setError('Recovery failed. Please try again.');
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
    setFormData({ identifier: '', email: '', username: '', password: '', confirmPassword: '', rememberMe: false });
    setNewPassword('');
    setConfirmNewPassword('');
    setRecoveryFile(null);
  };

  return (
    <div className="auth-page">
      {/* Ambient background */}
      <div className="auth-bg">
        <div className="auth-bg-orb auth-bg-orb-1" />
        <div className="auth-bg-orb auth-bg-orb-2" />
        <div className="auth-bg-orb auth-bg-orb-3" />
        <div className="auth-bg-grid" />
      </div>

      <div className="auth-container">
        {/* Left: Branding */}
        <div className="auth-brand">
          <img src={orbitLogo} alt="Orbit" className="auth-logo" />
          <h1 className="auth-brand-title">Orbit</h1>
          <p className="auth-brand-subtitle">Your secure productivity hub</p>
          <div className="auth-brand-features">
            <div className="auth-feature">
              <ShieldCheck size={16} />
              <span>Zero-knowledge encryption</span>
            </div>
            <div className="auth-feature">
              <Lock size={16} />
              <span>Local-first, private by design</span>
            </div>
            <div className="auth-feature">
              <FileKey size={16} />
              <span>Recovery file backup</span>
            </div>
          </div>
        </div>

        {/* Right: Form */}
        <div className="auth-form-section">
          {/* Mode tabs */}
          <div className="auth-tabs">
            <button
              className={`auth-tab ${mode === 'login' ? 'active' : ''}`}
              onClick={() => switchMode('login')}
              disabled={loading}
            >
              <LogIn size={16} />
              Sign In
            </button>
            <button
              className={`auth-tab ${mode === 'register' ? 'active' : ''}`}
              onClick={() => switchMode('register')}
              disabled={loading}
            >
              <UserPlus size={16} />
              Register
            </button>
          </div>

          {/* Error / Success */}
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
                <label>Email or Username</label>
                <div className="auth-input-wrapper">
                  <User size={18} className="auth-input-icon" />
                  <input
                    type="text"
                    name="identifier"
                    placeholder="Enter your email or username"
                    value={formData.identifier}
                    onChange={handleChange}
                    required
                    autoComplete="username"
                    autoFocus
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label>Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={18} className="auth-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Enter your password"
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
                <label className="auth-checkbox">
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                  />
                  <span>Remember me</span>
                </label>
                <button type="button" className="auth-link" onClick={() => switchMode('recover')}>
                  Forgot password?
                </button>
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-full auth-submit" disabled={loading}>
                {loading ? (
                  <><Loader size={18} className="auth-spinner" /> Signing in...</>
                ) : (
                  <><LogIn size={18} /> Sign In</>
                )}
              </button>
            </form>
          )}

          {/* Register Form */}
          {mode === 'register' && (
            <form onSubmit={handleRegister} className="auth-form">
              <div className="auth-input-group">
                <label>Email</label>
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
                <label>Username</label>
                <div className="auth-input-wrapper">
                  <User size={18} className="auth-input-icon" />
                  <input
                    type="text"
                    name="username"
                    placeholder="3-20 characters, letters & numbers"
                    value={formData.username}
                    onChange={handleChange}
                    required
                    autoComplete="username"
                    pattern="[a-zA-Z0-9_]{3,20}"
                    title="3-20 characters, letters, numbers, and underscores only"
                  />
                </div>
              </div>

              <div className="auth-input-group">
                <label>Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={18} className="auth-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    placeholder="Min 6 characters"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                    minLength={6}
                  />
                  <button type="button" className="auth-toggle-pw" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="auth-input-group">
                <label>Confirm Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={18} className="auth-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    placeholder="Repeat your password"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    required
                    autoComplete="new-password"
                    minLength={6}
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-full auth-submit" disabled={loading}>
                {loading ? (
                  <><Loader size={18} className="auth-spinner" /> Creating account...</>
                ) : (
                  <><UserPlus size={18} /> Create Account</>
                )}
              </button>
            </form>
          )}

          {/* Recovery Form */}
          {mode === 'recover' && (
            <form onSubmit={handleRecover} className="auth-form">
              <div className="auth-recover-info">
                <FileKey size={24} />
                <p>
                  Orbit uses zero-knowledge encryption. To reset your password,
                  you need the recovery file generated when you created your account.
                </p>
              </div>

              <div className="auth-input-group">
                <label>Recovery File</label>
                <button
                  type="button"
                  className={`auth-file-picker ${recoveryFile ? 'has-file' : ''}`}
                  onClick={handlePickRecoveryFile}
                >
                  <FileKey size={18} />
                  <span>{recoveryFile ? recoveryFile.fileName : 'Select recovery file...'}</span>
                  {recoveryFile && <ShieldCheck size={16} className="auth-file-check" />}
                </button>
              </div>

              <div className="auth-input-group">
                <label>New Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={18} className="auth-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Min 6 characters"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); if (error) setError(''); }}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button type="button" className="auth-toggle-pw" onClick={() => setShowPassword(!showPassword)}>
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="auth-input-group">
                <label>Confirm New Password</label>
                <div className="auth-input-wrapper">
                  <Lock size={18} className="auth-input-icon" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Repeat new password"
                    value={confirmNewPassword}
                    onChange={(e) => { setConfirmNewPassword(e.target.value); if (error) setError(''); }}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <button type="submit" className="btn btn-primary btn-lg btn-full auth-submit" disabled={loading}>
                {loading ? (
                  <><Loader size={18} className="auth-spinner" /> Recovering...</>
                ) : (
                  <><ShieldCheck size={18} /> Reset Password</>
                )}
              </button>

              <button type="button" className="auth-back-link" onClick={() => switchMode('login')}>
                Back to Sign In
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="auth-footer">
            Orbit v0.1.0
          </div>
        </div>
      </div>

      {/* Recovery File Save Prompt (post-register/migrate) */}
      {recoveryPrompt && (
        <div className="auth-overlay">
          <div className="auth-modal">
            <div className="auth-modal-icon">
              <ShieldCheck size={32} />
            </div>
            <h2>Save Your Recovery Key</h2>
            <p>
              This is your <strong>only way</strong> to recover your data if you forget your password.
              Orbit uses zero-knowledge encryption — we cannot reset your password for you.
              <br />Save this file somewhere safe.
            </p>
            <button className="btn btn-primary btn-lg btn-full" onClick={handleSaveRecoveryFile}>
              <Download size={18} />
              Download Recovery File
            </button>
            <button className="auth-skip-btn" onClick={handleSkipRecovery}>
              Skip for now (not recommended)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Auth;
