import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MIN_PLAYERS, GAME_MODES } from '../../constants/gameConfig';
import { PUZZLE_DRAWING } from '../../constants/gameModes/puzzleDrawing';

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
  onClearBoard,
  onAlmostUp,
  onShowPlayers
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
  let gameMode = modeNameFromId || (typeof gameState?.mode === 'string' ? gameState.mode : null) || gameConfig?.name || 'Classica';

  // Robust puzzle detection: check known ids, names, and nested objects
  const isPuzzleMode = () => {
    try {
      if (!gameState && !gameConfig) return false;
      const candidates = [
        gameConfig?.id,
        gameConfig?.gameModeId,
        gameConfig?.name,
        gameState?.gameModeId,
        gameState?.modeId,
        gameState?.mode,
        modeNameFromId
      ];
      for (const c of candidates) {
        if (!c) continue;
        const s = typeof c === 'string' ? c.toLowerCase() : (typeof c === 'object' && c?.id ? String(c.id).toLowerCase() : JSON.stringify(c).toLowerCase());
        if (s.includes('puzzle') || s.includes('puzzledrawing') || s.includes('puzzle_drawing') || s.includes('puzzledraw')) return true;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  const puzzleDetected = isPuzzleMode();
  if (puzzleDetected) gameMode = PUZZLE_DRAWING.name;

  const difficulty = gameState?.difficulty || gameConfig?.difficulty?.name || 'Medio';

  // Per Puzzle Drawing, mostra i cicli invece dei rounds a testa
  const getRoundsPerPlayerDisplay = () => {
    if (puzzleDetected) {
      return gameState?.puzzleCycles || gameConfig?.puzzleCycles || 1;
    }
    return gameState?.roundsPerPlayer || gameConfig?.roundsPerGame || gameConfig?.rounds || gameConfig?.roundsPerPlayer || 3;
  };

  const roundsPerPlayer = getRoundsPerPlayerDisplay();

  const playersCount = players?.length || 0;

  // Determina il minimo di giocatori richiesti in base alla modalità
  const getMinPlayersForMode = () => {
    if (puzzleDetected) {
      return PUZZLE_DRAWING.minPlayers; // 4 giocatori per Puzzle Drawing
    }
    return MIN_PLAYERS; // 2 giocatori per le altre modalità
  };

  const minPlayersRequired = getMinPlayersForMode();
  const canStartGame = !gameState?.active && !gameState?.gameEnded && (gameState?.round === 0 || !gameState?.round) && playersCount >= minPlayersRequired && isOwner;

  // active malus list is shown via the popover; no inline summary variable needed

  const [malusOpen, setMalusOpen] = useState(false);
  const [malusManualOpen, setMalusManualOpen] = useState(false);
  const malusRef = useRef(null);
  const malusAutoTimeoutRef = useRef(null);
  const [mobileInfoOpen, setMobileInfoOpen] = useState(false);

  const almostFiredRef = useRef(false);
  const lastCountdownRef = useRef(null);

  // Play a short beep using WebAudio (no external file)
  const playBeep = () => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      // Use triangle for a softer tone
      o.type = 'triangle';
      o.frequency.setValueAtTime(880, ctx.currentTime);
      // gentle envelope
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.14, ctx.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => { try { o.stop(); ctx.close(); } catch (e) { } }, 220);
    } catch (e) {
      // fail silently if AudioContext blocked
      console.error('beep failed', e);
    }
  };

  // Play a countdown beep with configurable frequency/duration
  const playCountdownBeep = (freq = 600, duration = 150) => {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, ctx.currentTime);
      g.gain.setValueAtTime(0.0001, ctx.currentTime);
      g.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (duration / 1000));
      o.connect(g);
      g.connect(ctx.destination);
      o.start();
      setTimeout(() => { try { o.stop(); ctx.close(); } catch (e) { } }, duration + 20);
    } catch (e) {
      console.error('countdown beep failed', e);
    }
  };

  // Trigger beep/pulse once when timeLeft crosses the near-expiry threshold
  useEffect(() => {
    if (typeof timeLeft !== 'number') return;
    const threshold = 5;
    // Single gentle alert when crossing the near-expiry threshold
    if (timeLeft <= threshold && !almostFiredRef.current) {
      almostFiredRef.current = true;
      playBeep();
      if (typeof onAlmostUp === 'function') {
        try { onAlmostUp(); } catch (e) { console.error('onAlmostUp error', e); }
      }
    }
    if (timeLeft > threshold) almostFiredRef.current = false;

    // Countdown beeps for 3,2,1 — ensure each second triggers once
    if (timeLeft > 0 && timeLeft <= 3) {
      if (!lastCountdownRef.current) lastCountdownRef.current = null;
      if (lastCountdownRef.current !== timeLeft) {
        // Map seconds to frequencies for pleasant ascending pitch
        const map = { 3: 650, 2: 820, 1: 1000 };
        playCountdownBeep(map[timeLeft] || 700, 140);
        lastCountdownRef.current = timeLeft;
      }
    } else {
      lastCountdownRef.current = null;
    }
  }, [timeLeft, onAlmostUp]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (malusRef.current && !malusRef.current.contains(e.target)) setMalusOpen(false);
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Auto-show malus details briefly to the artist when a round starts
  useEffect(() => {
    if (gameState?.active && isArtist && Array.isArray(gameState?.chaosEffects) && gameState.chaosEffects.length > 0) {
      // clear any previous timeout
      if (malusAutoTimeoutRef.current) clearTimeout(malusAutoTimeoutRef.current);
      setMalusOpen(true);
      // auto-hide after 3.5s
      malusAutoTimeoutRef.current = setTimeout(() => {
        setMalusOpen(false);
        setMalusManualOpen(false);
        malusAutoTimeoutRef.current = null;
      }, 3500);
    }

    return () => {
      if (malusAutoTimeoutRef.current) {
        clearTimeout(malusAutoTimeoutRef.current);
        malusAutoTimeoutRef.current = null;
      }
    };
  }, [gameState?.active, isArtist, gameState?.chaosEffects]);

  const handleLeaveRoom = () => {
    // Directly navigate back to home. Exit confirmation is shown only from results.
    navigate('/home', { replace: true });
  };

  const [showCopyPopup, setShowCopyPopup] = useState(false);

  const handleCopyLink = () => {
    const link = `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    setShowCopyPopup(true);
  };

  // Auto-close for the copy toast
  useEffect(() => {
    if (showCopyPopup) {
      const timer = setTimeout(() => setShowCopyPopup(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [showCopyPopup]);

  return (
    <header className="board-header">
      {/* Visual Feedback Toast for Room Code Copy */}
      {showCopyPopup && (
        <div className="copy-toast">
          <span className="toast-icon">🔗</span>
          <span className="toast-text">Link Copiato!</span>
        </div>
      )}
      <div className="header-main">
        <div className="room-info-section">
          <div className="room-basic">
            <div className="room-label">Stanza {isOwner && '👑'}</div>
            <div className="room-code">{roomId}</div>
          </div>

          {/* Mobile Share Button Style (Classic) */}
          <div className="mobile-share-row">
            <div className="mobile-share-link" onClick={handleCopyLink}>
              🔗 Invita Amici
            </div>
          </div>
        </div>

        <div className="mobile-header-buttons">
          <button className="mobile-icon-btn info-trigger" onClick={() => setMobileInfoOpen(true)}>ℹ️</button>
          <button className="mobile-icon-btn players-trigger" onClick={onShowPlayers}>👥</button>
          <button className="mobile-icon-btn exit-trigger" onClick={handleLeaveRoom}>✕</button>
        </div>
      </div>

      {!gameState?.active && (
        <div className="mobile-waiting-status">
          {canStartGame ? (
            <button
              className="mobile-start-btn"
              onClick={(e) => {
                e.preventDefault();
                onStartGame();
              }}
            >
              🚀 Inizia partita
            </button>
          ) : (
            playersCount < minPlayersRequired
              ? `⏳ In attesa di altri giocatori (${playersCount}/${minPlayersRequired})`
              : "👑 In attesa dell'host..."
          )}
        </div>
      )}

      {/* Render game-info normally (desktop) */}
      <div className="game-info desktop-only">
        <div className="game-mode-info">
          <div className="room-label">Modalità</div>
          <div className={`mode-badge ${puzzleDetected ? 'puzzle' : ''}`}>{gameMode}</div>
        </div>

        <div className="difficulty-info">
          <div className="room-label">Difficoltà</div>
          <div className="difficulty-badge secondary">{difficulty}</div>
        </div>

        <div className="round-info">
          <div className="room-label">{puzzleDetected ? 'Cicli' : 'Rounds a testa'}</div>
          <div className="round-display">{roundsPerPlayer}</div>
        </div>

        {gameState?.active && (
          <div className="round-info">
            <div className="room-label">Round</div>
            <div className="round-display">{currentRound}/{totalRounds}</div>
          </div>
        )}
        {Array.isArray(gameState?.chaosEffects) && gameState.chaosEffects.length > 0 && (
          <div
            className="malus-inline"
            ref={malusRef}
            onMouseEnter={() => {
              if (malusAutoTimeoutRef.current) {
                clearTimeout(malusAutoTimeoutRef.current);
                malusAutoTimeoutRef.current = null;
              }
              setMalusOpen(true);
            }}
            onMouseLeave={() => {
              setMalusOpen(malusManualOpen);
            }}
          >
            <div className="malus-label">🎭</div>
            <div className="malus-info-inline">
              <button
                type="button"
                className="malus-summary"
                onClick={() => {
                  setMalusManualOpen((prev) => {
                    const nv = !prev;
                    setMalusOpen(nv);
                    return nv;
                  });
                }}
                aria-expanded={malusOpen}
              >
                {gameState.chaosEffects.length} attivi
              </button>
              <div className={`malus-popover ${malusOpen ? 'open' : ''}`} role="dialog" aria-hidden={!malusOpen}>
                <div className="malus-popover-inner">
                  {gameState.chaosEffects.map((m, idx) => {
                    const renderParams = () => {
                      if (!m.params || typeof m.params !== 'object') return null;
                      return Object.entries(m.params).map(([k, v]) => {
                        const pretty = (val) => {
                          if (val === null || val === undefined) return String(val);
                          if (typeof val === 'object') {
                            try { return JSON.stringify(val); } catch (e) { return String(val); }
                          }
                          return String(val);
                        };
                        return `${k}: ${pretty(v)}`;
                      }).join(' • ');
                    };

                    return (
                      <div key={m.id || idx} className="malus-popover-item">
                        <div className="effect-name">{m.name}</div>
                        {m.params && typeof m.params === 'object' && (
                          <div className="effect-params">{renderParams()}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Modal for game info */}
      {mobileInfoOpen && (
        <div className="mobile-modal-overlay" onClick={() => setMobileInfoOpen(false)}>
          <div className="mobile-modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>ℹ️ Informazioni Partita</h3>
              <button className="close-btn" onClick={() => setMobileInfoOpen(false)}>✕</button>
            </div>
            <div className="mobile-game-info-inner">
              <div className="game-mode-info">
                <div className="room-label">Modalità</div>
                <div className={`mode-badge ${puzzleDetected ? 'puzzle' : ''}`}>{gameMode}</div>
              </div>
              <div className="difficulty-info">
                <div className="room-label">Difficoltà</div>
                <div className="difficulty-badge secondary">{difficulty}</div>
              </div>
              <div className="round-info">
                <div className="room-label">{puzzleDetected ? 'Cicli' : 'Rounds a testa'}</div>
                <div className="round-display">{roundsPerPlayer}</div>
              </div>
              {gameState?.active && (
                <div className="round-info">
                  <div className="room-label">Round</div>
                  <div className="round-display">{currentRound}/{totalRounds}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )
      }

      {/* Stato artista / malus */}
      <div className="status-section">
        {gameState?.active && (
          <>
            <div className="artist-status">
              <div className="status-label">
                {isArtist ? '🎨 Stai disegnando' : hasGuessed ? '✅ Hai indovinato!' : '🤔 Indovina la parola'}
              </div>
              <div className="word-timer-group">
                <div className="word-display">
                  {isArtist ? gameState.word : '_ '.repeat(gameState.word?.length || 0)}
                </div>
                <div className="timer-display mobile-timer">⏱️ {timeLeft}s</div>
              </div>
            </div>

            {/* Malus summary moved next to round info to avoid header overflow */}
          </>
        )}
      </div>

      {/* Azioni */}
      <div className="header-actions">
        {gameState?.active && (
          <div className="timer-display">⏱️ {timeLeft}s</div>
        )
        }

        {
          canStartGame && (
            <button onClick={onStartGame} className="btn-start">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              👑 Inizia
            </button>
          )
        }

        {
          !gameState?.active && !gameState?.gameEnded && playersCount >= minPlayersRequired && !isOwner && (
            <div className="waiting-message">
              👑 In attesa che il creatore avvii la partita...
            </div>
          )
        }

        {
          !gameState?.active && !gameState?.gameEnded && playersCount < minPlayersRequired && (
            <div className="waiting-message">
              ⏳ In attesa di altri giocatori ({playersCount}/{minPlayersRequired})
            </div>
          )
        }

        {/* Clear button - will be moved below canvas on mobile via CSS */}
        {
          isArtist && gameState?.active && (
            <button onClick={onClearBoard} className="btn-clear desktop-clear-btn">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              Pulisci
            </button>
          )
        }

        {/* Exit button - desktop only, mobile version is in room-info-section */}
        <button onClick={handleLeaveRoom} className="btn-leave desktop-exit-btn">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path>
            <polyline points="16 17 21 12 16 7"></polyline>
            <line x1="21" y1="12" x2="9" y2="12"></line>
          </svg>
          {isOwner ? '👑 Esci' : 'Esci'}
        </button>
      </div >
    </header >
  );
}
