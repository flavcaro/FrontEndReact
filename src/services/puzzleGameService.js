import { ref, set, push, remove, get, update } from "firebase/database";
import { db } from "../firebase";
// WORDS_BY_DIFFICULTY removed; we rely on remote API for random words
import { getRandomWord as getRandomWordFromAPI } from "./wordService";
import { 
  assignPuzzleRoles, 
  calculateMinRounds, 
  allPlayersHaveGuessed,
  calculatePuzzleScore,
  PUZZLE_DRAWING 
} from "../constants/gameModes/puzzleDrawing";

/**
 * Ottiene una parola casuale dall'API
 */
const getRandomWordAsync = async (difficulty = 'MEDIUM', usedWords = []) => {
  return await getRandomWordFromAPI(difficulty, usedWords);
};

/**
 * Inizia una nuova partita in modalità Puzzle Drawing
 */
export const startPuzzleGame = async (roomId, players, userId, gameConfig) => {
  console.log('[startPuzzleGame] Inizializzazione Puzzle Drawing', { roomId, playerCount: players?.length });

  if (!players || !Array.isArray(players) || players.length < PUZZLE_DRAWING.minPlayers) {
    throw new Error(`Servono almeno ${PUZZLE_DRAWING.minPlayers} giocatori per Puzzle Drawing`);
  }

  // Recupera la configurazione delle sezioni e cicli (default 3 sezioni, 1 ciclo)
  // Supporta sia `puzzleSections` che `sections` (fallback), e normalizza a number
  const rawSections = gameConfig?.puzzleSections ?? gameConfig?.sections ?? 3;
  let sectionsCount = Number(rawSections);
  // Reject boolean values saved accidentally (true -> 1)
  if (typeof rawSections === 'boolean' || !Number.isFinite(sectionsCount) || ![2, 3].includes(sectionsCount)) {
    const parsed = parseInt(rawSections, 10);
    sectionsCount = (Number.isFinite(parsed) && [2, 3].includes(parsed)) ? parsed : 3;
  } else {
    sectionsCount = Math.floor(sectionsCount);
  }
  const cyclesCountRaw = gameConfig?.puzzleCycles;
  const cyclesCount = Number.isFinite(Number(cyclesCountRaw)) ? parseInt(cyclesCountRaw, 10) : 1;
  console.log('[startPuzzleGame] Configurazione sezioni:', sectionsCount, 'Cicli:', cyclesCount);

  // Reset punteggi
  const resetPromises = players.map(player => 
    set(ref(db, `rooms/${roomId}/players/${player.id}/score`), 0)
  );
  await Promise.all(resetPromises);

  const word = await getRandomWordAsync(gameConfig.difficulty?.id, []);
  const minRounds = calculateMinRounds(players.length, sectionsCount, cyclesCount);
  
  // Crea la lista dei giocatori per i ruoli - ordina per joinedAt per consistenza
  const playersList = players
    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0))
    .map(p => ({
      uid: p.id,
      name: p.name
    }));

  console.log('👥 Lista giocatori ordinata per ruoli:', playersList);
  console.log('🔢 Round calcolati per', players.length, 'giocatori con', sectionsCount, 'sezioni:', minRounds);

  // Assegna i ruoli per il primo round con il numero di sezioni configurato
  const roles = assignPuzzleRoles(playersList, 0, sectionsCount);
  
  console.log('🎭 Ruoli assegnati - Round 1:', {
    guessers: roles.guessers?.map(g => g.name),
    drawers: roles.drawers?.map(d => `${d.player.name} (sezione ${d.section})`)
  });

  // Inizializza lo stato del gioco
  console.log('🎯 Parola selezionata per TUTTI i giocatori:', word);
  console.log('⏱️ Durata turno configurata:', gameConfig.turnDuration);
  console.log('💾 Salvataggio ruoli nel DB:', {
    currentGuessers: roles.guessers,
    currentDrawers: roles.drawers
  });
  
  await set(ref(db, `rooms/${roomId}/game`), {
    active: true,
    gameModeId: 'puzzleDrawing',
    mode: PUZZLE_DRAWING.name,
    difficulty: gameConfig.difficulty?.name || 'Medio',
    difficultyId: gameConfig.difficulty?.id || 'medium',
    turnDuration: gameConfig.turnDuration || PUZZLE_DRAWING.turnDuration,
    puzzleSections: sectionsCount, // Salva configurazione sezioni (number)
    puzzleCycles: cyclesCount, // Salva numero di cicli richiesti (number)
    
    // Stato del round corrente
    round: 1,
    totalRounds: minRounds,
    word,
    usedWords: [word.toLowerCase()], // Traccia le parole usate
    turnStartedAt: Date.now(),
    
    // Ruoli attuali (aggiornato per supportare array di guessers)
    currentGuesser: roles.guessers[0] || null, // Backwards compatibility
    currentGuessers: roles.guessers,
    currentDrawers: roles.drawers,
    
    // Tracciamento giocatori
    playersWhoGuessed: [], // Array di uid che hanno indovinato almeno una volta
    playersWhoGuessedCounts: {}, // Object {uid: count} per tracciare quante volte ognuno ha indovinato
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
  const guessersNames = roles.guessers.map(g => g.name).join(', ');
  
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `🎨 Disegnatori: ${drawersNames}`,
    timestamp: Date.now(),
    isSystem: true
  });
  
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `🔍 Indovinatori: ${guessersNames}`,
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

  // Verifica che il giocatore sia effettivamente un guesser
  const guessers = gameState.currentGuessers || (gameState.currentGuesser ? [gameState.currentGuesser] : []);
  const isGuesser = guessers.some(g => g.uid === guesserId || g.name === guesserName);
  
  if (!isGuesser) {
    console.warn('❌ Tentativo di indovinare da parte di un non-guesser:', guesserName);
    return;
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
  // Condividi i punti artista tra i disegnatori (uguale ripartizione)
  const drawers = Array.isArray(gameState.currentDrawers) ? gameState.currentDrawers : [];
  const drawersCount = Math.max(1, drawers.length);
  const totalArtistPoints = scores.artistPoints;
  const perDrawer = Math.round(totalArtistPoints / drawersCount);
  for (const drawer of drawers) {
    const drawerData = Object.entries(playersData).find(([id, p]) => p.name === drawer.player.name);
    if (drawerData) {
      const [playerId, playerInfo] = drawerData;
      const currentScore = playerInfo.score || 0;
      await set(ref(db, `rooms/${roomId}/players/${playerId}/score`), currentScore + perDrawer);
      console.log(`✅ Assegnati ${perDrawer} punti a ${drawer.player.name} (condivisione)`);
    } else {
      console.error(`❌ Disegnatore ${drawer.player.name} non trovato nei players`);
    }
  }

  // Aggiorna lo stato del gioco - incrementa il contatore per questo giocatore
  const playersWhoGuessedCounts = gameState.playersWhoGuessedCounts || {};
  playersWhoGuessedCounts[guesserId] = (playersWhoGuessedCounts[guesserId] || 0) + 1;
  
  const updatedPlayersWhoGuessed = [...(gameState.playersWhoGuessed || [])];
  if (!updatedPlayersWhoGuessed.includes(guesserId)) {
    updatedPlayersWhoGuessed.push(guesserId);
  }
  
  await update(gameRef, {
    guessedInCurrentRound: true,
    playersWhoGuessed: updatedPlayersWhoGuessed,
    playersWhoGuessedCounts
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
    message: `🎨 Disegnatori (${drawersNames}): punti condivisi +${totalArtistPoints} (ogni disegnatore +${perDrawer})`,
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

  // Verifica se tutti hanno indovinato il numero di volte richiesto
  const gameStateForCheck = {
    ...gameState,
    playersWhoGuessed: gameState.playersWhoGuessed || [],
    playersWhoGuessedCounts: gameState.playersWhoGuessedCounts || {},
    puzzleCycles: gameState.puzzleCycles || 1,
    players: playersData
  };

  if (allPlayersHaveGuessed(gameStateForCheck)) {
    console.log('🎉 Tutti hanno indovinato il numero di volte richiesto! Fine partita.');
    await endPuzzleGame(roomId);
    return;
  }

  // Verifica se abbiamo raggiunto il numero massimo di round
  if (nextRound > gameState.totalRounds) {
    console.log('🏁 Raggiunto il numero massimo di round. Fine partita.');
    await endPuzzleGame(roomId);
    return;
  }

  // Assegna i nuovi ruoli (usa il numero di sezioni salvato nello stato)
  const raw = gameState?.puzzleSections;
  let sectionsCount = Number(raw);
  if (typeof raw === 'boolean' || !Number.isFinite(sectionsCount) || ![2, 3].includes(sectionsCount)) {
    const parsed = parseInt(raw, 10);
    sectionsCount = (Number.isFinite(parsed) && [2, 3].includes(parsed)) ? parsed : 3;
  } else {
    sectionsCount = Math.floor(sectionsCount);
  }
  const newRoles = assignPuzzleRoles(playersList, nextRound - 1, sectionsCount);
  
  // Ottieni una nuova parola non ancora usata
  const usedWords = gameState.usedWords || [];
  const newWord = await getRandomWordAsync(gameState.difficultyId, usedWords);
  const updatedUsedWords = [...usedWords, newWord.toLowerCase()];

  console.log('🎭 Nuovi ruoli assegnati - Round', nextRound, ':', {
    guessers: newRoles.guessers?.map(g => g.name),
    drawers: newRoles.drawers?.map(d => `${d.player.name} (sezione ${d.section})`)
  });

  // Aggiorna lo stato del gioco
  await update(gameRef, {
    active: true,
    round: nextRound,
    word: newWord,
    usedWords: updatedUsedWords, // Aggiorna la lista delle parole usate
    turnStartedAt: Date.now(),
    currentGuesser: newRoles.guessers[0] || null, // Backwards compatibility
    currentGuessers: newRoles.guessers,
    currentDrawers: newRoles.drawers,
    guessedInCurrentRound: false
  });

  // Annuncia i nuovi ruoli
  const drawersNames = newRoles.drawers.map(d => d.player.name).join(', ');
  const guessersNames = newRoles.guessers.map(g => g.name).join(', ');
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `🔄 Round ${nextRound}/${gameState.totalRounds}`,
    timestamp: Date.now(),
    isSystem: true
  });

  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `🎨 Disegnatori: ${drawersNames}`,
    timestamp: Date.now(),
    isSystem: true
  });
  
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message: `🔍 Indovinatori: ${guessersNames}`,
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
