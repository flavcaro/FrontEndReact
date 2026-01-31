import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import SimplePopup from "./SimplePopup";
import PlayersSidebar from "./PlayersSidebar";
import ChatSidebar from "./ChatSidebar";
import GameHeader from "./GameHeader";
import Canvas from "./Canvas";
import PuzzleBoard from "./PuzzleBoard";
import GameResults from "./GameResults";
import Palette from "./Palette";
import Button from "../common/Button"; // Assicurati di avere questo import!

import { usePlayers } from "../../hooks/usePlayers";
import { useGame } from "../../hooks/useGame";
import { useChat } from "../../hooks/useChat";
import { useDrawing } from "../../hooks/useDrawing";
import { listenRestartVote } from '../../services/restartService';

export default function Board({ roomId, nickname, gameConfig }) {
  const navigate = useNavigate();

  // --- LOGICA DI LAYOUT E RESIZE (Mantenuta Originale) ---
  const [isPinned, setIsPinned] = useState(() => {
    try {
      return window.innerWidth >= 900;
    } catch (e) {
      return true;
    }
  });
  const [playersSidebarWidth, setPlayersSidebarWidth] = useState(() => {
    try {
      const w = window.innerWidth;
      if (w > 1400) return 480;
      if (w > 1200) return 240;
      if (w > 1000) return 200;
      if (w > 800) return 180;
      return 160;
    } catch (e) { return 240; }
  });
  const [chatSidebarWidth, setChatSidebarWidth] = useState(() => {
    try {
      const w = window.innerWidth;
      if (w > 1400) return 560;
      if (w > 1200) return 240;
      if (w > 1000) return 240;
      if (w > 800) return 200;
      return 180;
    } catch (e) { return 320; }
  });

  // --- HOOKS ---
  // FIX: Aggiunto isChecking estratto da usePlayers
  const { players, finalNickname, cannotJoinReason, isOwner, playerId, isChecking } =
    usePlayers(roomId, nickname);

  const {
    gameState,
    timeLeft,
    isArtist,
    hasGuessed,
    finalResults,
    startGame,
    handleGuess,
    restartGame,
    showResults
  } = useGame(roomId, finalNickname, players);

  // Survival threshold info 
  const survivalThreshold = gameState?.survivalThreshold;
  const survivalThresholdType = survivalThreshold?.type || survivalThreshold?.thresholdType;
  const survivalThresholdValue = survivalThreshold?.value ?? survivalThreshold?.thresholdValue;

  const { messages, messagesEndRef } = useChat(roomId);

  const [selectedColor, setSelectedColor] = useState("#1e293b");
  const [selectedInstrument, setSelectedInstrument] = useState("pencil");

  const {
    lines,
    clearBoard,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  } = useDrawing(
    roomId,
    finalNickname,
    isArtist,
    gameState?.active,
    showResults,
    selectedColor,
    gameState?.allGuessed,
    selectedInstrument,
    gameState?.chaosEffects
  );

  const [popup, setPopup] = useState({ open: false, message: "" });

  // --- LISTENERS E EFFETTI ---

  // Listen for restartVote 
  useEffect(() => {
    if (!roomId) return;
    const unsub = listenRestartVote(roomId, (data) => {
      try { window.__restartVoteCache = data || null; } catch (e) { /* ignore */ }
    });
    return () => unsub && unsub();
  }, [roomId]);

  // Fine Partita
  useEffect(() => {
    if (
      gameState?.gameEnded &&
      (gameState.endReason === "owner_left" ||
        gameState.endReason === "not_enough_players")
    ) {
      const ownerName = gameState.endActorName || null;
      setTimeout(() => {
        setPopup({
          open: true,
          message:
            gameState.endReason === "owner_left"
              ? (ownerName ? `Giocatore "${ownerName}" è uscito, verrai reindirizzato alla home` : 'Il creatore ha abbandonato. Verrai reindirizzato alla home')
              : 'La partita è terminata: non ci sono abbastanza giocatori. Verrai reindirizzato alla home'
        });
      }, 100);

      const restartVote = window.__restartVoteCache;
      if (restartVote && (restartVote.status === 'open' || restartVote.status === 'accepted')) {
        return;
      }

      setTimeout(() => {
        try { navigate('/home', { replace: true }); } catch (e) { console.error(e); }
      }, 3000);
    }
  }, [gameState, navigate]);

  // Warn on Refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (gameState?.active) {
        e.preventDefault();
        e.returnValue = "Sei sicuro di voler uscire? La partita è in corso!";
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [gameState]);

  // Resize Listener (Ripristinato logica originale)
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setIsPinned(w >= 900);
      if (w > 1400) {
        setPlayersSidebarWidth(480);
        setChatSidebarWidth(560);
      } else if (w > 1200) {
        setPlayersSidebarWidth(240);
        setChatSidebarWidth(240);
      } else if (w > 1000) {
        setPlayersSidebarWidth(200);
        setChatSidebarWidth(240);
      } else if (w > 800) {
        setPlayersSidebarWidth(180);
        setChatSidebarWidth(200);
      } else {
        setPlayersSidebarWidth(160);
        setChatSidebarWidth(180);
      }
    };

    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Body Scroll Lock
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (isPinned) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = prev || '';
    }
    return () => { document.body.style.overflow = prev || ''; };
  }, [isPinned]);

  const handleClosePopup = () => {
    setPopup({ open: false, message: "" });
    navigate("/home", { replace: true });
  };

  const handleStartGame = () => {
    if (!gameConfig) return;
    startGame(gameConfig);
  };

  // =================================================================
  // BLOCHI DI SICUREZZA (Codice Nuovo per fixare i ghost player)
  // =================================================================

  // 1. Schermata di Caricamento (Blocca tutto finché usePlayers non decide)
  if (isChecking) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <h2 style={{color: '#64748b', fontSize: '1.2rem'}}>Verifica accesso alla stanza...</h2>
      </div>
    );
  }

  // 2. Schermata di Blocco (Se la partita è in corso)
  if (cannotJoinReason === 'Game in progress') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🚫</div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>Partita in Corso</h2>
          <p style={{ color: '#64748b', marginBottom: '30px' }}>
            Non puoi unirti a questa stanza perché la partita è già iniziata.
          </p>
          <Button onClick={() => navigate('/home')} variant="primary">
            Torna alla Home
          </Button>
        </div>
      </div>
    );
  }

  // 3. Schermata di Blocco (Se la stanza è piena)
  if (cannotJoinReason === 'Room full') {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#f8fafc', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        <div style={{ background: 'white', padding: '40px', borderRadius: '20px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '60px', marginBottom: '20px' }}>🌕</div>
          <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b' }}>Stanza Piena</h2>
          <Button onClick={() => navigate('/home')} variant="primary">
            Torna alla Home
          </Button>
        </div>
      </div>
    );
  }

  // Redirect per Puzzle Mode
  if ((gameConfig && gameConfig.id === 'puzzleDrawing') || (gameState && gameState.gameModeId === 'puzzleDrawing')) {
    return <PuzzleBoard roomId={roomId} nickname={nickname} gameConfig={gameConfig} />;
  }

  return (
    <>
      <SimplePopup
        open={popup.open}
        message={popup.message}
        onClose={handleClosePopup}
      />

      <div
        className="board-container"
        style={{
          position: isPinned ? 'fixed' : 'static',
          inset: isPinned ? 0 : 'auto',
          display: 'flex',
          overflow: 'hidden',
          alignItems: 'stretch',
          width: '100%'
        }}
      >
        <PlayersSidebar
          players={players}
          gameState={gameState}
          nickname={finalNickname}
          roomId={roomId}
          style={{ width: `${playersSidebarWidth}px` }}
        />

        <div
          className="board-center"
          style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}
        >
          <GameHeader
            roomId={roomId}
            gameState={gameState}
            gameConfig={gameConfig}
            isArtist={isArtist}
            hasGuessed={hasGuessed}
            timeLeft={timeLeft}
            players={players}
            isOwner={isOwner}
            onStartGame={handleStartGame}
            onClearBoard={clearBoard}
            selectedColor={selectedColor}
            onChangeColor={setSelectedColor}
            selectedInstrument={selectedInstrument}
            onChangeInstrument={setSelectedInstrument}
          />

          {/* Lives Display - Solo in modalità sopravvivenza */}
          {gameState?.survivalMode && gameState?.playerLives && (
            <div className="lives-display">
              <div className="lives-title">❤️ Vite Giocatori</div>
                  {typeof survivalThresholdValue !== 'undefined' && (
                    <div className="lives-subtitle">
                      Soglia minima: {survivalThresholdValue} {survivalThresholdType ? `(${survivalThresholdType === 'turn' ? 'per turno' : 'per partita'})` : ''}
                    </div>
                  )}
              <div className="lives-container">
                {players.map((player) => {
                  const lives = gameState.playerLives[player.name] || 0;
                  const isEliminated = lives === 0;
                  
                  return (
                    <div 
                      key={player.id} 
                      className={`player-lives ${isEliminated ? 'eliminated' : ''} ${player.name === finalNickname ? 'current-player' : ''}`}
                    >
                      <div className="player-name">{player.name}</div>
                      <div className="hearts-container">
                        {Array.from({ length: gameState.startingLives || 3 }, (_, i) => (
                          <span 
                            key={i} 
                            className={`heart ${i < lives ? 'filled' : 'empty'}`}
                          >
                            {i < lives ? '❤️' : '🤍'}
                          </span>
                        ))}
                      </div>
                      {isEliminated && <div className="eliminated-text">ELIMINATO</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <main className="board-main" style={{ flex: 1, overflow: "auto", minHeight: 0 }}>
            <div className="game-content">
              <Canvas
                lines={lines}
                onMouseDown={showResults ? undefined : handleMouseDown}
                onMouseMove={showResults ? undefined : handleMouseMove}
                onMouseUp={showResults ? undefined : handleMouseUp}
                isArtist={isArtist}
                nickname={finalNickname}
                chaosEffects={gameState?.chaosEffects}
              />

              {isArtist && (
                <div className="palette-floating">
                  <Palette
                    selectedColor={selectedColor}
                    onChangeColor={setSelectedColor}
                    selectedInstrument={selectedInstrument}
                    onChangeInstrument={setSelectedInstrument}
                    showColors={selectedInstrument === "pencil"}
                  />
                </div>
              )}
            </div>
          </main>

          {finalResults && (
            <GameResults
              roomId={roomId}
              players={players}
              finalNickname={finalNickname}
              finalResults={finalResults}
              onRestart={restartGame}
              playerId={playerId}
            />
          )}
        </div>

        <ChatSidebar
          roomId={roomId}
          nickname={finalNickname}
          messages={messages}
          messagesEndRef={messagesEndRef}
          gameState={gameState}
          timeLeft={timeLeft}
          isArtist={isArtist}
          hasGuessed={hasGuessed}
          onGuessCorrect={handleGuess}
          style={{ width: `${chatSidebarWidth}px` }}
        />
      </div>
    </>
  );
}