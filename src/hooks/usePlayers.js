import { useState, useEffect, useRef } from "react";
import { ref, set, push, onValue, remove } from "firebase/database";
import { db, auth } from "../firebase";

export function usePlayers(roomId, nickname) {
  const [players, setPlayers] = useState([]);
  const playerRefRef = useRef(null);

  // Aggiungi giocatore
  useEffect(() => {
    const addPlayer = async () => {
      const user = auth.currentUser;
      if (!user) {
        console.error("No authenticated user");
        return;
      }

      const newRef = push(ref(db, `rooms/${roomId}/players`));
      await set(newRef, { 
        name: nickname, 
        joinedAt: Date.now(), 
        score: 0,
        userId: user.uid, // Link player to authenticated user
        email: user.email
      });
      playerRefRef.current = newRef;
    };
    addPlayer();

    return () => {
      if (playerRefRef.current) remove(playerRefRef.current);
    };
  }, [roomId, nickname]);

  // Listener giocatori
  useEffect(() => {
    const playersRef = ref(db, `rooms/${roomId}/players`);
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const online = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
      setPlayers(online);
    });
    return unsubscribe;
  }, [roomId]);

  return { players };
}
