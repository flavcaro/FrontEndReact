import React from 'react';

export default function GameResults({ finalResults, onRestart }) {
  if (!finalResults || finalResults.length === 0) return null;

  const winner = finalResults[0];
  const podium = finalResults.slice(0, 3);

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

        <button onClick={onRestart} className="btn-restart">
          🔄 Gioca Ancora
        </button>
      </div>
    </div>
  );
}