import { WORDS_BY_DIFFICULTY } from "../constants/gameConfig";
import { ref, get } from "firebase/database";
import { db } from "../firebase";

// Cache per le parole ottenute da Firebase
const wordCache = {
  EASY: null,
  MEDIUM: null,
  HARD: null,
  lastFetch: null
};

const CACHE_DURATION = 3600000; // 1 ora in millisecondi

/**
 * Ottiene parole da Firebase Realtime Database
 * @param {string} difficulty - 'EASY', 'MEDIUM', 'HARD'
 * @returns {Promise<string[]>}
 */
const fetchWordsFromFirebase = async (difficulty) => {
  try {
    const difficultyKey = difficulty.toLowerCase();
    const snapshot = await get(ref(db, `dictionary/${difficultyKey}`));
    
    if (snapshot.exists()) {
      const words = snapshot.val();
      console.log(`✅ Loaded ${words.length} words from Firebase for ${difficulty}`);
      return words;
    } else {
      console.warn(`⚠️ No words found in Firebase for ${difficulty}`);
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching words from Firebase:', error);
    return null;
  }
};

/**
 * Ottiene una parola casuale, prima prova da Firebase, poi usa il fallback locale
 * @param {string} difficulty - 'EASY', 'MEDIUM', 'HARD'
 * @returns {Promise<string>}
 */
export const getRandomWord = async (difficulty = 'MEDIUM') => {
  const difficultyKey = difficulty.toUpperCase();
  const now = Date.now();
  
  // Controlla se la cache è valida
  const isCacheValid = wordCache[difficultyKey] && 
                       wordCache.lastFetch && 
                       (now - wordCache.lastFetch) < CACHE_DURATION;
  
  // Se la cache non è valida, prova a fetchare da Firebase
  if (!isCacheValid) {
    console.log(`🔥 Fetching words from Firebase for ${difficultyKey}...`);
    const firebaseWords = await fetchWordsFromFirebase(difficultyKey);
    
    if (firebaseWords && firebaseWords.length > 0) {
      wordCache[difficultyKey] = firebaseWords;
      wordCache.lastFetch = now;
      console.log(`✅ Firebase words cached for ${difficultyKey}: ${firebaseWords.length} words`);
    }
  }
  
  // Usa parole da Firebase se disponibili, altrimenti usa il fallback locale
  const wordList = wordCache[difficultyKey] || WORDS_BY_DIFFICULTY[difficultyKey] || WORDS_BY_DIFFICULTY.MEDIUM;
  
  const randomWord = wordList[Math.floor(Math.random() * wordList.length)];
  console.log(`🎲 Selected word: "${randomWord}" (from ${wordCache[difficultyKey] ? 'Firebase' : 'LOCAL'})`);
  
  return randomWord;
};

/**
 * Versione sincrona che usa solo parole locali (backward compatibility)
 */
export const getRandomWordSync = (difficulty = 'MEDIUM') => {
  const wordList = WORDS_BY_DIFFICULTY[difficulty.toUpperCase()] || WORDS_BY_DIFFICULTY.MEDIUM;
  return wordList[Math.floor(Math.random() * wordList.length)];
};

/**
 * Pre-carica le parole dall'API per tutte le difficoltà
 */
export const preloadWords = async () => {
  console.log('🚀 Preloading words from API...');
  await Promise.all([
    getRandomWord('EASY'),
    getRandomWord('MEDIUM'),
    getRandomWord('HARD')
  ]);
  console.log('✅ Words preloaded');
};

/**
 * Svuota la cache
 */
export const clearWordCache = () => {
  wordCache.EASY = null;
  wordCache.MEDIUM = null;
  wordCache.HARD = null;
  wordCache.lastFetch = null;
  console.log('🗑️ Word cache cleared');
};
