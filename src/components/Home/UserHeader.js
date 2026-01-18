import React from 'react';

export default function UserHeader({ nickname, isGuest, user, xpPoints, level, gamesPlayed, gamesWon, totalScore, bestScore, onSignOut, navigate }) {
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
  return (
    <header className="home-header">
      <div className="user-info">
        <div className="user-nickname">
          <span className="nickname-icon">{isGuest ? '👤' : '✨'}</span>
          <span className="nickname-text">{nickname || 'Utente'}</span>
          {!isGuest && user?.email && (
            <span style={{ fontSize: 18, color: '#64748b', marginLeft: 8 }}>
              ({user.email})
            </span>
          )}
        </div>
        {!isGuest && (
          <div className="user-stats">
            <span className="level-badge">🏆 Lv.{level}</span>
            <span className="xp-badge">⭐ {xpPoints} XP</span>
            <span className="games-badge">🎯 {gamesWon} su {gamesPlayed} partite</span>
            <span className="winrate-badge">📈 {winRate}% vittorie</span>
          </div>
        )}
      </div>
      
      <div className="header-actions">
        {!isGuest && navigate && (
          <button className="btn-profile" onClick={() => navigate('/profile')}>
            👤 Profilo
          </button>
        )}
        <button className="btn-logout" onClick={onSignOut}>
          🚪 {isGuest ? 'Esci' : 'Logout'}
        </button>
      </div>
    </header>
  );
}