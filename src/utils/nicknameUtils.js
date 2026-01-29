/* filepath: src/utils/nicknameUtils.js */
// Generate unique colors for players
const PLAYER_COLORS = [
  '#667eea', // Purple
  '#22c55e', // Green
  '#f59e0b', // Orange
  '#ef4444', // Red
  '#3b82f6', // Blue
  '#ec4899', // Pink
  '#8b5cf6', // Violet
  '#14b8a6', // Teal
  '#f97316', // Orange-Red
  '#06b6d4', // Cyan
];

/**
 * Get a unique color for a player based on their index
 */
export const getPlayerColor = (index) => {
  return PLAYER_COLORS[index % PLAYER_COLORS.length];
};

/**
 * Generate a unique nickname by checking existing players
 * If nickname exists, append a number (nickname1, nickname2, etc.)
 */
export const generateUniqueNickname = (desiredNickname, existingPlayers) => {
  const existingNames = (existingPlayers || []).map(p => p.name);

  // If no desired nickname provided, generate a fallback base name
  const hasDesired = Boolean(desiredNickname && desiredNickname.toString().trim());
  const base = hasDesired ? desiredNickname.toString().trim() : 'Giocatore';

  // If base is free, return it
  if (!existingNames.includes(base)) return base;

  // Otherwise append a counter until unique
  let counter = 1;
  let uniqueNickname = `${base}${counter}`;
  while (existingNames.includes(uniqueNickname)) {
    counter++;
    uniqueNickname = `${base}${counter}`;
  }

  return uniqueNickname;
};

/**
 * Validate nickname format
 */
export const validateNicknameFormat = (nickname) => {
  if (!nickname || typeof nickname !== 'string') {
    return { valid: false, error: 'Il nickname è obbligatorio' };
  }

  const trimmed = nickname.trim();
  
  if (trimmed.length === 0) {
    return { valid: false, error: 'Il nickname non può essere vuoto' };
  }

  if (trimmed.length > 15) {
    return { valid: false, error: 'Il nickname deve essere massimo 15 caratteri' };
  }

  if (!/^[a-zA-Z0-9_\s]+$/.test(trimmed)) {
    return { valid: false, error: 'Il nickname può contenere solo lettere, numeri e underscore' };
  }

  return { valid: true, nickname: trimmed };
};

/**
 * Get player color by their nickname (for consistent coloring)
 */
export const getColorForNickname = (nickname, allPlayers) => {
  const index = allPlayers.findIndex(p => p.name === nickname);
  return index >= 0 ? getPlayerColor(index) : '#667eea';
};