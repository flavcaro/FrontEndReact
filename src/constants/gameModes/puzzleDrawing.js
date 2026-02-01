/**
 * Modalità Puzzle Drawing
 * 
 * Il canvas può essere diviso in 2 o 3 sezioni (colonne) configurabili.
 * Configurazioni disponibili:
 * - 2 sezioni: 2 disegnatori + 2 indovinatori (minimo 4 giocatori)
 * - 3 sezioni: 3 disegnatori + 1 indovinatore (minimo 4 giocatori)
 * I turni ruotano fino a quando tutti hanno indovinato almeno una volta.
 */

import puzzleSprite from '../../sprites/puzzle.gif';

export const PUZZLE_DRAWING = {
  id: 'puzzleDrawing',
  name: 'Puzzle Drawing',
  description: 'Disegnate insieme dividendo il canvas!',
  icon: '🧩',
  sprite: puzzleSprite,
  turnDuration: 90, // Più tempo perché i giocatori devono coordinarsi
  minPlayers: 4, // Minimo per entrambe le configurazioni
  maxPlayers: 6,

  // Configurazione specifica del puzzle (default)
  sections: 3, // Numero di sezioni del canvas (configurabile: 2 o 3)
  drawersPerRound: 3, // Numero di giocatori che disegnano simultaneamente
  guessersPerRound: 1, // Numero di giocatori che indovinano

  // Punteggi
  pointsPerGuess: 150, // Più punti perché è più difficile
  artistPoints: 50, // Punti per ogni artista quando qualcuno indovina
  teamBonusPoints: 30, // Bonus per tutti e 3 i disegnatori se qualcuno indovina velocemente

  // Regole specifiche
  rules: [
    'Il canvas è diviso in 2 o 3 sezioni verticali (configurabile)',
    'Ogni giocatore disegna solo nella propria sezione',
    'I disegnatori devono collaborare per creare un disegno coerente',
    'Gli indovinatori vedono il disegno completo assemblato',
    'Tutti i giocatori devono indovinare almeno una volta',
    'La comunicazione tramite chat è disabilitata durante il disegno'
  ]
};

// Configurazioni disponibili per le sezioni
export const PUZZLE_SECTIONS_CONFIG = {
  2: {
    sections: 2,
    drawers: 2,
    guessers: 2,
    sectionNames: ['Sinistra', 'Destra'],
    description: '2 Disegnatori + 2 Indovinatori'
  },
  3: {
    sections: 3,
    drawers: 3,
    guessers: 1,
    sectionNames: ['Sinistra', 'Centro', 'Destra'],
    description: '3 Disegnatori + 1 Indovinatore'
  }
};

/**
 * Calcola l'assegnazione delle sezioni per i giocatori
 * @param {Array} players - Array di giocatori
 * @param {number} roundIndex - Indice del round corrente
 * @param {number} sectionsCount - Numero di sezioni (2 o 3)
 * @returns {Object} - { drawers: [{player, section}], guessers: [player] }
 */
export const assignPuzzleRoles = (players, roundIndex, sectionsCount = 3) => {
  if (!players || players.length < PUZZLE_DRAWING.minPlayers) {
    console.error('Non ci sono abbastanza giocatori per Puzzle Drawing');
    return null;
  }
  // ... (rest of function logic is fine, existing file has it)

  const config = PUZZLE_SECTIONS_CONFIG[sectionsCount] || PUZZLE_SECTIONS_CONFIG[3];
  const totalPlayers = players.length;

  // Normalize players: accept objects with `id` or `uid` and ensure { uid, name }
  const normalized = players.map(p => ({ uid: p.uid || p.id || p.playerId || p.id, name: p.name || p.nickname || p.displayName || '' }));

  // Determine counts
  const drawersCount = config.drawers || config.sections || sectionsCount;
  const guessersCount = Math.min(config.guessers || 1, Math.max(0, totalPlayers - drawersCount));

  const guessers = [];
  const drawers = [];

  // Defensive: if guessersCount is 0, make at least one guesser if possible
  const finalGuessersCount = guessersCount > 0 ? guessersCount : Math.min(1, Math.max(0, totalPlayers - drawersCount));

  // Pick guessers by rotating start index so rounds cycle fairly
  let pickIndex = (roundIndex * finalGuessersCount) % totalPlayers;
  while (guessers.length < finalGuessersCount) {
    const candidate = normalized[pickIndex % totalPlayers];
    if (!guessers.find(g => g.uid === candidate.uid)) {
      guessers.push(candidate);
    }
    pickIndex++;
  }

  const guesserUIDs = new Set(guessers.map(g => g.uid));

  // Assign drawers: pick next players after guessers, skipping guessers, until drawersCount
  pickIndex = (roundIndex * finalGuessersCount + finalGuessersCount) % totalPlayers; // start after primary guessers block
  let sectionIndex = 0;
  let safety = 0;
  while (drawers.length < drawersCount && safety < totalPlayers * 2) {
    const candidate = normalized[pickIndex % totalPlayers];
    if (!guesserUIDs.has(candidate.uid) && !drawers.find(d => d.player.uid === candidate.uid)) {
      drawers.push({ player: candidate, section: sectionIndex, sectionName: config.sectionNames[sectionIndex] });
      sectionIndex = (sectionIndex + 1) % drawersCount;
    }
    pickIndex++;
    safety++;
  }

  // Fallback: if still not enough drawers (unlikely), fill from front skipping guessers
  if (drawers.length < drawersCount) {
    for (let i = 0; i < normalized.length && drawers.length < drawersCount; i++) {
      const candidate = normalized[i];
      if (!guesserUIDs.has(candidate.uid) && !drawers.find(d => d.player.uid === candidate.uid)) {
        drawers.push({ player: candidate, section: sectionIndex, sectionName: config.sectionNames[sectionIndex] });
        sectionIndex = (sectionIndex + 1) % drawersCount;
      }
    }
  }

  console.log('assignPuzzleRoles debug:', { totalPlayers, sectionsCount, drawersCount, finalGuessersCount, guessers: guessers.map(g => g.name), drawers: drawers.map(d => d.player.name) });

  return { drawers, guessers };
};

