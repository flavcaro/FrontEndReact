import { ref, set, push, remove, get, update } from "firebase/database";
import { db } from "../firebase";
import { WORDS_BY_DIFFICULTY } from "../constants/gameConfig";
import { 
  assignPuzzleRoles, 
  calculateMinRounds, 
  allPlayersHaveGuessed,
  calculatePuzzleScore,
  PUZZLE_DRAWING 
} from "../constants/gameModes/puzzleDrawing";

/**
 * Ottiene una parola casuale per il puzzle
 */
const getRandomWord = (difficulty = 'MEDIUM') => {
  const wordList = WORDS_BY_DIFFICULTY[difficulty.toUpperCase()] || WORDS_BY_DIFFICULTY.MEDIUM;
  return wordList[Math.floor(Math.random() * wordList.length)];
};

/**
 * Inizia una nuova partita in modalità Puzzle Drawing
 */
export const startPuzzleGame = async (roomId, players, userId, gameConfig) => {
  console.log('[startPuzzleGame] Inizializzazione Puzzle Drawing', { roomId, playerCount: players?.length });

  if (!players || !Array.isArray(players) || players.length < PUZZLE_DRAWING.minPlayers) {
    throw new Error(`Servono almeno ${PUZZLE_DRAWING.minPlayers} giocatori per Puzzle Drawing`);
  }

  // Reset punteggi
  const resetPromises = players.map(player => 
    set(ref(db, `rooms/${roomId}/players/${player.id}/score`), 0)
  );
  await Promise.all(resetPromises);

  const word = getRandomWord(gameConfig.difficulty?.id);
  const minRounds = calculateMinRounds(players.length);
  
  // Crea la lista dei giocatori per i ruoli - ordina per joinedAt per consistenza
  const playersList = players
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
    .map(p => ({
      uid: p.id,
      name: p.name
    }));

  console.log('👥 Lista giocatori ordinata per ruoli:', playersList);

  // Assegna i ruoli per il primo round
  const roles = assignPuzzleRoles(playersList, 0);
  
  console.log('🎭 Ruoli assegnati - Round 1:', {
    guesser: roles.guesser?.name,
    drawers: roles.drawers?.map(d => `${d.player.name} (sezione ${d.section})`)
  });

  // Inizializza lo stato del gioco
  console.log('🎯 Parola selezionata per TUTTI i giocatori:', word);
  console.log('⏱️ Durata turno configurata:', gameConfig.turnDuration);
  
  await set(ref(db, `rooms/${roomId}/game`), {
    active: true,
    gameModeId: 'puzzleDrawing',
    mode: PUZZLE_DRAWING.name,
    difficulty: gameConfig.difficulty?.name || 'Medio',
    difficultyId: gameConfig.difficulty?.id || 'medium',
    turnDuration: gameConfig.turnDuration || PUZZLE_DRAWING.turnDuration,
    
    // Stato del round corrente
    round: 1,
    totalRounds: minRounds,
    word,
    turnStartedAt: Date.now(),
    
    // Ruoli attuali
    currentGuesser: roles.guesser,
    currentDrawers: roles.drawers,
    
    // Tracciamento giocatori
    playersWhoGuessed: [], // Array di uid che hanno indovinato
    guessedInCurrentRound: false,
    
    // Metadata
    startedBy: userId,
    ownerId: userId,
    gameEnded: false,
    roundsPerPlayer: gameConfig.roundsPerGame || minRounds
  });

  // Cancella canvas e chat
  await Promise.all([
    remove(ref(db, `rooms/${roomId}/lines`)),
    remove(ref(db, `rooms/${roomId}/lines_temp`)),
    remove(ref(db, `rooms/${roomId}/puzzleStrokes`)),
    remove(ref(db, `rooms/${roomId}/chat`))
  ]);

  // Messaggio di sistema
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `🧩 Partita Puzzle Drawing iniziata! Difficoltà: ${gameConfig.difficulty?.name}`,
    timestamp: Date.now(),
    isSystem: true
  });

  // Annuncia i ruoli
  const drawersNames = roles.drawers.map(d => d.player.name).join(', ');
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `🎨 Disegnatori: ${drawersNames} | 🤔 Indovinatore: ${roles.guesser.name}`,
    timestamp: Date.now(),
    isSystem: true
  });

  console.log('🧩 Puzzle Drawing iniziato:', { word, roles });
};

/**
 * Gestisce l'indovinata corretta nella modalità Puzzle
 */
