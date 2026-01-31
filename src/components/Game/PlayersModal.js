import React from 'react';
import { MAX_PLAYERS } from '../../constants/gameConfig';

export default function PlayersModal({ isOpen, onClose, players, gameState, nickname, roomId }) {
  if (!isOpen) return null;

  // Try to include the room name in the share URL if available in localStorage
  let shareUrl = `${window.location.origin}/room/${roomId}`;
  let roomName = '';
  try {
    const stored = localStorage.getItem(`room_${roomId}_mode`);
    if (stored) {
      const cfg = JSON.parse(stored);
      if (cfg && cfg.name) {
        const nameOnly = cfg.name.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
        const cleaned = nameOnly.replace(/[^\p{L}\p{N}\s\-_.]/gu, '').trim();
        roomName = cleaned || '';
      }
    }
  } catch (err) {
    // ignore parse errors
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="players-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="players-modal-header">
          <div className="modal-title">
            <span className="modal-icon">👥</span>
            <h3>Giocatori</h3>
            <span className="players-count-badge">{players.length}/{MAX_PLAYERS}</span>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Chiudi">
            ✕
          </button>
        </div>
        
        <div className="players-modal-list">
          {players.map((p) => (
            <div 
              key={p.id} 
              className={`player-modal-item ${p.name === nickname ? 'player-current' : ''}`}
              style={{
                border: p.name === gameState?.currentArtist ? '2px solid #22c55e' : 'none',
                background: p.name === gameState?.currentArtist ? '#dcfce7' : undefined
              }}
            >
              <div 
                className="player-modal-avatar"
                style={{
                  background: `linear-gradient(135deg, ${p.color || '#667eea'}, ${adjustBrightness(p.color || '#667eea', -20)})`,
                  border: p.name === nickname ? '3px solid #fbbf24' : 'none'
                }}
              >
                {p.isOwner ? '👑' : p.name === gameState?.currentArtist ? '🎨' : p.name.charAt(0).toUpperCase()}
              </div>
              
              <div className="player-modal-info">
                <div className="player-modal-name">
                  {p.isOwner && '👑 '}
                  {p.name}
                  {p.name === nickname && <span className="you-tag-modal">Tu</span>}
                </div>
                <div className="player-modal-score">{p.score || 0} punti</div>
                {gameState?.survivalMode && (
                  <div className="player-modal-lives">
                    ❤️ {gameState.playerLives?.[p.name] || 0} vite
                  </div>
                )}
              </div>
              
              {gameState?.guessedPlayers?.some(g => g.nickname === p.name) && (
                <span className="guessed-check">✅</span>
              )}
            </div>
          ))}
        </div>

        <div className="share-box-modal">
          <label className="share-label">
            🔗 Invita amici 
            {players.length >= MAX_PLAYERS && <span className="room-full-text">(Stanza piena)</span>}
          </label>
          {roomName && (
            <div className="room-name-display">
              Nome stanza: <strong>{roomName}</strong>
            </div>
          )}
          <input
            className="share-input-modal"
            value={shareUrl}
            readOnly
            onClick={(e) => {
              e.target.select();
              navigator.clipboard.writeText(shareUrl);
            }}
            title={shareUrl}
          />
        </div>
      </div>
    </div>
  );
}

// Helper function to adjust color brightness
function adjustBrightness(color, percent) {
  const num = parseInt(color.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00FF) + amt;
  const B = (num & 0x0000FF) + amt;
  return "#" + (0x1000000 + (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255))
    .toString(16).slice(1);
}
