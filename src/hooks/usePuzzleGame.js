import { useState, useEffect, useCallback } from "react";
import { ref, onValue, get } from "firebase/database";
import { db, auth } from "../firebase";
import { PUZZLE_DRAWING } from "../constants/gameModes/puzzleDrawing";
import { useGameTimer } from "./useGameTimer";
import { updateGameStats } from "../services/userService";
import {
  startPuzzleGame,
  handlePuzzleGuess,
  advancePuzzleRound
} from "../services/puzzleGameService";

/**
 * Hook per gestire la logica del gioco Puzzle Drawing
 */
export function usePuzzleGame(roomId, nickname, players) {
  const [gameState, setGameState] = useState(null);
  const [timeLeft, setTimeLeft] = useState(PUZZLE_DRAWING.turnDuration);
  const [showResults, setShowResults] = useState(false);
  const [finalResults, setFinalResults] = useState(null);
  const [mySection, setMySection] = useState(null);

  // Trova l'uid del giocatore corrente
  const currentPlayer = players?.find(p => p.name === nickname);
  const currentPlayerId = currentPlayer?.id;

  // Determina il ruolo del giocatore corrente - usa solo uid per evitare conflitti con nomi duplicati
  const guessers = gameState?.currentGuessers || (gameState?.currentGuesser ? [gameState.currentGuesser] : []);
  const isGuesser = currentPlayerId && guessers.some(g => g.uid === currentPlayerId);
  const myDrawerInfo = gameState?.currentDrawers?.find(d => currentPlayerId && d.player.uid === currentPlayerId);
  const isDrawer = !!myDrawerInfo;

  // Aggiorna la sezione assegnata
  useEffect(() => {
    if (myDrawerInfo) {
      setMySection(myDrawerInfo.section);
    } else {
      setMySection(null);
    }
  }, [myDrawerInfo]);

  // Sincronizza timeLeft con turnDuration
  useEffect(() => {
    if (gameState?.turnDuration) {
      setTimeLeft(gameState.turnDuration);
    }
  }, [gameState?.turnDuration]);

  /* ---------------- GAME STATE LISTENER ---------------- */
  useEffect(() => {
    if (!roomId) return;

    const gameRef = ref(db, `rooms/${roomId}/game`);
    return onValue(gameRef, async snapshot => {
      try {
        const data = snapshot.val();
        setGameState(data);

        // Clear finalResults when a new game starts (so GameResults popup closes for all players)
        if (data?.active && !data?.gameEnded) {
          setFinalResults(null);
          setShowResults(false);
          return;
        }

        if (!data?.gameEnded || !data?.finalScores) return;

        setFinalResults(data.finalScores);
        setShowResults(true);

        // Aggiorna le statistiche del giocatore
        const user = auth.currentUser;
        if (user && !user.isAnonymous) {
          const myScore = data.finalScores.find(p => p.userId === user.uid);
          if (myScore) {
            const isWinner = data.finalScores[0]?.userId === user.uid;
            await updateGameStats(user.uid, myScore.score, isWinner);
          }
        }
      } catch (error) {
        console.error('Error in puzzle game state listener:', error);
      }
    });
  }, [roomId]);

  /* ---------------- TIMER ---------------- */
  const handleTimerEnd = useCallback(async () => {
    if (!gameState?.active || gameState?.gameEnded) return;

    console.log('⏰ Timer scaduto, avanzando al prossimo round...');

    try {
      await advancePuzzleRound(roomId);
    } catch (error) {
      console.error('Errore avanzando il round:', error);
    }
  }, [roomId, gameState]);

  useGameTimer(
    gameState,
    showResults,
    handleTimerEnd,
    setTimeLeft
  );

  /* ---------------- START GAME ---------------- */
  const startGame = useCallback(async (gameConfig) => {
    if (!players || !Array.isArray(players) || players.length < PUZZLE_DRAWING.minPlayers) {
      alert(`Servono almeno ${PUZZLE_DRAWING.minPlayers} giocatori per Puzzle Drawing!`);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) throw new Error("Utente non autenticato");

      await startPuzzleGame(roomId, players, user.uid, gameConfig);
    } catch (error) {
      console.error("Errore avviando Puzzle Drawing:", error);
      alert("Errore nell'avvio del gioco: " + error.message);
    }
  }, [roomId, players]);

  /* ---------------- HANDLE GUESS ---------------- */
  const handleGuess = useCallback(async (guesserNickname) => {
    if (!gameState?.active || gameState?.guessedInCurrentRound || !isGuesser) {
      return;
    }

    try {
      // Use the player's DB id (player record key) as guesserId so server-side matching
      // works for both authenticated and anonymous players.
      const guesserId = currentPlayerId || null;
      await handlePuzzleGuess(roomId, guesserId, guesserNickname || nickname, timeLeft);

      // Dopo un breve delay, avanza al prossimo round
      setTimeout(async () => {
        await advancePuzzleRound(roomId);
      }, 3000);

    } catch (error) {
      console.error("Errore gestendo l'indovinata:", error);
    }
  }, [roomId, gameState, nickname, isGuesser, timeLeft, currentPlayerId]);

  /* ---------------- RESTART GAME ---------------- */
  const restartGame = useCallback(async (acceptedPlayers = []) => {
    try {
      // Recupera la configurazione precedente
      const gameSnap = await get(ref(db, `rooms/${roomId}/game`));
      const previousGame = gameSnap.val();

      const gameConfig = {
        difficulty: {
          id: previousGame?.difficultyId || 'medium',
          name: previousGame?.difficulty || 'Medio'
        },
        turnDuration: previousGame?.turnDuration || PUZZLE_DRAWING.turnDuration,
        roundsPerGame: previousGame?.roundsPerPlayer || PUZZLE_DRAWING.minPlayers
      };

      setShowResults(false);
      setFinalResults(null);

      const user = auth.currentUser;
      if (!user) throw new Error("Utente non autenticato");

      // Use all current players for restart (acceptedPlayers filtering not needed for puzzle drawing)
      const playersToUse = players;

      await startPuzzleGame(roomId, playersToUse, user.uid, gameConfig);
    } catch (error) {
      console.error("Errore riavviando il gioco:", error);
      alert("Errore nel riavvio del gioco: " + error.message);
    }
  }, [roomId, players]);

  return {
    gameState,
    timeLeft,
    isDrawer,
    isGuesser,
    mySection,
    hasGuessed: gameState?.guessedInCurrentRound,
    finalResults,
    showResults,
    startGame,
    handleGuess,
    restartGame
  };
}
