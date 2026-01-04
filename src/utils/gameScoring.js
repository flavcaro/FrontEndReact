import { POINTS_PER_GUESS, TURN_DURATION, TIME_BONUS_MULTIPLIER, ARTIST_POINTS } from '../constants/gameConfig';

export const calculatePoints = (timeRemaining) => {
  const basePoints = POINTS_PER_GUESS;
  const timeBonus = Math.floor((timeRemaining / TURN_DURATION) * basePoints * TIME_BONUS_MULTIPLIER);
  return basePoints + timeBonus;
};

export const calculateArtistBonus = (guessedCount) => {
  return guessedCount * ARTIST_POINTS;
};