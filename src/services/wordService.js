/**
 * ============================================================================
 * wordService.js - Servizio Gestione Parole Casuali
 * ============================================================================
 * 
 * SCOPO:
 * Questo servizio gestisce il recupero di parole casuali per il gioco:
 * - Carica parole da Firebase Realtime Database
 * - Fallback su dizionario locale se Firebase non disponibile
 * - Sistema di cache per ridurre chiamate al database
 * - Filtraggio parole già usate nella partita
 * 
 * STRATEGIA:
 * 1. Prova a caricare parole da Firebase (dictionary/{difficulty})
 * 2. Cach a le parole per 1 ora
 * 3. Se Firebase fallisce, usa dizionario locale (WORDS_BY_DIFFICULTY)
 * 4. Filtra parole già usate per evitare ripetizioni
 * 
 * DIFFICOLTÀ:
 * - EASY: Parole semplici e comuni
 * - MEDIUM: Parole di difficoltà media
 * - HARD: Parole complesse o specifiche
 */

import { WORDS_BY_DIFFICULTY } from "../constants/gameConfig";
import { ref, get } from "firebase/database";
import { db } from "../firebase";

// ============================================================================
// CACHE PAROLE
// ============================================================================
// Oggetto che mantiene in memoria le parole caricate da Firebase
// per evitare di fare troppe richieste al database.

const wordCache = {
  EASY: null,      // Array di parole facili (null se non ancora caricato)
  MEDIUM: null,    // Array di parole medie
  HARD: null,      // Array di parole difficili
  lastFetch: null  // Timestamp dell'ultimo caricamento
};

// Durata della cache: 1 ora (3600000 millisecondi)
// Dopo 1 ora, le parole vengono ricaricate da Firebase
const CACHE_DURATION = 3600000;

// ============================================================================
// FUNZIONE PRIVATA: CARICA PAROLE DA FIREBASE
// ============================================================================
/**
 * Carica le parole da Firebase Realtime Database.
 * Le parole sono salvate in: dictionary/{difficulty}
 * 
 * STRUTTURA FIREBASE:
 * dictionary/
 *   ├─ easy: ["casa", "gatto", "sole", ...]
 *   ├─ medium: ["computer", "montagna", "biblioteca", ...]
 *   └─ hard: ["epistemologia", "fotosintesi", ...]
 * 
 * @param {string} difficulty - 'EASY', 'MEDIUM', o 'HARD'
 * @returns {Promise<string[]|null>} Array di parole o null se errore
 */
const fetchWordsFromFirebase = async (difficulty) => {
  try {
    // Converti in lowercase per il percorso Firebase (easy, medium, hard)
    const difficultyKey = difficulty.toLowerCase();

    // Carica i dati da Firebase
    const snapshot = await get(ref(db, `dictionary/${difficultyKey}`));

    if (snapshot.exists()) {
      // I dati esistono: restituisci l'array di parole
      const words = snapshot.val();
      console.log(`✅ Loaded ${words.length} words from Firebase for ${difficulty}`);
      return words;
    } else {
      // Nessun dato trovato per questa difficoltà
      console.warn(`⚠️ No words found in Firebase for ${difficulty}`);
      return null;
    }
  } catch (error) {
    // Errore di rete o permessi Firebase
    console.error('❌ Error fetching words from Firebase:', error);
    return null;
  }
};

// ============================================================================
// FUNZIONE PRINCIPALE: OTTIENI PAROLA CASUALE (ASYNC)
// ============================================================================
/**
 * Ottiene una parola casuale basata sulla difficoltà.
 * Usa Firebase come fonte primaria, con fallback su dizionario locale.
 * 
 * FLUSSO:
 * 1. Controlla se la cache è valida (< 1 ora)
 * 2. Se cache non valida, carica da Firebase e aggiorna cache
 * 3. Usa parole da cache/Firebase, altrimenti fallback locale
 * 4. Filtra parole già usate
 * 5. Restituisci parola casuale
 * 
 * @param {string} difficulty - 'EASY', 'MEDIUM', o 'HARD' (default: 'MEDIUM')
 * @param {string[]} usedWords - Array di parole già usate nella partita corrente
 * @returns {Promise<string>} Parola casuale selezionata
 */
