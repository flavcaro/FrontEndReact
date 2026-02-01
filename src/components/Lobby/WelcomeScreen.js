import React from 'react';
import Button from '../common/Button';
import classicGif from '../../sprites/logo.gif';

export default function WelcomeScreen({ onGuestLogin, onShowAuthForm, authError }) {
  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <div className="lobby-header">
          <div className="logo">
            <img src={classicGif} alt="SketchUp" style={{ width: '64px', height: '64px', imageRendering: 'pixelated' }} />
          </div>
          <h1>SketchUp</h1>
          <p>Disegna, indovina e divertiti con i tuoi amici!</p>
        </div>

        {authError && (
          <div style={{ 
            color: '#dc2626', 
            fontSize: '16px', 
            marginBottom: '20px',
            padding: '12px',
            background: '#fee2e2',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            ⚠️ {authError}
          </div>
        )}

        <div className="lobby-actions">
          <Button onClick={onGuestLogin} variant="primary" icon="👤">
            Gioca come Ospite
          </Button>

          <div className="divider">
            <span>oppure</span>
          </div>

          <Button onClick={onShowAuthForm} variant="secondary" icon="🔑">
            Accedi con un Account
          </Button>
        </div>

        <div className="info-box" style={{ marginTop: 24 }}>
          <span className="info-icon">💡</span>
          <span className="info-text">
            <strong>Modalità Ospite:</strong> Gioca subito senza registrazione.<br />
            <strong>Con Account:</strong> Salva i tuoi progressi e statistiche!
          </span>
        </div>
      </div>

      <div className="lobby-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
    </div>
  );
}