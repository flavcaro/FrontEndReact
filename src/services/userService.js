/**
 * ============================================================================
 * userService.js - Servizio Gestione Utenti e Statistiche
 * ============================================================================
 * 
 * SCOPO:
 * Questo servizio centralizza tutte le operazioni relative agli utenti:
 * - Salvataggio dati utente nel database
 * - Aggiornamento statistiche di gioco (XP, livello, vittorie)
 * - Gestione leaderboard (classifica globale)
 * - Sincronizzazione in tempo reale
 * 
 * ARCHITETTURA:
 * - Usa Firebase Realtime Database per persistenza
 * - Mantiene due nodi: users/ (dati completi) e leaderboard/ (mirror ottimizzato)
 * - Calcola livelli dinamicamente basandosi sugli XP
 * - Esclude utenti anonimi dalla leaderboard pubblica
 * 
 * FUNZIONI PRINCIPALI:
 * - saveUserToDatabase: Crea record utente iniziale
 * - updateGameStats: Aggiorna statistiche dopo ogni partita
 * - fetchLeaderboard: Carica classifica (snapshot singolo)
 * - subscribeLeaderboard: Ascolta classifica in tempo reale
 */

import { ref, set, serverTimestamp, get, update, query, orderByChild, limitToLast, onValue } from "firebase/database";
import { db } from "../firebase";

// ============================================================================
// FUNZIONE 1: SALVA UTENTE NEL DATABASE
// ============================================================================
/**
 * Crea un nuovo record utente nel database quando si registra o accede per la prima volta.
 * Inizializza tutte le statistiche a zero.
 * 
 * PERCORSO FIREBASE: users/{uid}
 * 
 * @param {Object} user - Oggetto utente Firebase (da auth.currentUser)
 * @throws {Error} Se il salvataggio fallisce
 */
export const saveUserToDatabase = async (user) => {
  try {
    // Crea riferimento al percorso users/{uid}
    const userRef = ref(db, `users/${user.uid}`);

    // Salva i dati iniziali dell'utente
    await set(userRef, {
      uid: user.uid,                          // ID univoco Firebase
      email: user.email || null,              // Email (null per utenti anonimi)
      isAnonymous: user.isAnonymous,          // true se utente ospite
      createdAt: serverTimestamp(),           // Timestamp creazione (server-side)
      lastLogin: serverTimestamp(),           // Timestamp ultimo accesso

      // STATISTICHE INIZIALI
      xp: 0,                                  // Punti esperienza (0 all'inizio)
      level: 1,                               // Livello iniziale
      gamesPlayed: 0,                         // Partite giocate
      gamesWon: 0,                            // Partite vinte
      totalScore: 0,                          // Punteggio totale accumulato
      bestScore: 0                            // Miglior punteggio singola partita
    });
  } catch (error) {
    console.error("Error saving user to database:", error);
    throw error;  // Rilancia l'errore per gestirlo nel chiamante
  }
};

// ============================================================================
// FUNZIONE 2: AGGIORNA ULTIMO ACCESSO
// ============================================================================
/**
 * Aggiorna il timestamp dell'ultimo accesso dell'utente.
 * Chiamata ogni volta che l'utente fa login.
 * 
 * @param {string} uid - ID utente Firebase
 */
export const updateLastLogin = async (uid) => {
  try {
    const userRef = ref(db, `users/${uid}/lastLogin`);
    // serverTimestamp() usa l'ora del server Firebase (più affidabile del client)
    await set(userRef, serverTimestamp());
  } catch (error) {
    console.error("Error updating last login:", error);
    // Non rilancia l'errore: l'aggiornamento del lastLogin non è critico
  }
};

// ============================================================================
// FUNZIONE 3: AGGIORNA STATISTICHE DI GIOCO
// ============================================================================
/**
 * Aggiorna le statistiche dell'utente dopo una partita completata.
 * Calcola XP guadagnati, nuovo livello, e aggiorna la leaderboard.
 * 
 * FORMULA XP:
 * - XP base = punteggio della partita (1 XP per punto)
 * - Bonus vittoria = 100 XP se ha vinto
 * - XP totali = XP base + bonus vittoria
 * 
 * FORMULA LIVELLO:
 * - Livello N richiede: 100 * N * (N+1) / 2 XP totali
 * - Esempio: Livello 1 = 0-100 XP, Livello 2 = 100-300 XP, Livello 3 = 300-600 XP
 * 
 * @param {string} userId - ID utente Firebase
 * @param {number} score - Punteggio ottenuto nella partita
 * @param {boolean} isWinner - true se l'utente ha vinto la partita
 */
