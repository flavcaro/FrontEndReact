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
  const { players, finalNickname, isRoomFull, isOwner } = usePlayers(roomId, nickname);
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
  const [selectedColor, setSelectedColor] = useState('#1e293b');
  const [selectedInstrument, setSelectedInstrument] = useState('pencil');

  const { 
    lines, 
    clearBoard, 
    handleMouseDown, 
    handleMouseMove, 
    handleMouseUp 
  } = useDrawing(roomId, finalNickname, isArtist, gameState?.active, showResults, selectedColor, selectedInstrument);

  // Handle room full
  useEffect(() => {
    if (isRoomFull && !players.find(p => p.name === finalNickname)) {
      alert("⚠️ La stanza è piena! Massimo 6 giocatori.");
      navigate("/home", { replace: true });
    }
  }, [isRoomFull, players, finalNickname, navigate]);

  // Handle page close/refresh - warn user
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (gameState?.active) {
        e.preventDefault();
        e.returnValue = 'Sei sicuro di voler uscire? La partita è in corso!';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [gameState]);

  // Handler to start game with config
  const handleStartGame = () => {
    if (gameConfig) {
      console.log('Starting game with stored config:', gameConfig); // Debug
      startGame(gameConfig);
    } else {
      alert('⚠️ Errore: configurazione di gioco non trovata!');
    }
  };

  return (
    <div className="board-container">
      <PlayersSidebar 
        players={players} 
        gameState={gameState} 
        nickname={finalNickname} 
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
          isOwner={isOwner}
          onStartGame={handleStartGame}
          onClearBoard={clearBoard}
          selectedColor={selectedColor}
          onChangeColor={setSelectedColor}
          selectedInstrument={selectedInstrument}
          onChangeInstrument={setSelectedInstrument}
        />

        <Canvas
          lines={lines}
          onMouseDown={showResults ? undefined : handleMouseDown}
          onMouseMove={showResults ? undefined : handleMouseMove}
          onMouseUp={showResults ? undefined : handleMouseUp}
          isArtist={isArtist}
          nickname={finalNickname}
        />
      </main>

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

      {finalResults && (
        <GameResults 
          finalResults={finalResults}
          onRestart={restartGame}
        />
      )}
    </div>
  );
}
