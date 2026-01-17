import { POINTS_PER_GUESS, TURN_DURATION, TIME_BONUS_MULTIPLIER, ARTIST_POINTS } from '../constants/gameConfig';

export const calculatePoints = (timeRemaining, turnDuration = TURN_DURATION) => {
  const basePoints = POINTS_PER_GUESS;  // 100
  const timeBonus = Math.floor((timeRemaining / turnDuration) * basePoints * TIME_BONUS_MULTIPLIER);
  // TIME_BONUS_MULTIPLIER = 2
  return basePoints + timeBonus;
};

export const calculateArtistBonus = (guessedCount) => {
  return guessedCount * ARTIST_POINTS;
};