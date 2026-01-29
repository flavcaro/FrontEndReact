import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ref, remove as dbRemove } from 'firebase/database';
import { db } from '../../firebase';
import { startRestartVote, castRestartVote, listenRestartVote, endRestartVote } from '../../services/restartService';

export default function GameResults({ roomId, players = [], finalNickname, finalResults, onRestart }) {
  const navigate = useNavigate();

  if (!finalResults || finalResults.length === 0) return null;

  const podium = finalResults.slice(0, 3);

  const [restartVote, setRestartVote] = useState(null);
  const [hasCast, setHasCast] = useState(false);

  // Listen for any restartVote changes
  useEffect(() => {
    if (!roomId) return;
    const unsub = listenRestartVote(roomId, (data) => {
      setRestartVote(data || null);
    });
    return () => unsub && unsub();
  }, [roomId]);

  // If votes reach a decision, conclude locally
  useEffect(() => {
    if (!restartVote || restartVote.status !== 'open') {
      // If accepted, trigger onRestart; if rejected, do nothing (vote canceled)
      if (restartVote?.status === 'accepted') {
        const acceptedPlayers = restartVote.acceptedPlayers || [];
        // Trigger provided restart handler; pass acceptedPlayers (handler may ignore)
        try { onRestart && onRestart(acceptedPlayers); } catch (e) { console.error(e); }
      }
      return;
    }

    const votes = restartVote.votes || {};
    const yesCount = Object.values(votes).filter(v => v === 'yes').length;
    const totalCast = Object.values(votes).filter(v => v !== 'pending').length;
    const totalPlayers = players.length;

    // If at least 2 yes -> accept vote
    if (yesCount >= 2) {
      const accepted = Object.entries(votes).filter(([, v]) => v === 'yes').map(([id]) => id);
      endRestartVote(roomId, 'accepted', accepted).catch(err => console.error(err));
      return;
    }

    // If everyone voted and not enough yes -> reject
    if (totalCast === totalPlayers && yesCount < 2) {
      endRestartVote(roomId, 'rejected', []).catch(err => console.error(err));
    }
  }, [restartVote, players, roomId, onRestart]);

  const handleExit = () => {
    navigate('/home', { replace: true });
  };

  const currentPlayer = players.find(p => p.name === finalNickname);
  const currentPlayerId = currentPlayer?.id;

  const canInitiate = players.length >= 2;

  const handleStartVote = async () => {
    if (!canInitiate) return;
    const initiator = currentPlayer || players[0];
    try {
      await startRestartVote(roomId, initiator.id, initiator.name, players);
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
      if (choice === 'no') {
        // remove player and navigate away
        await dbRemove(ref(db, `rooms/${roomId}/players/${currentPlayerId}`));
        navigate('/home', { replace: true });
      }
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

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={handleStartVote}
            className="btn-restart"
            style={{ flex: 1 }}
            disabled={!canInitiate}
            title={!canInitiate ? 'Servono almeno 2 giocatori per votare' : 'Avvia votazione "Gioca ancora"'}
          >
            🔄 Gioca Ancora
          </button>

          <button
            onClick={handleExit}
            style={{
              flex: 1,
              padding: '16px',
              background: '#64748b',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              fontSize: '16px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 20px rgba(100, 116, 139, 0.4)';
              e.currentTarget.style.background = '#475569';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.background = '#64748b';
            }}
          >
            🚪 Esci
          </button>
        </div>

        {/* Voting modal */}
        {restartVote && (
          <div className="simple-modal" style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', background: 'rgba(0,0,0,0.4)'
          }}>
            <div style={{ background: 'white', padding: 20, borderRadius: 12, minWidth: 320 }}>
              <h3>Votazione: Giocare ancora?</h3>
              <p>Avviata da: {restartVote.initiatorName}</p>
              <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
                <div style={{ flex: 1 }}>
                  <strong>Si:</strong> {Object.values(restartVote.votes || {}).filter(v => v === 'yes').length}
                </div>
                <div style={{ flex: 1 }}>
                  <strong>No:</strong> {Object.values(restartVote.votes || {}).filter(v => v === 'no').length}
                </div>
              </div>

              {!hasCast && (!restartVote.votes || restartVote.votes[currentPlayerId] === 'pending') && (
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <button onClick={() => handleVote('yes')} style={{ flex: 1, padding: 10 }}>✅ Gioco</button>
                  <button onClick={() => handleVote('no')} style={{ flex: 1, padding: 10 }}>❌ Esco</button>
                </div>
              )}

              {hasCast && <div style={{ marginTop: 12 }}>Hai votato. Attendi il risultato...</div>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}