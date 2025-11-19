export const generateRoomCode = () => {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
};

export const validateNickname = (nickname) => {
  return nickname && nickname.trim().length > 0;
};

export const validateRoomCode = (code) => {
  return code && code.trim().length > 0;
};