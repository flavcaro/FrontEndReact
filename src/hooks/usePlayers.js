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

// Global flag per room+session per evitare duplicazioni tra rendering multipli
const addingPlayersMap = new Map();

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
  const ownerRef = useRef(null);

  // Add or update player with disconnect handling
  useEffect(() => {
    const currentSessionId = sessionId.current;
    const mapKey = `${roomId}_${currentSessionId}`;
    
    const addOrUpdatePlayer = async () => {
      // Check global map per evitare chiamate duplicate anche tra rendering
      if (isAddingPlayer.current || addingPlayersMap.get(mapKey)) {
        console.log('⚠️ [usePlayers] Già in fase di aggiunta (global check), skip');
        return;
      }
      
      isAddingPlayer.current = true;
      addingPlayersMap.set(mapKey, true);

      // Resolve effective nickname: prop -> localStorage -> auth.displayName -> empty
      const user = auth.currentUser;
      const storedNick = typeof window !== 'undefined' ? localStorage.getItem('nickname') : null;
      const resolvedNickname = (nickname && nickname.toString().trim())
        ? nickname.toString().trim()
        : (storedNick && storedNick.toString().trim())
          ? storedNick.toString().trim()
          : (user && !user.isAnonymous && user.displayName ? user.displayName.toString().trim() : '');

      // set an initial finalNickname so UI can show the intended name earlier
      if (resolvedNickname) setFinalNickname(resolvedNickname);

      console.log('👤 [usePlayers] Aggiunta/Aggiornamento player:', { nickname: resolvedNickname, sessionId: currentSessionId });
      try {
        // Get all existing players
        const playersRef = ref(db, `rooms/${roomId}/players`);
        const snapshot = await get(playersRef);
        const existingPlayers = snapshot.val() || {};
        
        console.log('📋 [usePlayers] Players esistenti:', Object.keys(existingPlayers).length);
        
        // Convert to array for nickname checking
        const playersList = Object.entries(existingPlayers).map(([id, player]) => ({
          id,
          ...player
        }));

        // Check if THIS EXACT SESSION already exists (same tab/window reconnecting)
        const existingSessionEntry = Object.entries(existingPlayers).find(
          ([, player]) => player.sessionId === currentSessionId
        );

        if (existingSessionEntry) {
          console.log('✅ [usePlayers] Sessione esistente trovata, aggiorno:', existingSessionEntry[0]);
        } else {
          console.log('🆕 [usePlayers] Nuova sessione, creo nuovo player');
        }

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
            joinedAt: playerData.joinedAt || Date.now(), // Mantieni il joinedAt originale!
            score: playerData.score || 0,
            color: playerData.color || getPlayerColor(playersList.length),
            connected: true
          });
          
          setFinalNickname(playerData.name);
        } else {
          // New session - create new player with unique name if needed
          // Re-check names right before writing to avoid race conditions where
          // two clients join with the same nickname at the same time.
          let uniqueName = generateUniqueNickname(resolvedNickname, playersList);
          // user is available above
          try {
            // refresh players list from server
            const latestSnap = await get(playersRef);
            const latestPlayersObj = latestSnap.val() || {};
            const latestPlayersList = Object.entries(latestPlayersObj).map(([id, player]) => ({ id, ...player }));
            uniqueName = generateUniqueNickname(resolvedNickname, latestPlayersList);
          } catch (err) {
            console.warn('Could not refresh players before creating new player:', err);
          }
          
          if (!uniqueName) {
            console.error("Failed to generate unique nickname");
            isAddingPlayer.current = false;
            return;
          }

          if (resolvedNickname && uniqueName !== resolvedNickname) {
            console.log(`Nickname "${resolvedNickname}" già in uso. Cambiato in "${uniqueName}"`);
          }

          playerNickname = uniqueName;

          // Attempt to create the player; if name collision happens due to concurrent writes,
          // retry a few times with updated list.
          const MAX_RETRIES = 3;
          let created = false;
          let attempts = 0;
          while (!created && attempts < MAX_RETRIES) {
            attempts++;
            const newRef = push(playersRef);
            playerKey = newRef.key;
            playerReference = newRef;
            try {
              // Ensure we write the chosen uniqueName
              await set(playerReference, {
                name: uniqueName,
                originalNickname: resolvedNickname,
                sessionId: currentSessionId,
                userId: user && !user.isAnonymous ? user.uid : null,
                joinedAt: Date.now(),
                score: 0,
                color: getPlayerColor(playersList.length),
                connected: true
              });
              created = true;
            } catch (err) {
              console.warn('Failed to create player entry, retrying', err);
              // refresh uniqueName and retry
              const latestSnap = await get(playersRef);
              const latestPlayersObj = latestSnap.val() || {};
              const latestPlayersList = Object.entries(latestPlayersObj).map(([id, player]) => ({ id, ...player }));
              uniqueName = generateUniqueNickname(resolvedNickname, latestPlayersList);
            }
          }
          if (!created) {
            console.error('Unable to create player after retries');
            isAddingPlayer.current = false;
            return;
          }
          
          await set(playerReference, {
            name: uniqueName,
            originalNickname: resolvedNickname,
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

        // Non rimuovere dalla map - mantieni per evitare duplicati futuri
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
        const rawPlayers = Object.entries(data)
          .map(([id, player]) => ({
            id,
            ...player
          }))
          .filter(player => player.connected !== false);

        // If we have owner info, mark the owner on the player objects
        const ownerSnapshot = ownerRef.current;
        const ownerPlayerId = ownerSnapshot ? ownerSnapshot.playerId : null;
        const allPlayers = rawPlayers.map(p => ({ ...p, isOwner: p.id === ownerPlayerId }));

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
    const ownerDbRef = ref(db, `rooms/${roomId}/owner`);
    const unsubscribe = onValue(ownerDbRef, (snapshot) => {
      try {
        const ownerData = snapshot.val();
        const currentSessionId = sessionId.current;
        
        // store the owner snapshot in a ref so players listener can mark isOwner
        ownerRef.current = ownerData || null;
        if (ownerData) {
          // Check both playerId and sessionId for more reliable owner detection
          const isOwnerByPlayerId = playerId && ownerData.playerId === playerId;
          const isOwnerBySessionId = ownerData.sessionId === currentSessionId;
          setIsOwner(isOwnerByPlayerId || isOwnerBySessionId);
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