export const getRandomWord = async (difficulty = 'MEDIUM', usedWords = []) => {
  const difficultyKey = difficulty.toUpperCase();
  const now = Date.now();

  // --- CONTROLLO VALIDITÀ CACHE ---
  // La cache è valida se:
  // 1. Esiste (non null)
  // 2. È stata caricata meno di 1 ora fa
  const isCacheValid = wordCache[difficultyKey] &&
    wordCache.lastFetch &&
    (now - wordCache.lastFetch) < CACHE_DURATION;

  // --- CARICAMENTO DA FIREBASE (SE CACHE NON VALIDA) ---
  if (!isCacheValid) {
    console.log(`🔥 Fetching words from Firebase for ${difficultyKey}...`);
    const firebaseWords = await fetchWordsFromFirebase(difficultyKey);

    if (firebaseWords && firebaseWords.length > 0) {
      // Salva in cache
      wordCache[difficultyKey] = firebaseWords;
      wordCache.lastFetch = now;
      console.log(`✅ Firebase words cached for ${difficultyKey}: ${firebaseWords.length} words`);
    }
  }

  // --- SELEZIONE LISTA PAROLE ---
  // Priorità: Cache Firebase > Dizionario locale > Fallback MEDIUM
  let wordList = wordCache[difficultyKey] || WORDS_BY_DIFFICULTY[difficultyKey] || WORDS_BY_DIFFICULTY.MEDIUM;

  // --- FILTRAGGIO PAROLE GIÀ USATE ---
  // Rimuovi le parole già usate nella partita corrente
  // (confronto case-insensitive con toLowerCase())
  let availableWords = wordList.filter(word => !usedWords.includes(word.toLowerCase()));

  // --- GESTIONE LISTA VUOTA ---
  // Se tutte le parole sono state usate, resetta e usa tutte le parole
  if (availableWords.length === 0) {
    console.warn('⚠️ Tutte le parole sono state usate, resetto la lista');
    availableWords = [...wordList];  // Copia dell'array completo
  }

  // --- SELEZIONE CASUALE ---
  // Math.random() genera numero tra 0 e 1
  // Moltiplica per lunghezza array e arrotonda per indice casuale
  const randomWord = availableWords[Math.floor(Math.random() * availableWords.length)];

  console.log(`🎲 Selected word: "${randomWord}" (from ${wordCache[difficultyKey] ? 'Firebase' : 'LOCAL'}, ${availableWords.length} available)`);

  return randomWord;
};

// ============================================================================
// FUNZIONE: OTTIENI PAROLA CASUALE (SYNC - SOLO LOCALE)
// ============================================================================
/**
 * Versione sincrona che usa SOLO il dizionario locale.
 * Usata per backward compatibility o quando non serve Firebase.
 * 
 * NOTA: Non filtra parole usate, non usa cache Firebase.
 * 
 * @param {string} difficulty - 'EASY', 'MEDIUM', o 'HARD' (default: 'MEDIUM')
 * @returns {string} Parola casuale dal dizionario locale
 */
export const getRandomWordSync = (difficulty = 'MEDIUM') => {
  // Seleziona lista parole dal dizionario locale
  const wordList = WORDS_BY_DIFFICULTY[difficulty.toUpperCase()] || WORDS_BY_DIFFICULTY.MEDIUM;

  // Restituisci parola casuale
  return wordList[Math.floor(Math.random() * wordList.length)];
};

// ============================================================================
// FUNZIONE: PRE-CARICAMENTO PAROLE
// ============================================================================
/**
 * Pre-carica le parole da Firebase per tutte le difficoltà.
 * Utile da chiamare all'avvio dell'app per popolare la cache.
 * 
 * Esegue 3 chiamate in parallelo con Promise.all per velocità.
 */
export const preloadWords = async () => {
  console.log('🚀 Preloading words from API...');

  // Carica tutte le difficoltà in parallelo
  await Promise.all([
    getRandomWord('EASY'),
    getRandomWord('MEDIUM'),
    getRandomWord('HARD')
  ]);

  console.log('✅ Words preloaded');
};

// ============================================================================
// FUNZIONE: SVUOTA CACHE
// ============================================================================
/**
 * Svuota la cache delle parole.
 * Utile per forzare il ricaricamento da Firebase.
 */
export const clearWordCache = () => {
  wordCache.EASY = null;
  wordCache.MEDIUM = null;
  wordCache.HARD = null;
  wordCache.lastFetch = null;
  console.log('🗑️ Word cache cleared');
};
