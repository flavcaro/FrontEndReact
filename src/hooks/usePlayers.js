import { useState, useEffect, useRef } from "react";
import { ref, set, push, onValue, remove } from "firebase/database";
import { db } from "../firebase";

export function usePlayers(roomId, nickname) {
  const [players, setPlayers] = useState([]);
  const playerRefRef = useRef(null);

  // Aggiungi giocatore
  useEffect(() => {
    const addPlayer = async () => {
      const newRef = push(ref(db, `rooms/${roomId}/players`));
      await set(newRef, { name: nickname, joinedAt: Date.now(), score: 0 });
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
