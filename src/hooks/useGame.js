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

    const unsubOwner = onValue(ownerRef, ownerSnap => {
      try {
        const owner = ownerSnap.val();
        if (!owner) {
          endForOwnerLeave();
          return;
        }

        unsubPlayers = onValue(playersRef, snap => {
          try {
            const list = Object.values(snap.val() || {});
            const stillHere = list.some(
              p => p.sessionId === owner.sessionId
            );
            if (!stillHere) endForOwnerLeave();
          } catch (error) {
            console.error('Error in owner leave players listener:', error);
          }
        });
      } catch (error) {
        console.error('Error in owner leave listener:', error);
      }
    });

    async function endForOwnerLeave() {
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
    }

    return () => {
      unsubOwner?.();
      unsubPlayers?.();
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
    const { nextArtist, word, chaosEffects } = await advanceToNextTurn(
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

    // Survival mode penalties
    await applySurvivalPenalties(roomId, gameState, players, sendSystemMessage, db, set, ref, get);

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
    timerRef
  };
}
