import React from 'react';
import PropTypes from 'prop-types';

export default function Button({ 
  children, 
  onClick, 
  variant = 'primary', 
  size = 'normal',
  disabled = false,
  icon = null,
  className = ''
}) {
  const baseClass = 'lobby-btn';
  const variantClass = variant;
  const sizeClass = size === 'small' ? 'small' : '';
  
  return (
    <button 
      className={`${baseClass} ${variantClass} ${sizeClass} ${className}`.trim()}
      onClick={onClick}
      disabled={disabled}
    >
      {icon && <span className="btn-icon">{icon}</span>}
      <span className="btn-text">{children}</span>
    </button>
  );
}

Button.propTypes = {
  children: PropTypes.node.isRequired,
  onClick: PropTypes.func,
  variant: PropTypes.oneOf(['primary', 'secondary', 'tertiary']),
  size: PropTypes.oneOf(['normal', 'small']),
  disabled: PropTypes.bool,
  icon: PropTypes.string,
  className: PropTypes.string
};