import React from "react";
import "./SimplePopup.css";

export default function SimplePopup({ 
  open, 
  message, 
  onClose,
  emoji,
  title,
  onConfirm,
  onCancel,
  confirmText = "OK",
  cancelText = "Annulla",
  showCancel = false
}) {
  // Backward compatibility: if only open/message/onClose are provided
  const isSimpleMode = !emoji && !title && !onConfirm && !onCancel && !showCancel;
  
  if (!open && isSimpleMode) return null;
  
  // Per PuzzleBoard: mostra il popup se non c'è 'open' prop o se showStartPopup è true
  const shouldShow = isSimpleMode ? open : true;
  if (!shouldShow) return null;

  return (
    <div className="simple-popup-overlay">
      <div className="simple-popup">
        {emoji && <div style={{ fontSize: '48px', marginBottom: '16px' }}>{emoji}</div>}
        {title && <h2 style={{ margin: '0 0 16px 0', fontSize: '24px', fontWeight: '700' }}>{title}</h2>}
        <div className="simple-popup-message">{message}</div>
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px', justifyContent: 'center' }}>
          {onConfirm && (
            <button 
              className="simple-popup-btn" 
              onClick={onConfirm}
              disabled={!onConfirm}
              style={{
                opacity: onConfirm ? 1 : 0.5,
                cursor: onConfirm ? 'pointer' : 'not-allowed'
              }}
            >
              {confirmText}
            </button>
          )}
          {!onConfirm && !showCancel && (
            <button className="simple-popup-btn" onClick={onClose}>OK</button>
          )}
          {showCancel && (
            <button 
              className="simple-popup-btn" 
              onClick={onCancel || onClose}
              style={{ background: '#64748b' }}
            >
              {cancelText}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
