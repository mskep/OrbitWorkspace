import React from 'react';
import { X, AlertTriangle, CheckCircle, Info, AlertCircle } from 'lucide-react';

/**
 * Modal Component - Custom modal dialogs that respect the app's design system
 *
 * Types:
 * - confirm: Destructive confirmation with Cancel/Confirm (red)
 * - alert: Error/warning alert with OK button (red)
 * - info: Informational with OK button (accent blue)
 * - success: Success feedback with OK button (green)
 */

const TYPE_STYLES = {
  confirm: { icon: AlertTriangle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  alert: { icon: AlertCircle, color: '#ef4444', bg: 'rgba(239, 68, 68, 0.1)' },
  info: { icon: Info, color: '#6366f1', bg: 'rgba(99, 102, 241, 0.1)' },
  success: { icon: CheckCircle, color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' }
};

function Modal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  type = 'confirm',
  confirmText = 'Confirm',
  cancelText = 'Cancel'
}) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    onClose();
  };

  const style = TYPE_STYLES[type] || TYPE_STYLES.info;
  const Icon = style.icon;
  const hasCancel = type === 'confirm';
  const btnColor = type === 'confirm' || type === 'alert' ? '#ef4444' : type === 'success' ? '#10b981' : 'var(--accent)';

  return (
    <div
      className="modal-overlay"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        backdropFilter: 'blur(4px)',
        animation: 'modalFadeIn 0.15s ease'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-primary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-default)',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '500px',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
          animation: 'modalSlideIn 0.2s ease'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                padding: '8px',
                backgroundColor: style.bg,
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <Icon size={20} color={style.color} />
            </div>
            <h3
              style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '600',
                color: 'var(--text-primary)'
              }}
            >
              {title}
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '4px',
              background: 'none',
              border: 'none',
              color: 'var(--text-tertiary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              borderRadius: 'var(--radius-sm)',
              transition: 'all 0.2s'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
              e.currentTarget.style.color = 'var(--text-primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-tertiary)';
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Message */}
        <p
          style={{
            margin: '0 0 24px 0',
            fontSize: '14px',
            lineHeight: '1.6',
            color: 'var(--text-secondary)'
          }}
        >
          {message}
        </p>

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '12px',
            justifyContent: 'flex-end'
          }}
        >
          {hasCancel && (
            <button
              onClick={onClose}
              className="btn btn-secondary"
              style={{
                padding: '10px 20px',
                fontSize: '14px'
              }}
            >
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className="btn"
            style={{
              padding: '10px 20px',
              background: btnColor,
              color: '#fff',
              fontSize: '14px',
              fontWeight: '600'
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Modal;
