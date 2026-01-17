import { useState, useEffect, useCallback } from "react";
import { ref, set, onValue, get, remove } from "firebase/database";
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

  // End game for all if owner leaves
  useEffect(() => {
    if (!roomId || !gameState?.active || gameState?.gameEnded) return;
    const ownerRef = ref(db, `rooms/${roomId}/owner`);
    const playersRef = ref(db, `rooms/${roomId}/players`);
    let unsubOwner, unsubPlayers;

    // Listen for owner changes
    unsubOwner = onValue(ownerRef, async (ownerSnap) => {
      const ownerData = ownerSnap.val();
      if (!ownerData) {
        // Owner field deleted, end game for all
        await set(ref(db, `rooms/${roomId}/game`), {
          ...gameState,
          active: false,
          gameEnded: true,
          endReason: 'owner_left',
          endedAt: Date.now(),
          finalScores: players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score || 0,
            userId: p.userId || null
          }))
        });
        await sendSystemMessage(roomId, '⚠️ Il creatore della stanza ha abbandonato. Partita terminata!');
      } else {
        // Also check if the owner is still in the players list
        unsubPlayers = onValue(playersRef, (playersSnap) => {
          const playersData = playersSnap.val() || {};
          const stillPresent = Object.values(playersData).some(p => p.sessionId === ownerData.sessionId);
          if (!stillPresent) {
            (async () => {
              await set(ref(db, `rooms/${roomId}/game`), {
                ...gameState,
                active: false,
                gameEnded: true,
                endReason: 'owner_left',
                endedAt: Date.now(),
                finalScores: players.map(p => ({
                  id: p.id,
                  name: p.name,
                  score: p.score || 0,
                  userId: p.userId || null
                }))
              });
              await sendSystemMessage(roomId, '⚠️ Il creatore della stanza ha abbandonato. Partita terminata!');
            })();
          }
        });
      }
    });
    return () => {
      if (typeof unsubOwner === 'function') unsubOwner();
      if (typeof unsubPlayers === 'function') unsubPlayers();
    };
  }, [roomId, gameState, players]);
import { useState, useEffect, useCallback } from "react";
import { ref, set, onValue, get, remove } from "firebase/database";
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

      // Prevent XP if game ended for early reasons
      const endedForEarlyReason = data?.endReason === 'owner_left' || data?.endReason === 'not_enough_players';

      if (data?.gameEnded && data?.finalScores) {
        setShowResults(false);
        setFinalResults(data.finalScores);
        
        // Update own statistics if registered user and not early end
        const user = auth.currentUser;
        if (!endedForEarlyReason && user && !user.isAnonymous) {
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
  // Stop and finish game if only one player remains
  useEffect(() => {
    if (!gameState?.active || gameState?.gameEnded) return;
    if (players.length === 1) {
      // End game for not enough players
      (async () => {
        await set(ref(db, `rooms/${roomId}/game`), {
          ...gameState,
          active: false,
          gameEnded: true,
          endReason: 'not_enough_players',
          endedAt: Date.now(),
          finalScores: [
            {
              id: players[0].id,
              name: players[0].name,
              score: players[0].score || 0,
              userId: players[0].userId || null
            }
          ]
        });
        await sendSystemMessage(roomId, '⚠️ La partita è terminata: non ci sono abbastanza giocatori.');
      })();
    }
  }, [players, gameState, roomId]);

  // Next turn logic
  const nextTurn = useCallback(async () => {
    const difficultyId = gameState?.difficultyId || 'medium';
    const playerOrder = gameState?.playerOrder || players.map(p => p.name);
    const roundsPerPlayer = gameState?.roundsPerPlayer || 6;
    
    // Get current draw counts BEFORE advancing
    const drawCountsSnapshotBefore = await get(ref(db, `rooms/${roomId}/game/drawCounts`));
    const currentDrawCounts = drawCountsSnapshotBefore.val() || {};
    
    // Check if game should end BEFORE next turn
    const allPlayersFinished = playerOrder.every(playerName => {
      const count = currentDrawCounts[playerName] || 0;
      return count >= roundsPerPlayer;
    });

    console.log(`🔍 Check fine gioco PRIMA del prossimo turno:`, {
      roundsPerPlayer,
      currentDrawCounts,
      allPlayersFinished,
      currentArtist: gameState?.currentArtist
    });
    
    if (allPlayersFinished) {
      console.log('🏁 Partita finita! Tutti hanno disegnato', roundsPerPlayer, 'volte');
      await endGame(roomId, players);
      return;
    }
    
    // Advance to next turn and increment counter
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
      drawCounts: updatedDrawCounts,
      allGuessed: false // Reset flag per nuovo turno
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

    // Pulisci la canvas subito
    await Promise.all([
      remove(ref(db, `rooms/${roomId}/lines`)),
      remove(ref(db, `rooms/${roomId}/lines_temp`)),
    ]);
    
    await sendSystemMessage(roomId, `📊 Fine turno! La parola era: "${gameState?.word}"`);
    await awardArtistPoints();

    setTimeout(async () => {
      setShowResults(false);
      await nextTurn();
    }, 5000);
  }, [roomId, gameState, awardArtistPoints, nextTurn]);

  // End turn callbacks
  const endTurnAutomatically = useCallback(async () => {
    if (!isArtist) return; // Solo l'artista gestisce la fine turno per timeout
    await sendSystemMessage(roomId, `⏰ Tempo scaduto!`);
    await showRoundResults();
  }, [roomId, showRoundResults, isArtist]);

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

    // Check if everyone guessed - usa sempre la lista aggiornata dei giocatori
    const totalPlayersInGame = players.length;
    const artistCount = 1;
    const guessedCount = updatedGuessedPlayers.length;
    
    console.log('🔍 Check tutti hanno indovinato:', {
      totalPlayersInGame,
      guessedCount,
      needed: totalPlayersInGame - artistCount
    });
    
    if (guessedCount >= totalPlayersInGame - artistCount) {
      console.log('✅ Tutti hanno indovinato! Chiamando endTurnManually...');
      
      // Invece di disattivare il gioco, impostiamo un flag per bloccare il disegno
      await set(ref(db, `rooms/${roomId}/game/allGuessed`), true);
      
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
