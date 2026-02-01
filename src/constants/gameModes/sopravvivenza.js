// Modalità Sopravvivenza
import survivalSprite from '../../sprites/survival.gif';

export const SOPRAVVIVENZA = {
  id: 'sopravvivenza',
  name: 'Sopravvivenza',
  description: 'Difficoltà crescente per round. Penalità per non indovinare: perdita vite, eliminazione. Vince l\'ultimo rimasto!',
  icon: '🏃',
  sprite: survivalSprite,
  turnDuration: 30,
  survivalMode: true,
  startingLives: 3
};

// Default threshold settings for Survival mode
// thresholdType: 'turn' -> compare points scored this turn
// thresholdType: 'game' -> compare total score
export const SURVIVAL_DEFAULT_THRESHOLD = {
  thresholdType: 'turn',
  thresholdValue: 10
};

// Calcola la difficoltà basata sul round per Survival
export const getSurvivalDifficulty = (round) => {
  if (round <= 3) return 'easy';
  if (round <= 6) return 'medium';
  return 'hard';
};

// Applica penalità per Survival mode
// Returns { shouldEndGame: boolean, winner: string | null }
export const applySurvivalPenalties = async (roomId, gameState, players, sendSystemMessage, db, set, ref, get) => {
  if (!gameState?.survivalMode || !gameState?.playerLives) return { shouldEndGame: false, winner: null };

  // Aspetta un momento per assicurarsi che guessedPlayers sia aggiornato
  await new Promise(resolve => setTimeout(resolve, 100));

  // Leggi direttamente guessedPlayers dal database per avere il valore più aggiornato
  const guessedRef = ref(db, `rooms/${roomId}/game/guessedPlayers`);
  const guessedSnapshot = await get(guessedRef);
  const guessedPlayers = guessedSnapshot.val() || [];
  const guessedNames = guessedPlayers.map(g => g.nickname);

  // Determine threshold configuration: prefer gameState, fallback to defaults
  const thresholdConfig = {
    thresholdType: gameState.survivalThreshold?.type || gameState.survivalThreshold?.thresholdType || SURVIVAL_DEFAULT_THRESHOLD.thresholdType,
    thresholdValue: gameState.survivalThreshold?.value || gameState.survivalThreshold?.thresholdValue || SURVIVAL_DEFAULT_THRESHOLD.thresholdValue
  };

  // Keep track of updated lives locally to check for winner after all penalties
  const updatedPlayerLives = { ...gameState.playerLives };

  for (const player of players) {
    if (player.name === gameState.currentArtist) continue;

    // Points this turn for the player (from guessedPlayers entries)
    const guessedEntry = guessedPlayers.find(g => g.nickname === player.name);
    const pointsThisTurn = guessedEntry ? (guessedEntry.points || 0) : 0;

    let shouldPenalize = false;

    if (thresholdConfig.thresholdType === 'turn') {
      // Penalize if didn't reach per-turn threshold
      if (pointsThisTurn < thresholdConfig.thresholdValue) shouldPenalize = true;
    } else if (thresholdConfig.thresholdType === 'game') {
      // Penalize if total score below threshold
      const totalScore = player.score || 0;
      if (totalScore < thresholdConfig.thresholdValue) shouldPenalize = true;
    } else {
      // Fallback: penalize non-guessers
      if (!guessedNames.includes(player.name)) shouldPenalize = true;
    }

    if (!shouldPenalize) continue;

    const currentLives = updatedPlayerLives[player.name] || 0;
    if (currentLives > 0) {
      const newLives = currentLives - 1;
      updatedPlayerLives[player.name] = newLives;
      await set(ref(db, `rooms/${roomId}/game/playerLives/${player.name}`), newLives);

      if (newLives === 0) {
        await sendSystemMessage(roomId, `💀 ${player.name} ha perso tutte le vite ed è eliminato!`);
      } else {
        await sendSystemMessage(roomId, `❤️ ${player.name} perde una vita! (${newLives} rimanenti)`);
      }
    }
  }

  // Check if only one player remains alive - survival victory!
  const playersAlive = players.filter(p => (updatedPlayerLives[p.name] || 0) > 0);
  if (playersAlive.length === 1) {
    const winner = playersAlive[0].name;
    await sendSystemMessage(roomId, `🏆 ${winner} è l'ultimo sopravvissuto e vince la partita!`);
    return { shouldEndGame: true, winner };
  }

  // Also end game if no players are alive (edge case)
  if (playersAlive.length === 0) {
    return { shouldEndGame: true, winner: null };
  }

  return { shouldEndGame: false, winner: null };
};