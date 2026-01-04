/* filepath: src/hooks/usePlayerPresence.js */
import { useEffect, useRef } from 'react';
import { ref, onDisconnect, set, serverTimestamp } from 'firebase/database';
import { db } from '../firebase';

/**
 * Hook to manage player presence - removes player when they disconnect
 */
export function usePlayerPresence(roomId, playerId, isActive) {
  const presenceRef = useRef(null);

  useEffect(() => {
    if (!roomId || !playerId || !isActive) return;

    // Reference to this player's data
    const playerRef = ref(db, `rooms/${roomId}/players/${playerId}`);
    presenceRef.current = playerRef;

    // Set up disconnect handler
    const disconnectRef = onDisconnect(playerRef);
    
    // Remove player data when disconnected
    disconnectRef.remove().catch(err => {
      console.error('Error setting up disconnect handler:', err);
    });

    // Update presence timestamp periodically (heartbeat)
    const heartbeatInterval = setInterval(() => {
      set(ref(db, `rooms/${roomId}/players/${playerId}/lastSeen`), serverTimestamp())
        .catch(err => console.error('Heartbeat error:', err));
    }, 30000); // Every 30 seconds

    // Cleanup
    return () => {
      clearInterval(heartbeatInterval);
      
      // Cancel disconnect handler if still connected
      if (presenceRef.current) {
        onDisconnect(presenceRef.current).cancel();
      }
    };
  }, [roomId, playerId, isActive]);

  return presenceRef;
}