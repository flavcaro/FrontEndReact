import { ref, set, push, remove, get } from "firebase/database";
import { db } from "../firebase";
import { WORDS_BY_DIFFICULTY } from "../constants/gameConfig";

// Get random word based on difficulty
const getRandomWord = (difficulty = 'MEDIUM') => {
  const wordList = WORDS_BY_DIFFICULTY[difficulty.toUpperCase()] || WORDS_BY_DIFFICULTY.MEDIUM;
  return wordList[Math.floor(Math.random() * wordList.length)];
};

export const startNewGame = async (roomId, players, userId, gameConfig) => {
  // Reset all player scores
  const resetPromises = players.map(player => 
    set(ref(db, `rooms/${roomId}/players/${player.id}/score`), 0)
  );
  await Promise.all(resetPromises);

  const firstArtist = players[0]?.name;
  const word = getRandomWord(gameConfig.difficulty?.id);
  
  // Rounds per player (not total rounds)
  const roundsPerPlayer = gameConfig.roundsPerGame || 6;
  
  // Save player rotation order (fixed for entire game)
  const playerOrder = players.map(p => p.name);
  
  // Initialize draw count for each player starting at 1 for first artist
  const drawCounts = {};
  players.forEach(player => {
    drawCounts[player.name] = player.name === firstArtist ? 1 : 0;
  });
  
  await set(ref(db, `rooms/${roomId}/game`), {
    active: true,
    currentArtist: firstArtist,
    word,
    turnStartedAt: Date.now(),
    guessedPlayers: [],
    round: 1,
    roundsPerPlayer: roundsPerPlayer, // Rounds each player should draw
    totalRounds: roundsPerPlayer * players.length, // <-- totale turni per partita
    drawCounts: drawCounts, // Track how many times each player has drawn
    playerOrder: playerOrder, // Fixed rotation order
    startedBy: userId,
    ownerId: userId,
    gameEnded: false,
    mode: gameConfig.name || 'Classica',
    difficulty: gameConfig.difficulty?.name || 'Medio',
    difficultyId: gameConfig.difficulty?.id || 'medium'
  });

  // Clear board and chat
  await Promise.all([
    remove(ref(db, `rooms/${roomId}/lines`)),
    remove(ref(db, `rooms/${roomId}/lines_temp`)),
    remove(ref(db, `rooms/${roomId}/chat`))
  ]);

  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `🎮 Partita iniziata! Ogni giocatore disegnerà ${roundsPerPlayer} volte - Difficoltà: ${gameConfig.difficulty?.name}`,
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

  await set(ref(db, `rooms/${roomId}/game/active`), false);
  await set(ref(db, `rooms/${roomId}/game/gameEnded`), true);
  await set(ref(db, `rooms/${roomId}/game/finalScores`), finalScores);
  await set(ref(db, `rooms/${roomId}/game/endedAt`), Date.now());

  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `🎉 Partita terminata! Vincitore: ${finalScores[0].name} con ${finalScores[0].score} punti!`,
    timestamp: Date.now(),
    isSystem: true
  });

  console.log("🎮 Fine partita - Risultati salvati");
  console.log("Vincitore:", finalScores[0]);
  console.log("Tutti i player:", finalScores);

  return finalScores;
};

export const endGameByOwnerLeaving = async (roomId, players) => {
  const playersSnapshot = await get(ref(db, `rooms/${roomId}/players`));
  const playersData = playersSnapshot.val() || {};
  
  const finalScores = Object.entries(playersData)
    .map(([id, player]) => ({
      id,
      name: player.name,
      score: player.score || 0,
      userId: player.userId || null
    }))
    .sort((a, b) => b.score - a.score);

  await set(ref(db, `rooms/${roomId}/game`), {
    active: false,
    gameEnded: true,
    finalScores,
    endedAt: Date.now(),
    endReason: 'owner_left'
  });

  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `⚠️ Il creatore della stanza è uscito. Partita terminata! Vincitore: ${finalScores[0]?.name || 'Nessuno'} con ${finalScores[0]?.score || 0} punti!`,
    timestamp: Date.now(),
    isSystem: true
  });

  return finalScores;
};

export const advanceToNextTurn = async (roomId, players, currentArtist, difficultyId, playerOrder) => {
  await set(ref(db, `rooms/${roomId}/game/active`), false);
  
  // Clear canvas and chat for next round
  await Promise.all([
    remove(ref(db, `rooms/${roomId}/lines`)),
    remove(ref(db, `rooms/${roomId}/lines_temp`)),
    remove(ref(db, `rooms/${roomId}/chat`))
  ]);
  
  await new Promise(resolve => setTimeout(resolve, 200));
  
  // Use the saved player order for rotation (not the dynamic sorted players array)
  const currentIndex = playerOrder.findIndex(name => name === currentArtist);
  const nextIndex = (currentIndex + 1) % playerOrder.length;
  const nextArtist = playerOrder[nextIndex];
  const word = getRandomWord(difficultyId);
  
  // Increment draw count for next artist
  const drawCountRef = ref(db, `rooms/${roomId}/game/drawCounts/${nextArtist}`);
  const snapshot = await get(drawCountRef);
  const currentCount = snapshot.val() || 0;
  await set(drawCountRef, currentCount + 1);
  
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

export const clearChat = async (roomId) => {
  await remove(ref(db, `rooms/${roomId}/chat`));
};