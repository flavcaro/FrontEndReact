/**
 * Modalità Puzzle Drawing
 * 
 * Il canvas è diviso in 3 sezioni (colonne).
 * 3 giocatori disegnano contemporaneamente, uno per sezione.
 * 1 giocatore indovina.
 * I turni ruotano fino a quando tutti hanno indovinato almeno una volta.
 */

export const PUZZLE_DRAWING = {
  id: 'puzzleDrawing',
  name: '🧩 Puzzle Drawing',
  description: 'Disegnate insieme dividendo il canvas in 3 sezioni!',
  icon: '🧩',
  turnDuration: 90, // Più tempo perché i giocatori devono coordinarsi
  minPlayers: 4, // Servono almeno 3 disegnatori + 1 indovinatore
  maxPlayers: 6,
  
  // Configurazione specifica del puzzle
  sections: 3, // Numero di sezioni del canvas
  drawersPerRound: 3, // Numero di giocatori che disegnano simultaneamente
  guessersPerRound: 1, // Numero di giocatori che indovinano
  
  // Punteggi
  pointsPerGuess: 150, // Più punti perché è più difficile
  artistPoints: 50, // Punti per ogni artista quando qualcuno indovina
  teamBonusPoints: 30, // Bonus per tutti e 3 i disegnatori se qualcuno indovina velocemente
  
  // Regole specifiche
  rules: [
    'Il canvas è diviso in 3 sezioni verticali',
    'Ogni giocatore disegna solo nella propria sezione',
    'I disegnatori devono collaborare per creare un disegno coerente',
    'L\'indovinatore vede il disegno completo assemblato',
    'Tutti i giocatori devono indovinare almeno una volta',
    'La comunicazione tramite chat è disabilitata durante il disegno'
  ]
};

/**
 * Calcola l'assegnazione delle sezioni per i giocatori
 * @param {Array} players - Array di giocatori
 * @param {number} roundIndex - Indice del round corrente
 * @returns {Object} - { drawers: [{player, section}], guesser: player }
 */
export const assignPuzzleRoles = (players, roundIndex) => {
  if (!players || players.length < PUZZLE_DRAWING.minPlayers) {
    console.error('Non ci sono abbastanza giocatori per Puzzle Drawing');
    return null;
  }

  const totalPlayers = players.length;
  
  // L'indovinatore ruota ad ogni round
  const guesserIndex = roundIndex % totalPlayers;
  const guesser = players[guesserIndex];
  
  // I disegnatori sono tutti gli altri (massimo 3)
  const drawers = [];
  let sectionIndex = 0;
  
  for (let i = 0; i < totalPlayers && drawers.length < PUZZLE_DRAWING.sections; i++) {
    const playerIndex = (guesserIndex + 1 + i) % totalPlayers;
    if (playerIndex !== guesserIndex) {
      drawers.push({
        player: players[playerIndex],
        section: sectionIndex, // 0 = sinistra, 1 = centro, 2 = destra
        sectionName: ['Sinistra', 'Centro', 'Destra'][sectionIndex]
      });
      sectionIndex++;
    }
  }
  
  return { drawers, guesser };
};

/**
 * Calcola quanti round sono necessari perché tutti abbiano indovinato almeno una volta
 * @param {number} playerCount - Numero di giocatori
 * @returns {number} - Numero minimo di round
 */
export const calculateMinRounds = (playerCount) => {
  return Math.max(playerCount, PUZZLE_DRAWING.minPlayers);
};

/**
 * Verifica se tutti i giocatori hanno indovinato almeno una volta
 * @param {Object} gameState - Stato del gioco
 * @returns {boolean}
 */
export const allPlayersHaveGuessed = (gameState) => {
  if (!gameState || !gameState.players) return false;
  
  const playersWhoGuessed = new Set();
  
  // Controlla nei round completati chi ha già indovinato
  if (gameState.completedRounds) {
    gameState.completedRounds.forEach(round => {
      if (round.guesser && round.guessed) {
        playersWhoGuessed.add(round.guesser.uid);
      }
    });
  }
  
  // Verifica se tutti i giocatori hanno indovinato
  const allPlayers = Object.keys(gameState.players);
  return allPlayers.every(uid => playersWhoGuessed.has(uid));
};

/**
 * Calcola i bounds per una sezione specifica del canvas
 * @param {number} section - Indice della sezione (0, 1, 2)
 * @param {number} canvasWidth - Larghezza totale del canvas
 * @param {number} canvasHeight - Altezza totale del canvas
 * @returns {Object} - { x, y, width, height }
 */
export const getSectionBounds = (section, canvasWidth, canvasHeight) => {
  const sectionWidth = canvasWidth / PUZZLE_DRAWING.sections;
  
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
 * @returns {boolean}
 */
export const isPointInSection = (x, y, section, canvasWidth, canvasHeight) => {
  const bounds = getSectionBounds(section, canvasWidth, canvasHeight);
  
  // Margine interno di 2px per evitare sovrapposizioni sui bordi
  const margin = 2;
  const adjustedX = bounds.x + (section === 0 ? 0 : margin);
  const adjustedWidth = bounds.width - (section === 0 ? margin : (section === 2 ? 0 : margin * 2));
  
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
