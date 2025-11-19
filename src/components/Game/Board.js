import React from "react";
import { usePlayers } from "../../hooks/usePlayers";
import { useGame } from "../../hooks/useGame";
import { useChat } from "../../hooks/useChat";
import { useDrawing } from "../../hooks/useDrawing";
import PlayersSidebar from "./PlayersSidebar";
import ChatSidebar from "./ChatSidebar";
import GameHeader from "./GameHeader";
import Canvas from "./Canvas";
import "../../App.css";

export default function Board({ roomId, nickname }) {
  const { players } = usePlayers(roomId, nickname);
  const { 
    gameState, 
    timeLeft, 
    isArtist, 
    hasGuessed, 
    startGame, 
    handleGuess 
  } = useGame(roomId, nickname, players);
  const { messages, messagesEndRef } = useChat(roomId);
  const { 
    lines, 
    clearBoard, 
    handleMouseDown, 
    handleMouseMove, 
    handleMouseUp 
  } = useDrawing(roomId, nickname, isArtist, gameState?.active);

  return (
    <div className="board-container">
      <PlayersSidebar 
        players={players} 
        gameState={gameState} 
        nickname={nickname} 
        roomId={roomId} 
      />

      <main className="board-main">
        <GameHeader
          roomId={roomId}
          gameState={gameState}
          isArtist={isArtist}
          hasGuessed={hasGuessed}
          timeLeft={timeLeft}
          players={players}
          onStartGame={startGame}
          onClearBoard={clearBoard}
        />

        <Canvas
          lines={lines}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        />
      </main>

      <ChatSidebar
        roomId={roomId}
        nickname={nickname}
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
