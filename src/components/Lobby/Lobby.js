import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useAuth } from "../../hooks/useAuth";
import WelcomeScreen from "./WelcomeScreen";
import AuthForm from "./AuthForm";

export default function Lobby() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const { authError, setAuthError, handleEmailAuth, handleGuestAuth } = useAuth();

  // Check if user is already authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        navigate("/home", { replace: true });
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleAuth = async () => {
    const success = await handleEmailAuth(email, password, isSignUp);
    if (success) navigate("/home", { replace: true });
  };

  const handleGuestLogin = async () => {
    const success = await handleGuestAuth();
    if (success) navigate("/home", { replace: true });
  };

  const handleBack = () => {
    setShowAuthForm(false);
    setAuthError("");
    setEmail("");
    setPassword("");
  };

  if (authLoading) {
    return (
      <div className="lobby-container">
        <div className="lobby-card">
          <div className="lobby-header">
            <div className="logo">🎨</div>
            <h1>SketchUp</h1>
            <p>Caricamento...</p>
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

  if (showAuthForm) {
    return (
      <AuthForm
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        isSignUp={isSignUp}
        setIsSignUp={setIsSignUp}
        authError={authError}
        onAuth={handleAuth}
        onBack={handleBack}
      />
    );
  }

  return (
    <WelcomeScreen
      onGuestLogin={handleGuestLogin}
      onShowAuthForm={() => setShowAuthForm(true)}
      authError={authError}
    />
  );
}