import { useEffect, useRef } from 'react';
import { TURN_DURATION } from '../constants/gameConfig';

export function useGameTimer(gameState, showResults, onTimeUp, setTimeLeft) {
  const timerRef = useRef(null);

  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!gameState?.active || showResults) return;

    // Sync timer with server time
    if (gameState?.turnStartedAt) {
      const elapsed = Math.floor((Date.now() - gameState.turnStartedAt) / 1000);
      setTimeLeft(Math.max(0, (gameState?.turnDuration || TURN_DURATION) - elapsed));
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.active, gameState?.round, gameState?.turnStartedAt, gameState?.turnDuration, showResults, onTimeUp, setTimeLeft]);

  return timerRef;
}