export const updateGameStats = async (userId, score, isWinner) => {
  try {
    console.log(`📊 Aggiornamento statistiche per userId: ${userId}, score: ${score}, winner: ${isWinner}`);

    // --- CARICAMENTO DATI ATTUALI ---
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);
    const userData = snapshot.val() || {};  // Dati utente esistenti (o oggetto vuoto)

    // --- CALCOLO NUOVE STATISTICHE ---
    const gamesPlayed = (userData.gamesPlayed || 0) + 1;  // Incrementa partite giocate
    const gamesWon = isWinner ? (userData.gamesWon || 0) + 1 : (userData.gamesWon || 0);  // Incrementa vittorie solo se ha vinto
    const totalScore = (userData.totalScore || 0) + score;  // Aggiungi punteggio al totale
    const bestScore = Math.max(userData.bestScore || 0, score);  // Aggiorna miglior punteggio se superato

    // --- CALCOLO XP ---
    // XP basati sul punteggio: 1 XP per ogni punto + bonus vittoria
    const baseXp = score;                    // 1 XP per ogni punto fatto
    const winnerBonus = isWinner ? 100 : 0;  // Bonus di 100 XP per vittoria
    const newXp = (userData.xp || 0) + baseXp + winnerBonus;  // XP totali

    // --- CALCOLO LIVELLO ---
    // Il livello cresce in modo progressivo: servono sempre più XP per salire
    // Formula: Livello N richiede 100 * N * (N+1) / 2 XP
    let level = 1;
    while (true) {
      const xpForNextLevel = 100 * level * (level + 1) / 2;
      if (newXp < xpForNextLevel) break;  // Se gli XP non bastano per il prossimo livello, fermati
      level++;
    }

    console.log(`📊 Nuove statistiche:`, {
      gamesPlayed,
      gamesWon,
      totalScore,
      bestScore,
      xp: newXp,
      level,
      xpGuadagnati: baseXp + winnerBonus
    });

    // --- SALVATAGGIO NEL DATABASE ---
    await update(userRef, {
      gamesPlayed,
      gamesWon,
      totalScore,
      bestScore,
      xp: newXp,
      level,
      lastPlayed: serverTimestamp()  // Timestamp ultima partita
    });

    // --- AGGIORNAMENTO LEADERBOARD MIRROR ---
    // La leaderboard è un nodo separato ottimizzato per query veloci.
    // Contiene solo i dati essenziali per la classifica.
    try {
      // NON aggiungere utenti anonimi alla leaderboard pubblica
      if (!userData.isAnonymous) {
        const lbRef = ref(db, `leaderboard/${userId}`);
        await update(lbRef, {
          uid: userId,
          displayName: userData.nickname || userData.email || null,  // Nome da mostrare
          email: userData.email || null,
          totalScore,
          level,
          isAnonymous: !!userData.isAnonymous,
          lastUpdated: serverTimestamp()
        });
      } else {
        // Se l'utente è anonimo, rimuovi eventuali entry nella leaderboard
        try {
          const lbRef = ref(db, `leaderboard/${userId}`);
          await update(lbRef, { uid: null });  // Marca come invalido
        } catch (e) {
          // Ignora errori di rimozione
        }
      }
    } catch (err) {
      console.warn('Could not update leaderboard mirror', err);
      // Non bloccare l'aggiornamento delle statistiche se la leaderboard fallisce
    }

    console.log(`✅ Statistiche aggiornate con successo per ${userId}`);
  } catch (error) {
    console.error("Error updating game stats:", error);
    // Non rilancia l'errore: le statistiche non sono critiche per il gameplay
  }
};

// ============================================================================
// FUNZIONE 4: CARICA LEADERBOARD (SNAPSHOT SINGOLO)
// ============================================================================
/**
 * Carica la classifica globale come snapshot singolo (non in tempo reale).
 * Utile per caricamenti iniziali o quando non serve sincronizzazione live.
 * 
 * @param {number} limit - Numero massimo di giocatori da caricare (default: 20)
 * @param {string} orderBy - Campo per ordinamento ('totalScore' o 'level')
 * @returns {Promise<Array>} Array di oggetti giocatore ordinati per punteggio
 */
