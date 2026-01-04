import { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInAnonymously } from "firebase/auth";
import { auth } from "../firebase";
import { saveUserToDatabase, updateLastLogin } from '../services/userService';

const AUTH_ERRORS = {
  'auth/invalid-email': 'Email non valida',
  'auth/user-not-found': 'Utente non trovato',
  'auth/wrong-password': 'Password errata',
  'auth/email-already-in-use': 'Email già registrata',
  'auth/weak-password': 'Password troppo debole (minimo 6 caratteri)',
  'auth/invalid-credential': 'Credenziali non valide'
};

export function useAuth() {
  const [authError, setAuthError] = useState("");

  const handleEmailAuth = async (email, password, isSignUp) => {
    setAuthError("");
    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await saveUserToDatabase(userCredential.user);
        alert("✅ Account creato con successo!");
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
        await updateLastLogin(userCredential.user.uid);
      }
      return true;
    } catch (error) {
      setAuthError(AUTH_ERRORS[error.code] || error.message);
      return false;
    }
  };

  const handleGuestAuth = async () => {
    setAuthError("");
    try {
      const userCredential = await signInAnonymously(auth);
      await saveUserToDatabase(userCredential.user);
      return true;
    } catch (error) {
      console.error("Guest login error:", error);
      setAuthError("Errore durante l'accesso come ospite: " + error.message);
      return false;
    }
  };

  return { authError, setAuthError, handleEmailAuth, handleGuestAuth };
}