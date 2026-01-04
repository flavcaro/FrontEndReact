import React from 'react';
import { useNavigate } from 'react-router-dom';

export default function GameResults({ finalResults, onRestart }) {
  const navigate = useNavigate();

  if (!finalResults || finalResults.length === 0) return null;

  const podium = finalResults.slice(0, 3);

  const handleExit = () => {
    navigate('/home', { replace: true });
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

        <div
          style={{
            display: 'flex',
            gap: '12px',
            marginTop: '24px',
          }}
        >
          <button onClick={onRestart} className="btn-restart" style={{ flex: 1 }}>
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
      </div>
    </div>
  );
}