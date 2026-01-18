import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { ref, onValue } from 'firebase/database';

export function useUserData() {
  const [nickname, setNickname] = useState('');
  const [xpPoints, setXpPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const [gamesPlayed, setGamesPlayed] = useState(0);
  const [gamesWon, setGamesWon] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const user = auth.currentUser;
  const isGuest = user?.isAnonymous;

  // Load XP and level from database
  useEffect(() => {
    if (!user) return;

    const userRef = ref(db, `users/${user.uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const xp = data.xp || 0;
        setXpPoints(xp);
        
        // Calcola il livello dinamicamente dagli XP
        let calculatedLevel = 1;
        while (true) {
          const xpForNextLevel = 100 * calculatedLevel * (calculatedLevel + 1) / 2;
          if (xp < xpForNextLevel) break;
          calculatedLevel++;
        }
        setLevel(calculatedLevel);
        
        setGamesPlayed(data.gamesPlayed || 0);
        setGamesWon(data.gamesWon || 0);
        setTotalScore(data.totalScore || 0);
        setBestScore(data.bestScore || 0);
      }
    });

    return () => unsubscribe();
  }, [user]);

  // Initialize nickname
  useEffect(() => {
    const savedNick = localStorage.getItem('nickname');
    if (savedNick) {
      setNickname(savedNick);
    } else if (isGuest) {
      const guestNick = `Ospite${Math.floor(Math.random() * 9999)}`;
      setNickname(guestNick);
      localStorage.setItem('nickname', guestNick);
    } else if (user?.email) {
      const emailNick = user.email.split('@')[0];
      setNickname(emailNick);
    }
  }, [isGuest, user]);

  return { nickname, setNickname, xpPoints, level, gamesPlayed, gamesWon, totalScore, bestScore, user, isGuest };
}