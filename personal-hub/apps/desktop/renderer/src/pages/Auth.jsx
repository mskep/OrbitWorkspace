import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, LogIn, UserPlus, Loader } from 'lucide-react';
import { useAppStore } from '../state/store';
import hubAPI from '../api/hubApi';
import orbitLogo from '../assets/orbitlogo.png';

function Auth() {
  const navigate = useNavigate();
  const { setSession, setProfile } = useAppStore();

  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    identifier: '', // email or username for login
    email: '', // for register
    username: '', // for register
    password: '',
    rememberMe: false
  });

  // Handle input change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    // Clear error on input change
    if (error) setError('');
  };

  // Handle login
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

        // Get profile
        const profileResult = await hubAPI.profile.get();
        if (profileResult) {
          setProfile(profileResult);
        }

        navigate('/home');
      } else {
        setError(result.error || 'Authentication failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Handle register
  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await hubAPI.auth.register({
        email: formData.email,
        username: formData.username,
        password: formData.password
      });

      if (result.success) {
        // Auto-login after successful registration
        const loginResult = await hubAPI.auth.login({
          identifier: formData.username,
          password: formData.password,
          rememberMe: true
        });

        if (loginResult.success) {
          setSession(loginResult.session);

          const profileResult = await hubAPI.profile.get();
          if (profileResult) {
            setProfile(profileResult);
          }

          navigate('/home');
        } else {
          // Registration success but login failed, switch to login mode
          setMode('login');
          setFormData((prev) => ({ ...prev, identifier: formData.username }));
          setError('Account created! Please log in.');
        }
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Switch mode
  const switchMode = () => {
    setMode(mode === 'login' ? 'register' : 'login');
    setError('');
    setFormData({
      identifier: '',
      email: '',
      username: '',
      password: '',
      rememberMe: false
    });
  };

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* Animated background */}
      <div
        style={{
          position: 'absolute',
          width: '100%',
          height: '100%',
          opacity: 0.05,
          background: `
          radial-gradient(circle at 20% 50%, #667eea 0%, transparent 50%),
          radial-gradient(circle at 80% 80%, #764ba2 0%, transparent 50%),
          radial-gradient(circle at 40% 20%, #f093fb 0%, transparent 50%)
        `,
          animation: 'float 20s ease-in-out infinite'
        }}
      />

      {/* Auth Card */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '440px',
          margin: '0 20px',
          animation: 'slideUp 0.6s ease-out'
        }}
      >
        {/* Logo */}
        <div
          style={{
            textAlign: 'center',
            marginBottom: '32px'
          }}
        >
          <img
            src={orbitLogo}
            alt="Orbit"
            style={{
              height: '80px',
              marginBottom: '16px',
              filter: 'drop-shadow(0 4px 12px rgba(102, 126, 234, 0.3))',
              animation: 'pulse 3s ease-in-out infinite'
            }}
          />
          <h1
            style={{
              fontSize: '32px',
              fontWeight: '700',
              margin: 0,
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              letterSpacing: '-0.5px'
            }}
          >
            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
          </h1>
          <p
            style={{
              fontSize: '14px',
              color: 'var(--text-tertiary)',
              marginTop: '8px'
            }}
          >
            {mode === 'login' ? 'Sign in to continue to Orbit' : 'Join Orbit and get started'}
          </p>
        </div>

        {/* Auth Form Card */}
        <div
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            padding: '40px',
            border: '1px solid var(--border-default)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
            backdropFilter: 'blur(10px)'
          }}
        >
          <form onSubmit={mode === 'login' ? handleLogin : handleRegister}>
            {/* Error Message */}
            {error && (
              <div
                style={{
                  padding: '12px 16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  marginBottom: '24px',
                  fontSize: '14px',
                  color: '#ef4444',
                  animation: 'shake 0.5s ease'
                }}
              >
                {error}
              </div>
            )}

            {/* Register Fields */}
            {mode === 'register' && (
              <>
                <InputField
                  icon={Mail}
                  type="email"
                  name="email"
                  placeholder="Email address"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  autoComplete="email"
                />

                <InputField
                  icon={User}
                  type="text"
                  name="username"
                  placeholder="Username (3-20 characters)"
                  value={formData.username}
                  onChange={handleChange}
                  required
                  autoComplete="username"
                  pattern="[a-zA-Z0-9_]{3,20}"
                  title="3-20 characters, letters, numbers, and underscores only"
                />
              </>
            )}

            {/* Login Field */}
            {mode === 'login' && (
              <InputField
                icon={User}
                type="text"
                name="identifier"
                placeholder="Email or Username"
                value={formData.identifier}
                onChange={handleChange}
                required
                autoComplete="username"
              />
            )}

            {/* Password Field */}
            <div style={{ position: 'relative', marginBottom: '20px' }}>
              <InputField
                icon={Lock}
                type={showPassword ? 'text' : 'password'}
                name="password"
                placeholder={mode === 'register' ? 'Password (min 6 characters)' : 'Password'}
                value={formData.password}
                onChange={handleChange}
                required
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                minLength={mode === 'register' ? 6 : undefined}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-tertiary)',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'color var(--transition-fast)'
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-tertiary)')}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {/* Remember Me (Login only) */}
            {mode === 'login' && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  marginBottom: '24px'
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <input
                    type="checkbox"
                    name="rememberMe"
                    checked={formData.rememberMe}
                    onChange={handleChange}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer',
                      accentColor: '#667eea'
                    }}
                  />
                  <span>Remember me</span>
                </label>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all var(--transition-fast)',
                opacity: loading ? 0.7 : 1,
                transform: loading ? 'scale(0.98)' : 'scale(1)',
                boxShadow: '0 4px 12px rgba(102, 126, 234, 0.4)'
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.5)';
                }
              }}
              onMouseLeave={(e) => {
                if (!loading) {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.4)';
                }
              }}
            >
              {loading ? (
                <>
                  <Loader size={18} style={{ animation: 'spin 1s linear infinite' }} />
                  <span>{mode === 'login' ? 'Signing in...' : 'Creating account...'}</span>
                </>
              ) : (
                <>
                  {mode === 'login' ? <LogIn size={18} /> : <UserPlus size={18} />}
                  <span>{mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                </>
              )}
            </button>
          </form>

          {/* Switch Mode */}
          <div
            style={{
              marginTop: '24px',
              textAlign: 'center',
              fontSize: '14px',
              color: 'var(--text-tertiary)'
            }}
          >
            {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
            <button
              onClick={switchMode}
              disabled={loading}
              style={{
                background: 'none',
                border: 'none',
                color: '#667eea',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                textDecoration: 'none',
                transition: 'color var(--transition-fast)'
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.color = '#764ba2')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.color = '#667eea')}
            >
              {mode === 'login' ? 'Create one' : 'Sign in'}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            textAlign: 'center',
            marginTop: '24px',
            fontSize: '12px',
            color: 'var(--text-tertiary)'
          }}
        >
          Orbit v1.0.0 - Secure & Simple
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(30px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.05);
          }
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) rotate(0deg);
          }
          33% {
            transform: translate(30px, -30px) rotate(120deg);
          }
          66% {
            transform: translate(-20px, 20px) rotate(240deg);
          }
        }

        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// Input Field Component
function InputField({ icon: Icon, style, ...props }) {
  return (
    <div style={{ position: 'relative', marginBottom: '16px', ...style }}>
      <div
        style={{
          position: 'absolute',
          left: '16px',
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--text-tertiary)',
          pointerEvents: 'none'
        }}
      >
        <Icon size={18} />
      </div>
      <input
        {...props}
        style={{
          width: '100%',
          padding: '14px 16px 14px 48px',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-md)',
          fontSize: '15px',
          color: 'var(--text-primary)',
          outline: 'none',
          transition: 'all var(--transition-fast)',
          boxSizing: 'border-box'
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#667eea';
          e.target.style.boxShadow = '0 0 0 3px rgba(102, 126, 234, 0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'var(--border-default)';
          e.target.style.boxShadow = 'none';
        }}
      />
    </div>
  );
}

export default Auth;
