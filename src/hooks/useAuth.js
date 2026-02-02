/**
 * ============================================================================
 * useAuth.js - Hook per Gestione Autenticazione
 * ============================================================================
 * 
 * SCOPO:
 * Questo custom hook gestisce tutte le operazioni di autenticazione dell'app:
 * - Login/Registrazione con email e password
 * - Login con Google OAuth
 * - Login come ospite (anonimo)
 * - Gestione errori di autenticazione con messaggi in italiano
 * 
 * FUNZIONAMENTO:
 * 1. Fornisce funzioni per ogni tipo di autenticazione
 * 2. Gestisce gli errori e li traduce in messaggi user-friendly
 * 3. Salva automaticamente i dati utente nel database dopo l'autenticazione
 * 4. Aggiorna il timestamp dell'ultimo accesso
 * 
 * USO:
 * const { handleEmailAuth, handleGoogleAuth, handleGuestAuth, authError } = useAuth();
 */

import { useState } from 'react';
import {
  signInWithEmailAndPassword,      // Login con email/password
  createUserWithEmailAndPassword,   // Registrazione nuovo utente
  signInAnonymously,                // Login anonimo (ospite)
  signInWithPopup                   // Login con popup (Google)
} from "firebase/auth";
import { auth, googleProvider } from "../firebase";
import { saveUserToDatabase, updateLastLogin } from '../services/userService';

// ============================================================================
// DIZIONARIO ERRORI
// ============================================================================
// Mappa i codici errore di Firebase in messaggi user-friendly in italiano.
// Firebase restituisce errori in inglese con codici come 'auth/invalid-email'.
// Questo oggetto traduce questi codici in messaggi comprensibili.

const AUTH_ERRORS = {
  'auth/invalid-email': 'Email non valida',
  'auth/user-not-found': 'Utente non trovato',
  'auth/wrong-password': 'Password errata',
  'auth/email-already-in-use': 'Email già registrata',
  'auth/weak-password': 'Password troppo debole (minimo 6 caratteri)',
  'auth/invalid-credential': 'Credenziali non valide'
};

export function useAuth() {
  // ============================================================================
  // STATO LOCALE
  // ============================================================================

  // Messaggio di errore da mostrare all'utente
  // Viene aggiornato quando un'operazione di autenticazione fallisce
  const [authError, setAuthError] = useState("");

  // ============================================================================
  // FUNZIONE 1: AUTENTICAZIONE EMAIL/PASSWORD
  // ============================================================================
  /**
   * Gestisce sia il login che la registrazione con email e password.
   * 
   * @param {string} email - Email dell'utente
   * @param {string} password - Password dell'utente
   * @param {boolean} isSignUp - true per registrazione, false per login
   * @returns {Promise<boolean>} - true se successo, false se errore
   */
  const handleEmailAuth = async (email, password, isSignUp) => {
    // Reset errore precedente
    setAuthError("");

    try {
      let userCredential;  // Conterrà i dati dell'utente autenticato

      if (isSignUp) {
        // --- MODALITÀ REGISTRAZIONE ---
        // Crea un nuovo account Firebase con email e password
        userCredential = await createUserWithEmailAndPassword(auth, email, password);

        // Salva i dati dell'utente nel database Realtime
        // Questo crea il record iniziale in users/{uid}
        await saveUserToDatabase(userCredential.user);

        // Notifica successo
        alert("✅ Account creato con successo!");
      } else {
        // --- MODALITÀ LOGIN ---
        // Accedi con credenziali esistenti
        userCredential = await signInWithEmailAndPassword(auth, email, password);

        // Aggiorna il timestamp dell'ultimo accesso
        await updateLastLogin(userCredential.user.uid);
      }

      return true;  // Autenticazione riuscita

    } catch (error) {
      // Gestione errori
      // Cerca il messaggio tradotto nel dizionario, altrimenti usa il messaggio originale
      setAuthError(AUTH_ERRORS[error.code] || error.message);
      return false;  // Autenticazione fallita
    }
  };

  // ============================================================================
  // FUNZIONE 2: AUTENTICAZIONE OSPITE (ANONIMA)
  // ============================================================================
  /**
   * Permette l'accesso senza registrazione come utente anonimo.
   * L'utente può giocare ma i suoi dati non saranno persistenti tra sessioni.
   * 
   * @returns {Promise<boolean>} - true se successo, false se errore
   */
  const handleGuestAuth = async () => {
    setAuthError("");

    try {
      // signInAnonymously crea un utente temporaneo senza credenziali
      // Firebase genera automaticamente un UID univoco
      const userCredential = await signInAnonymously(auth);

      // Salva i dati base dell'ospite nel database
      // Questo permette di tracciare statistiche anche per gli ospiti
      await saveUserToDatabase(userCredential.user);

      return true;

    } catch (error) {
      console.error("Guest login error:", error);
      setAuthError("Errore durante l'accesso come ospite: " + error.message);
      return false;
    }
  };

  // ============================================================================
  // FUNZIONE 3: AUTENTICAZIONE GOOGLE
  // ============================================================================
  /**
   * Gestisce il login con Google OAuth tramite popup.
   * L'utente viene reindirizzato a Google per autenticarsi, poi torna all'app.
   * 
   * @returns {Promise<boolean>} - true se successo, false se errore
   */
  const handleGoogleAuth = async () => {
    setAuthError("");

    try {
      // signInWithPopup apre una finestra popup di Google
      // googleProvider è configurato in firebase.js
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;  // Contiene email, displayName, photoURL, ecc.

      // Salva o aggiorna l'utente nel database
      // Se l'utente esiste già, aggiorna i dati; altrimenti crea un nuovo record
      await saveUserToDatabase(user);

      // Aggiorna timestamp ultimo accesso
      await updateLastLogin(user.uid);

      return true;

    } catch (error) {
      console.error("Google login error:", error);

      // Gestisci errori specifici del popup
      if (error.code === 'auth/popup-closed-by-user') {
        // L'utente ha chiuso il popup senza completare il login
        setAuthError("Accesso annullato");
      } else if (error.code === 'auth/popup-blocked') {
        // Il browser ha bloccato il popup
        setAuthError("Popup bloccato dal browser. Abilita i popup per questo sito.");
      } else {
        // Altri errori generici
        setAuthError(AUTH_ERRORS[error.code] || "Errore durante l'accesso con Google");
      }

      return false;
    }
  };

  // ============================================================================
  // RETURN - ESPOSIZIONE FUNZIONI E STATO
  // ============================================================================
  // Restituisce le funzioni di autenticazione e lo stato degli errori.
  // I componenti possono chiamare queste funzioni e mostrare authError all'utente.

  return {
    authError,           // Messaggio di errore corrente (stringa vuota se nessun errore)
    setAuthError,        // Funzione per impostare manualmente un errore
    handleEmailAuth,     // Funzione per login/registrazione email
    handleGuestAuth,     // Funzione per login ospite
    handleGoogleAuth     // Funzione per login Google
  };
}