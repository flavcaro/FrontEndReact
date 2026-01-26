import { ref, set, serverTimestamp, get, update, query, orderByChild, limitToLast, onValue } from "firebase/database";
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
    // Mirror summary to leaderboard node for fast reads
    try {
      const lbRef = ref(db, `leaderboard/${userId}`);
      await update(lbRef, {
        uid: userId,
        displayName: userData.nickname || userData.email || null,
        email: userData.email || null,
        totalScore,
        level,
        lastUpdated: serverTimestamp()
      });
    } catch (err) {
      console.warn('Could not update leaderboard mirror', err);
    }
    
    console.log(`✅ Statistiche aggiornate con successo per ${userId}`);
  } catch (error) {
    console.error("Error updating game stats:", error);
  }
};

export const fetchLeaderboard = async (limit = 20, orderBy = 'totalScore') => {
  try {
    const q = query(ref(db, 'leaderboard'), orderByChild(orderBy), limitToLast(limit));
    const snap = await get(q);
    const val = snap.val() || {};
    const list = Object.entries(val).map(([uid, u]) => ({ uid, ...u }));
    // sort descending by chosen key
    list.sort((a, b) => (b[orderBy] || 0) - (a[orderBy] || 0));
    return list;
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
};

// Subscribe to leaderboard changes in realtime. Returns an unsubscribe function.
export const subscribeLeaderboard = (onUpdate, limit = 20, orderBy = 'totalScore') => {
  try {
    const leaderboardRef = ref(db, 'leaderboard');
    const usersRef = ref(db, 'users');

    const subscribeTo = (refNode, label) => {
      const q = query(refNode, orderByChild(orderBy), limitToLast(limit));
      const unsub = onValue(q, (snap) => {
        const val = snap.val() || {};
        const list = Object.entries(val).map(([uid, u]) => {
          if (label === 'users') {
            // Use public summary when available, otherwise fall back to user's root fields
            const pub = (u && u.public) || u || {};
            // normalize fields expected by UI
            const displayName = pub.displayName || pub.nickname || pub.email || null;
            const totalScoreVal = (pub.totalScore !== undefined) ? pub.totalScore : (u && u.totalScore) || 0;
            const levelVal = (pub.level !== undefined) ? pub.level : (u && u.level) || 1;
            const gamesPlayedVal = (pub.gamesPlayed !== undefined) ? pub.gamesPlayed : (u && u.gamesPlayed) || 0;
            return ({ uid, displayName, email: pub.email || u.email || null, totalScore: totalScoreVal, level: levelVal, gamesPlayed: gamesPlayedVal });
          }
          return ({ uid, ...u });
        });
        list.sort((a, b) => (b[orderBy] || 0) - (a[orderBy] || 0));
        console.log(`[subscribeLeaderboard] source=${label} count=${list.length}`);
        onUpdate(list);
      }, (err) => {
        console.error('Realtime leaderboard error', err);
      });
      return unsub;
    };

    // First try leaderboard/ (mirror). If it's empty on first snapshot, fall back to users/.
    let unsubPrimary = null;
    let unsubFallback = null;
    let initialChecked = false;

    const primaryQuery = query(leaderboardRef, orderByChild(orderBy), limitToLast(limit));
    unsubPrimary = onValue(primaryQuery, (snap) => {
      const val = snap.val() || {};
      const has = Object.keys(val).length > 0;
      const list = Object.entries(val).map(([uid, u]) => ({ uid, ...u }));
      list.sort((a, b) => (b[orderBy] || 0) - (a[orderBy] || 0));
      if (!initialChecked) {
        initialChecked = true;
        if (!has) {
          // leaderboard empty: switch to users/ fallback
          console.log('[subscribeLeaderboard] leaderboard empty, falling back to users/');
          if (typeof unsubPrimary === 'function') unsubPrimary();
          unsubFallback = subscribeTo(usersRef, 'users');
          return;
        }
      }
      console.log(`[subscribeLeaderboard] source=leaderboard count=${list.length}`);
      onUpdate(list);
    }, (err) => {
      console.error('Realtime leaderboard error', err);
      // on error try fallback
      if (!unsubFallback) {
        console.log('[subscribeLeaderboard] error on leaderboard, falling back to users/');
        unsubFallback = subscribeTo(usersRef, 'users');
      }
    });

    return () => {
      try { if (typeof unsubPrimary === 'function') unsubPrimary(); } catch(e){}
      try { if (typeof unsubFallback === 'function') unsubFallback(); } catch(e){}
    };
  } catch (error) {
    console.error('Error subscribing leaderboard:', error);
    return () => {};
  }
};
