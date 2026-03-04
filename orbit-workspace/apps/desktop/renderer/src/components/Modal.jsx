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
  confirm: { icon: AlertTriangle, color: 'var(--status-error)', bg: 'var(--status-error-glow)' },
  alert: { icon: AlertCircle, color: 'var(--status-error)', bg: 'var(--status-error-glow)' },
  info: { icon: Info, color: 'var(--accent-primary)', bg: 'var(--accent-glow)' },
  success: { icon: CheckCircle, color: 'var(--status-success)', bg: 'var(--status-success-glow)' }
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
  const btnColor = type === 'confirm' || type === 'alert' ? 'var(--status-error)' : type === 'success' ? 'var(--status-success)' : 'var(--accent-primary)';

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-header-left">
            <div className="modal-icon-wrap" style={{ backgroundColor: style.bg }}>
              <Icon size={20} color={style.color} />
            </div>
            <h3 className="modal-title">{title}</h3>
          </div>
          <button onClick={onClose} className="modal-close-btn">
            <X size={20} />
          </button>
        </div>

        {/* Message */}
        <p className="modal-message">{message}</p>

        {/* Actions */}
        <div className="modal-actions">
          {hasCancel && (
            <button onClick={onClose} className="btn btn-secondary modal-btn">
              {cancelText}
            </button>
          )}
          <button
            onClick={handleConfirm}
            className="btn modal-confirm-btn"
            style={{ background: btnColor }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

export default Modal;
