/**
 * ============================================================================
 * useUserData.js - Hook per Gestione Dati Utente
 * ============================================================================
 * 
 * SCOPO:
 * Questo custom hook gestisce tutti i dati dell'utente corrente, inclusi:
 * - Nickname (nome visualizzato)
 * - Statistiche di gioco (XP, livello, partite giocate, vittorie)
 * - Sincronizzazione in tempo reale con Firebase
 * 
 * FUNZIONAMENTO:
 * 1. Carica i dati utente da Firebase Realtime Database
 * 2. Calcola dinamicamente il livello basandosi sugli XP
 * 3. Inizializza il nickname da localStorage o genera uno automatico
 * 4. Mantiene sincronizzati Firebase e localStorage
 * 
 * USO:
 * const { nickname, xpPoints, level, ... } = useUserData();
 */

import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { ref, onValue } from 'firebase/database';

export function useUserData() {
  // ============================================================================
  // STATO LOCALE
  // ============================================================================
  // Questi useState mantengono i dati dell'utente in memoria locale.
  // Vengono aggiornati automaticamente quando Firebase cambia.

  const [nickname, setNickname] = useState('');        // Nome visualizzato del giocatore
  const [xpPoints, setXpPoints] = useState(0);         // Punti esperienza totali
  const [level, setLevel] = useState(1);               // Livello calcolato dagli XP
  const [gamesPlayed, setGamesPlayed] = useState(0);   // Numero totale di partite giocate
  const [gamesWon, setGamesWon] = useState(0);         // Numero di partite vinte
  const [totalScore, setTotalScore] = useState(0);     // Punteggio totale accumulato
  const [bestScore, setBestScore] = useState(0);       // Miglior punteggio in una singola partita

  // Riferimenti all'utente Firebase corrente
  const user = auth.currentUser;                       // Oggetto utente Firebase (null se non autenticato)
  const isGuest = user?.isAnonymous;                   // true se l'utente è in modalità ospite (anonimo)

  // ============================================================================
  // EFFECT 1: SINCRONIZZAZIONE DATI DA FIREBASE
  // ============================================================================
  // Questo useEffect si attiva quando l'utente cambia (login/logout).
  // Crea un listener in tempo reale su Firebase che aggiorna lo stato locale
  // ogni volta che i dati dell'utente cambiano nel database.

  useEffect(() => {
    // Se non c'è un utente autenticato, non fare nulla
    if (!user) return;

    // Crea un riferimento al percorso Firebase dell'utente: users/{uid}
    const userRef = ref(db, `users/${user.uid}`);

    // onValue è un listener Firebase che si attiva ogni volta che i dati cambiano
    const unsubscribe = onValue(userRef, (snapshot) => {
      try {
        // snapshot.val() restituisce i dati dal database
        const data = snapshot.val();

        if (data) {
          // --- SINCRONIZZAZIONE NICKNAME ---
          // Se il database contiene un nickname, usalo e sincronizza localStorage
          if (data.nickname) {
            setNickname(data.nickname);
            // Salva anche in localStorage per persistenza locale
            try {
              localStorage.setItem('nickname', data.nickname);
            } catch (e) {
              /* Ignora errori di localStorage (es. quota superata) */
            }
          }

          // --- CARICAMENTO XP ---
          const xp = data.xp || 0;  // Se data.xp non esiste, usa 0
          setXpPoints(xp);

          // --- CALCOLO LIVELLO DINAMICO ---
          // Il livello viene calcolato in base agli XP usando una formula progressiva.
          // Formula: XP richiesti per livello N = 100 * N * (N+1) / 2
          // Esempio: 
          //   Livello 1: 0-100 XP
          //   Livello 2: 100-300 XP (100 + 200)
          //   Livello 3: 300-600 XP (100 + 200 + 300)
          let calculatedLevel = 1;
          while (true) {
            const xpForNextLevel = 100 * calculatedLevel * (calculatedLevel + 1) / 2;
            if (xp < xpForNextLevel) break;  // Se gli XP non bastano per il prossimo livello, fermati
            calculatedLevel++;
          }
          setLevel(calculatedLevel);

          // --- CARICAMENTO STATISTICHE ---
          // Usa l'operatore || per fornire valori di default se i dati non esistono
          setGamesPlayed(data.gamesPlayed || 0);
          setGamesWon(data.gamesWon || 0);
          setTotalScore(data.totalScore || 0);
          setBestScore(data.bestScore || 0);
        }
      } catch (error) {
        // Logga eventuali errori ma non bloccare l'applicazione
        console.error('Error in user data listener:', error);
      }
    });

    // CLEANUP FUNCTION
    // Quando il componente viene smontato o l'utente cambia,
    // rimuovi il listener per evitare memory leak
    return () => unsubscribe();
  }, [user]);  // Dipendenza: ri-esegui quando cambia l'utente

  // ============================================================================
  // EFFECT 2: INIZIALIZZAZIONE NICKNAME
  // ============================================================================
  // Questo useEffect gestisce l'inizializzazione del nickname quando l'utente
  // accede per la prima volta o non ha ancora un nickname salvato.

  useEffect(() => {
    // PRIORITÀ 1: Nickname salvato in localStorage
    const savedNick = localStorage.getItem('nickname');
    if (savedNick) {
      setNickname(savedNick);
    }
    // PRIORITÀ 2: Utente ospite → genera nickname casuale
    else if (isGuest) {
      const guestNick = `Ospite${Math.floor(Math.random() * 9999)}`;
      setNickname(guestNick);
      localStorage.setItem('nickname', guestNick);
    }
    // PRIORITÀ 3: Utente autenticato → usa parte email
    else if (user?.email) {
      // Estrae la parte prima della @ dall'email
      // Esempio: "mario.rossi@gmail.com" → "mario.rossi"
      const emailNick = user.email.split('@')[0];
      setNickname(emailNick);
    }
  }, [isGuest, user]);  // Dipendenze: ri-esegui quando cambia lo stato ospite o l'utente

  // ============================================================================
  // RETURN - ESPOSIZIONE DATI E FUNZIONI
  // ============================================================================
  // Restituisce un oggetto con tutti i dati e le funzioni utili.
  // I componenti che usano questo hook possono accedere a questi valori.

  return {
    nickname,      // Nickname corrente
    setNickname,   // Funzione per cambiare il nickname
    xpPoints,      // Punti esperienza
    level,         // Livello calcolato
    gamesPlayed,   // Partite giocate
    gamesWon,      // Partite vinte
    totalScore,    // Punteggio totale
    bestScore,     // Miglior punteggio
    user,          // Oggetto utente Firebase
    isGuest        // Flag: true se utente ospite
  };
}