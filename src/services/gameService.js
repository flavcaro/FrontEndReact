import { ref, set, push, remove, get } from "firebase/database";
import { db } from "../firebase";
import { GAME_MODES } from "../constants/gameConfig";
import { generateChaosEffects} from "../constants/gameModes/chaosTools";
import { getRandomWord as getRandomWordFromAPI } from "./wordService";

//DEBUG PER CHAOS TOOLS DI EDOARDO, NON TOCCARE
//import { pickChaosEffect} from "../constants/gameModes/chaosTools"; 


// Get random word from API (asincrona)
const getRandomWordAsync = async (difficulty = 'MEDIUM') => {
  return await getRandomWordFromAPI(difficulty);
};

export const startNewGame = async (roomId, players, userId, gameConfig) => {
  console.log('[startNewGame] incoming gameConfig:', gameConfig);
  // Reset all player scores
  const resetPromises = players.map(player => 
    set(ref(db, `rooms/${roomId}/players/${player.id}/score`), 0)
  );
  await Promise.all(resetPromises);

  const firstArtist = players[0]?.name;

  // Normalize / resolve selected mode from provided gameConfig
  const providedId = gameConfig?.id || gameConfig?.gameModeId || gameConfig?.modeId || null;
  const selectedMode = Object.values(GAME_MODES).find(m => m.id === providedId) || null;

  // If a selectedMode exists, prefer its values; otherwise fall back to gameConfig fields
  const resolvedModeName = selectedMode?.name || gameConfig?.name || 'Classica';
  const resolvedModeId = selectedMode?.id || gameConfig?.id || gameConfig?.gameModeId || 'classica';
  const resolvedHasChaos = selectedMode?.hasChaosEffects || gameConfig?.hasChaosEffects || false;
  const resolvedSurvival = selectedMode?.survivalMode || gameConfig?.survivalMode || false;
  const resolvedStartingLives = selectedMode?.startingLives || gameConfig?.startingLives || 3;

  // Usa l'API per ottenere la parola (inizializza lista parole usate)
  const word = await getRandomWordAsync(gameConfig.difficulty?.id, []);
  
  // Rounds per player (not total rounds)
  const roundsPerPlayer = gameConfig.roundsPerGame || 6;
  
  // Save player rotation order (fixed for entire game)
  const playerOrder = players.map(p => p.name);
  
  // Initialize draw count for each player starting at 0
  // The first artist will get their count incremented to 1 when starting
  const drawCounts = {};
  players.forEach(player => {
    drawCounts[player.name] = 0;
  });
  
  //COMMENTARE PER DEBUG, SCOMMENTARE PER VERSIONE FINALE
  const initialChaos = resolvedHasChaos ? generateChaosEffects() : null;
  
  //DEBUG PER CHAOS TOOLS DI EDOARDO, NON TOCCARE
  //const initialChaos = resolvedHasChaos ? pickChaosEffect('skew') : null; // DEBUG_EFFECT

  await set(ref(db, `rooms/${roomId}/game`), {
    active: true,
    currentArtist: firstArtist,
    word,
    usedWords: [word.toLowerCase()], // Traccia le parole usate
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
    mode: resolvedModeName,
    difficulty: gameConfig.difficulty?.name || 'Medio',
    difficultyId: gameConfig.difficulty?.id || 'medium',
    turnDuration: gameConfig.turnDuration || 60,
    gameModeId: resolvedModeId,
    hasChaosEffects: resolvedHasChaos,
    chaosEffects: initialChaos,
    survivalMode: resolvedSurvival,
    startingLives: resolvedStartingLives,
    // Persist survival threshold from config so penalties use it
    survivalThreshold: gameConfig.survivalThreshold || null,
    playerLives: resolvedSurvival ? players.reduce((acc, p) => ({ ...acc, [p.name]: resolvedStartingLives }), {}) : null
  });

  // Increment the first artist's count since they're starting now
  await set(ref(db, `rooms/${roomId}/game/drawCounts/${firstArtist}`), 1);

  // Log initial chaos effects for debugging/history
  if (initialChaos) {
    await push(ref(db, `rooms/${roomId}/game/chaosLogs`), {
      event: 'start_game',
      round: 1,
      artist: firstArtist,
      effects: initialChaos,
      createdAt: Date.now()
    });
  }

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
  
  const gameSnapshot = await get(ref(db, `rooms/${roomId}/game`));
  const gameState = gameSnapshot.val() || {};
  
  let finalScores = Object.entries(playersData)
    .map(([id, player]) => ({
      id,
      name: player.name,
      score: player.score || 0,
      userId: player.userId || null
    }));
  
  // Survival mode: only count players with lives > 0
  if (gameState.survivalMode && gameState.playerLives) {
    finalScores = finalScores.filter(p => (gameState.playerLives[p.name] || 0) > 0);
  }
  
  finalScores.sort((a, b) => b.score - a.score);

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

export const endGameByOwnerLeaving = async (roomId, players, ownerName = null) => {
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
    endReason: 'owner_left',
    endActorName: ownerName || null
  });

  // Push a clear system message including the owner's name so clients can show a specific alert
  const ownerText = ownerName ? `Giocatore "${ownerName}" ha abbandonato. Verrai reindirizzato alla home.` : `Il creatore della stanza ha abbandonato. Verrai reindirizzato alla home.`;
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: ownerText,
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
  
  // Get used words list and pick a new unique word
  const gameSnap = await get(ref(db, `rooms/${roomId}/game`));
  const gameState = gameSnap.val() || {};
  const usedWords = gameState.usedWords || [];
  const word = await getRandomWordAsync(difficultyId, usedWords);
  
  // Add new word to used words list
  const updatedUsedWords = [...usedWords, word.toLowerCase()];
  
  // Generate chaos effects server-side if game mode requires it
  try {
    const chaosEffects = gameState?.hasChaosEffects ? generateChaosEffects() : null;
    // Persist chosen chaos effects so clients receive a stable shared value
    await set(ref(db, `rooms/${roomId}/game/chaosEffects`), chaosEffects);

    // Log assigned chaos effects for this round
    if (chaosEffects) {
      await push(ref(db, `rooms/${roomId}/game/chaosLogs`), {
        event: 'advance_turn',
        round: (gameState.round || 0) + 1,
        artist: nextArtist,
        effects: chaosEffects,
        createdAt: Date.now()
      });
    }

    return { nextArtist, word, chaosEffects, updatedUsedWords };
  } catch (err) {
    console.error('[advanceToNextTurn] error generating/persisting chaosEffects', err);
    return { nextArtist, word, chaosEffects: null, updatedUsedWords };
  }
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