import { useState, useEffect, useRef } from "react";
import { ref, set, push, onValue, remove, get, onDisconnect } from "firebase/database";
import { db } from "../firebase";
import { generateUniqueNickname, getPlayerColor } from "../utils/nicknameUtils";
import { MAX_PLAYERS } from "../constants/gameConfig";
import { endGameByOwnerLeaving } from "../services/gameService";

// Generate a unique session ID for this browser tab/window
const generateSessionId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Get or create session ID (persists only in this tab/window)
const getSessionId = () => {
  let sessionId = sessionStorage.getItem('playerSessionId');
  if (!sessionId) {
    sessionId = generateSessionId();
    sessionStorage.setItem('playerSessionId', sessionId);
  }
  return sessionId;
};

export function usePlayers(roomId, nickname) {
  const [players, setPlayers] = useState([]);
  const [finalNickname, setFinalNickname] = useState(nickname);
  const [isRoomFull, setIsRoomFull] = useState(false);
  const [playerId, setPlayerId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  const playerRefRef = useRef(null);
  const isAddingPlayer = useRef(false);
  const sessionId = useRef(getSessionId());

  // Add or update player with disconnect handling
  useEffect(() => {
    const currentSessionId = sessionId.current; // Capture for cleanup
    
    const addOrUpdatePlayer = async () => {
      if (isAddingPlayer.current) return;
      isAddingPlayer.current = true;

      try {
        // Get all existing players
        const playersRef = ref(db, `rooms/${roomId}/players`);
        const snapshot = await get(playersRef);
        const existingPlayers = snapshot.val() || {};
        
        // Convert to array for nickname checking
        const playersList = Object.entries(existingPlayers).map(([id, player]) => ({
          id,
          ...player
        }));

        // Check if THIS EXACT SESSION already exists (same tab/window reconnecting)
        const existingSessionEntry = Object.entries(existingPlayers).find(
          ([, player]) => player.sessionId === sessionId.current
        );

        if (!existingSessionEntry && playersList.length >= MAX_PLAYERS) {
          setIsRoomFull(true);
          isAddingPlayer.current = false;
          return;
        }

        let playerReference;
        let playerKey;
        let isFirstPlayer = playersList.length === 0;

        if (existingSessionEntry) {
          // THIS EXACT SESSION exists (same tab reconnecting) - just update
          const [existingPlayerId, playerData] = existingSessionEntry;
          playerKey = existingPlayerId;
          playerReference = ref(db, `rooms/${roomId}/players/${playerKey}`);
          
          await set(playerReference, {
            name: playerData.name,
            originalNickname: nickname,
            sessionId: sessionId.current,
            joinedAt: Date.now(),
            score: playerData.score || 0,
            color: playerData.color || getPlayerColor(playersList.length),
            connected: true,
            isOwner: playerData.isOwner || false
          });
          
          setFinalNickname(playerData.name);
          setIsOwner(playerData.isOwner || false);
        } else {
          // New session - create new player with unique name if needed
          const uniqueName = generateUniqueNickname(nickname, playersList);
          
          if (!uniqueName) {
            console.error("Failed to generate unique nickname");
            isAddingPlayer.current = false;
            return;
          }

          if (uniqueName !== nickname) {
            console.log(`Nickname "${nickname}" già in uso. Cambiato in "${uniqueName}"`);
          }

          const newRef = push(playersRef);
          playerKey = newRef.key;
          playerReference = newRef;
          
          await set(playerReference, {
            name: uniqueName,
            originalNickname: nickname,
            sessionId: sessionId.current,
            joinedAt: Date.now(),
            score: 0,
            color: getPlayerColor(playersList.length),
            connected: true,
            isOwner: isFirstPlayer // First player is the owner
          });
          
          setFinalNickname(uniqueName);
          setIsOwner(isFirstPlayer);

          // Store room ownership in separate location
          if (isFirstPlayer) {
            await set(ref(db, `rooms/${roomId}/owner`), {
              playerId: playerKey,
              nickname: uniqueName,
              sessionId: sessionId.current,
              createdAt: Date.now()
            });
          }
        }

        // Set up disconnect handler - remove player when they leave
        const disconnectHandler = onDisconnect(playerReference);
        
        // If owner disconnects, end the game
        if (isFirstPlayer || (existingSessionEntry && existingSessionEntry[1].isOwner)) {
          disconnectHandler.remove().then(async () => {
            // Check if game is active
            const gameSnapshot = await get(ref(db, `rooms/${roomId}/game`));
            const gameData = gameSnapshot.val();
            
            if (gameData?.active) {
              await endGameByOwnerLeaving(roomId, playersList);
            }
          });
        } else {
          await disconnectHandler.remove();
        }

        playerRefRef.current = playerReference;
        setPlayerId(playerKey);

      } catch (error) {
        console.error("Error adding/updating player:", error);
      } finally {
        isAddingPlayer.current = false;
      }
    };

    addOrUpdatePlayer();

    // Cleanup on unmount - manually remove player
    return () => {
      if (playerRefRef.current) {
        // Check if this is the owner
        const checkOwnerAndRemove = async () => {
          try {
            const ownerSnapshot = await get(ref(db, `rooms/${roomId}/owner`));
            const ownerData = ownerSnapshot.val();
            
            if (ownerData?.sessionId === currentSessionId) {
              // This is the owner leaving
              const gameSnapshot = await get(ref(db, `rooms/${roomId}/game`));
              const gameData = gameSnapshot.val();
              
              if (gameData?.active) {
                const playersSnapshot = await get(ref(db, `rooms/${roomId}/players`));
                const playersData = playersSnapshot.val() || {};
                const playersList = Object.values(playersData);
                await endGameByOwnerLeaving(roomId, playersList);
              }
            }
            
            // Remove player
            await remove(playerRefRef.current);
          } catch (err) {
            console.error("Error removing player:", err);
          }
        };
        
        checkOwnerAndRemove();
        playerRefRef.current = null;
      }
    };
  }, [roomId, nickname]);

  // Listen to players list
  useEffect(() => {
    const playersRef = ref(db, `rooms/${roomId}/players`);
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const data = snapshot.val() || {};
      
      // Convert to array - Keep ALL connected players
      const allPlayers = Object.entries(data)
        .map(([id, player]) => ({
          id,
          ...player
        }))
        .filter(player => player.connected !== false);

      // Sort by score (highest first)
      const sortedPlayers = allPlayers.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      setPlayers(sortedPlayers);
      setIsRoomFull(sortedPlayers.length >= MAX_PLAYERS);
    });
    return unsubscribe;
  }, [roomId]);

  return { players, finalNickname, isRoomFull, playerId, isOwner };
}
