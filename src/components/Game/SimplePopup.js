import React from "react";
import { createPortal } from "react-dom";
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
  // Only render when `open` is truthy. This ensures confirm-style popups
  // (with onConfirm/onCancel/showCancel) are shown only when requested.
  if (!open) return null;

  const node = (
    <div className="simple-popup-overlay" onClick={onClose}>
      <div className="simple-popup" onClick={(e) => e.stopPropagation()}>
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

  // Render portal to body so popup is outside any stacking context of the canvas
  try {
    return createPortal(node, document.body);
  } catch (e) {
    // Fallback to inline render if portal fails (e.g., during SSR)
    return node;
  }
}
