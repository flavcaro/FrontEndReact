import React from 'react';
import Button from '../common/Button';
import Input from '../common/Input';

export default function AuthForm({ 
  email, 
  setEmail, 
  password, 
  setPassword, 
  isSignUp, 
  setIsSignUp, 
  authError, 
  onAuth, 
  onBack 
}) {
  return (
    <div className="lobby-container">
      <div className={`lobby-card ${isSignUp ? 'auth-signup' : 'auth-login'}`}>
        <div className="lobby-header">
          <div className="logo">🎨</div>
          <h1>SketchUp</h1>
          <p>{isSignUp ? "Crea un account" : "Accedi al tuo account"}</p>
        </div>

        <Input
          label="📧 Email"
          type="email"
          placeholder="Inserisci la tua email..."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />

        <Input
          label="🔒 Password"
          type="password"
          placeholder="Inserisci la password..."
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onAuth()}
        />

        {authError && (
          <div style={{ 
            color: '#dc2626', 
            fontSize: '16px', 
            marginTop: '10px',
            padding: '10px',
            background: '#fee2e2',
            borderRadius: '8px',
            textAlign: 'center'
          }}>
            ⚠️ {authError}
          </div>
        )}

        <div className="lobby-actions">
          <Button onClick={onAuth} variant="primary" icon={isSignUp ? "✨" : "🔑"}>
            {isSignUp ? "Registrati" : "Accedi"}
          </Button>

          <Button 
            onClick={() => setIsSignUp(!isSignUp)} 
            variant="secondary"
          >
            {isSignUp ? "Hai già un account? Accedi" : "Non hai un account? Registrati"}
          </Button>

          <div className="divider">
            <span>oppure</span>
          </div>

          <Button onClick={onBack} variant="tertiary" icon="◀">
            Torna Indietro
          </Button>
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