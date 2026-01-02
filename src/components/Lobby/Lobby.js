import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth, db } from "../../firebase";
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { ref, set, serverTimestamp } from "firebase/database";
import Button from "../common/Button";
import Input from "../common/Input";
import Loading from "../common/Loading";
import "./Lobby.css";

export default function Lobby() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAuthForm, setShowAuthForm] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        navigate("/home", { replace: true });
      } else {
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  // Save user to Realtime Database
  const saveUserToDatabase = async (user) => {
    try {
      const userRef = ref(db, `users/${user.uid}`);
      await set(userRef, {
        uid: user.uid,
        email: user.email || null,
        isAnonymous: user.isAnonymous,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
        xp: 0,
        gamesPlayed: 0,
        gamesWon: 0
      });
    } catch (error) {
      console.error("Error saving user to database:", error);
    }
  };

  const handleAuth = async () => {
    setAuthError("");
    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        // Save new user to database
        await saveUserToDatabase(userCredential.user);
        alert("✅ Account creato con successo!");
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        // Update last login
        const userRef = ref(db, `users/${userCredential.user.uid}/lastLogin`);
        await set(userRef, serverTimestamp());
      }
      // Navigation happens automatically via onAuthStateChanged
    } catch (error) {
      const errorMessages = {
        'auth/invalid-email': 'Email non valida',
        'auth/user-not-found': 'Utente non trovato',
        'auth/wrong-password': 'Password errata',
        'auth/email-already-in-use': 'Email già registrata',
        'auth/weak-password': 'Password troppo debole (minimo 6 caratteri)',
        'auth/invalid-credential': 'Credenziali non valide'
      };
      setAuthError(errorMessages[error.code] || error.message);
    }
  };

  const handleGuestLogin = async () => {
    setAuthError("");
    try {
      const userCredential = await signInAnonymously(auth);
      // Save guest user to database
      await saveUserToDatabase(userCredential.user);
      // Navigation happens automatically via onAuthStateChanged
    } catch (error) {
      console.error("Guest login error:", error);
      setAuthError("Errore durante l'accesso come ospite: " + error.message);
    }
  };

  if (loading) {
    return <Loading message="Caricamento..." />;
  }

  // Initial screen - Choose guest or account
  if (!showAuthForm) {
    return (
      <div className="lobby-container">
        <div className="lobby-card">
          <div className="lobby-header">
            <div className="logo">🎨</div>
            <h1>SketchGuess</h1>
            <p>Disegna, indovina e divertiti con i tuoi amici!</p>
          </div>

          {authError && (
            <div style={{ 
              color: '#dc2626', 
              fontSize: '14px', 
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
            <Button 
              onClick={handleGuestLogin} 
              variant="primary"
              icon="👤"
            >
              Gioca come Ospite
            </Button>

            <div className="divider">
              <span>oppure</span>
            </div>

            <Button 
              onClick={() => setShowAuthForm(true)} 
              variant="secondary"
              icon="🔑"
            >
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

  // Auth form screen - Login or Sign Up
  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <div className="lobby-header">
          <div className="logo">🎨</div>
          <h1>SketchGuess</h1>
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
          onKeyDown={(e) => e.key === "Enter" && handleAuth()}
        />

        {authError && (
          <div style={{ 
            color: '#dc2626', 
            fontSize: '14px', 
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
          <Button onClick={handleAuth} variant="primary" icon={isSignUp ? "✨" : "🔑"}>
            {isSignUp ? "Registrati" : "Accedi"}
          </Button>

          <Button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setAuthError("");
            }} 
            variant="secondary"
          >
            {isSignUp ? "Hai già un account? Accedi" : "Non hai un account? Registrati"}
          </Button>

          <div className="divider">
            <span>oppure</span>
          </div>

          <Button 
            onClick={() => {
              setShowAuthForm(false);
              setAuthError("");
              setEmail("");
              setPassword("");
            }} 
            variant="tertiary"
            icon="◀"
          >
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