export const fetchLeaderboard = async (limit = 20, orderBy = 'totalScore') => {
  try {
    // Crea query Firebase: ordina per campo specificato e limita risultati
    const q = query(ref(db, 'leaderboard'), orderByChild(orderBy), limitToLast(limit));
    const snap = await get(q);
    const val = snap.val() || {};

    // --- FILTRAGGIO E CONVERSIONE ---
    // Filtra utenti anonimi/ospiti se presenti nel mirror
    const list = Object.entries(val)
      .map(([uid, u]) => ({ uid, ...u }))
      .filter(item => !item.isAnonymous && item.uid);  // Escludi anonimi e entry invalide

    // Ordina in modo decrescente (punteggio più alto prima)
    list.sort((a, b) => (b[orderBy] || 0) - (a[orderBy] || 0));

    return list;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];  // Restituisci array vuoto in caso di errore
  }
};

// ============================================================================
// FUNZIONE 5: SOTTOSCRIZIONE LEADERBOARD IN TEMPO REALE
// ============================================================================
/**
 * Crea un listener in tempo reale sulla leaderboard.
 * La callback viene chiamata ogni volta che la classifica cambia.
 * 
 * STRATEGIA FALLBACK:
 * 1. Prova a usare leaderboard/ (nodo mirror ottimizzato)
 * 2. Se vuoto, fallback su users/ (nodo completo)
 * 3. Arricchisce i dati con nickname in tempo reale
 * 
 * @param {Function} onUpdate - Callback chiamata con la lista aggiornata
 * @param {number} limit - Numero massimo di giocatori (default: 20)
 * @param {string} orderBy - Campo per ordinamento (default: 'totalScore')
 * @returns {Function} Funzione di cleanup per rimuovere i listener
 */
