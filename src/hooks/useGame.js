import { useState, useEffect, useCallback } from "react";
import { ref, set, onValue, get } from "firebase/database";
import { db, auth } from "../firebase";
import { TURN_DURATION } from "../constants/gameConfig";
import { calculatePoints, calculateArtistBonus } from "../utils/gameScoring";
import { useGameTimer } from "./useGameTimer";
import { updateGameStats } from "../services/userService";
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
    const unsubscribe = onValue(gameRef, async (snapshot) => {
      const data = snapshot.val();
      setGameState(data);

      if (data?.gameEnded && data?.finalScores) {
        setShowResults(false);
        setFinalResults(data.finalScores);
        
        // Update own statistics if registered user
        const user = auth.currentUser;
        if (user && !user.isAnonymous) {
          const myScore = data.finalScores.find(p => p.userId === user.uid);
          if (myScore) {
            const isWinner = data.finalScores[0]?.userId === user.uid;
            console.log('📊 Aggiornando le MIE statistiche:', { myScore, isWinner });
            await updateGameStats(user.uid, myScore.score, isWinner);
          }
        }
      }
    });
    return unsubscribe;
  }, [roomId]);

  // Next turn logic
  const nextTurn = useCallback(async () => {
    const difficultyId = gameState?.difficultyId || 'medium';
    const playerOrder = gameState?.playerOrder || players.map(p => p.name);
    
    // First, advance to next turn and increment counter
    const { nextArtist, word } = await advanceToNextTurn(
      roomId, 
      players, 
      gameState?.currentArtist,
      difficultyId,
      playerOrder
    );
    
    // Get updated draw counts after increment
    const drawCountsSnapshot = await get(ref(db, `rooms/${roomId}/game/drawCounts`));
    const updatedDrawCounts = drawCountsSnapshot.val() || {};
    
    // Now check if game should end (after incrementing)
    const roundsPerPlayer = gameState?.roundsPerPlayer || 6;
    
    // Only check players that are in the playerOrder (original rotation)
    const allPlayersFinished = playerOrder.every(playerName => {
      const count = updatedDrawCounts[playerName] || 0;
      return count >= roundsPerPlayer;
    });

    console.log(`🔍 Check fine gioco dopo turno:`, {
      roundsPerPlayer,
      updatedDrawCounts,
      allPlayersFinished
    });
    
    if (allPlayersFinished) {
      console.log('🏁 Partita finita! Tutti hanno disegnato', roundsPerPlayer, 'volte');
      await endGame(roomId, players);
      return;
    }

    // Continue with next turn
    const nextRound = (gameState?.round || 0) + 1;

    await set(ref(db, `rooms/${roomId}/game`), {
      ...gameState,
      active: true,
      currentArtist: nextArtist,
      word,
      turnStartedAt: Date.now(),
      guessedPlayers: [],
      round: nextRound,
      drawCounts: updatedDrawCounts
    });

    const drawCount = updatedDrawCounts[nextArtist] || 0;
    await sendSystemMessage(roomId, `🎨 Turno ${nextRound}: ${nextArtist} sta disegnando! (${drawCount}/${gameState.roundsPerPlayer})`);
  }, [roomId, players, gameState]);

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

  // Start game - receives config as parameter
  const startGame = useCallback(async (config) => {
    const user = auth.currentUser;
    if (!user) {
      alert("⚠️ Devi essere autenticato per iniziare la partita!");
      return;
    }

    console.log('Starting game with config:', config); // Debug log
    await startNewGame(roomId, players, user.uid, config);
  }, [roomId, players]);

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

    // Check if everyone guessed - use playerOrder for accurate count
    const playerOrder = gameState?.playerOrder || players.map(p => p.name);
    const totalPlayersInGame = playerOrder.length;
    const artistCount = 1;
    const guessedCount = updatedGuessedPlayers.length;
    
    console.log('🔍 Check tutti hanno indovinato:', {
      totalPlayersInGame,
      guessedCount,
      needed: totalPlayersInGame - artistCount
    });
    
    if (guessedCount >= totalPlayersInGame - artistCount) {
      console.log('✅ Tutti hanno indovinato! Chiamando endTurnManually...');
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
