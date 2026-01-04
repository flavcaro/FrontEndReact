import { ref, set, push, remove, get } from "firebase/database";
import { db } from "../firebase";
import { WORDS, ROUNDS_PER_GAME } from "../constants/gameConfig";
import { updateGameStats } from "./userService";

export const startNewGame = async (roomId, players, userId) => {
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
    startedBy: userId,
    gameEnded: false
  });

  // Clear board and chat
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

export const endGame = async (roomId, players) => {
  const playersSnapshot = await get(ref(db, `rooms/${roomId}/players`));
  const playersData = playersSnapshot.val() || {};
  
  const finalScores = Object.entries(playersData)
    .map(([id, player]) => ({
      id,
      name: player.name,
      score: player.score || 0,
      userId: player.userId
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

  // Update user statistics for registered users
  const winnerId = finalScores[0]?.userId;
  for (const player of finalScores) {
    if (player.userId) {
      const isWinner = player.userId === winnerId;
      await updateGameStats(player.userId, player.score, isWinner);
    }
  }

  return finalScores;
};

export const advanceToNextTurn = async (roomId, players, currentArtist) => {
  await set(ref(db, `rooms/${roomId}/game/active`), false);
  
  // Clear canvas
  await Promise.all([
    remove(ref(db, `rooms/${roomId}/lines`)),
    remove(ref(db, `rooms/${roomId}/lines_temp`))
  ]);
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Select next artist
  const currentIndex = players.findIndex(p => p.name === currentArtist);
  const nextIndex = (currentIndex + 1) % players.length;
  const nextArtist = players[nextIndex]?.name;
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  
  return { nextArtist, word };
};

export const awardPlayerPoints = async (roomId, playerId, playerScore, points) => {
  await set(ref(db, `rooms/${roomId}/players/${playerId}/score`), 
    (playerScore || 0) + points
  );
};

export const sendSystemMessage = async (roomId, message) => {
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message,
    timestamp: Date.now(),
    isSystem: true
  });
};