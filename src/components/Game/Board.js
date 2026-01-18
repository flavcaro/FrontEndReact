import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import SimplePopup from "./SimplePopup";
import PlayersSidebar from "./PlayersSidebar";
import ChatSidebar from "./ChatSidebar";
import GameHeader from "./GameHeader";
import Canvas from "./Canvas";
import GameResults from "./GameResults";
import Palette from "./Palette";

import { usePlayers } from "../../hooks/usePlayers";
import { useGame } from "../../hooks/useGame";
import { useChat } from "../../hooks/useChat";
import { useDrawing } from "../../hooks/useDrawing";

export default function Board({ roomId, nickname, gameConfig }) {
  const navigate = useNavigate();

  const { players, finalNickname, isOwner } =
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

  const [popup, setPopup] = useState({ open: false, message: "" });

  /* =========================
     FINE PARTITA
  ========================= */
  useEffect(() => {
    if (
      gameState?.ended &&
      (gameState.endReason === "owner_left" ||
        gameState.endReason === "not_enough_players")
    ) {
      setTimeout(() => {
        setPopup({
          open: true,
          message:
            "La partita è terminata: " +
            (gameState.endReason === "owner_left"
              ? "il creatore ha abbandonato."
              : "non ci sono abbastanza giocatori.")
        });
      }, 100);
    }
  }, [gameState]);

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
  return (
    <>
      <SimplePopup
        open={popup.open}
        message={popup.message}
        onClose={handleClosePopup}
      />

      <div
        className="board-container"
        style={{ display: "flex", height: "100dvh", overflow: "hidden" }}
      >
        <PlayersSidebar
          players={players}
          gameState={gameState}
          nickname={finalNickname}
          roomId={roomId}
        />

        <div className="board-center">
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

          <main className="board-main">
            <div className="game-content">
              <Canvas
                lines={lines}
                onMouseDown={showResults ? undefined : handleMouseDown}
                onMouseMove={showResults ? undefined : handleMouseMove}
                onMouseUp={showResults ? undefined : handleMouseUp}
                isArtist={isArtist}
                nickname={finalNickname}
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
    </>
  );
}
