import React from 'react';

export default function PlayersSidebar({ players, gameState, nickname, roomId }) {
  return (
    <aside className="players-sidebar">
      <div className="sidebar-header">
        <h3>👥 Giocatori</h3>
        <span className="players-badge">{players.length}</span>
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
            <div className="player-avatar">
              {p.name === gameState?.currentArtist ? '🎨' : p.name.charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1 }}>
              <div className="player-name">{p.name}</div>
              <div style={{ fontSize: 11, color: '#64748b' }}>{p.score || 0} punti</div>
            </div>
            {p.name === nickname && <span className="you-tag">Tu</span>}
            {gameState?.guessedPlayers?.includes(p.name) && <span style={{ fontSize: 18 }}>✅</span>}
          </li>
        ))}
      </ul>

      <div className="share-box">
        <label>🔗 Invita amici</label>
        <input
          value={`${window.location.origin}/room/${roomId}`}
          readOnly
          onClick={(e) => e.target.select()}
        />
      </div>
    </aside>
  );
}
