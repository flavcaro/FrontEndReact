import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../../firebase";
import { onAuthStateChanged } from "firebase/auth";
import { useAuth } from "../../hooks/useAuth";
import Loading from "../common/Loading";
import WelcomeScreen from "./WelcomeScreen";
import AuthForm from "./AuthForm";

export default function Lobby() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const { authError, setAuthError, handleEmailAuth, handleGuestAuth } = useAuth();

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

  const handleAuth = async () => {
    await handleEmailAuth(email, password, isSignUp);
  };

  const handleGuestLogin = async () => {
    await handleGuestAuth();
  };

  const handleBack = () => {
    setShowAuthForm(false);
    setAuthError("");
    setEmail("");
    setPassword("");
  };

  if (loading) {
    return <Loading message="Caricamento..." />;
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