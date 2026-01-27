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
      // Do not mirror guest/anonymous users to the public leaderboard
      if (!userData.isAnonymous) {
        const lbRef = ref(db, `leaderboard/${userId}`);
        await update(lbRef, {
          uid: userId,
          displayName: userData.nickname || userData.email || null,
          email: userData.email || null,
          totalScore,
          level,
          isAnonymous: !!userData.isAnonymous,
          lastUpdated: serverTimestamp()
        });
      } else {
        // If the user is anonymous, ensure there's no public leaderboard entry
        try {
          const lbRef = ref(db, `leaderboard/${userId}`);
          await update(lbRef, { uid: null });
        } catch (e) {
          // ignore
        }
      }
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
    // filter out anonymous/guest entries if present in the mirror
    const list = Object.entries(val)
      .map(([uid, u]) => ({ uid, ...u }))
      .filter(item => !item.isAnonymous && item.uid);
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
    // store per-uid listeners so we can update nicknames in realtime
    const perUidUnsubs = {};
    let latestPrimaryList = [];

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
        // Filter out anonymous users when using the users/ fallback
        const filtered = list.filter(item => !(label === 'users' && (item.isAnonymous || (item && item.isAnonymous))));
        filtered.sort((a, b) => (b[orderBy] || 0) - (a[orderBy] || 0));
        console.log(`[subscribeLeaderboard] source=${label} count=${filtered.length}`);
        onUpdate(filtered);
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
      // keep reference for per-uid nickname listeners
      latestPrimaryList = list.slice();
      const currentUids = new Set(latestPrimaryList.map(i => i.uid).filter(Boolean));
      // remove listeners for uids no longer in the top list
      Object.keys(perUidUnsubs).forEach((uid) => {
        if (!currentUids.has(uid)) {
          try { perUidUnsubs[uid](); } catch(e){}
          delete perUidUnsubs[uid];
        }
      });
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
      // Enrich mirror entries with gamesPlayed from users/ if available
      (async () => {
        try {
          const enriched = await Promise.all(list.map(async (item) => {
            try {
              const snapGames = await get(ref(db, `users/${item.uid}/gamesPlayed`));
              const gp = snapGames && snapGames.exists() ? snapGames.val() : (item.gamesPlayed !== undefined ? item.gamesPlayed : 0);
              return { ...item, gamesPlayed: gp };
            } catch (e) {
              return { ...item, gamesPlayed: (item.gamesPlayed !== undefined ? item.gamesPlayed : 0) };
            }
          }));
          // After initial enrichment, also subscribe to users/{uid}/nickname for realtime updates
          enriched.forEach((entry) => {
            const uid = entry.uid;
            if (!uid) return;
            if (perUidUnsubs[uid]) return; // already listening
            try {
              const nickRef = ref(db, `users/${uid}/nickname`);
              const unsubNick = onValue(nickRef, (snapNick) => {
                try {
                  const nickVal = snapNick && snapNick.exists() ? snapNick.val() : null;
                  // update latestPrimaryList and emit updated list
                  latestPrimaryList = latestPrimaryList.map(it => it.uid === uid ? { ...it, nickname: nickVal !== null ? nickVal : it.nickname } : it);
                  // ensure sorting remains consistent
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
              // ignore subscription errors
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
      // on error try fallback
      if (!unsubFallback) {
        console.log('[subscribeLeaderboard] error on leaderboard, falling back to users/');
        unsubFallback = subscribeTo(usersRef, 'users');
      }
    });

    return () => {
      try { if (typeof unsubPrimary === 'function') unsubPrimary(); } catch(e){}
      try { if (typeof unsubFallback === 'function') unsubFallback(); } catch(e){}
      // cleanup per-uid listeners
      Object.keys(perUidUnsubs).forEach((uid) => {
        try { perUidUnsubs[uid](); } catch(e){}
      });
    };
  } catch (error) {
    console.error('Error subscribing leaderboard:', error);
    return () => {};
  }
};
