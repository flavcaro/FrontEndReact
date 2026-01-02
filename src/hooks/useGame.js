import { useState, useEffect, useCallback, useRef } from "react";
import { ref, set, push, remove, onValue, get } from "firebase/database";
import { db, auth } from "../firebase";
import { 
  WORDS, 
  TURN_DURATION, 
  POINTS_PER_GUESS, 
  ARTIST_POINTS,
  TIME_BONUS_MULTIPLIER,
  ROUNDS_PER_GAME 
} from "../constants/gameConfig";

export function useGame(roomId, nickname, players) {
  const [gameState, setGameState] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
  const [showResults, setShowResults] = useState(false);
  const [finalResults, setFinalResults] = useState(null);
  const timerRef = useRef(null);

  const isArtist = gameState?.currentArtist === nickname;
  const hasGuessed = gameState?.guessedPlayers?.some(g => g.nickname === nickname);

  // Listener stato gioco
  useEffect(() => {
    const gameRef = ref(db, `rooms/${roomId}/game`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      setGameState(data);
      
      if (data?.turnStartedAt && data?.active) {
        const elapsed = Math.floor((Date.now() - data.turnStartedAt) / 1000);
        setTimeLeft(Math.max(0, TURN_DURATION - elapsed));
      }

      // Check if game ended
      if (data?.gameEnded) {
        setShowResults(false);
        setFinalResults(data.finalScores);
      }
    });
    return unsubscribe;
  }, [roomId]);

  // Calculate points based on time remaining
  const calculatePoints = (timeRemaining) => {
    const basePoints = POINTS_PER_GUESS;
    const timeBonus = Math.floor((timeRemaining / TURN_DURATION) * basePoints * TIME_BONUS_MULTIPLIER);
    return basePoints + timeBonus;
  };

  // Award points to artist
  const awardArtistPoints = useCallback(async () => {
    const artistPlayer = players.find(p => p.name === gameState?.currentArtist);
    if (artistPlayer) {
      const guessedCount = gameState?.guessedPlayers?.length || 0;
      const artistBonus = guessedCount * ARTIST_POINTS;
      
      const playerRef = ref(db, `rooms/${roomId}/players/${artistPlayer.id}/score`);
      await set(playerRef, (artistPlayer.score || 0) + artistBonus);

      await push(ref(db, `rooms/${roomId}/chat`), {
        user: "Sistema",
        message: `🎨 ${gameState.currentArtist} riceve ${artistBonus} punti come artista!`,
        timestamp: Date.now(),
        isSystem: true
      });
    }
  }, [roomId, players, gameState]);

  // Show round results
  const showRoundResults = useCallback(async () => {
    setShowResults(true);
    
    await push(ref(db, `rooms/${roomId}/chat`), {
      user: "Sistema",
      message: `📊 Fine turno! La parola era: "${gameState?.word}"`,
      timestamp: Date.now(),
      isSystem: true
    });

    // Award artist points
    await awardArtistPoints();

    // Wait 5 seconds before next turn
    setTimeout(async () => {
      setShowResults(false);
      await nextTurn();
    }, 5000);
  }, [roomId, gameState, awardArtistPoints]);

  // Check if game should end
  const checkGameEnd = useCallback(async () => {
    const currentRound = gameState?.round || 1;
    const totalRounds = players.length * ROUNDS_PER_GAME;

    if (currentRound >= totalRounds) {
      // Game ended - calculate final scores
      const playersSnapshot = await get(ref(db, `rooms/${roomId}/players`));
      const playersData = playersSnapshot.val() || {};
      
      const finalScores = Object.entries(playersData)
        .map(([id, player]) => ({
          id,
          name: player.name,
          score: player.score || 0
        }))
        .sort((a, b) => b.score - a.score);

      await set(ref(db, `rooms/${roomId}/game`), {
        active: false,
        gameEnded: true,
        finalScores,
        endedAt: Date.now()
      });

      await push(ref(db, `rooms/${roomId}/chat`), {
        user: "Sistema",
        message: `🎉 Partita terminata! Vincitore: ${finalScores[0].name} con ${finalScores[0].score} punti!`,
        timestamp: Date.now(),
        isSystem: true
      });

      return true;
    }
    return false;
  }, [roomId, players, gameState]);

  // Next turn logic
  const nextTurn = useCallback(async () => {
    // Check if game should end first
    const gameEnded = await checkGameEnd();
    if (gameEnded) return;

    await set(ref(db, `rooms/${roomId}/game/active`), false);
    
    // Clear canvas
    await Promise.all([
      remove(ref(db, `rooms/${roomId}/lines`)),
      remove(ref(db, `rooms/${roomId}/lines_temp`))
    ]);
    
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Select next artist
    const currentIndex = players.findIndex(p => p.name === gameState?.currentArtist);
    const nextIndex = (currentIndex + 1) % players.length;
    const nextArtist = players[nextIndex]?.name;
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    const nextRound = (gameState?.round || 0) + 1;

    await set(ref(db, `rooms/${roomId}/game`), {
      active: true,
      currentArtist: nextArtist,
      word,
      turnStartedAt: Date.now(),
      guessedPlayers: [],
      round: nextRound,
      totalRounds: players.length * ROUNDS_PER_GAME
    });

    await push(ref(db, `rooms/${roomId}/chat`), {
      user: "Sistema",
      message: `🎨 Turno ${nextRound}/${players.length * ROUNDS_PER_GAME}: ${nextArtist} sta disegnando!`,
      timestamp: Date.now(),
      isSystem: true
    });
  }, [roomId, players, gameState, checkGameEnd]);

  // End turn when time runs out
  const endTurnAutomatically = useCallback(async () => {
    await push(ref(db, `rooms/${roomId}/chat`), {
      user: "Sistema",
      message: `⏰ Tempo scaduto!`,
      timestamp: Date.now(),
      isSystem: true
    });

    await showRoundResults();
  }, [roomId, showRoundResults]);

  // End turn when everyone guessed
  const endTurnManually = useCallback(async () => {
    await push(ref(db, `rooms/${roomId}/chat`), {
      user: "Sistema",
      message: `🎉 Tutti hanno indovinato!`,
      timestamp: Date.now(),
      isSystem: true
    });

    await showRoundResults();
  }, [roomId, showRoundResults]);

  // Timer logic
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!gameState?.active || showResults) return;

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
  }, [gameState?.active, gameState?.round, showResults, endTurnAutomatically]);

  // Start game
  const startGame = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("⚠️ Devi essere autenticato per iniziare la partita!");
      return;
    }

    // Reset all player scores
    const resetPromises = players.map(player => 
      set(ref(db, `rooms/${roomId}/players/${player.id}/score`), 0)
    );
    await Promise.all(resetPromises);

    const firstArtist = players[0]?.name;
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    
    await set(ref(db, `rooms/${roomId}/game`), {
      active: true,
      currentArtist: firstArtist,
      word,
      turnStartedAt: Date.now(),
      guessedPlayers: [],
      round: 1,
      totalRounds: players.length * ROUNDS_PER_GAME,
      startedBy: user.uid,
      gameEnded: false
    });

    await Promise.all([
      remove(ref(db, `rooms/${roomId}/lines`)),
      remove(ref(db, `rooms/${roomId}/lines_temp`)),
      remove(ref(db, `rooms/${roomId}/chat`))
    ]);

    await push(ref(db, `rooms/${roomId}/chat`), {
      user: "Sistema",
      message: `🎮 Partita iniziata! ${players.length * ROUNDS_PER_GAME} turni totali. Ogni giocatore disegnerà ${ROUNDS_PER_GAME} volte.`,
      timestamp: Date.now(),
      isSystem: true
    });
  };

  // Handle correct guess
  const handleGuess = useCallback(async (nickname) => {
    const pointsEarned = calculatePoints(timeLeft);
    const playerRef = players.find(p => p.name === nickname);
    
    if (playerRef) {
      await set(ref(db, `rooms/${roomId}/players/${playerRef.id}/score`), 
        (playerRef.score || 0) + pointsEarned
      );
    }

    const updatedGuessedPlayers = [
      ...(gameState.guessedPlayers || []), 
      { nickname, points: pointsEarned, time: timeLeft }
    ];
    
    await set(ref(db, `rooms/${roomId}/game/guessedPlayers`), updatedGuessedPlayers);

    await push(ref(db, `rooms/${roomId}/chat`), {
      user: "Sistema",
      message: `🎉 ${nickname} ha indovinato! (+${pointsEarned} punti)`,
      timestamp: Date.now(),
      isSystem: true
    });

    // Check if everyone guessed
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
  }, [players, gameState, roomId, timeLeft, endTurnManually]);

  // Restart game
  const restartGame = async () => {
    await set(ref(db, `rooms/${roomId}/game`), null);
    setFinalResults(null);
    setShowResults(false);
  };

  return {
    gameState,
    timeLeft,
    isArtist,
    hasGuessed,
    showResults,
    finalResults,
    startGame,
    handleGuess,
    restartGame,
    timerRef
  };
}
