// Words by difficulty
export const WORDS_BY_DIFFICULTY = {
  EASY: [
    "gatto", "cane", "casa", "sole", "luna", "mare", "fiore", "albero",
    "palla", "libro", "sedia", "tavolo", "auto", "mano", "piede", "occhio",
    "naso", "bocca", "cuore", "stella", "nuvola", "pioggia", "neve", "vento"
  ],
  MEDIUM: [
    "telefono", "computer", "bicicletta", "aereo", "nave", "treno", "montagna",
    "cappello", "ombrello", "orologio", "chitarra", "pianoforte", "pallone",
    "scarpa", "penna", "zaino", "finestra", "porta", "giardino", "spiaggia",
    "foresta", "deserto", "vulcano", "cascata", "arcobaleno", "farfalla"
  ],
  HARD: [
    "microscopio", "telescopio", "dinosauro", "archeologo", "architetto",
    "ingegnere", "medaglia", "trofeo", "campionato", "astronomia", "geometria",
    "equilibrio", "simmetria", "democrazia", "rivoluzione", "esperimento",
    "caleidoscopio", "pterodattilo", "ippopotamo", "rinoceronte", "coccodrillo"
  ]
};

// Legacy combined words array (for backward compatibility)
export const WORDS = [
  ...WORDS_BY_DIFFICULTY.EASY,
  ...WORDS_BY_DIFFICULTY.MEDIUM,
  ...WORDS_BY_DIFFICULTY.HARD
];

export const TURN_DURATION = 60; // seconds per turn
export const POINTS_PER_GUESS = 100; // base points for guessing
export const ARTIST_POINTS = 50; // points artist gets per correct guess
export const MIN_PLAYERS = 2; // Minimum players to start
export const MAX_PLAYERS = 6; // Maximum players allowed
export const ROUNDS_PER_GAME = 3; // Each player draws 3 times (default)
export const TIME_BONUS_MULTIPLIER = 2; // Faster guess = more points

// Difficulty settings
export const DIFFICULTY_LEVELS = {
  EASY: {
    id: 'easy',
    name: '😊 Facile',
    description: 'Parole semplici e comuni',
    icon: '😊',
    words: WORDS_BY_DIFFICULTY.EASY,
    color: '#22c55e'
  },
  MEDIUM: {
    id: 'medium',
    name: '🤔 Medio',
    description: 'Parole di difficoltà media',
    icon: '🤔',
    words: WORDS_BY_DIFFICULTY.MEDIUM,
    color: '#f59e0b'
  },
  HARD: {
    id: 'hard',
    name: '🔥 Difficile',
    description: 'Parole complesse e rare',
    icon: '🔥',
    words: WORDS_BY_DIFFICULTY.HARD,
    color: '#ef4444'
  }
};

// Rounds options
export const ROUNDS_OPTIONS = [
  { value: 3, label: '3 Round', icon: '⚡', description: 'Partita veloce' },
  { value: 6, label: '6 Round', icon: '🎯', description: 'Partita media' },
  { value: 8, label: '8 Round', icon: '🏆', description: 'Partita lunga' }
];

// Game Modes
export const GAME_MODES = {
  CLASSIC: {
    id: 'classic',
    name: '🎨 Classica',
    description: 'Modalità standard: disegna e indovina a turno',
    icon: '🎨',
    turnDuration: 60
  }
};

export const DEFAULT_GAME_MODE = GAME_MODES.CLASSIC;
export const DEFAULT_DIFFICULTY = DIFFICULTY_LEVELS.MEDIUM;
export const DEFAULT_ROUNDS = 6;