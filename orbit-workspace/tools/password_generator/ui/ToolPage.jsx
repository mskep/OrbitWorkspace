import React, { useState } from 'react';
import { Copy, RefreshCw, Shield, Eye, EyeOff } from 'lucide-react';
import Topbar from '../../../app/layout/Topbar';

function PasswordGeneratorPage() {
  const [password, setPassword] = useState('');
  const [strength, setStrength] = useState('medium');
  const [showPassword, setShowPassword] = useState(true);
  const [copied, setCopied] = useState(false);

  const [options, setOptions] = useState({
    length: 16,
    uppercase: true,
    lowercase: true,
    numbers: true,
    symbols: true,
    excludeSimilar: false,
    noDuplicates: false
  });

  const generatePassword = async () => {
    const result = await window.hubAPI.tools.run({
      toolId: 'password_generator',
      action: 'generate',
      payload: options
    });

    if (result.success) {
      setPassword(result.password);
      setStrength(result.strength);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const generatePreset = async (type) => {
    let result;
    if (type === 'pin') {
      result = await window.hubAPI.tools.run({
        toolId: 'password_generator',
        action: 'generatePIN',
        payload: { length: 4 }
      });
    } else if (type === 'memorable') {
      result = await window.hubAPI.tools.run({
        toolId: 'password_generator',
        action: 'generateMemorable',
        payload: {}
      });
    }

    if (result && result.success) {
      setPassword(result.password);
      setStrength(result.strength);
    }
  };

  const getStrengthColor = () => {
    const colors = {
      'weak': '#ef4444',
      'medium': '#f59e0b',
      'strong': '#10b981',
      'very strong': '#10b981'
    };
    return colors[strength] || '#64748b';
  };

  return (
    <div className="page">
      <Topbar title="Password Generator" />

      <div className="page-content">
        <div className="card" style={{ padding: '32px', maxWidth: '700px', margin: '0 auto' }}>
          {/* Password Display */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ position: 'relative', marginBottom: '16px' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                readOnly
                placeholder="Click 'Generate' to create password"
                style={{
                  width: '100%',
                  fontSize: '20px',
                  fontFamily: 'monospace',
                  padding: '20px',
                  paddingRight: '60px',
                  backgroundColor: 'var(--bg-tertiary)',
                  border: '2px solid var(--border-default)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  textAlign: 'center'
                }}
              />
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowPassword(!showPassword)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)' }}
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
              <Shield size={20} style={{ color: getStrengthColor() }} />
              <span style={{ color: getStrengthColor(), fontWeight: '600', textTransform: 'uppercase' }}>
                {strength}
              </span>
            </div>
          </div>

          {/* Options */}
          <div style={{
            padding: '24px',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-lg)',
            marginBottom: '24px'
          }}>
            <h3 style={{ marginBottom: '20px', fontSize: '16px' }}>Options</h3>

            <div style={{ marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>Length</label>
                <span style={{ fontSize: '14px', fontWeight: '600' }}>{options.length}</span>
              </div>
              <input
                type="range"
                min="8"
                max="64"
                value={options.length}
                onChange={(e) => setOptions({ ...options, length: parseInt(e.target.value) })}
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              {[
                { key: 'uppercase', label: 'Uppercase (A-Z)' },
                { key: 'lowercase', label: 'Lowercase (a-z)' },
                { key: 'numbers', label: 'Numbers (0-9)' },
                { key: 'symbols', label: 'Symbols (!@#$...)' },
                { key: 'excludeSimilar', label: 'Exclude Similar (i,l,1,O,0)' },
                { key: 'noDuplicates', label: 'No Duplicates' }
              ].map((option) => (
                <label key={option.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}>
                  <input
                    type="checkbox"
                    checked={options[option.key]}
                    onChange={(e) => setOptions({ ...options, [option.key]: e.target.checked })}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <button className="btn btn-primary btn-full" onClick={generatePassword}>
              <RefreshCw size={16} />
              Generate Password
            </button>
            <button
              className="btn btn-secondary"
              onClick={copyToClipboard}
              disabled={!password}
            >
              <Copy size={16} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Presets */}
          <div>
            <h4 style={{ marginBottom: '12px', fontSize: '14px', color: 'var(--text-secondary)' }}>
              Quick Presets
            </h4>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary btn-sm" onClick={() => generatePreset('pin')}>
                PIN (4 digits)
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => generatePreset('memorable')}>
                Memorable
              </button>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setOptions({
                    length: 32,
                    uppercase: true,
                    lowercase: true,
                    numbers: true,
                    symbols: true,
                    excludeSimilar: true,
                    noDuplicates: false
                  });
                }}
              >
                Max Security
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PasswordGeneratorPage;
