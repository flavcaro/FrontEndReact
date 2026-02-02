import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../firebase";
import classicGif from "../../sprites/logo.gif";
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
  const { authError, setAuthError, handleEmailAuth, handleGuestAuth, handleGoogleAuth } = useAuth();

  // Helper to handle redirection
  const handleRedirect = () => {
    const returnTo = localStorage.getItem('returnTo');
    if (returnTo) {
      localStorage.removeItem('returnTo');
      navigate(returnTo, { replace: true });
    } else {
      navigate("/home", { replace: true });
    }
  };

  // Check if user is already authenticated
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        handleRedirect();
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleAuth = async () => {
    const success = await handleEmailAuth(email, password, isSignUp);
    if (success) handleRedirect();
  };

  const handleGuestLogin = async () => {
    const success = await handleGuestAuth();
    if (success) handleRedirect();
  };

  const handleGoogleLogin = async () => {
    const success = await handleGoogleAuth();
    if (success) handleRedirect();
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
            <div className="logo">
              <img src={classicGif} alt="SketchUp" style={{ width: '72px', height: '72px', imageRendering: 'pixelated' }} />
            </div>
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
        onGoogleAuth={handleGoogleLogin}
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