import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MIN_PLAYERS } from '../../constants/gameConfig';

export default function GameHeader({ 
  roomId, 
  gameState, 
  isArtist, 
  hasGuessed, 
  timeLeft, 
  players,
  isOwner,
  onStartGame,
  onClearBoard,
  selectedColor,
  onChangeColor,
  selectedInstrument,
  onChangeInstrument
}) {
  const navigate = useNavigate();
  const currentRound = gameState?.round || 0;
  const totalRounds = gameState?.totalRounds || 0;
  const gameMode = gameState?.mode || 'Classica';
  const difficulty = gameState?.difficulty || 'Medio';
  
  const canStartGame = !gameState?.active && !gameState?.gameEnded && players.length >= MIN_PLAYERS && isOwner;

  const activeMalus = Array.isArray(gameState?.chaosEffects) && gameState.chaosEffects.length > 0
    ? gameState.chaosEffects.map(m => m.name).join(', ')
    : null;

  const handleLeaveRoom = () => {
    if (gameState?.active) {
      const confirmMessage = isOwner 
        ? 'Sei il creatore della stanza! Se esci, la partita terminerà per tutti. Sei sicuro?' 
        : 'Sei sicuro di voler uscire? La partita è in corso!';
      
      const confirm = window.confirm(confirmMessage);
      if (!confirm) return;
    }
    navigate('/home', { replace: true });
  };

  return (
    <header className="board-header">
      <div className="room-info">
        <div>
          <div className="room-label">Stanza {isOwner && '👑'}</div>
          <div className="room-code">{roomId}</div>
        </div>

        <div style={{ marginLeft: 20 }}>
          <div className="room-label">Modalità</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: '#6366f1' }}>
            🎨 {gameMode}
          </div>
        </div>

        {gameState?.active && (
          <>
            <div style={{ marginLeft: 20 }}>
              <div className="room-label">Difficoltà</div>
              <div style={{ fontSize: 24, fontWeight: 600, color: '#f59e0b' }}>
                {difficulty}
              </div>
            </div>

            <div style={{ marginLeft: 20 }}>
              <div className="room-label">Round {currentRound}/{totalRounds}</div>
              <div style={{ fontSize: 26, fontWeight: 600, color: '#6366f1' }}>
                {isArtist ? '🎨 Stai disegnando' : hasGuessed ? '✅ Hai indovinato!' : '🤔 Indovina la parola'}
              </div>
            </div>
            <div style={{ marginLeft: 20 }}>
              <div className="room-label">Parola</div>
              <div style={{ fontSize: 30, fontWeight: 700, color: isArtist ? '#22c55e' : '#6366f1' }}>
                {isArtist ? gameState.word : '_ '.repeat(gameState.word?.length || 0)}
              </div>
            </div>
            {activeMalus && (
              <div style={{ marginLeft: 20 }}>
                <div className="room-label">Malus attivo</div>
                <div style={{ fontSize: 18, fontWeight: 600, color: '#ef4444' }}>{activeMalus}</div>
              </div>
            )}
            {/* Detailed malus info for the current artist (visible to the artist) */}
            {isArtist && Array.isArray(gameState?.chaosEffects) && gameState.chaosEffects.length > 0 && (
              <div style={{ marginLeft: 20 }}>
                <div className="room-label">Dettagli Malus</div>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {gameState.chaosEffects.map((m, idx) => (
                    <div key={m.id + idx} style={{ padding: '6px 10px', background: '#fff1f2', color: '#991b1b', borderRadius: 8, fontWeight: 600, fontSize: 14 }}>
                      <div>{m.name}</div>
                      {m.params && typeof m.params === 'object' && (
                        <div style={{ fontSize: 12, fontWeight: 500, marginTop: 4 }}>
                          {Object.entries(m.params).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <div className="header-actions">
        {gameState?.active && (
          <div style={{ 
            fontSize: 24, 
            fontWeight: 700, 
            color: timeLeft < 10 ? '#ef4444' : '#6366f1',
            background: timeLeft < 10 ? '#fee2e2' : '#eef2ff',
            padding: '8px 16px',
            borderRadius: 8
          }}>
            ⏱️ {timeLeft}s
          </div>
        )}
        
        {canStartGame && (
          <button onClick={onStartGame} className="btn-start">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            👑 Inizia Partita
          </button>
        )}

        {!gameState?.active && !gameState?.gameEnded && players.length >= MIN_PLAYERS && !isOwner && (
          <div style={{
            padding: '8px 16px',
            background: '#fef3c7',
            color: '#92400e',
            borderRadius: 8,
            fontSize: 24,
            fontWeight: 600
          }}>
            👑 In attesa che il creatore avvii la partita...
          </div>
        )}

        {!gameState?.active && !gameState?.gameEnded && players.length < MIN_PLAYERS && (
          <div style={{
            padding: '8px 16px',
            background: '#fef3c7',
            color: '#92400e',
            borderRadius: 8,
            fontSize: 24,
            fontWeight: 600
          }}>
            ⏳ In attesa di altri giocatori ({players.length}/{MIN_PLAYERS})
          </div>
        )}
        
        {isArtist && gameState?.active && (
          <>
            <button onClick={onClearBoard} className="btn-clear">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Pulisci
          </button>
          </>
        )}

        <button onClick={handleLeaveRoom} className="btn-leave" style={{
          background: isOwner ? '#dc2626' : '#64748b',
          color: 'white',
          padding: '12px 20px',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          fontSize: 24,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          {isOwner ? '👑 Esci (Termina Partita)' : 'Esci'}
        </button>
      </div>
    </header>
  );
}
