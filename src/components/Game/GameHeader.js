import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MIN_PLAYERS, GAME_MODES } from '../../constants/gameConfig';

export default function GameHeader({ 
  roomId, 
  gameState, 
  gameConfig,
  isArtist, 
  hasGuessed, 
  timeLeft, 
  players,
  isOwner,
  onStartGame,
  onClearBoard
}) {
  const navigate = useNavigate();
  const currentRound = gameState?.round || 0;
  const totalRounds = gameState?.totalRounds || 0;

  // Resolve a friendly mode name prioritizing explicit ids in state/config
  const getModeNameFromId = (id) => {
    if (!id) return null;
    const gm = Object.values(GAME_MODES).find(m => m.id === id);
    return gm ? gm.name : null;
  };

  const modeId = gameState?.gameModeId || gameState?.modeId || gameConfig?.id || gameConfig?.gameModeId;
  const modeNameFromId = getModeNameFromId(modeId);
  const gameMode = modeNameFromId || (typeof gameState?.mode === 'string' ? gameState.mode : null) || gameConfig?.name || 'Classica';

  const difficulty = gameState?.difficulty || gameConfig?.difficulty?.name || 'Medio';
  const roundsPerPlayer = gameState?.roundsPerPlayer || gameConfig?.roundsPerGame || gameConfig?.rounds || gameConfig?.roundsPerPlayer || 3;
  
  const playersCount = players?.length || 0;
  const canStartGame = !gameState?.active && !gameState?.gameEnded && playersCount >= MIN_PLAYERS && isOwner;

  // active malus list is shown via the popover; no inline summary variable needed

  const [malusOpen, setMalusOpen] = useState(false);
  const malusRef = useRef(null);

  useEffect(() => {
    const onDocClick = (e) => {
      if (malusRef.current && !malusRef.current.contains(e.target)) setMalusOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

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
      <div className="header-main">
        {/* Info stanza e modalità */}
        <div className="room-info-section">
          <div className="room-basic">
            <div className="room-label">Stanza {isOwner && '👑'}</div>
            <div className="room-code">{roomId}</div>
          </div>

          <div className="game-info">
            <div className="game-mode-info">
              <div className="room-label">Modalità</div>
              <div className="mode-badge">🎨 {gameMode}</div>
            </div>

            <div className="difficulty-info">
              <div className="room-label">Difficoltà</div>
              <div className="difficulty-badge secondary">🎯 {difficulty}</div>
            </div>

            <div className="round-info">
              <div className="room-label">Rounds a testa</div>
              <div className="round-display">{roundsPerPlayer}</div>
            </div>

            {gameState?.active && (
              <div className="round-info">
                <div className="room-label">Round</div>
                <div className="round-display">{currentRound}/{totalRounds}</div>
              </div>
            )}
            {Array.isArray(gameState?.chaosEffects) && gameState.chaosEffects.length > 0 && (
              <div className="malus-inline">
                <div className="malus-label">🎭</div>
                <div className="malus-info-inline">
                  <button
                    type="button"
                    className="malus-summary"
                    onClick={() => setMalusOpen(v => !v)}
                    aria-expanded={malusOpen}
                  >
                    {gameState.chaosEffects.length} attivi
                  </button>
                  <div className={`malus-popover ${malusOpen ? 'open' : ''}`} role="dialog" aria-hidden={!malusOpen}>
                    <div className="malus-popover-inner">
                      {gameState.chaosEffects.map((m, idx) => (
                        <div key={m.id || idx} className="malus-popover-item">
                          <div className="effect-name">{m.name}</div>
                          {m.params && typeof m.params === 'object' && (
                            <div className="effect-params">{Object.entries(m.params).map(([k, v]) => `${k}: ${v}`).join(' • ')}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stato artista / malus */}
        <div className="status-section">
          {gameState?.active && (
            <>
              <div className="artist-status">
                <div className="status-label">
                  {isArtist ? '🎨 Stai disegnando' : hasGuessed ? '✅ Hai indovinato!' : '🤔 Indovina la parola'}
                </div>
                <div className="word-display">
                  {isArtist ? gameState.word : '_ '.repeat(gameState.word?.length || 0)}
                </div>
              </div>



              {isArtist && Array.isArray(gameState?.chaosEffects) && gameState.chaosEffects.length > 0 && (
                <div className="malus-details-section">
                  <div className="malus-label">Dettagli Malus</div>
                  <div className="malus-effects">
                    {gameState.chaosEffects.map((m, idx) => (
                      <div key={m.id + idx} className="malus-effect">
                        <div className="effect-name">{m.name}</div>
                        {m.params && typeof m.params === 'object' && (
                          <div className="effect-params">
                            {Object.entries(m.params).map(([k, v]) => `${k}: ${v}`).join(' • ')}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
                  {/* Malus summary moved next to round info to avoid header overflow */}
            </>
          )}
        </div>
      </div>

      {/* Azioni */}
      <div className="header-actions">
        {gameState?.active && (
          <div className="timer-display">⏱️ {timeLeft}s</div>
        )}
        
        {canStartGame && (
          <button onClick={onStartGame} className="btn-start">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            👑 Inizia
          </button>
        )}

        {!gameState?.active && !gameState?.gameEnded && playersCount >= MIN_PLAYERS && !isOwner && (
          <div className="waiting-message">
            👑 In attesa che il creatore avvii la partita...
          </div>
        )}

        {!gameState?.active && !gameState?.gameEnded && playersCount < MIN_PLAYERS && (
          <div className="waiting-message">
            ⏳ In attesa di altri giocatori ({playersCount}/{MIN_PLAYERS})
          </div>
        )}
        
        {isArtist && gameState?.active && (
          <button onClick={onClearBoard} className="btn-clear">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            Pulisci
          </button>
        )}

        <button onClick={handleLeaveRoom} className="btn-leave">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          {isOwner ? '👑 Esci' : 'Esci'}
        </button>
      </div>
    </header>
  );
}
