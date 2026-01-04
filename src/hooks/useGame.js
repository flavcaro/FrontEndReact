import { useState, useEffect, useCallback } from "react";
import { ref, set, onValue } from "firebase/database";
import { db, auth } from "../firebase";
import { TURN_DURATION } from "../constants/gameConfig";
import { calculatePoints, calculateArtistBonus } from "../utils/gameScoring";
import { useGameTimer } from "./useGameTimer";
import { 
  startNewGame, 
  endGame, 
  advanceToNextTurn, 
  awardPlayerPoints, 
  sendSystemMessage 
} from "../services/gameService";

export function useGame(roomId, nickname, players) {
  const [gameState, setGameState] = useState(null);
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
  const [showResults, setShowResults] = useState(false);
  const [finalResults, setFinalResults] = useState(null);

  const isArtist = gameState?.currentArtist === nickname;
  const hasGuessed = gameState?.guessedPlayers?.some(g => g.nickname === nickname);

  // Listen to game state
  useEffect(() => {
    const gameRef = ref(db, `rooms/${roomId}/game`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      setGameState(data);

      if (data?.gameEnded) {
        setShowResults(false);
        setFinalResults(data.finalScores);
      }
    });
    return unsubscribe;
  }, [roomId]);

  // Check if game should end
  const checkGameEnd = useCallback(async () => {
    const currentRound = gameState?.round || 1;
    const totalRounds = gameState?.totalRounds || players.length * 3;

    if (currentRound >= totalRounds) {
      await endGame(roomId, players);
      return true;
    }
    return false;
  }, [roomId, players, gameState]);

  // Next turn logic
  const nextTurn = useCallback(async () => {
    const gameEnded = await checkGameEnd();
    if (gameEnded) return;

    const difficultyId = gameState?.difficultyId || 'medium';
    const { nextArtist, word } = await advanceToNextTurn(
      roomId, 
      players, 
      gameState?.currentArtist,
      difficultyId
    );
    const nextRound = (gameState?.round || 0) + 1;

    await set(ref(db, `rooms/${roomId}/game`), {
      ...gameState,
      active: true,
      currentArtist: nextArtist,
      word,
      turnStartedAt: Date.now(),
      guessedPlayers: [],
      round: nextRound
    });

    await sendSystemMessage(roomId, `🎨 Turno ${nextRound}/${gameState.totalRounds}: ${nextArtist} sta disegnando!`);
  }, [roomId, players, gameState, checkGameEnd]);

  // Award points to artist
  const awardArtistPoints = useCallback(async () => {
    const artistPlayer = players.find(p => p.name === gameState?.currentArtist);
    
    if (artistPlayer) {
      const guessedCount = gameState?.guessedPlayers?.length || 0;
      const artistBonus = calculateArtistBonus(guessedCount);
      
      await awardPlayerPoints(roomId, artistPlayer.id, artistPlayer.score, artistBonus);
      await sendSystemMessage(roomId, `🎨 ${gameState.currentArtist} riceve ${artistBonus} punti come artista!`);
    }
  }, [roomId, players, gameState]);

  // Show round results
  const showRoundResults = useCallback(async () => {
    setShowResults(true);
    
    await sendSystemMessage(roomId, `📊 Fine turno! La parola era: "${gameState?.word}"`);
    await awardArtistPoints();

    setTimeout(async () => {
      setShowResults(false);
      await nextTurn();
    }, 5000);
  }, [roomId, gameState, awardArtistPoints, nextTurn]);

  // End turn callbacks
  const endTurnAutomatically = useCallback(async () => {
    await sendSystemMessage(roomId, `⏰ Tempo scaduto!`);
    await showRoundResults();
  }, [roomId, showRoundResults]);

  const endTurnManually = useCallback(async () => {
    await sendSystemMessage(roomId, `🎉 Tutti hanno indovinato!`);
    await showRoundResults();
  }, [roomId, showRoundResults]);

  // Timer
  const timerRef = useGameTimer(gameState, showResults, endTurnAutomatically, setTimeLeft);

  // Start game
  const startGame = async (config) => {
    const user = auth.currentUser;
    if (!user) {
      alert("⚠️ Devi essere autenticato per iniziare la partita!");
      return;
    }

    await startNewGame(roomId, players, user.uid, config);
  };

  // Handle correct guess
  const handleGuess = useCallback(async (nickname) => {
    const pointsEarned = calculatePoints(timeLeft);
    const playerRef = players.find(p => p.name === nickname);
    
    if (playerRef) {
      await awardPlayerPoints(roomId, playerRef.id, playerRef.score, pointsEarned);
    }

    const updatedGuessedPlayers = [
      ...(gameState.guessedPlayers || []), 
      { nickname, points: pointsEarned, time: timeLeft }
    ];
    
    await set(ref(db, `rooms/${roomId}/game/guessedPlayers`), updatedGuessedPlayers);
    await sendSystemMessage(roomId, `🎉 ${nickname} ha indovinato! (+${pointsEarned} punti)`);

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
  }, [players, gameState, roomId, timeLeft, endTurnManually, timerRef]);

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
