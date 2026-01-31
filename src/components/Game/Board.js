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

import { usePlayers } from "../../hooks/usePlayers";
import { useGame } from "../../hooks/useGame";
import { useChat } from "../../hooks/useChat";
import { useDrawing } from "../../hooks/useDrawing";
import { listenRestartVote } from '../../services/restartService';

export default function Board({ roomId, nickname, gameConfig }) {
  const navigate = useNavigate();

  // Track whether we should pin the board to the viewport.
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

  const { players, finalNickname, cannotJoinReason, isOwner, playerId } =
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


  // Survival threshold info (may be stored as {type,value} or {thresholdType,thresholdValue})
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

  // Listen for restartVote so we can avoid redirecting to home while restart is in progress
  useEffect(() => {
    if (!roomId) return;
    const unsub = listenRestartVote(roomId, (data) => {
      // store latest on window for the game end effect to read synchronously
      try { window.__restartVoteCache = data || null; } catch (e) { /* ignore */ }
    });
    return () => unsub && unsub();
  }, [roomId]);

  /* =========================
     FINE PARTITA
  ========================= */
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

      // If there's an active restartVote in progress or accepted, do not redirect to home here;
      // GameResults will handle navigation to the new room when ready.
      // Listen state is provided below; check it via restartVoteRef on the window (set by listener).
      const restartVote = window.__restartVoteCache;
      if (restartVote && (restartVote.status === 'open' || restartVote.status === 'accepted')) {
        // skip redirect: waiting for restart flow
        return;
      }

      // Redirect everyone to home after short delay
      setTimeout(() => {
        try { navigate('/home', { replace: true }); } catch (e) { console.error(e); }
      }, 3000);
    }
  }, [gameState, navigate]);

  
  

  /* =========================
     CANNOT JOIN REASON
  ========================= */
  useEffect(() => {
    if (cannotJoinReason) {
      setPopup({
        open: true,
        message: `Cannot join: ${cannotJoinReason}. Please wait for the game to end or try reconnecting if you were previously in the room.`,
      });
    }
  }, [cannotJoinReason]);

  /* =========================
     WARN ON REFRESH
  ========================= */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (gameState?.active) {
        e.preventDefault();
        e.returnValue =
          "Sei sicuro di voler uscire? La partita è in corso!";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () =>
      window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [gameState]);

  const handleClosePopup = () => {
    setPopup({ open: false, message: "" });
    navigate("/home", { replace: true });
  };

  const handleStartGame = () => {
    if (!gameConfig) return;
    startGame(gameConfig);
  };

  /* =========================
     RENDER
  ========================= */
  useEffect(() => {
    const onResize = () => {
      const w = window.innerWidth;
      setIsPinned(w >= 900);
      // compute sidebar widths
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

  // When the board is pinned (fixed to viewport) prevent body scroll
  useEffect(() => {
    const prev = document.body.style.overflow;
    if (isPinned) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = prev || '';
    }
    return () => { document.body.style.overflow = prev || ''; };
  }, [isPinned]);

  // If this room is configured for Puzzle Drawing, render the specialized board.
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