/**
 * Calcola quanti round sono necessari perché tutti abbiano indovinato almeno una volta
 * @param {number} playerCount - Numero di giocatori
 * @param {number} sectionsCount - Numero di sezioni (2 o 3)
 * @param {number} cycles - Quante volte ogni giocatore deve indovinare (default 1)
 * @returns {number} - Numero minimo di round
 */
export const calculateMinRounds = (playerCount, sectionsCount = 3, cycles = 1) => {
  const config = PUZZLE_SECTIONS_CONFIG[sectionsCount] || PUZZLE_SECTIONS_CONFIG[3];
  const guessersPerRound = config.guessers;

  // Calcola quanti round servono perché tutti indovinino "cycles" volte
  const roundsForGuessing = Math.ceil((playerCount * cycles) / guessersPerRound);

  // Assicura un minimo ragionevole di round
  return Math.max(roundsForGuessing, Math.ceil(playerCount / 2) * cycles);
};

/**
 * Verifica se tutti i giocatori hanno indovinato il numero di volte richiesto
 * @param {Object} gameState - Stato del gioco
 * @returns {boolean}
 */
export const allPlayersHaveGuessed = (gameState) => {
  if (!gameState || !gameState.players) return false;

  const requiredCycles = gameState.puzzleCycles || 1;
  const playersWhoGuessedCounts = gameState.playersWhoGuessedCounts || {};

  // Verifica se tutti i giocatori hanno indovinato almeno "requiredCycles" volte
  const allPlayers = Object.keys(gameState.players);
  const allHaveGuessedEnough = allPlayers.every(uid => {
    const count = playersWhoGuessedCounts[uid] || 0;
    return count >= requiredCycles;
  });

  console.log('🎯 [allPlayersHaveGuessed] Check:', {
    totalPlayers: allPlayers.length,
    requiredCycles,
    playersWhoGuessedCounts,
    allHaveGuessedEnough,
    remaining: allPlayers.filter(uid => (playersWhoGuessedCounts[uid] || 0) < requiredCycles)
  });

  return allHaveGuessedEnough;
};

/**
 * Calcola i bounds per una sezione specifica del canvas
 * @param {number} section - Indice della sezione (0, 1, o 2)
 * @param {number} canvasWidth - Larghezza totale del canvas
 * @param {number} canvasHeight - Altezza totale del canvas
 * @param {number} totalSections - Numero totale di sezioni (2 o 3)
 * @returns {Object} - { x, y, width, height }
 */
export const getSectionBounds = (section, canvasWidth, canvasHeight, totalSections = 3) => {
  const sectionWidth = canvasWidth / totalSections;

  return {
    x: section * sectionWidth,
    y: 0,
    width: sectionWidth,
    height: canvasHeight,
    section
  };
};

/**
 * Verifica se un punto è all'interno della sezione assegnata
 * @param {number} x - Coordinata X
 * @param {number} y - Coordinata Y
 * @param {number} section - Indice della sezione
 * @param {number} canvasWidth - Larghezza del canvas
 * @param {number} canvasHeight - Altezza del canvas
 * @param {number} totalSections - Numero totale di sezioni (2 o 3)
 * @returns {boolean}
 */
export const isPointInSection = (x, y, section, canvasWidth, canvasHeight, totalSections = 3) => {
  const bounds = getSectionBounds(section, canvasWidth, canvasHeight, totalSections);

  // Margine interno di 2px per evitare sovrapposizioni sui bordi
  const margin = 2;
  const adjustedX = bounds.x + (section === 0 ? 0 : margin);
  const lastSection = totalSections - 1;
  const adjustedWidth = bounds.width - (section === 0 ? margin : (section === lastSection ? 0 : margin * 2));

  return x >= adjustedX && x <= adjustedX + adjustedWidth &&
    y >= bounds.y && y <= bounds.y + bounds.height;
};

/**
 * Calcola il punteggio per un'indovinata nel Puzzle Drawing
 * @param {number} timeLeft - Tempo rimanente in secondi
 * @param {number} turnDuration - Durata totale del turno
 * @returns {Object} - { guesserPoints, artistPoints }
 */
export const calculatePuzzleScore = (timeLeft, turnDuration) => {
  // Per l'indovinatore: usa la stessa logica della modalità classica
  // 100 punti base + bonus tempo (max 200 punti bonus)
  const basePoints = 100;
  const timeBonus = Math.floor((timeLeft / turnDuration) * basePoints * 2);
  const guesserPoints = basePoints + timeBonus;

  // Per i disegnatori: 50 punti base + 1 punto per ogni secondo rimasto
  const artistPoints = 50 + timeLeft;

  return {
    guesserPoints,
    artistPoints
  };
};
