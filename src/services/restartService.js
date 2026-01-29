import { ref, set, update, onValue, remove } from "firebase/database";
import { db } from "../firebase";

/**
 * startRestartVote(roomId, initiatorId, initiatorName, players)
 * - Creates a restartVote node with votes initialized to 'pending' and the initiator auto-voting 'yes'
 */
export const startRestartVote = async (roomId, initiatorId, initiatorName, players) => {
  const votes = {};
  (players || []).forEach(p => {
    votes[p.id] = "pending";
  });
  votes[initiatorId] = "yes";
  await set(ref(db, `rooms/${roomId}/restartVote`), {
    initiatorId,
    initiatorName,
    createdAt: Date.now(),
    votes,
    status: "open"
  });
};

export const castRestartVote = async (roomId, playerId, vote) => {
  await set(ref(db, `rooms/${roomId}/restartVote/votes/${playerId}`), vote);
};

export const listenRestartVote = (roomId, cb) => {
  const r = ref(db, `rooms/${roomId}/restartVote`);
  const unsub = onValue(r, snapshot => {
    cb(snapshot.val());
  });
  return () => unsub();
};

export const endRestartVote = async (roomId, result, acceptedPlayers = []) => {
  await update(ref(db, `rooms/${roomId}/restartVote`), { status: result, acceptedPlayers });
  // keep result visible for a short time for clients, then remove
  setTimeout(() => {
    remove(ref(db, `rooms/${roomId}/restartVote`)).catch(() => {});
  }, 30000);
};