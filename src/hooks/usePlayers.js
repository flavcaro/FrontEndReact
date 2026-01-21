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
        // Check if there's already an owner to prevent race conditions
        const ownerSnapshot = await get(ref(db, `rooms/${roomId}/owner`));
        const hasExistingOwner = ownerSnapshot.exists();
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
            connected: true
          });
          
          setFinalNickname(uniqueName);

          // Send join message
          await sendSystemMessage(roomId, `👋 ${uniqueName} è entrato nella stanza`);

          // Store room ownership in separate location
          if (!hasExistingOwner) {
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

        // If the game is in survival mode, ensure this player's lives are initialized
        try {
          const gameSnapshot = await get(ref(db, `rooms/${roomId}/game`));
          const gameData = gameSnapshot.val() || {};
          if (gameData.survivalMode) {
            const starting = gameData.startingLives || 3;
            const playerLivesRef = ref(db, `rooms/${roomId}/game/playerLives/${playerNickname}`);
            const livesSnap = await get(playerLivesRef);
            if (!livesSnap.exists()) {
              await set(playerLivesRef, starting);
            }
          }
        } catch (err) {
          console.error('Error ensuring player lives:', err);
        }

        // Set up disconnect handler ONLY ONCE
        if (!disconnectSetup.current) {
          disconnectSetup.current = true;
          
          const disconnectHandler = onDisconnect(playerReference);
          
          // Always remove player on disconnect
          await disconnectHandler.remove();
          console.log('Player disconnect handler set up');
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
              
              // Remove current owner
              await remove(ref(db, `rooms/${roomId}/owner`));
              
              // Assign new owner to the oldest remaining player (by joinedAt)
              const remainingPlayersSnapshot = await get(ref(db, `rooms/${roomId}/players`));
              const remainingPlayers = remainingPlayersSnapshot.val() || {};
              const remainingPlayerList = Object.entries(remainingPlayers)
                .map(([id, data]) => ({ id, ...data }))
                .filter(player => player.sessionId !== currentSessionId) // Exclude the leaving player
                .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0)); // Sort by join time
              
              if (remainingPlayerList.length > 0) {
                const newOwner = remainingPlayerList[0];
                await set(ref(db, `rooms/${roomId}/owner`), {
                  playerId: newOwner.id,
                  nickname: newOwner.name,
                  sessionId: newOwner.sessionId,
                  createdAt: Date.now()
                });
                await sendSystemMessage(roomId, `👑 ${newOwner.name} è ora il nuovo creatore della stanza`);
              }
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
      try {
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
      } catch (error) {
        console.error("Error in players listener:", error);
        // Don't crash the app, just log the error
      }
    });
    return unsubscribe;
  }, [roomId]);

  // Listen to owner
  useEffect(() => {
    const ownerRef = ref(db, `rooms/${roomId}/owner`);
    const unsubscribe = onValue(ownerRef, (snapshot) => {
      try {
        const ownerData = snapshot.val();
        if (ownerData && playerId) {
          setIsOwner(ownerData.playerId === playerId);
        } else {
          setIsOwner(false);
        }
      } catch (error) {
        console.error("Error in owner listener:", error);
        // Don't crash the app, just log the error
      }
    });
    return unsubscribe;
  }, [roomId, playerId]);

  return { players, finalNickname, isRoomFull, playerId, isOwner };
}
