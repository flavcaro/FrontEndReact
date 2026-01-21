// Modalità Sopravvivenza
export const SOPRAVVIVENZA = {
  id: 'sopravvivenza',
  name: '🏃 Sopravvivenza',
  description: 'Difficoltà crescente per round. Penalità per non indovinare: perdita vite, eliminazione. Vince l\'ultimo rimasto!',
  icon: '🏃',
  turnDuration: 30,
  survivalMode: true,
  startingLives: 3
};

// Calcola la difficoltà basata sul round per Survival
export const getSurvivalDifficulty = (round) => {
  if (round <= 3) return 'easy';
  if (round <= 6) return 'medium';
  return 'hard';
};

// Applica penalità per Survival mode
export const applySurvivalPenalties = async (roomId, gameState, players, sendSystemMessage, db, set, ref) => {
  if (!gameState?.survivalMode || !gameState?.playerLives) return;

  const guessedNames = (gameState.guessedPlayers || []).map(g => g.nickname);

  for (const player of players) {
    if (player.name === gameState.currentArtist || guessedNames.includes(player.name)) continue;

    const currentLives = gameState.playerLives[player.name] || 0;
    if (currentLives > 0) {
      const newLives = currentLives - 1;
      await set(ref(db, `rooms/${roomId}/game/playerLives/${player.name}`), newLives);

      if (newLives === 0) {
        await sendSystemMessage(roomId, `💀 ${player.name} ha perso tutte le vite ed è eliminato!`);
      } else {
        await sendSystemMessage(roomId, `❤️ ${player.name} perde una vita! (${newLives} rimanenti)`);
      }
    }
  }
};