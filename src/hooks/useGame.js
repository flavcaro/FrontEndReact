import { useState, useEffect, useCallback, useRef } from "react";
import { ref, set, push, remove, onValue } from "firebase/database";
import { db } from "../firebase";
import { WORDS, TURN_DURATION, POINTS_PER_GUESS } from "../constants/gameConfig";

export function useGame(roomId, nickname, players) {
  const [gameState, setGameState] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
  const timerRef = useRef(null);

  const isArtist = gameState?.currentArtist === nickname;
  const hasGuessed = gameState?.guessedPlayers?.includes(nickname);

  // Listener stato gioco
  useEffect(() => {
    const gameRef = ref(db, `rooms/${roomId}/game`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      setGameState(data);
      if (data?.turnStartedAt) {
        const elapsed = Math.floor((Date.now() - data.turnStartedAt) / 1000);
        setTimeLeft(Math.max(0, TURN_DURATION - elapsed));
      }
    });
    return unsubscribe;
  }, [roomId]);

  // Funzione per passare al turno successivo
  const nextTurn = useCallback(async () => {
    await set(ref(db, `rooms/${roomId}/game/active`), false);
    
    await Promise.all([
      remove(ref(db, `rooms/${roomId}/lines`)),
      remove(ref(db, `rooms/${roomId}/lines_temp`))
    ]);
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    const currentIndex = players.findIndex(p => p.name === gameState?.currentArtist);
    const nextIndex = (currentIndex + 1) % players.length;
    const nextArtist = players[nextIndex]?.name;
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];

    await set(ref(db, `rooms/${roomId}/game`), {
      active: true,
      currentArtist: nextArtist,
      word,
      turnStartedAt: Date.now(),
      guessedPlayers: [],
      round: (gameState?.round || 1) + 1
    });
  }, [roomId, players, gameState?.currentArtist, gameState?.round]);

  // Fine turno automatica
  const endTurnAutomatically = useCallback(async () => {
    await push(ref(db, `rooms/${roomId}/chat`), {
      user: "Sistema",
      message: `⏰ Tempo scaduto! La parola era: ${gameState?.word}`,
      timestamp: Date.now(),
      isSystem: true
    });

    setTimeout(() => nextTurn(), 3000);
  }, [roomId, gameState?.word, nextTurn]);

  // Fine turno manuale
  const endTurnManually = useCallback(async () => {
    await push(ref(db, `rooms/${roomId}/chat`), {
      user: "Sistema",
      message: `🎉 Tutti hanno indovinato! La parola era: ${gameState?.word}`,
      timestamp: Date.now(),
      isSystem: true
    });

    setTimeout(() => nextTurn(), 2000);
  }, [roomId, gameState?.word, nextTurn]);

  // Timer
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!gameState?.active) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          endTurnAutomatically();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState?.active, gameState?.round, endTurnAutomatically]);

  // Inizia gioco
  const startGame = async () => {
    const firstArtist = players[0]?.name;
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    
    await set(ref(db, `rooms/${roomId}/game`), {
      active: true,
      currentArtist: firstArtist,
      word,
      turnStartedAt: Date.now(),
      guessedPlayers: [],
      round: 1
    });

    await Promise.all([
      remove(ref(db, `rooms/${roomId}/lines`)),
      remove(ref(db, `rooms/${roomId}/lines_temp`)),
      set(ref(db, `rooms/${roomId}/chat`), null)
    ]);
  };

  // Gestisci indovinamento
  const handleGuess = useCallback(async (nickname) => {
    const pointsEarned = POINTS_PER_GUESS;
    const playerRef = players.find(p => p.name === nickname);
    
    if (playerRef) {
      await set(ref(db, `rooms/${roomId}/players/${playerRef.id}/score`), 
        (playerRef.score || 0) + pointsEarned
      );
    }

    const updatedGuessedPlayers = [...(gameState.guessedPlayers || []), nickname];
    
    await set(ref(db, `rooms/${roomId}/game/guessedPlayers`), updatedGuessedPlayers);

    await push(ref(db, `rooms/${roomId}/chat`), {
      user: "Sistema",
      message: `🎉 ${nickname} ha indovinato! (+${pointsEarned} punti)`,
      timestamp: Date.now(),
      isSystem: true
    });

    // Se tutti hanno indovinato
    const totalPlayers = players.length;
    const artistCount = 1;
    const guessedCount = updatedGuessedPlayers.length;
    
    if (guessedCount >= totalPlayers - artistCount) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeout(() => endTurnManually(), 1000);
    }
  }, [players, gameState, roomId, endTurnManually]);

  return {
    gameState,
    timeLeft,
    isArtist,
    hasGuessed,
    startGame,
    handleGuess,
    timerRef
  };
}
