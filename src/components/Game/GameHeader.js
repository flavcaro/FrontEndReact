import React from 'react';
import { MIN_PLAYERS } from '../../constants/gameConfig';

export default function GameHeader({ 
  roomId, 
  gameState, 
  isArtist, 
  hasGuessed, 
  timeLeft, 
  players,
  onStartGame,
  onClearBoard
}) {
  const currentRound = gameState?.round || 0;
  const totalRounds = gameState?.totalRounds || 0;

  return (
    <header className="board-header">
      <div className="room-info">
        <div>
          <div className="room-label">Stanza</div>
          <div className="room-code">{roomId}</div>
        </div>
        
        {gameState?.active && (
          <>
            <div style={{ marginLeft: 40 }}>
              <div className="room-label">Round {currentRound}/{totalRounds}</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: '#6366f1' }}>
                {isArtist ? '🎨 Stai disegnando' : hasGuessed ? '✅ Hai indovinato!' : '🤔 Indovina la parola'}
              </div>
            </div>
            <div style={{ marginLeft: 40 }}>
              <div className="room-label">Parola</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: isArtist ? '#22c55e' : '#6366f1' }}>
                {isArtist ? gameState.word : '_ '.repeat(gameState.word?.length || 0)}
              </div>
            </div>
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
        
        {!gameState?.active && !gameState?.gameEnded && players.length >= MIN_PLAYERS && (
          <button onClick={onStartGame} className="btn-start">
            🎮 Inizia Partita
          </button>
        )}
        
        {isArtist && gameState?.active && (
          <button onClick={onClearBoard} className="btn-clear">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Pulisci
          </button>
        )}
      </div>
    </header>
  );
}