export const handlePuzzleGuess = async (roomId, guesserId, guesserName, timeLeft) => {
  const gameRef = ref(db, `rooms/${roomId}/game`);
  const gameSnap = await get(gameRef);
  const gameState = gameSnap.val();

  if (!gameState || gameState.guessedInCurrentRound) {
    return; // Già indovinato in questo round
  }

  // Calcola i punteggi
  const scores = calculatePuzzleScore(timeLeft, gameState.turnDuration);

  // Assegna punti all'indovinatore
  const playersRef = ref(db, `rooms/${roomId}/players`);
  const playersSnap = await get(playersRef);
  const playersData = playersSnap.val();

  // Trova il giocatore indovinatore e aggiorna il punteggio
  const guesserData = Object.entries(playersData).find(([id, p]) => p.name === guesserName);
  if (guesserData) {
    const [playerId, playerInfo] = guesserData;
    const currentScore = playerInfo.score || 0;
    await set(ref(db, `rooms/${roomId}/players/${playerId}/score`), currentScore + scores.guesserPoints);
  }

  // Assegna punti a TUTTI i disegnatori
  for (const drawer of gameState.currentDrawers) {
    const drawerData = Object.entries(playersData).find(([id, p]) => p.name === drawer.player.name);
    if (drawerData) {
      const [playerId, playerInfo] = drawerData;
      const currentScore = playerInfo.score || 0;
      await set(ref(db, `rooms/${roomId}/players/${playerId}/score`), currentScore + scores.artistPoints);
      console.log(`✅ Assegnati ${scores.artistPoints} punti a ${drawer.player.name}`);
    } else {
      console.error(`❌ Disegnatore ${drawer.player.name} non trovato nei players`);
    }
  }

  // Aggiorna lo stato del gioco
  const updatedPlayersWhoGuessed = [...(gameState.playersWhoGuessed || []), guesserId];
  await update(gameRef, {
    guessedInCurrentRound: true,
    playersWhoGuessed: updatedPlayersWhoGuessed
  });

  // Messaggio di sistema
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `✅ ${guesserName} ha indovinato "${gameState.word}"! (+${scores.guesserPoints} punti)`,
    timestamp: Date.now(),
    isSystem: true
  });

  // Messaggio per i disegnatori
  const drawersNames = gameState.currentDrawers.map(d => d.player.name).join(', ');
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `🎨 Disegnatori (${drawersNames}): +${scores.artistPoints} punti ciascuno!`,
    timestamp: Date.now(),
    isSystem: true
  });

  console.log('✅ Puzzle indovinato:', { guesserName, scores });
};

/**
 * Avanza al prossimo round del puzzle
 */
export const advancePuzzleRound = async (roomId) => {
  const gameRef = ref(db, `rooms/${roomId}/game`);
  const gameSnap = await get(gameRef);
  const gameState = gameSnap.val();

  if (!gameState) return;

  // Disattiva temporaneamente il gioco
  await set(ref(db, `rooms/${roomId}/game/active`), false);

  // Cancella canvas e chat
  await Promise.all([
    remove(ref(db, `rooms/${roomId}/lines`)),
    remove(ref(db, `rooms/${roomId}/lines_temp`)),
    remove(ref(db, `rooms/${roomId}/puzzleStrokes`))
  ]);

  await new Promise(resolve => setTimeout(resolve, 200));

  // Ottieni tutti i giocatori e ordinali per consistenza
  const playersSnap = await get(ref(db, `rooms/${roomId}/players`));
  const playersData = playersSnap.val();
  const playersList = Object.entries(playersData)
    .map(([id, p]) => ({
      uid: id,
      name: p.name,
      joinedAt: p.joinedAt || 0
    }))
    .sort((a, b) => a.joinedAt - b.joinedAt);

  const nextRound = (gameState.round || 0) + 1;
  
  console.log(`🔄 Avanzamento al round ${nextRound} - Lista giocatori:`, playersList.map(p => p.name));

  // Verifica se tutti hanno indovinato
  const gameStateForCheck = {
    ...gameState,
    playersWhoGuessed: gameState.playersWhoGuessed || [],
    players: playersData
  };

  if (allPlayersHaveGuessed(gameStateForCheck)) {
    console.log('🎉 Tutti hanno indovinato almeno una volta! Fine partita.');
    await endPuzzleGame(roomId);
    return;
  }

  // Verifica se abbiamo raggiunto il numero massimo di round
  if (nextRound > gameState.totalRounds) {
    console.log('🏁 Raggiunto il numero massimo di round. Fine partita.');
    await endPuzzleGame(roomId);
    return;
  }

  // Assegna i nuovi ruoli
  const newRoles = assignPuzzleRoles(playersList, nextRound - 1);
  const newWord = getRandomWord(gameState.difficultyId);

  console.log('🎭 Nuovi ruoli assegnati - Round', nextRound, ':', {
    guesser: newRoles.guesser?.name,
    drawers: newRoles.drawers?.map(d => `${d.player.name} (sezione ${d.section})`)
  });

  // Aggiorna lo stato del gioco
  await update(gameRef, {
    active: true,
    round: nextRound,
    word: newWord,
    turnStartedAt: Date.now(),
    currentGuesser: newRoles.guesser,
    currentDrawers: newRoles.drawers,
    guessedInCurrentRound: false
  });

  // Annuncia i nuovi ruoli
  const drawersNames = newRoles.drawers.map(d => d.player.name).join(', ');
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `🔄 Round ${nextRound}/${gameState.totalRounds}`,
    timestamp: Date.now(),
    isSystem: true
  });

  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `🎨 Disegnatori: ${drawersNames} | 🤔 Indovinatore: ${newRoles.guesser.name}`,
    timestamp: Date.now(),
    isSystem: true
  });

  console.log('🔄 Avanzato al round', nextRound, newRoles);
};

/**
 * Termina la partita Puzzle Drawing
 */
export const endPuzzleGame = async (roomId) => {
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

  console.log("🎮 Fine partita Puzzle Drawing - Risultati:", finalScores);

  return finalScores;
};
