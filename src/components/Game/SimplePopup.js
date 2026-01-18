import React from "react";
import "./SimplePopup.css";

export default function SimplePopup({ open, message, onClose }) {
  if (!open) return null;
  return (
    <div className="simple-popup-overlay">
      <div className="simple-popup">
        <div className="simple-popup-message">{message}</div>
        <button className="simple-popup-btn" onClick={onClose}>OK</button>
      </div>
    </div>
  );
}
