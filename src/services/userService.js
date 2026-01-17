import { ref, set, serverTimestamp, get, update } from "firebase/database";
import { db } from "../firebase";

export const saveUserToDatabase = async (user) => {
  try {
    const userRef = ref(db, `users/${user.uid}`);
    await set(userRef, {
      uid: user.uid,
      email: user.email || null,
      isAnonymous: user.isAnonymous,
      createdAt: serverTimestamp(),
      lastLogin: serverTimestamp(),
      xp: 0,
      level: 1, // Livello iniziale
      gamesPlayed: 0,
      gamesWon: 0,
      totalScore: 0,
      bestScore: 0
    });
  } catch (error) {
    console.error("Error saving user to database:", error);
    throw error;
  }
};

export const updateLastLogin = async (uid) => {
  try {
    const userRef = ref(db, `users/${uid}/lastLogin`);
    await set(userRef, serverTimestamp());
  } catch (error) {
    console.error("Error updating last login:", error);
  }
};

export const updateGameStats = async (userId, score, isWinner) => {
  try {
    console.log(`📊 Aggiornamento statistiche per userId: ${userId}, score: ${score}, winner: ${isWinner}`);
    const userRef = ref(db, `users/${userId}`);
    const snapshot = await get(userRef);
    const userData = snapshot.val() || {};

    const gamesPlayed = (userData.gamesPlayed || 0) + 1;
    const gamesWon = isWinner ? (userData.gamesWon || 0) + 1 : (userData.gamesWon || 0);
    const totalScore = (userData.totalScore || 0) + score;
    const bestScore = Math.max(userData.bestScore || 0, score);
    
    // XP basati sul punteggio: 1 XP per ogni punto + bonus vittoria
    const baseXp = score; // 1 XP per ogni punto fatto
    const winnerBonus = isWinner ? 100 : 0; // Bonus di 100 XP per vittoria
    const newXp = (userData.xp || 0) + baseXp + winnerBonus;
    
    // Calcolo livello con progressione crescente
    // Livello N richiede: 100 * (N-1) * N / 2 XP
    let level = 1;
    while (true) {
      const xpForNextLevel = 100 * level * (level + 1) / 2;
      if (newXp < xpForNextLevel) break;
      level++;
    }

    console.log(`📊 Nuove statistiche:`, { gamesPlayed, gamesWon, totalScore, bestScore, xp: newXp, level, xpGuadagnati: baseXp + winnerBonus });
    
    await update(userRef, {
      gamesPlayed,
      gamesWon,
      totalScore,
      bestScore,
      xp: newXp,
      level,
      lastPlayed: serverTimestamp()
    });
    
    console.log(`✅ Statistiche aggiornate con successo per ${userId}`);
  } catch (error) {
    console.error("Error updating game stats:", error);
  }
};
