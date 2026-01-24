import React, { useState } from "react";
import { useNavigate } from "react-router-dom";

import SimplePopup from "./SimplePopup";
import PlayersSidebar from "./PlayersSidebar";
import ChatSidebar from "./ChatSidebar";
import GameHeader from "./GameHeader";
import PuzzleCanvas from "./PuzzleCanvas";
import GameResults from "./GameResults";
import Palette from "./Palette";

import { usePlayers } from "../../hooks/usePlayers";
import { usePuzzleGame } from "../../hooks/usePuzzleGame";
import { usePuzzleDrawing } from "../../hooks/usePuzzleDrawing";
import { useChat } from "../../hooks/useChat";

/**
 * Board per la modalità Puzzle Drawing
 * Il canvas è diviso in 3 sezioni, ogni giocatore disegna nella propria sezione
 */
const PuzzleBoard = ({ roomId, nickname, gameConfig }) => {
  console.log('🧩🧩🧩 PUZZLE BOARD CARICATO!', { roomId, nickname, gameConfig });
  
  const navigate = useNavigate();

  const { players, finalNickname, isOwner } = usePlayers(roomId, nickname);

  console.log('🎮 [PuzzleBoard] Nicknames:', { 
    original: nickname, 
    final: finalNickname,
    different: nickname !== finalNickname 
  });

  const {
    gameState,
    timeLeft,
    isDrawer,
    isGuesser,
    mySection,
    hasGuessed,
    finalResults,
    startGame,
    handleGuess,
    restartGame,
    showResults
  } = usePuzzleGame(roomId, finalNickname, players);

  const { messages, messagesEndRef } = useChat(roomId);

  const { strokes, startStroke, addPoint, finishStroke } = usePuzzleDrawing(
    roomId,
    mySection,
    gameState?.active
  );

  const [selectedColor, setSelectedColor] = useState("#1e293b");
  const [brushSize, setBrushSize] = useState(4);
  const [showStartPopup, setShowStartPopup] = useState(true);

  const handleStartGame = () => {
    setShowStartPopup(false);
    startGame(gameConfig);
  };

  return (
    <>
      {showStartPopup && !gameState?.active && (
        <SimplePopup
          emoji="🧩"
          title="Puzzle Drawing"
          message="Il canvas sarà diviso in 3 sezioni. Collaborate per creare un disegno!"
          onConfirm={isOwner ? handleStartGame : null}
          onCancel={() => navigate("/")}
          confirmText={isOwner ? "Inizia Partita" : "In attesa del creatore..."}
          cancelText="Esci"
          showCancel={true}
        />
      )}

      <div
        className="board-container"
        style={{ display: "flex", height: "100dvh", overflow: "hidden" }}
      >
        <PlayersSidebar
          players={players}
          gameState={gameState}
          currentNickname={finalNickname}
          roomId={roomId}
        />

        <div className="board-center">
          <GameHeader
            gameState={gameState}
            timeLeft={timeLeft}
            isArtist={isDrawer}
            nickname={finalNickname}
            players={players}
            isOwner={isOwner}
            onStartGame={handleStartGame}
          >
            {/* Info ruolo corrente */}
            {gameState?.active && !showResults && (
              <div style={{
                background: isDrawer 
                  ? 'linear-gradient(135deg, #10b981, #059669)' 
                  : 'linear-gradient(135deg, #f59e0b, #d97706)',
                color: 'white',
                padding: '12px 24px',
                borderRadius: '12px',
                fontSize: '18px',
                fontWeight: '700',
                textAlign: 'center',
                marginTop: '8px',
                boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)',
                border: '3px solid white'
              }}>
                {isDrawer && (
                  <>
                    🎨 TU DISEGNI - Sezione:{' '}
                    <strong>{['SINISTRA', 'CENTRO', 'DESTRA'][mySection]}</strong>
                  </>
                )}
                {isGuesser && (
                  <>
                    🤔 TU INDOVINI! Osserva il puzzle e scrivi nella chat
                  </>
                )}
                {!isDrawer && !isGuesser && (
                  <>
                    ⏳ In attesa...
                  </>
                )}
              </div>
            )}

            {/* Mostra i disegnatori correnti */}
            {gameState?.active && !showResults && (
              <div style={{
                marginTop: '12px',
                padding: '12px',
                background: '#f8fafc',
                borderRadius: '8px',
                fontSize: '14px',
                color: '#64748b'
              }}>
                <div style={{ marginBottom: '4px' }}>
                  <strong>Disegnatori:</strong>{' '}
                  {gameState.currentDrawers?.map(d => d.player.name).join(', ')}
                </div>
                <div>
                  <strong>Indovinatore:</strong> {gameState.currentGuesser?.name}
                </div>
              </div>
            )}
          </GameHeader>

          <main className="board-main">
            <div className="game-content" style={{ maxWidth: '1100px' }}>
              <PuzzleCanvas
                currentColor={selectedColor}
                brushSize={brushSize}
                isDrawing={isDrawer && !hasGuessed}
                assignedSection={isDrawer ? mySection : null}
                allStrokes={strokes}
                onStartStroke={startStroke}
                onAddPoint={addPoint}
                onFinishStroke={finishStroke}
                showSectionBorders={true}
              />

              {/* Palette solo per i disegnatori */}
              {isDrawer && !hasGuessed && (
                <div className="palette-floating">
                  <Palette
                    selectedColor={selectedColor}
                    onChangeColor={setSelectedColor}
                    selectedInstrument="pencil"
                    onChangeInstrument={() => {}}
                    showColors={true}
                  />
                  
                  {/* Slider per dimensione pennello */}
                  <div style={{
                    marginTop: '12px',
                    padding: '12px',
                    background: 'white',
                    borderRadius: '12px',
                    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)'
                  }}>
                    <label style={{
                      display: 'block',
                      marginBottom: '8px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: '#1e293b'
                    }}>
                      Dimensione: {brushSize}px
                    </label>
                    <input
                      type="range"
                      min="2"
                      max="20"
                      value={brushSize}
                      onChange={(e) => setBrushSize(Number(e.target.value))}
                      style={{ width: '100%' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </main>

          {/* Risultati finali */}
          {finalResults && (
            <GameResults
              finalResults={finalResults}
              onRestart={isOwner ? restartGame : null}
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
          isArtist={isDrawer} // I disegnatori non possono scrivere (come se fossero artisti)
          hasGuessed={hasGuessed}
          onGuessCorrect={handleGuess}
        />
      </div>
    </>
  );
};

// Usa React.memo per evitare re-render inutili
export default React.memo(PuzzleBoard, (prevProps, nextProps) => {
  return (
    prevProps.roomId === nextProps.roomId &&
    prevProps.nickname === nextProps.nickname &&
    prevProps.gameConfig?.id === nextProps.gameConfig?.id
  );
});
