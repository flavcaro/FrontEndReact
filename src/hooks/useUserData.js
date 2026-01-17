import { useState, useEffect } from 'react';
import { auth, db } from '../firebase';
import { ref, onValue } from 'firebase/database';

export function useUserData() {
  const [nickname, setNickname] = useState('');
  const [xpPoints, setXpPoints] = useState(0);
  const [level, setLevel] = useState(1);
  const user = auth.currentUser;
  const isGuest = user?.isAnonymous;

  // Load XP and level from database
  useEffect(() => {
    if (!user) return;

    const userRef = ref(db, `users/${user.uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setXpPoints(data.xp || 0);
        setLevel(data.level || 1);
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

  return { nickname, setNickname, xpPoints, level, user, isGuest };
}