import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, remove as dbRemove, push, get, set } from 'firebase/database';
import { db } from '../../firebase';
import { startRestartVote, castRestartVote, listenRestartVote, endRestartVote } from '../../services/restartService';
import { endGameByOwnerLeaving } from '../../services/gameService';
import SimplePopup from './SimplePopup';

export default function GameResults({ roomId, players = [], finalNickname, finalResults, onRestart, minYesVotes = 2, playerId: propPlayerId }) {
  const navigate = useNavigate();


  const podium = finalResults.slice(0, 3);

  const [restartVote, setRestartVote] = useState(null);
  const [hasCast, setHasCast] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [thumbFeedback, setThumbFeedback] = useState(null); // 'yes' | 'no' | null

  // Prefer explicit `playerId` prop (from `usePlayers`) — fallback to name-based lookup
  const currentPlayer = players.find(p => p.name === finalNickname);
  const currentPlayerId = propPlayerId || currentPlayer?.id;

  

  // Listen for any restartVote changes
  useEffect(() => {
    if (!roomId) return;
    const unsub = listenRestartVote(roomId, (data) => {
      try {
        console.log('[GameResults] restartVote update', { roomId, data, currentPlayerId, playersCount: players.length });
      } catch (e) { /* ignore logging errors */ }
      setRestartVote(data || null);
      // Update hasCast according to the stored votes for this player
      if (data?.status === 'open') {
        const myVote = data.votes ? data.votes[currentPlayerId] : undefined;
        setHasCast(myVote && myVote !== 'pending');
      } else {
        setHasCast(false);
      }
    });
    return () => unsub && unsub();
  }, [roomId, currentPlayerId, players.length]);

  // If votes reach a decision, conclude locally
  useEffect(() => {
    (async () => {
      if (!restartVote || restartVote.status !== 'open') {
        // If accepted, trigger onRestart and navigate clients to new room returned by handler
        if (restartVote?.status === 'accepted') {
          const acceptedPlayers = restartVote.acceptedPlayers || [];
          try {
            console.log('[restart] accepted detected', { roomId, acceptedPlayers, restartVote });
            // If a newRoomId was already written by the initiator, use it
            if (restartVote.newRoomId) {
              const encoded = encodeURIComponent(finalNickname || '');
              // Give users a short moment to see the result before navigating
              await new Promise((res) => setTimeout(res, 2000));
              navigate(`/room/${restartVote.newRoomId}/play?nick=${encoded}`);
              return;
            }

            // Non-initiators: wait briefly for initiator to publish newRoomId
            if (restartVote.initiatorId !== currentPlayerId) {
              const start = Date.now();
              let foundNew = null;
              while (Date.now() - start < 8000) {
                const snap = await get(ref(db, `rooms/${roomId}/restartVote/newRoomId`));
                if (snap.exists()) { foundNew = snap.val(); break; }
                await new Promise((r) => setTimeout(r, 500));
              }
              if (foundNew) {
                const encoded = encodeURIComponent(finalNickname || '');
                await new Promise((res) => setTimeout(res, 2000));
                navigate(`/room/${foundNew}/play?nick=${encoded}`);
                return;
              }
              // If after waiting the newRoomId was not published, fall through to optional fallback
            }

            // Only the initiator (or fallback) creates the new room to avoid race conditions
            if (onRestart && restartVote.initiatorId === currentPlayerId) {
              const newRoomId = await onRestart(acceptedPlayers);
              if (newRoomId) {
                // publish newRoomId so other clients can navigate
                try { await set(ref(db, `rooms/${roomId}/restartVote/newRoomId`), newRoomId); } catch (err) { console.error(err); }
                const encoded = encodeURIComponent(finalNickname || '');
                // Give users a short moment to see the result before navigating
                await new Promise((res) => setTimeout(res, 2000));
                navigate(`/room/${newRoomId}/play?nick=${encoded}`);
                return;
              }
            }

            // Fallback: if we're not the initiator but we have an onRestart handler, attempt to create a room
            if (onRestart && restartVote.initiatorId !== currentPlayerId) {
              console.warn('[restart] fallback: initiator did not publish newRoomId in time, creating new room as fallback');
              const newRoomId = await onRestart(acceptedPlayers);
              if (newRoomId) {
                try { await set(ref(db, `rooms/${roomId}/restartVote/newRoomId`), newRoomId); } catch (err) { console.error(err); }
                const encoded = encodeURIComponent(finalNickname || '');
                await new Promise((res) => setTimeout(res, 2000));
                navigate(`/room/${newRoomId}/play?nick=${encoded}`);
                return;
              }
            }
          } catch (e) {
            console.error(e);
          }
        }

        // If rejected, send everyone back to home
        if (restartVote?.status === 'rejected') {
          try { navigate('/home', { replace: true }); } catch (e) { console.error(e); }
        }
        return;
      }

      const votes = restartVote.votes || {};
      const currentPlayerIds = new Set(players.map(p => p.id));
      const relevantVotes = Object.entries(votes).filter(([id]) => currentPlayerIds.has(id));
      const yesCount = relevantVotes.filter(([, v]) => v === 'yes').length;
      const noCount = relevantVotes.filter(([, v]) => v === 'no').length;
      // Count only votes that are not 'pending' as cast
      const totalCast = relevantVotes.filter(([, v]) => v !== 'pending').length;
      const totalPlayers = players.length;

      // Guard: require at least 2 players to auto-resolve vote
      if (totalPlayers < 2) return;

      // Early acceptance/rejection if majority reached
      if (yesCount > Math.floor(totalPlayers / 2)) {
        const accepted = Object.entries(votes).filter(([, v]) => v === 'yes').map(([id]) => id);
        await endRestartVote(roomId, 'accepted', accepted).catch(err => console.error(err));
        return;
      }
      if (noCount > Math.floor(totalPlayers / 2)) {
        // Rejected by majority
        await endRestartVote(roomId, 'rejected', []).catch(err => console.error(err));
        return;
      }

      // If everyone cast and no early majority: accept on tie or majority-yes
      if (totalCast === totalPlayers) {
        if (yesCount >= noCount) {
          const accepted = Object.entries(votes).filter(([, v]) => v === 'yes').map(([id]) => id);
          await endRestartVote(roomId, 'accepted', accepted).catch(err => console.error(err));
        } else {
          await endRestartVote(roomId, 'rejected', []).catch(err => console.error(err));
        }
      }
    })();
    }, [restartVote, players, roomId, onRestart, minYesVotes, navigate, finalNickname, /* derived */ currentPlayerId]);

  const handleExit = () => {
    // Open confirmation modal
    setConfirmOpen(true);
  };

  const confirmLeave = async () => {
    setConfirmOpen(false);
    const me = players.find(p => p.name === finalNickname);
    try {
      if (me && me.isOwner) {
        // Owner confirmed exit
        // Check remaining players
        const playersSnapshot = await get(ref(db, `rooms/${roomId}/players`));
        const playersData = playersSnapshot.val() || {};
        const remaining = Object.entries(playersData)
          .map(([id, data]) => ({ id, ...data }))
          .filter(p => p.id !== me.id);

        if (remaining.length > 0) {
          // Assign new owner (oldest by joinedAt)
          remaining.sort((a, b) => (a.joinedAt || 0) - (b.joinedAt || 0));
          const newOwner = remaining[0];
          await set(ref(db, `rooms/${roomId}/owner`), {
            playerId: newOwner.id,
            nickname: newOwner.name,
            sessionId: newOwner.sessionId,
            createdAt: Date.now()
          });
          // Announce owner left and new owner
          await push(ref(db, `rooms/${roomId}/chat`), {
            user: 'Sistema',
            message: `Giocatore "${me.name}" ha abbandonato la stanza. ${newOwner.name} è ora il nuovo creatore della stanza.`,
            timestamp: Date.now(),
            isSystem: true
          });
          // Wait briefly so clients receive the message before removing the player
          await new Promise((res) => setTimeout(res, 1000));
          // Remove leaving player
          try { await dbRemove(ref(db, `rooms/${roomId}/players/${me.id}`)); } catch (e) {}
          navigate('/home', { replace: true });
        } else {
          // No remaining players: end game and navigate home
          await endGameByOwnerLeaving(roomId, players, me.name);
          // wait briefly so clients receive end message
          await new Promise((res) => setTimeout(res, 1000));
          try { await dbRemove(ref(db, `rooms/${roomId}/owner`)); } catch (e) {}
          navigate('/home', { replace: true });
        }
      } else {
        // Non-owner confirm exit: announce, wait, remove self and navigate home
        await push(ref(db, `rooms/${roomId}/chat`), {
          user: 'Sistema',
          message: `Giocatore "${me?.name || 'Un giocatore'}" ha abbandonato la stanza.`,
          timestamp: Date.now(),
          isSystem: true
        });
        // Give clients time to receive the message
        await new Promise((res) => setTimeout(res, 1000));
        if (me && me.id) {
          try { await dbRemove(ref(db, `rooms/${roomId}/players/${me.id}`)); } catch (e) {}
        }
        navigate('/home', { replace: true });
      }
    } catch (err) {
      console.error('confirmLeave error', err);
      navigate('/home', { replace: true });
    }
  };

  const canInitiate = players.length >= 2;

  if (!finalResults || finalResults.length === 0) return null;

  const handleStartVote = async () => {
    if (!canInitiate) return;
    const initiator = currentPlayer || players[0];
    try {
      await startRestartVote(roomId, initiator.id, initiator.name, players);
      // Mark initiator as having cast locally; actual vote state will be reconciled from DB
      if (initiator.id === currentPlayerId) setHasCast(true);
    } catch (err) {
      console.error('startRestartVote error', err);
      alert('Errore avviando la votazione');
    }
  };

  const handleVote = async (choice) => {
    if (!currentPlayerId) return;
    try {
      await castRestartVote(roomId, currentPlayerId, choice);
      setHasCast(true);
      // Quick visual feedback for the clicked thumb
      try {
        setThumbFeedback(choice);
        setTimeout(() => setThumbFeedback(null), 260);
      } catch (e) { /* ignore */ }
      // Vote cast; do NOT remove player automatically on 'no' — just register vote
    } catch (err) {
      console.error('castRestartVote error', err);
    }
  };

  return (
    <div className="game-results-overlay">
      <div className="game-results-card">
        <div className="results-header">
          <h1>🎉 Partita Terminata! 🎉</h1>
          <p>Ecco i risultati finali</p>
        </div>

        <div className="podium">
          {podium.map((player, index) => (
            <div key={player.id} className={`podium-place place-${index + 1}`}>
              <div className="podium-medal">
                {index === 0 && '🥇'}
                {index === 1 && '🥈'}
                {index === 2 && '🥉'}
              </div>
              <div className="podium-player">
                <div className="podium-name">{player.name}</div>
                <div className="podium-score">{player.score} punti</div>
              </div>
            </div>
          ))}
        </div>

        <div className="results-list">
          <h3>📊 Classifica Completa</h3>
          {finalResults.map((player, index) => (
            <div key={player.id} className="result-row">
              <div className="result-position">#{index + 1}</div>
              <div className="result-player">{player.name}</div>
              <div className="result-score">{player.score} pts</div>
            </div>
          ))}
        </div>

        <div className="results-actions">
          <button
            onClick={handleStartVote}
            className="btn-restart"
            disabled={!canInitiate}
            title={!canInitiate ? 'Servono almeno 2 giocatori per votare' : 'Avvia votazione "Gioca ancora"'}
          >
            Gioca Ancora
          </button>

          <button
            onClick={handleExit}
            className="btn-exit"
          >
            Esci
          </button>
        </div>

        {/* Voting modal */}
        {restartVote && (
          <div className="simple-modal" style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(0,0,0,0.4)'
          }}>
            <div style={{ background: 'white', padding: 20, borderRadius: 12, minWidth: 360, maxWidth: 680 }}>
              <h3 style={{ marginTop: 0 }}>Votazione: Giocare ancora?</h3>
              <p style={{ marginTop: 6, marginBottom: 12, color: '#334155' }}>Avviata da: {restartVote.initiatorName}</p>

                    <div style={{ display: 'flex', gap: 16, marginTop: 6, alignItems: 'stretch' }}>
                      {(() => {
                        const myVote = restartVote?.votes ? restartVote.votes[currentPlayerId] : undefined;
                        return (
                          <>
                            <div
                              className={`thumb-vote ${thumbFeedback === 'yes' ? 'pulse' : ''}`}
                              onClick={() => (!hasCast && handleVote('yes'))}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter') (!hasCast && handleVote('yes')); }}
                              style={{
                                flex: 1,
                                textAlign: 'center',
                                padding: 12,
                                borderRadius: 8,
                                background: myVote === 'yes' ? '#ecfdf5' : (myVote === 'no' ? '#fff1f2' : '#f8fafc'),
                                cursor: hasCast ? 'default' : 'pointer',
                                border: myVote === 'yes' ? '1px solid #34d399' : '1px solid transparent'
                              }}
                            >
                              <div style={{ fontSize: 44 }}>👍</div>
                              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{Object.values(restartVote.votes || {}).filter(v => v === 'yes').length} voti</div>
                            </div>

                            <div
                              className={`thumb-vote ${thumbFeedback === 'no' ? 'pulse' : ''}`}
                              onClick={() => (!hasCast && handleVote('no'))}
                              role="button"
                              tabIndex={0}
                              onKeyDown={(e) => { if (e.key === 'Enter') (!hasCast && handleVote('no')); }}
                              style={{
                                flex: 1,
                                textAlign: 'center',
                                padding: 12,
                                borderRadius: 8,
                                background: myVote === 'no' ? '#fff1f2' : (myVote === 'yes' ? '#ecfdf5' : '#f8fafc'),
                                cursor: hasCast ? 'default' : 'pointer',
                                border: myVote === 'no' ? '1px solid #f87171' : '1px solid transparent'
                              }}
                            >
                              <div style={{ fontSize: 44 }}>👎</div>
                              <div style={{ fontSize: 20, fontWeight: 700, marginTop: 8 }}>{Object.values(restartVote.votes || {}).filter(v => v === 'no').length} voti</div>
                            </div>
                          </>
                        );
                      })()}
                    </div>

              {hasCast && <div style={{ marginTop: 14, textAlign: 'center', color: '#475569' }}>Hai votato. Attendi il risultato...</div>}
            </div>
          </div>
        )}

        {/* Confirmation popup for leaving */}
        <SimplePopup
          open={confirmOpen}
          title="Conferma Uscita"
          message="Stai per uscire. Sei sicuro?"
          onClose={() => setConfirmOpen(false)}
          onConfirm={confirmLeave}
          showCancel={true}
          confirmText="Sì, Esci"
          cancelText="Annulla"
        />

      </div>
    </div>
  );
}