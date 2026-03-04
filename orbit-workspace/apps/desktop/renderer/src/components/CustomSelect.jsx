import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

/**
 * Custom dropdown select component — replaces native <select> with a
 * modern, styled dropdown that matches the app's design system.
 *
 * @param {Object} props
 * @param {string} props.value - Currently selected value
 * @param {function} props.onChange - Called with the new value when selection changes
 * @param {Array<{value: string, label: string, color?: string, icon?: React.ReactNode}>} props.options
 * @param {boolean} [props.disabled]
 * @param {string} [props.placeholder]
 * @param {'sm'|'md'} [props.size] - 'sm' for compact (table cells), 'md' for standard
 * @param {number} [props.minWidth]
 */
function CustomSelect({
  value,
  onChange,
  options = [],
  disabled = false,
  placeholder = 'Select...',
  size = 'md',
  minWidth = 0,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const listRef = useRef(null);

  const selected = options.find((o) => o.value === value);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open]);

  // Scroll active item into view when opening
  useEffect(() => {
    if (open && listRef.current) {
      const active = listRef.current.querySelector('[data-active="true"]');
      if (active) active.scrollIntoView({ block: 'nearest' });
    }
  }, [open]);

  const isSm = size === 'sm';

  // These styles are heavily dependent on props (size, open, disabled, selected color)
  // so they remain inline as dynamic computed styles
  const triggerStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: isSm ? '4px' : '8px',
    padding: isSm ? '4px 8px' : '8px 12px',
    fontSize: isSm ? '12px' : '13px',
    fontWeight: '500',
    fontFamily: 'inherit',
    borderRadius: isSm ? 'var(--radius-sm)' : 'var(--radius-md)',
    border: '1px solid',
    borderColor: open ? 'var(--accent-primary)' : 'var(--border-default)',
    backgroundColor: open ? 'var(--bg-elevated)' : 'var(--bg-tertiary)',
    color: selected?.color || 'var(--text-primary)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    outline: 'none',
    transition: 'all 150ms ease',
    minWidth: minWidth || (isSm ? 0 : '140px'),
    position: 'relative',
    userSelect: 'none',
    boxShadow: open ? '0 0 0 3px var(--accent-glow)' : 'none',
    whiteSpace: 'nowrap',
  };

  const dropdownStyle = {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: '4px',
    zIndex: 'var(--z-dropdown)',
    backgroundColor: 'var(--bg-secondary)',
    border: '1px solid var(--border-strong)',
    borderRadius: 'var(--radius-md)',
    padding: '4px',
    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.04)',
    maxHeight: '240px',
    overflowY: 'auto',
    minWidth: 'max-content',
    animation: 'customSelectFadeIn 120ms ease-out',
  };

  const handleSelect = (optValue) => {
    if (optValue !== value) {
      onChange(optValue);
    }
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        style={triggerStyle}
        disabled={disabled}
      >
        {selected?.icon && <span className="flex-center" style={{ lineHeight: 1 }}>{selected.icon}</span>}
        <span>{selected?.label || placeholder}</span>
        <ChevronDown
          size={isSm ? 12 : 14}
          style={{
            marginLeft: 'auto',
            color: 'var(--text-tertiary)',
            transition: 'transform 150ms ease',
            transform: open ? 'rotate(180deg)' : 'rotate(0)',
            flexShrink: 0,
          }}
        />
      </button>

      {open && (
        <div ref={listRef} style={dropdownStyle}>
          {options.map((opt) => {
            const isActive = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                data-active={isActive}
                onClick={() => handleSelect(opt.value)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  width: '100%',
                  padding: isSm ? '6px 8px' : '8px 10px',
                  fontSize: isSm ? '12px' : '13px',
                  fontWeight: isActive ? '600' : '400',
                  fontFamily: 'inherit',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  backgroundColor: isActive ? 'var(--accent-glow)' : 'transparent',
                  color: opt.color || (isActive ? 'var(--accent-primary)' : 'var(--text-primary)'),
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background-color 100ms ease',
                  outline: 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = isActive ? 'var(--accent-glow)' : 'transparent';
                }}
              >
                {opt.icon && <span className="flex-center" style={{ lineHeight: 1, flexShrink: 0 }}>{opt.icon}</span>}
                <span style={{ flex: 1 }}>{opt.label}</span>
                {isActive && (
                  <Check
                    size={14}
                    style={{ color: 'var(--accent-primary)', flexShrink: 0 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CustomSelect;
