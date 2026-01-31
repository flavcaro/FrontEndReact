import { useState, useEffect, useCallback, useRef } from "react";
import { ref, set, onValue, get, remove } from "firebase/database";
import { db, auth } from "../firebase";
import { TURN_DURATION, getSurvivalDifficulty, applySurvivalPenalties } from "../constants/gameConfig";
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
  const hasGuessed = gameState?.guessedPlayers?.some(
    g => g.nickname === nickname
  );

  // Sincronizza timeLeft con turnDuration dal gameState
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

        // Sincronizza showResults per tutti
        if (data?.showResults) {
          setShowResults(true);
        } else {
          setShowResults(false);
        }

        // Clear finalResults when a new game starts (so GameResults popup closes for all players)
        if (data?.active && !data?.gameEnded) {
          setFinalResults(null);
          return;
        }

        if (!data?.gameEnded || !data?.finalScores) return;

        setFinalResults(data.finalScores);

        const earlyEnd =
          data.endReason === "owner_left" ||
          data.endReason === "not_enough_players";

        const user = auth.currentUser;
        if (!earlyEnd && user && !user.isAnonymous) {
          const myScore = data.finalScores.find(
            p => p.userId === user.uid
          );
          if (myScore) {
            const isWinner = data.finalScores[0]?.userId === user.uid;
            await updateGameStats(user.uid, myScore.score, isWinner);
          }
        }
      } catch (error) {
        console.error('Error in game state listener:', error);
      }
    });
  }, [roomId]);

  /* ---------------- OWNER LEAVES ---------------- */
  useEffect(() => {
    if (!roomId || !gameState?.active || gameState?.gameEnded) return;

    const ownerRef = ref(db, `rooms/${roomId}/owner`);
    const playersRef = ref(db, `rooms/${roomId}/players`);

    let unsubPlayers;
    let ownerMissingTimer = null;

    const unsubOwner = onValue(ownerRef, ownerSnap => {
      try {
        const owner = ownerSnap.val();
        console.log('[useGame] ownerRef update', { roomId, owner });

        // If owner exists again, cancel any pending end-for-owner timer
        if (owner) {
          if (ownerMissingTimer) {
            clearTimeout(ownerMissingTimer);
            ownerMissingTimer = null;
            console.log('[useGame] owner returned, cancelled pending endForOwnerLeave');
          }

          unsubPlayers = onValue(playersRef, snap => {
            try {
              const list = Object.values(snap.val() || {});
              const stillHere = list.some(
                p => p.sessionId === owner.sessionId
              );
              if (!stillHere) {
                console.log('[useGame] owner session not present among players -> scheduling endForOwnerLeave');
                if (ownerMissingTimer) clearTimeout(ownerMissingTimer);
                ownerMissingTimer = setTimeout(async () => {
                  try {
                    const restartSnap = await get(ref(db, `rooms/${roomId}/restartVote`));
                    const restartData = restartSnap.val();
                    console.log('[useGame] delayed owner-missing check restartVote', { roomId, restartData });
                    if (restartData && (restartData.status === 'open' || restartData.status === 'accepted')) {
                      console.log('[useGame] owner missing but restartVote in progress, skipping endForOwnerLeave');
                      return;
                    }
                    endForOwnerLeave();
                  } catch (err) {
                    console.error('[useGame] error during delayed owner-missing check', err);
                    endForOwnerLeave();
                  }
                }, 1200);
              }
            } catch (error) {
              console.error('Error in owner leave players listener:', error);
            }
          });
          return;
        }

        // Owner node missing entirely: schedule a short delay before ending
        console.log('[useGame] owner node missing -> scheduling endForOwnerLeave');
        if (ownerMissingTimer) clearTimeout(ownerMissingTimer);
        ownerMissingTimer = setTimeout(async () => {
          try {
            const restartSnap = await get(ref(db, `rooms/${roomId}/restartVote`));
            const restartData = restartSnap.val();
            console.log('[useGame] delayed owner-node-missing check restartVote', { roomId, restartData });
            if (restartData && (restartData.status === 'open' || restartData.status === 'accepted')) {
              console.log('[useGame] owner node missing but restartVote in progress, skipping endForOwnerLeave');
              return;
            }
            endForOwnerLeave();
          } catch (err) {
            console.error('[useGame] error during delayed owner-node-missing check', err);
            endForOwnerLeave();
          }
        }, 1200);
      } catch (error) {
        console.error('Error in owner leave listener:', error);
      }
    });

    async function endForOwnerLeave() {
      try {
        // If a restartVote is in progress or accepted, skip ending the game here
        const restartSnap = await get(ref(db, `rooms/${roomId}/restartVote`));
        const restartData = restartSnap.val();
        if (restartData && (restartData.status === 'open' || restartData.status === 'accepted')) {
          console.log('[useGame] owner left detected but restartVote in progress, skipping endForOwnerLeave');
          return;
        }

        await set(ref(db, `rooms/${roomId}/game`), {
          ...gameState,
          active: false,
          gameEnded: true,
          endReason: "owner_left",
          endedAt: Date.now(),
          finalScores: players.map(p => ({
            id: p.id,
            name: p.name,
            score: p.score || 0,
            userId: p.userId || null
          }))
        });

        await sendSystemMessage(
          roomId,
          "⚠️ Il creatore della stanza ha abbandonato. Partita terminata!"
        );
      } catch (err) {
        console.error('[useGame] error in endForOwnerLeave guard:', err);
      }
    }

    return () => {
      unsubOwner?.();
      unsubPlayers?.();
      if (ownerMissingTimer) clearTimeout(ownerMissingTimer);
    };
  }, [roomId, gameState, players]);

  /* ---------------- NOT ENOUGH PLAYERS (ANYONE LEFT) ---------------- */
  // Timeout per evitare falsi positivi su disconnessioni temporanee
  const notEnoughPlayersTimeout = useRef(null);

  useEffect(() => {
    if (!gameState?.active || gameState?.gameEnded) {
      if (notEnoughPlayersTimeout.current) {
        clearTimeout(notEnoughPlayersTimeout.current);
        notEnoughPlayersTimeout.current = null;
      }
      return;
    }
    if (players.length !== 1) {
      if (notEnoughPlayersTimeout.current) {
        clearTimeout(notEnoughPlayersTimeout.current);
        notEnoughPlayersTimeout.current = null;
      }
      return;
    }

    // Se scendiamo a 1 giocatore, aspetta 3 secondi prima di terminare
    notEnoughPlayersTimeout.current = setTimeout(async () => {
      // Ricontrolla che siamo ancora a 1 giocatore e partita attiva
      if (!gameState?.active || gameState?.gameEnded) return;
      if (players.length !== 1) return;
      await set(ref(db, `rooms/${roomId}/game`), {
        ...gameState,
        active: false,
        gameEnded: true,
        endReason: "not_enough_players",
        endedAt: Date.now(),
        finalScores: [{
          id: players[0].id,
          name: players[0].name,
          score: players[0].score || 0,
          userId: players[0].userId || null
        }]
      });
      await sendSystemMessage(
        roomId,
        "⚠️ Partita terminata: non ci sono abbastanza giocatori."
      );
    }, 3000);

    return () => {
      if (notEnoughPlayersTimeout.current) {
        clearTimeout(notEnoughPlayersTimeout.current);
        notEnoughPlayersTimeout.current = null;
      }
    };
  }, [players.length, gameState, roomId, players]);

  const nextTurn = useCallback(async () => {
    let difficultyId = gameState?.difficultyId || "medium";

    // Survival mode: increasing difficulty
    if (gameState?.survivalMode) {
      const round = (gameState?.round || 0) + 1;
      difficultyId = getSurvivalDifficulty(round);
    }

    const playerOrder =
      gameState?.playerOrder || players.map(p => p.name);
    const roundsPerPlayer = gameState?.roundsPerPlayer || 6;

    // Determina chi è il prossimo artista (senza incrementare ancora)
    const { nextArtist, word, chaosEffects, updatedUsedWords } = await advanceToNextTurn(
      roomId,
      players,
      gameState?.currentArtist,
      difficultyId,
      playerOrder
    );

    // Leggi i contatori attuali
    const drawCountsSnapshot = await get(ref(db, `rooms/${roomId}/game/drawCounts`));
    const currentCounts = drawCountsSnapshot.val() || {};

    // Controlla quante volte il prossimo artista ha già disegnato
    const nextArtistCount = currentCounts[nextArtist] || 0;

    // Se il prossimo artista ha già disegnato abbastanza volte, cerca il prossimo disponibile
    // oppure termina il gioco se tutti hanno finito
    if (nextArtistCount >= roundsPerPlayer) {
      // Tutti hanno completato i loro turni
      await endGame(roomId, players);
      return;
    }

    // Incrementa il contatore del prossimo artista che sta per disegnare
    currentCounts[nextArtist] = nextArtistCount + 1;

    // Salva il nuovo contatore
    await set(ref(db, `rooms/${roomId}/game/drawCounts`), currentCounts);

    // Leggi playerLives aggiornato dal database
    const playerLivesSnapshot = await get(ref(db, `rooms/${roomId}/game/playerLives`));
    const currentPlayerLives = playerLivesSnapshot.val() || {};

    const nextRound = (gameState?.round || 0) + 1;

    await set(ref(db, `rooms/${roomId}/game`), {
      ...gameState,
      active: true,
      currentArtist: nextArtist,
      word,
      usedWords: updatedUsedWords, // Aggiorna la lista delle parole usate
      turnStartedAt: Date.now(),
      guessedPlayers: [],
      round: nextRound,
      drawCounts: currentCounts,
      allGuessed: false,
      // Use chaosEffects provided/generated server-side
      chaosEffects: chaosEffects || null,
      playerLives: currentPlayerLives  // Usa il valore aggiornato dal database
    });

    // Reset timer alla durata configurata
    setTimeLeft(gameState?.turnDuration || TURN_DURATION);

    await sendSystemMessage(
      roomId,
      `🎨 Turno ${nextRound}: ${nextArtist} sta disegnando!`
    );
  }, [roomId, players, gameState]);

  /* ---------------- ARTIST BONUS ---------------- */
  const awardArtistPoints = useCallback(async () => {
    const artist = players.find(
      p => p.name === gameState?.currentArtist
    );
    if (!artist) return;

    // Leggi direttamente guessedPlayers dal database per avere il valore aggiornato
    const guessedRef = ref(db, `rooms/${roomId}/game/guessedPlayers`);
    const guessedSnapshot = await get(guessedRef);
    const guessedPlayers = guessedSnapshot.val() || [];
    const guessedCount = guessedPlayers.length;

    const bonus = calculateArtistBonus(guessedCount);

    await awardPlayerPoints(
      roomId,
      artist.id,
      artist.score,
      bonus
    );
    await sendSystemMessage(
      roomId,
      `🎨 ${artist.name} riceve ${bonus} punti!`
    );
  }, [roomId, players, gameState]);

  /* ---------------- ROUND END ---------------- */
  const showRoundResults = useCallback(async () => {
    // Aggiorna lo stato globale per tutti
    await set(ref(db, `rooms/${roomId}/game/showResults`), true);
    setShowResults(true);

    await Promise.all([
      remove(ref(db, `rooms/${roomId}/lines`)),
      remove(ref(db, `rooms/${roomId}/lines_temp`))
    ]);

    await sendSystemMessage(
      roomId,
      `📊 Fine turno! La parola era: "${gameState?.word}"`
    );

    await awardArtistPoints();

    // Survival mode penalties - check if game should end
    const survivalResult = await applySurvivalPenalties(roomId, gameState, players, sendSystemMessage, db, set, ref, get);

    // If survival mode determined a winner (only one player left alive), end the game
    if (survivalResult?.shouldEndGame) {
      setTimeout(async () => {
        await set(ref(db, `rooms/${roomId}/game/showResults`), false);
        setShowResults(false);
        await endGame(roomId, players);
      }, 5000);
      return;
    }

    setTimeout(async () => {
      // Reset showResults globale
      await set(ref(db, `rooms/${roomId}/game/showResults`), false);
      setShowResults(false);
      await nextTurn();
    }, 5000);
  }, [roomId, gameState, awardArtistPoints, nextTurn, players]);

  /* ---------------- TIMER ---------------- */
  const endTurnAutomatically = useCallback(async () => {
    if (!isArtist) return;
    await sendSystemMessage(roomId, "⏰ Tempo scaduto!");
    await showRoundResults();
  }, [roomId, showRoundResults, isArtist]);

  const timerRef = useGameTimer(
    gameState,
    showResults,
    endTurnAutomatically,
    setTimeLeft
  );

  /* ---------------- START GAME ---------------- */
  const startGame = useCallback(async config => {
    const user = auth.currentUser;
    if (!user) return alert("Devi essere autenticato");
    await startNewGame(roomId, players, user.uid, config);
  }, [roomId, players]);

  /* ---------------- RESTART GAME ---------------- */
  const restartGame = useCallback(async (acceptedPlayers = []) => {
    try {
      // Recupera la configurazione precedente
      const gameSnap = await get(ref(db, `rooms/${roomId}/game`));
      const previousGame = gameSnap.val();

      const gameConfig = {
        id: previousGame?.gameModeId || 'classica',
        name: previousGame?.mode || 'Classica',
        difficulty: {
          id: previousGame?.difficultyId || 'medium',
          name: previousGame?.difficulty || 'Medio'
        },
        turnDuration: previousGame?.turnDuration || TURN_DURATION,
        roundsPerGame: previousGame?.roundsPerPlayer || 1,
        survival: previousGame?.survivalMode || false,
        startingLives: previousGame?.startingLives || 3,
        hasChaos: previousGame?.hasChaosEffects || false
      };

      // Reset states
      setShowResults(false);
      setFinalResults(null);

      const user = auth.currentUser;
      if (!user) throw new Error("Utente non autenticato");

      // Restart in-place: remove players who rejected, reassign owner if needed, then start a fresh game in same room
      // Filter players list according to acceptedPlayers (if provided)
      const playersToKeep = acceptedPlayers.length > 0 ? players.filter(p => acceptedPlayers.includes(p.id)) : players;

      // Remove players who voted NO (not accepted)
      const playersToRemove = players.filter(p => !playersToKeep.some(k => k.id === p.id));
      try {
        for (const p of playersToRemove) {
          try {
            await sendSystemMessage(roomId, `🚪 ${p.name} ha lasciato la stanza (non ha accettato il riavvio)`);
            await remove(ref(db, `rooms/${roomId}/players/${p.id}`));
          } catch (err) {
            console.warn('[restartGame] failed to remove player during restart', p, err);
          }
        }
      } catch (err) {
        console.warn('[restartGame] error removing rejected players', err);
      }

      // Ensure owner: if previous owner is kept, preserve them; otherwise assign new owner from kept players
      try {
        const prevOwner = players.find(p => p.isOwner);
        let newOwnerPlayer = null;
        if (prevOwner && playersToKeep.some(p => p.id === prevOwner.id)) {
          newOwnerPlayer = prevOwner;
        } else if (playersToKeep.length > 0) {
          // choose the oldest by joinedAt if available, otherwise first
          newOwnerPlayer = playersToKeep.slice().sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))[0];
        }

        if (newOwnerPlayer) {
          const ownerUserId = newOwnerPlayer.userId || user.uid;
          await set(ref(db, `rooms/${roomId}/owner`), {
            playerId: newOwnerPlayer.id,
            nickname: newOwnerPlayer.name,
            sessionId: newOwnerPlayer.sessionId || null,
            createdAt: Date.now()
          });
          // Start the game as the chosen owner (pass ownerUserId to startNewGame)
          console.log('[restartGame] starting new in-place game', { roomId, ownerId: ownerUserId, playersCount: playersToKeep.length });
          await startNewGame(roomId, playersToKeep, ownerUserId, gameConfig);
          // Signal to other clients that an in-place restart completed
          try {
            await set(ref(db, `rooms/${roomId}/restartVote/inPlaceRestart`), Date.now());
          } catch (err) {
            console.warn('[restartGame] failed to write inPlaceRestart flag', err);
          }
          // Clean up the restartVote node immediately to prevent false auto-restarts in subsequent games
          try {
            // Small delay to ensure clients have read inPlaceRestart flag before removal
            setTimeout(async () => {
              try {
                await remove(ref(db, `rooms/${roomId}/restartVote`));
                console.log('[restartGame] removed restartVote node');
              } catch (err) {
                console.warn('[restartGame] failed to remove restartVote node', err);
              }
            }, 2000);
          } catch (err) {
            console.warn('[restartGame] error scheduling restartVote cleanup', err);
          }
        } else {
          console.warn('[restartGame] no players remain to start the game');
          // End game if no players remain
          await set(ref(db, `rooms/${roomId}/game`), {
            active: false,
            gameEnded: true,
            endReason: 'not_enough_players',
            endedAt: Date.now(),
            finalScores: []
          });
        }
      } catch (err) {
        console.error('[restartGame] failed to start in-place game', err);
        throw err;
      }

      // Return current room id to indicate in-place restart completed
      return roomId;
    } catch (error) {
      console.error("Errore riavviando il gioco:", error);
      alert("Errore nel riavvio del gioco: " + error.message);
    }
  }, [roomId, players]);

  /* ---------------- GUESS ---------------- */
  const handleGuess = useCallback(async nick => {
    const points = calculatePoints(timeLeft, gameState?.turnDuration || TURN_DURATION);
    const player = players.find(p => p.name === nick);
    if (!player) return;

    const guessedRef = ref(db, `rooms/${roomId}/game/guessedPlayers`);
    await get(guessedRef).then(async (snapshot) => {
      const currentGuessed = snapshot.val() || [];
      // Evita duplicati
      if (currentGuessed.some(g => g.nickname === nick)) return;

      const guessed = [
        ...currentGuessed,
        { nickname: nick, points, time: timeLeft }
      ];

      await set(guessedRef, guessed);

      // Messaggio di sistema
      await sendSystemMessage(
        roomId,
        `✅ ${nick} ha indovinato la parola! (+${points} punti)`
      );

      await awardPlayerPoints(
        roomId,
        player.id,
        player.score,
        points
      );

      if (guessed.length >= players.length - 1) {
        clearInterval(timerRef.current);
        await showRoundResults();
      }
    });
  }, [players, roomId, timeLeft, showRoundResults, timerRef, gameState?.turnDuration]);

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
