import { useState, useEffect, useRef } from "react";
import { ref, set, push, onValue, remove, get, onDisconnect } from "firebase/database";
import { db, auth } from "../firebase";
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

// Helper function to send system message
const sendSystemMessage = async (roomId, message) => {
  await push(ref(db, `rooms/${roomId}/chat`), {
    user: "Sistema",
    message,
    timestamp: Date.now(),
    isSystem: true
  });
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
  const playerNicknameRef = useRef(null);
  const disconnectSetup = useRef(false); // Track if disconnect is setup

  // Add or update player with disconnect handling
  useEffect(() => {
    const currentSessionId = sessionId.current;
    
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
          ([, player]) => player.sessionId === currentSessionId
        );

        if (!existingSessionEntry && playersList.length >= MAX_PLAYERS) {
          setIsRoomFull(true);
          isAddingPlayer.current = false;
          return;
        }

        let playerReference;
        let playerKey;
        let isFirstPlayer = playersList.length === 0;
        let playerNickname;

        if (existingSessionEntry) {
          // THIS EXACT SESSION exists (same tab reconnecting) - just update
          const [existingPlayerId, playerData] = existingSessionEntry;
          playerKey = existingPlayerId;
          playerReference = ref(db, `rooms/${roomId}/players/${playerKey}`);
          playerNickname = playerData.name;
          
          const user = auth.currentUser;
          await set(playerReference, {
            name: playerData.name,
            originalNickname: nickname,
            sessionId: currentSessionId,
            userId: user && !user.isAnonymous ? user.uid : null,
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

          playerNickname = uniqueName;

          const newRef = push(playersRef);
          playerKey = newRef.key;
          playerReference = newRef;
          
          const user = auth.currentUser;
          await set(playerReference, {
            name: uniqueName,
            originalNickname: nickname,
            sessionId: currentSessionId,
            userId: user && !user.isAnonymous ? user.uid : null,
            joinedAt: Date.now(),
            score: 0,
            color: getPlayerColor(playersList.length),
            connected: true,
            isOwner: isFirstPlayer
          });
          
          setFinalNickname(uniqueName);
          setIsOwner(isFirstPlayer);

          // Send join message
          await sendSystemMessage(roomId, `👋 ${uniqueName} è entrato nella stanza`);

          // Store room ownership in separate location
          if (isFirstPlayer) {
            await set(ref(db, `rooms/${roomId}/owner`), {
              playerId: playerKey,
              nickname: uniqueName,
              sessionId: currentSessionId,
              createdAt: Date.now()
            });
          }
        }

        // Store nickname for cleanup
        playerNicknameRef.current = playerNickname;
        playerRefRef.current = playerReference;
        setPlayerId(playerKey);

        // Set up disconnect handler ONLY ONCE
        if (!disconnectSetup.current) {
          disconnectSetup.current = true;
          
          const disconnectHandler = onDisconnect(playerReference);
          
          // If owner disconnects, end the game
          if (isFirstPlayer || (existingSessionEntry && existingSessionEntry[1].isOwner)) {
            await disconnectHandler.remove();
            console.log('Owner disconnect handler set up');
          } else {
            // Regular player disconnect - just remove
            await disconnectHandler.remove();
            console.log('Player disconnect handler set up');
          }
        }

      } catch (error) {
        console.error("Error adding/updating player:", error);
      } finally {
        isAddingPlayer.current = false;
      }
    };

    addOrUpdatePlayer();

    // Cleanup on unmount - always remove player and handle owner logic
    return () => {
      if (playerRefRef.current && playerNicknameRef.current) {
        const checkOwnerAndRemove = async () => {
          try {
            const playerName = playerNicknameRef.current;
            // Always remove player and send leave message
            await sendSystemMessage(roomId, `🚪 ${playerName} ha abbandonato la stanza`);
            const ownerSnapshot = await get(ref(db, `rooms/${roomId}/owner`));
            const ownerData = ownerSnapshot.val();
            if (ownerData?.sessionId === currentSessionId) {
              // Owner is leaving: end game and remove owner node
              const gameSnapshot = await get(ref(db, `rooms/${roomId}/game`));
              const gameData = gameSnapshot.val();
              if (gameData?.active) {
                const playersSnapshot = await get(ref(db, `rooms/${roomId}/players`));
                const playersData = playersSnapshot.val() || {};
                const playersList = Object.values(playersData);
                await endGameByOwnerLeaving(roomId, playersList);
              }
              await remove(ref(db, `rooms/${roomId}/owner`));
            }
            // Remove player from list
            await remove(playerRefRef.current);
          } catch (err) {
            console.error("Error removing player:", err);
          }
        };
        checkOwnerAndRemove();
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
