import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePlayers } from "../../hooks/usePlayers";
import { useGame } from "../../hooks/useGame";
import { useChat } from "../../hooks/useChat";
import { useDrawing } from "../../hooks/useDrawing";
import PlayersSidebar from "./PlayersSidebar";
import ChatSidebar from "./ChatSidebar";
import GameHeader from "./GameHeader";
import Canvas from "./Canvas";
import GameResults from "./GameResults";
import "../../App.css";

export default function Board({ roomId, nickname, gameConfig }) {
  const navigate = useNavigate();

  const { players, finalNickname, isRoomFull, isOwner, playerId } =
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
    selectedInstrument
  );

  // Room full protection
  useEffect(() => {
    if (!playerId) return;

    const weAreInRoom = players.some(
      (p) => p.id === playerId || p.name === finalNickname
    );

    if (isRoomFull && !weAreInRoom) {
      alert("⚠️ La stanza è piena! Massimo 6 giocatori.");
      navigate("/home", { replace: true });
    }
  }, [isRoomFull, players, finalNickname, playerId, navigate]);

  // Game ended unexpectedly
  useEffect(() => {
    if (
      gameState?.gameEnded &&
      (gameState.endReason === "owner_left" ||
        gameState.endReason === "not_enough_players")
    ) {
      setTimeout(() => {
        alert(
          "La partita è terminata: " +
            (gameState.endReason === "owner_left"
              ? "il creatore ha abbandonato."
              : "non ci sono abbastanza giocatori.")
        );
        navigate("/home", { replace: true });
      }, 100);
    }
  }, [gameState, navigate]);

  // Warn on refresh/close
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

  // Start game handler
  const handleStartGame = () => {
    if (!gameConfig) return;
    console.log("Starting game with config:", gameConfig);
    startGame(gameConfig);
  };

  return (
    <div className="board-container" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <PlayersSidebar
        players={players}
        gameState={gameState}
        nickname={finalNickname}
        roomId={roomId}
      />
      <div className="board-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0, height: '100vh', overflow: 'auto' }}>
        <GameHeader
          roomId={roomId}
          gameState={gameState}
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
        <main className="board-main" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <div className="game-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
            <Canvas
              lines={lines}
              onMouseDown={showResults ? undefined : handleMouseDown}
              onMouseMove={showResults ? undefined : handleMouseMove}
              onMouseUp={showResults ? undefined : handleMouseUp}
              isArtist={isArtist}
              nickname={finalNickname}
            />
          </div>
        </main>
        {finalResults && (
          <GameResults
            finalResults={finalResults}
            onRestart={restartGame}
          />
        )}
      </div>
      <ChatSidebar
        roomId={roomId}
        nickname={finalNickname}
        messages={messages}
        messagesEndRef={messagesEndRef}
        gameState={gameState}
        isArtist={isArtist}
        hasGuessed={hasGuessed}
        onGuessCorrect={handleGuess}
      />
    </div>
  );
}
