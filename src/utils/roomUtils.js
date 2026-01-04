export const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const validateNickname = (nickname) => {
  return nickname && nickname.trim().length > 0;
};

export const validateRoomCode = (code) => {
  return code && code.trim().length > 0;
};

/**
 * Extract room code from either a full URL or just a code
 * Examples:
 * - "ABC123" -> "ABC123"
 * - "http://localhost:3000/room/ABC123" -> "ABC123"
 * - "https://myapp.com/room/XYZ789/play?nick=Mario" -> "XYZ789"
 */
export const extractRoomCode = (input) => {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // Check if it's a URL
  if (trimmed.includes('://') || trimmed.includes('/room/')) {
    try {
      // Extract room code from URL pattern: /room/CODE or /room/CODE/play
      const match = trimmed.match(/\/room\/([A-Z0-9]{6})/i);
      if (match && match[1]) {
        return match[1].toUpperCase();
      }
    } catch (error) {
      console.error('Error parsing room URL:', error);
    }
  }

  // It's just a code - validate length and characters
  const code = trimmed.toUpperCase();
  if (/^[A-Z0-9]{6}$/.test(code)) {
    return code;
  }

  return null;
};