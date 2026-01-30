import { useEffect, useRef } from 'react';
import { TURN_DURATION } from '../constants/gameConfig';

export function useGameTimer(gameState, showResults, onTimeUp, setTimeLeft, onAlmostUp, almostThreshold = 5) {
  const timerRef = useRef(null);
  const almostFiredRef = useRef(false);

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
        const next = prev - 1;

        // Trigger almost-up callback once when threshold crossed
        if (typeof onAlmostUp === 'function' && !almostFiredRef.current && next <= almostThreshold) {
          try { onAlmostUp(); } catch (e) { console.error('onAlmostUp error', e); }
          almostFiredRef.current = true;
        }

        if (next <= 0) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          onTimeUp();
          return 0;
        }
        return next;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      almostFiredRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState?.active, gameState?.round, gameState?.turnStartedAt, gameState?.turnDuration, showResults, onTimeUp, setTimeLeft, onAlmostUp, almostThreshold]);

  return timerRef;
}