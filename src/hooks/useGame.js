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
  const hasGuessed = gameState?.guessedPlayers?.some(
    g => g.nickname === nickname
  );

  /* ---------------- GAME STATE LISTENER ---------------- */
  useEffect(() => {
    if (!roomId) return;

    const gameRef = ref(db, `rooms/${roomId}/game`);
    return onValue(gameRef, async snapshot => {
      const data = snapshot.val();
      setGameState(data);

      if (!data?.gameEnded || !data?.finalScores) return;

      setShowResults(false);
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
    });
  }, [roomId]);

  /* ---------------- OWNER LEAVES ---------------- */
  useEffect(() => {
    if (!roomId || !gameState?.active || gameState?.gameEnded) return;

    const ownerRef = ref(db, `rooms/${roomId}/owner`);
    const playersRef = ref(db, `rooms/${roomId}/players`);

    let unsubPlayers;

    const unsubOwner = onValue(ownerRef, ownerSnap => {
      const owner = ownerSnap.val();
      if (!owner) {
        endForOwnerLeave();
        return;
      }

      unsubPlayers = onValue(playersRef, snap => {
        const list = Object.values(snap.val() || {});
        const stillHere = list.some(
          p => p.sessionId === owner.sessionId
        );
        if (!stillHere) endForOwnerLeave();
      });
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
  useEffect(() => {
    if (!gameState?.active || gameState?.gameEnded) return;
    if (players.length !== 1) return;

    (async () => {
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
    })();
  }, [players.length, gameState, roomId, players]);

  /* ---------------- NEXT TURN ---------------- */
  const nextTurn = useCallback(async () => {
    const difficultyId = gameState?.difficultyId || "medium";
    const playerOrder =
      gameState?.playerOrder || players.map(p => p.name);
    const roundsPerPlayer = gameState?.roundsPerPlayer || 6;

    const snap = await get(
      ref(db, `rooms/${roomId}/game/drawCounts`)
    );
    const drawCounts = snap.val() || {};

    const finished = playerOrder.every(
      name => (drawCounts[name] || 0) >= roundsPerPlayer
    );

    if (finished) {
      await endGame(roomId, players);
      return;
    }

    const { nextArtist, word } = await advanceToNextTurn(
      roomId,
      players,
      gameState?.currentArtist,
      difficultyId,
      playerOrder
    );

    const updatedCounts = (
      await get(ref(db, `rooms/${roomId}/game/drawCounts`))
    ).val();

    const nextRound = (gameState?.round || 0) + 1;

    await set(ref(db, `rooms/${roomId}/game`), {
      ...gameState,
      active: true,
      currentArtist: nextArtist,
      word,
      turnStartedAt: Date.now(),
      guessedPlayers: [],
      round: nextRound,
      drawCounts: updatedCounts,
      allGuessed: false
    });

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

    const bonus = calculateArtistBonus(
      gameState?.guessedPlayers?.length || 0
    );

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

    setTimeout(async () => {
      setShowResults(false);
      await nextTurn();
    }, 5000);
  }, [roomId, gameState, awardArtistPoints, nextTurn]);

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
    const points = calculatePoints(timeLeft);
    const player = players.find(p => p.name === nick);
    if (!player) return;

    await awardPlayerPoints(
      roomId,
      player.id,
      player.score,
      points
    );

    const guessed = [
      ...(gameState.guessedPlayers || []),
      { nickname: nick, points, time: timeLeft }
    ];

    await set(
      ref(db, `rooms/${roomId}/game/guessedPlayers`),
      guessed
    );

    if (guessed.length >= players.length - 1) {
      clearInterval(timerRef.current);
      await showRoundResults();
    }
  }, [players, gameState, roomId, timeLeft, showRoundResults, timerRef]);

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
