import { useState, useEffect, useRef } from "react";
import { ref, set, push, onValue, remove, get, onDisconnect } from "firebase/database";
import { db } from "../firebase";
import { generateUniqueNickname, getPlayerColor } from "../utils/nicknameUtils";
import { MAX_PLAYERS } from "../constants/gameConfig";

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
  const playerRefRef = useRef(null);
  const isAddingPlayer = useRef(false);
  const sessionId = useRef(getSessionId());

  // Add or update player with disconnect handling
  useEffect(() => {
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
            connected: true
          });
          
          setFinalNickname(playerData.name);
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
            sessionId: sessionId.current, // Store session ID
            joinedAt: Date.now(),
            score: 0,
            color: getPlayerColor(playersList.length),
            connected: true
          });
          
          setFinalNickname(uniqueName);
        }

        // Set up disconnect handler - remove player when they leave
        const disconnectHandler = onDisconnect(playerReference);
        await disconnectHandler.remove();

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
        // Remove player immediately on unmount
        remove(playerRefRef.current).catch(err => console.error("Error removing player:", err));
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
        .filter(player => player.connected !== false); // Filter out disconnected players

      // Sort by score (highest first)
      const sortedPlayers = allPlayers.sort((a, b) => (b.score || 0) - (a.score || 0));
      
      setPlayers(sortedPlayers);
      setIsRoomFull(sortedPlayers.length >= MAX_PLAYERS);
    });
    return unsubscribe;
  }, [roomId]);

  return { players, finalNickname, isRoomFull, playerId };
}
