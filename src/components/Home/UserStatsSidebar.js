import React from 'react';

export default function UserStatsSidebar({ gamesPlayed, gamesWon, totalScore, bestScore, level, xpPoints, isGuest }) {
  const winRate = gamesPlayed > 0 ? Math.round((gamesWon / gamesPlayed) * 100) : 0;
  const avgScore = gamesPlayed > 0 ? Math.round(totalScore / gamesPlayed) : 0;

  if (isGuest) {
    return (
      <div className="stats-sidebar">
        <div className="stats-header">
          <h3>📊 Statistiche</h3>
        </div>
        <div className="stats-content">
          <div className="stat-item guest-notice">
            <div className="stat-icon">👤</div>
            <div className="stat-info">
              <div className="stat-label">Modalità Ospite</div>
              <div className="stat-value">Statistiche non salvate</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="stats-sidebar">
      <div className="stats-header">
        <h3>📊 Le Tue Statistiche</h3>
      </div>
      <div className="stats-content">
        <div className="stat-item">
          <div className="stat-icon">🎯</div>
          <div className="stat-info">
            <div className="stat-label">Partite Giocate</div>
            <div className="stat-value">{gamesPlayed}</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">🏆</div>
          <div className="stat-info">
            <div className="stat-label">Partite Vinte</div>
            <div className="stat-value">{gamesWon}</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">📈</div>
          <div className="stat-info">
            <div className="stat-label">% Vittoria</div>
            <div className="stat-value">{winRate}%</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">⭐</div>
          <div className="stat-info">
            <div className="stat-label">Punteggio Totale</div>
            <div className="stat-value">{totalScore.toLocaleString()}</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">🎖️</div>
          <div className="stat-info">
            <div className="stat-label">Miglior Punteggio</div>
            <div className="stat-value">{bestScore.toLocaleString()}</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">📊</div>
          <div className="stat-info">
            <div className="stat-label">Punteggio Medio</div>
            <div className="stat-value">{avgScore}</div>
          </div>
        </div>

        <div className="stat-divider"></div>

        <div className="stat-item level-highlight">
          <div className="stat-icon">🏆</div>
          <div className="stat-info">
            <div className="stat-label">Livello Attuale</div>
            <div className="stat-value level-value">{level}</div>
          </div>
        </div>

        <div className="stat-item">
          <div className="stat-icon">⭐</div>
          <div className="stat-info">
            <div className="stat-label">XP Totale</div>
            <div className="stat-value">{xpPoints.toLocaleString()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}