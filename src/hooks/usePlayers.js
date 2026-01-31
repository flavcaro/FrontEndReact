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
  const [cannotJoinReason, setCannotJoinReason] = useState(null);
  const [playerId, setPlayerId] = useState(null);
  const [isOwner, setIsOwner] = useState(false);
  
  // STATO NUOVO: Gestisce il caricamento iniziale per evitare "ghost players"
  const [isChecking, setIsChecking] = useState(true);

  const playerRefRef = useRef(null);
  const isAddingPlayer = useRef(false);
  const sessionId = useRef(getSessionId());
  const playerNicknameRef = useRef(null);
  const disconnectSetup = useRef(false);
  const ownerRef = useRef(null);

  // Add or update player with disconnect handling
  useEffect(() => {
    const currentSessionId = sessionId.current;
    
    const addOrUpdatePlayer = async () => {
      // Controllo locale (non globale) per evitare race conditions nello stesso render
      if (isAddingPlayer.current) {
        return;
      }
      
      isAddingPlayer.current = true;
      setCannotJoinReason(null);

      // Resolve effective nickname
      const user = auth.currentUser;
      const storedNick = typeof window !== 'undefined' ? localStorage.getItem('nickname') : null;
      const resolvedNickname = (nickname && nickname.toString().trim())
        ? nickname.toString().trim()
        : (storedNick && storedNick.toString().trim())
          ? storedNick.toString().trim()
          : (user && !user.isAnonymous && user.displayName ? user.displayName.toString().trim() : '');

      try {
        // Get all existing players
        const playersRef = ref(db, `rooms/${roomId}/players`);
        const snapshot = await get(playersRef);
        const existingPlayers = snapshot.val() || {};
        
        // Convert to array
        const playersList = Object.entries(existingPlayers).map(([id, player]) => ({
          id,
          ...player
        }));

        // Check if THIS EXACT SESSION already exists
        const existingSessionEntry = Object.entries(existingPlayers).find(
          ([, player]) => player.sessionId === currentSessionId
        );

        // --- CONTROLLO 1: PARTITA IN CORSO ---
        const gameRef = ref(db, `rooms/${roomId}/game`);
        const gameSnap = await get(gameRef);
        const gameState = gameSnap.val();

        // Se non è un rejoin (è un nuovo utente) E la partita è attiva -> BLOCCA
        if (!existingSessionEntry && gameState?.active) {
          console.warn('⛔ [usePlayers] Blocco: Partita attiva.');
          setCannotJoinReason('Game in progress');
          // Non settiamo finalNickname e non creiamo il player
          return; 
        }

        // --- CONTROLLO 2: STANZA PIENA ---
        if (!existingSessionEntry && playersList.length >= MAX_PLAYERS) {
          setIsRoomFull(true);
          setCannotJoinReason('Room full');
          return;
        }

        let playerReference;
        let playerKey;
        const ownerSnapshot = await get(ref(db, `rooms/${roomId}/owner`));
        const hasExistingOwner = ownerSnapshot.exists();
        let playerNickname;

        if (existingSessionEntry) {
          // REJOIN: Aggiorna sessione esistente
          const [existingPlayerId, playerData] = existingSessionEntry;
          playerKey = existingPlayerId;
          playerReference = ref(db, `rooms/${roomId}/players/${playerKey}`);
          playerNickname = playerData.name;
          
          await set(playerReference, {
            name: playerData.name,
            originalNickname: nickname,
            sessionId: currentSessionId,
            userId: user && !user.isAnonymous ? user.uid : null,
            joinedAt: playerData.joinedAt || Date.now(),
            score: playerData.score || 0,
            color: playerData.color || getPlayerColor(playersList.length),
            connected: true
          });
          
          setFinalNickname(playerData.name);
        } else {
          // NEW JOIN: Crea nuovo player
          let uniqueName = generateUniqueNickname(resolvedNickname, playersList);
          
          // Doppio controllo per evitare duplicati
          try {
            const latestSnap = await get(playersRef);
            const latestPlayersObj = latestSnap.val() || {};
            const latestPlayersList = Object.entries(latestPlayersObj).map(([id, player]) => ({ id, ...player }));
            uniqueName = generateUniqueNickname(resolvedNickname, latestPlayersList);
          } catch (err) {
            console.warn('Could not refresh players before creating new player:', err);
          }
          
          if (!uniqueName) {
            console.error("Failed to generate unique nickname");
            return;
          }

          playerNickname = uniqueName;

          // Tentativo di scrittura con retry
          const MAX_RETRIES = 3;
          let created = false;
          let attempts = 0;
          while (!created && attempts < MAX_RETRIES) {
            attempts++;
            const newRef = push(playersRef);
            playerKey = newRef.key;
            playerReference = newRef;
            try {
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
               // Riprova con nome aggiornato
               const latestSnap = await get(playersRef);
               const latestPlayersObj = latestSnap.val() || {};
               const latestPlayersList = Object.entries(latestPlayersObj).map(([id, player]) => ({ id, ...player }));
               uniqueName = generateUniqueNickname(resolvedNickname, latestPlayersList);
            }
          }
          
          if (!created) {
             console.error('Unable to create player after retries');
             return;
          }
          
          // Set finale per sicurezza
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
          await sendSystemMessage(roomId, `👋 ${uniqueName} è entrato nella stanza`);

          if (!hasExistingOwner) {
            await set(ref(db, `rooms/${roomId}/owner`), {
              playerId: playerKey,
              nickname: uniqueName,
              sessionId: currentSessionId,
              createdAt: Date.now()
            });
          }
        }

        playerNicknameRef.current = playerNickname;
        playerRefRef.current = playerReference;
        setPlayerId(playerKey);

        // --- GESTIONE VITE (SURVIVAL MODE) ---
        // (Questa parte mancava nella versione semplificata precedente)
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

        // Setup Disconnect Handler
        if (!disconnectSetup.current) {
          disconnectSetup.current = true;
          const disconnectHandler = onDisconnect(playerReference);
          await disconnectHandler.remove();
          console.log('Player disconnect handler set up');
        }

      } catch (error) {
        console.error("Error adding/updating player:", error);
      } finally {
        isAddingPlayer.current = false;
        // FONDAMENTALE: Sblocca l'interfaccia (toglie la schermata bianca)
        setIsChecking(false);
      }
    };

    addOrUpdatePlayer();

    // CLEANUP: Quando il componente viene smontato (navigazione o chiusura)
    return () => {
      if (playerRefRef.current && playerNicknameRef.current) {
        const checkOwnerAndRemove = async () => {
          console.log('[usePlayers] cleanup triggered');
          try {
            const playerName = playerNicknameRef.current;
            await sendSystemMessage(roomId, `🚪 ${playerName} ha abbandonato la stanza`);
            
            const ownerSnapshot = await get(ref(db, `rooms/${roomId}/owner`));
            const ownerData = ownerSnapshot.val();
            
            // Se chi esce è l'owner
            if (ownerData?.sessionId === currentSessionId) {
                const gameSnapshot = await get(ref(db, `rooms/${roomId}/game`));
                const gameData = gameSnapshot.val();
                let skipOwnerRemoval = false;
                
                // Controlla se c'è un voto di restart in corso
                try {
                  const restartSnap = await get(ref(db, `rooms/${roomId}/restartVote`));
                  const restartData = restartSnap.val();
                  if (restartData && (restartData.status === 'open' || restartData.status === 'accepted')) {
                    skipOwnerRemoval = true;
                  }
                } catch (err) { console.warn(err); }

                if (!skipOwnerRemoval) {
                  if (gameData?.active) {
                    const playersSnapshot = await get(ref(db, `rooms/${roomId}/players`));
                    const playersData = playersSnapshot.val() || {};
                    const playersList = Object.values(playersData);
                    await endGameByOwnerLeaving(roomId, playersList, playerName);
                  }

                  await remove(ref(db, `rooms/${roomId}/owner`));

                  // Assegna nuovo owner
                  const remainingPlayersSnapshot = await get(ref(db, `rooms/${roomId}/players`));
                  const remainingPlayers = remainingPlayersSnapshot.val() || {};
                  const remainingPlayerList = Object.entries(remainingPlayers)
                    .map(([id, data]) => ({ id, ...data }))
                    .filter(player => player.sessionId !== currentSessionId)
                    .sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));

                  if (remainingPlayerList.length > 0) {
                    const newOwner = remainingPlayerList[0];
                    await set(ref(db, `rooms/${roomId}/owner`), {
                      playerId: newOwner.id,
                      nickname: newOwner.name,
                      sessionId: typeof newOwner.sessionId !== 'undefined' ? newOwner.sessionId : null,
                      createdAt: Date.now()
                    });
                    await sendSystemMessage(roomId, `👑 ${newOwner.name} è ora il nuovo creatore della stanza`);
                  }
                } else {
                   try {
                     await sendSystemMessage(roomId, `⚠️ Il creatore sta riavviando la partita, attendere...`);
                   } catch (e) { /* ignore */ }
                }
            }
            
            // Rimuovi il player dalla lista
            await new Promise((res) => setTimeout(res, 1000));
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
        const rawPlayers = Object.entries(data)
          .map(([id, player]) => ({
            id,
            ...player
          }))
          .filter(player => player.connected !== false);

        const ownerSnapshot = ownerRef.current;
        const ownerPlayerId = ownerSnapshot ? ownerSnapshot.playerId : null;
        const allPlayers = rawPlayers.map(p => ({ ...p, isOwner: p.id === ownerPlayerId }));
        const sortedPlayers = allPlayers.sort((a, b) => (b.score || 0) - (a.score || 0));
        
        setPlayers(sortedPlayers);
        setIsRoomFull(sortedPlayers.length >= MAX_PLAYERS);
      } catch (error) {
        console.error("Error in players listener:", error);
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
        ownerRef.current = ownerData || null;
        if (ownerData) {
          const isOwnerByPlayerId = playerId && ownerData.playerId === playerId;
          const isOwnerBySessionId = ownerData.sessionId === currentSessionId;
          setIsOwner(isOwnerByPlayerId || isOwnerBySessionId);
        } else {
          setIsOwner(false);
        }
      } catch (error) {
        console.error("Error in owner listener:", error);
      }
    });
    return unsubscribe;
  }, [roomId, playerId]);

  // FIX: Ritorna isChecking
  return { players, finalNickname, isRoomFull, cannotJoinReason, playerId, isOwner, isChecking };
}