export const subscribeLeaderboard = (onUpdate, limit = 20, orderBy = 'totalScore') => {
  try {
    const leaderboardRef = ref(db, 'leaderboard');
    const usersRef = ref(db, 'users');

    // Mappa di listener per nickname individuali (per aggiornamenti in tempo reale)
    const perUidUnsubs = {};
    let latestPrimaryList = [];  // Cache della lista corrente

    // --- FUNZIONE HELPER: CREA SOTTOSCRIZIONE ---
    const subscribeTo = (refNode, label) => {
      const q = query(refNode, orderByChild(orderBy), limitToLast(limit));
      const unsub = onValue(q, (snap) => {
        const val = snap.val() || {};
        const list = Object.entries(val).map(([uid, u]) => {
          if (label === 'users') {
            // Modalità fallback: usa dati da users/
            const pub = (u && u.public) || u || {};
            const displayName = pub.displayName || pub.nickname || pub.email || null;
            const totalScoreVal = (pub.totalScore !== undefined) ? pub.totalScore : (u && u.totalScore) || 0;
            const levelVal = (pub.level !== undefined) ? pub.level : (u && u.level) || 1;
            const gamesPlayedVal = (pub.gamesPlayed !== undefined) ? pub.gamesPlayed : (u && u.gamesPlayed) || 0;
            return ({ uid, displayName, email: pub.email || u.email || null, totalScore: totalScoreVal, level: levelVal, gamesPlayed: gamesPlayedVal });
          }
          return ({ uid, ...u });
        });

        // Filtra utenti anonimi quando usi users/ come fallback
        const filtered = list.filter(item => !(label === 'users' && (item.isAnonymous || (item && item.isAnonymous))));
        filtered.sort((a, b) => (b[orderBy] || 0) - (a[orderBy] || 0));

        console.log(`[subscribeLeaderboard] source=${label} count=${filtered.length}`);
        onUpdate(filtered);
      }, (err) => {
        console.error('Realtime leaderboard error', err);
      });
      return unsub;
    };

    // --- LOGICA PRINCIPALE: PROVA LEADERBOARD/, POI FALLBACK SU USERS/ ---
    let unsubPrimary = null;
    let unsubFallback = null;
    let initialChecked = false;

    const primaryQuery = query(leaderboardRef, orderByChild(orderBy), limitToLast(limit));
    unsubPrimary = onValue(primaryQuery, (snap) => {
      const val = snap.val() || {};
      const has = Object.keys(val).length > 0;  // Controlla se leaderboard/ ha dati
      const list = Object.entries(val).map(([uid, u]) => ({ uid, ...u }));
      list.sort((a, b) => (b[orderBy] || 0) - (a[orderBy] || 0));

      // Mantieni riferimento per listener nickname individuali
      latestPrimaryList = list.slice();
      const currentUids = new Set(latestPrimaryList.map(i => i.uid).filter(Boolean));

      // Rimuovi listener per UID non più nella top list
      Object.keys(perUidUnsubs).forEach((uid) => {
        if (!currentUids.has(uid)) {
          try { perUidUnsubs[uid](); } catch (e) { }
          delete perUidUnsubs[uid];
        }
      });

      // --- CONTROLLO INIZIALE: FALLBACK SE LEADERBOARD VUOTA ---
      if (!initialChecked) {
        initialChecked = true;
        if (!has) {
          // leaderboard/ è vuota: passa a users/
          console.log('[subscribeLeaderboard] leaderboard empty, falling back to users/');
          if (typeof unsubPrimary === 'function') unsubPrimary();
          unsubFallback = subscribeTo(usersRef, 'users');
          return;
        }
      }

      // --- ARRICCHIMENTO DATI CON GAMESPLAYED E NICKNAME ---
      (async () => {
        try {
          // Carica gamesPlayed da users/ per ogni entry
          const enriched = await Promise.all(list.map(async (item) => {
            try {
              const snapGames = await get(ref(db, `users/${item.uid}/gamesPlayed`));
              const gp = snapGames && snapGames.exists() ? snapGames.val() : (item.gamesPlayed !== undefined ? item.gamesPlayed : 0);
              return { ...item, gamesPlayed: gp };
            } catch (e) {
              return { ...item, gamesPlayed: (item.gamesPlayed !== undefined ? item.gamesPlayed : 0) };
            }
          }));

          // Sottoscrivi ai nickname individuali per aggiornamenti in tempo reale
          enriched.forEach((entry) => {
            const uid = entry.uid;
            if (!uid) return;
            if (perUidUnsubs[uid]) return;  // Già in ascolto

            try {
              const nickRef = ref(db, `users/${uid}/nickname`);
              const unsubNick = onValue(nickRef, (snapNick) => {
                try {
                  const nickVal = snapNick && snapNick.exists() ? snapNick.val() : null;
                  // Aggiorna la lista con il nuovo nickname
                  latestPrimaryList = latestPrimaryList.map(it =>
                    it.uid === uid ? { ...it, nickname: nickVal !== null ? nickVal : it.nickname } : it
                  );
                  // Mantieni ordinamento
                  latestPrimaryList.sort((a, b) => (b[orderBy] || 0) - (a[orderBy] || 0));
                  onUpdate(latestPrimaryList.slice());
                } catch (e) {
                  console.warn('Error applying nickname update for', uid, e);
                }
              }, (err) => {
                console.warn('Nickname realtime error', uid, err);
              });
              perUidUnsubs[uid] = unsubNick;
            } catch (e) {
              // Ignora errori di sottoscrizione
            }
          });

          console.log(`[subscribeLeaderboard] source=leaderboard count=${enriched.length}`);
          onUpdate(enriched);
        } catch (errEnrich) {
          console.warn('Could not enrich leaderboard entries with gamesPlayed', errEnrich);
          console.log(`[subscribeLeaderboard] source=leaderboard count=${list.length}`);
          onUpdate(list);
        }
      })();
    }, (err) => {
      console.error('Realtime leaderboard error', err);
      // In caso di errore, prova fallback
      if (!unsubFallback) {
        console.log('[subscribeLeaderboard] error on leaderboard, falling back to users/');
        unsubFallback = subscribeTo(usersRef, 'users');
      }
    });

    // --- FUNZIONE DI CLEANUP ---
    // Rimuove tutti i listener quando non più necessari
    return () => {
      try { if (typeof unsubPrimary === 'function') unsubPrimary(); } catch (e) { }
      try { if (typeof unsubFallback === 'function') unsubFallback(); } catch (e) { }
      // Cleanup listener nickname individuali
      Object.keys(perUidUnsubs).forEach((uid) => {
        try { perUidUnsubs[uid](); } catch (e) { }
      });
    };
  } catch (error) {
    console.error('Error subscribing leaderboard:', error);
    return () => { };  // Restituisci funzione vuota in caso di errore
  }
};
