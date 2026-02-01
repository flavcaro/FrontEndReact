import React from 'react';

export default function Input({
  label,
  value,
  onChange,
  onKeyDown,
  placeholder = '',
  maxLength,
  type = 'text',
  disabled = false,
  className = '',
  autoFocus = false
}) {
  return (
    <div className="lobby-section">
      {label && <label className="lobby-label">{label}</label>}
      <input
        type={type}
        className={`lobby-input ${className}`.trim()}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        maxLength={maxLength}
        disabled={disabled}
        autoFocus={autoFocus}
        spellCheck={false}
      />
    </div>
  );
}