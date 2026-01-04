export const WORDS = [
  "gatto", "casa", "albero", "sole", "mare", "montagna", "fiore", "macchina",
  "telefono", "computer", "pizza", "gelato", "bicicletta", "aereo", "nave",
  "libro", "penna", "orologio", "scarpa", "cappello", "ombrello", "chitarra",
  "pianoforte", "pallone", "stella", "luna", "nuvola", "pioggia", "neve"
];

export const TURN_DURATION = 60; // seconds per turn
export const POINTS_PER_GUESS = 100; // base points for guessing
export const ARTIST_POINTS = 50; // points artist gets per correct guess
export const MIN_PLAYERS = 2; // Minimum players to start
export const MAX_PLAYERS = 6; // Maximum players allowed
export const ROUNDS_PER_GAME = 3; // Each player draws 3 times
export const TIME_BONUS_MULTIPLIER = 2; // Faster guess = more points

// Game Modes
export const GAME_MODES = {
  CLASSIC: {
    id: 'classic',
    name: '🎨 Classica',
    description: 'Modalità standard: disegna e indovina a turno',
    icon: '🎨',
    turnDuration: 60,
    roundsPerGame: 3
  },
  // Future modes can be added here
  // SPEED: {
  //   id: 'speed',
  //   name: '⚡ Veloce',
  //   description: 'Turni da 30 secondi, più frenetico!',
  //   icon: '⚡',
  //   turnDuration: 30,
  //   roundsPerGame: 5
  // },
  // TEAM: {
  //   id: 'team',
  //   name: '👥 A Squadre',
  //   description: 'Gioca in squadra contro altri team',
  //   icon: '👥',
  //   turnDuration: 60,
  //   roundsPerGame: 4
  // }
};

export const DEFAULT_GAME_MODE = GAME_MODES.CLASSIC;