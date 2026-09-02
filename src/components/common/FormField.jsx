import React, { useId } from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Reusable Accessible Form Field Component
 * Tự động liên kết label (htmlFor) với input (id), hỗ trợ required indicator, hint và error message.
 */
export const FormField = ({
  label,
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  required = false,
  disabled = false,
  error,
  hint,
  rows = 3,
  min,
  max,
  step,
  options = [], // [{ value: '...', label: '...' }] cho type="select"
  children,
  style = {},
  inputStyle = {},
  ...props
}) => {
  const generatedId = useId();
  const fieldId = id || `field-${generatedId}`;
  const errorId = `${fieldId}-error`;
  const hintId = `${fieldId}-hint`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      {label && (
        <label
          htmlFor={fieldId}
          style={{
            fontSize: '0.875rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            cursor: 'pointer',
          }}
        >
          <span>{label}</span>
          {required && <span style={{ color: 'var(--danger-500)', fontWeight: '700' }}>*</span>}
        </label>
      )}

      {children ? (
        children
      ) : type === 'textarea' ? (
        <textarea
          id={fieldId}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          rows={rows}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: error ? '1px solid var(--danger-500)' : '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-page)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            resize: 'vertical',
            outline: 'none',
            ...inputStyle,
          }}
          {...props}
        />
      ) : type === 'select' ? (
        <select
          id={fieldId}
          value={value}
          onChange={onChange}
          required={required}
          disabled={disabled}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: error ? '1px solid var(--danger-500)' : '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-page)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            outline: 'none',
            ...inputStyle,
          }}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={fieldId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          min={min}
          max={max}
          step={step}
          aria-invalid={!!error}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
          style={{
            width: '100%',
            padding: '10px 14px',
            borderRadius: 'var(--radius-md)',
            border: error ? '1px solid var(--danger-500)' : '1px solid var(--border-subtle)',
            backgroundColor: 'var(--bg-page)',
            color: 'var(--text-primary)',
            fontSize: '0.875rem',
            fontFamily: 'inherit',
            outline: 'none',
            ...inputStyle,
          }}
          {...props}
        />
      )}

      {error && (
        <div
          id={errorId}
          role="alert"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '0.8125rem',
            color: 'var(--danger-600)',
          }}
        >
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}

      {hint && !error && (
        <span id={hintId} style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
          {hint}
        </span>
      )}
    </div>
  );
};
