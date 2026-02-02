import React from 'react';
import Button from '../common/Button';
import Input from '../common/Input';
import logoGif from '../../sprites/logo.gif';

export default function AuthForm({ 
  email, 
  setEmail, 
  password, 
  setPassword, 
  isSignUp, 
  setIsSignUp, 
  authError, 
  onAuth, 
  onGoogleAuth,
  onBack 
}) {
  return (
    <div className="lobby-container">
      <div className={`lobby-card ${isSignUp ? 'auth-signup' : 'auth-login'}`}>
        <div className="lobby-header">
          <div className="logo">
            <img src={logoGif} alt="SketchUp" style={{ width: '72px', height: '72px', imageRendering: 'pixelated' }} />
          </div>
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
          <Button onClick={() => { console.log('AuthForm: primary clicked', { email, isSignUp }); onAuth && onAuth(); }} variant="primary" icon={isSignUp ? "✨" : "🔑"}>
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

          <Button 
            onClick={onGoogleAuth} 
            variant="secondary"
            style={{
              background: 'white',
              color: '#1f2937',
              border: '2px solid #e5e7eb',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              fontWeight: '600'
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continua con Google
          </Button>

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