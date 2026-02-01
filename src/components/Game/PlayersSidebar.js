import React from 'react';
import { MAX_PLAYERS } from '../../constants/gameConfig';

export default function PlayersSidebar({ players, gameState, nickname, roomId, style, className }) {
  // Try to include the room name in the share URL if available in localStorage
  let shareUrl = `${window.location.origin}/room/${roomId}`;
  let roomName = '';
  try {
    const stored = localStorage.getItem(`room_${roomId}_mode`);
    if (stored) {
      const cfg = JSON.parse(stored);
      if (cfg && cfg.name) {
        // Remove emoji and non-alphanumeric punctuation so we display a clean room name
        const nameOnly = cfg.name.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, '').trim();
        const cleaned = nameOnly.replace(/[^\p{L}\p{N}\s\-_.]/gu, '').trim();
        // Use cleaned name (no emojis). If empty, leave roomName empty so no emoji-only label shows.
        roomName = cleaned || '';
      }
    }
  } catch (err) {
    // ignore parse errors and fallback to basic URL
  }

  return (
    <aside className={`players-sidebar ${className || ''}`} style={style}>
      <div className="sidebar-header">
        <h3>👥 Giocatori</h3>
        <span className="players-badge">{players.length}/{MAX_PLAYERS}</span>
      </div>

      <ul className="players-list">
        {players.map((p) => (
          <li
            key={p.id}
            className={p.name === nickname ? 'player-current' : ''}
            style={{
              border: p.name === gameState?.currentArtist ? '2px solid #22c55e' : 'none',
              background: p.name === gameState?.currentArtist ? '#dcfce7' : undefined
            }}
          >
            <div
              className="player-avatar"
              style={{
                background: `linear-gradient(135deg, ${p.color || '#667eea'}, ${adjustBrightness(p.color || '#667eea', -20)})`,
                border: p.name === nickname ? '3px solid #fbbf24' : 'none'
              }}
            >
              {p.isOwner ? '👑' : p.name === gameState?.currentArtist ? '🎨' : p.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div className="player-name">
                {p.isOwner && '👑 '}
                {p.name}
              </div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{p.score || 0} punti</div>
              {gameState?.survivalMode && (
                <div style={{ fontSize: 11, color: '#ef4444' }}>
                  ❤️ {gameState.playerLives?.[p.name] || 0} vite
                </div>
              )}
            </div>
            {p.name === nickname && <span className="you-tag">Tu</span>}
            {gameState?.guessedPlayers?.some(g => g.nickname === p.name) && <span style={{ fontSize: 14 }}>✅</span>}
          </li>
        ))}
      </ul>

      <div className="share-box">
        <label>🔗 Invita amici {players.length >= MAX_PLAYERS && <span style={{ color: '#dc2626' }}>(Stanza piena)</span>}</label>
        {roomName && (
          <div className="room-name" style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
            Nome stanza: <strong>{roomName}</strong>
          </div>
        )}
        <input
          value={shareUrl}
          readOnly
          onClick={(e) => {
            e.target.select();
            navigator.clipboard.writeText(shareUrl);
          }}
          title={shareUrl}
        />
      </div>
    </aside>
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
