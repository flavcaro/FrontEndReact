import React, { useState } from "react";

import PlayersSidebar from "./PlayersSidebar";
import ChatSidebar from "./ChatSidebar";
import GameHeader from "./GameHeader";
import PuzzleCanvas from "./PuzzleCanvas";
import GameResults from "./GameResults";
import Palette from "./Palette";
import SimplePopup from "./SimplePopup";
import PlayersModal from "./PlayersModal";

import { usePlayers } from "../../hooks/usePlayers";
import { usePuzzleGame } from "../../hooks/usePuzzleGame";
import { usePuzzleDrawing } from "../../hooks/usePuzzleDrawing";
import { PUZZLE_DRAWING } from "../../constants/gameModes/puzzleDrawing";
import { useChat } from "../../hooks/useChat";

/**
 * Board per la modalità Puzzle Drawing
 * Il canvas è diviso in 3 sezioni, ogni giocatore disegna nella propria sezione
 */
const PuzzleBoard = ({ roomId, nickname, gameConfig }) => {
  const { players, finalNickname, cannotJoinReason, isOwner, playerId } = usePlayers(roomId, nickname);

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

  const { strokes, startStroke, addPoint, finishStroke, clearSection } = usePuzzleDrawing(
    roomId,
    mySection,
    gameState?.active
  );

  const [selectedColor, setSelectedColor] = useState("#1e293b");
  const [selectedInstrument, setSelectedInstrument] = useState("pencil");
  const [brushSize, setBrushSize] = useState(4);
  const [popup, setPopup] = useState({ open: false, message: "" });
  const [showPlayersModal, setShowPlayersModal] = useState(false);

  // Detect mobile for conditional styling
  const [isMobile, setIsMobile] = useState(() => {
    try {
      return window.innerWidth <= 768;
    } catch (e) {
      return false;
    }
  });

  React.useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleStartGame = () => {
    startGame(gameConfig);
  };

  // Handle cannot join reason
  React.useEffect(() => {
    if (cannotJoinReason) {
      setPopup({
        open: true,
        message: `Cannot join: ${cannotJoinReason}. Please wait for the game to end or try reconnecting if you were previously in the room.`,
      });
    }
  }, [cannotJoinReason]);

  // Compute effective sections robustly: prefer gameState, then gameConfig, then default.
  const rawSections = gameState?.puzzleSections ?? gameConfig?.puzzleSections ?? PUZZLE_DRAWING.sections;
  // Try a safe numeric coercion first (handles numbers, numeric-strings and booleans)
  let effectiveSections = Number(rawSections);
  // Reject booleans which coerce to 1/0 (true -> 1)
  if (typeof rawSections === 'boolean' || !Number.isFinite(effectiveSections) || ![2, 3].includes(effectiveSections)) {
    // Try parseInt as a last attempt for weird string shapes
    const parsed = parseInt(rawSections, 10);
    if (Number.isFinite(parsed) && [2, 3].includes(parsed)) {
      effectiveSections = parsed;
    } else {
      console.warn('⚠️ [PuzzleBoard] Invalid puzzleSections=', rawSections, '(', typeof rawSections, ') falling back to default', PUZZLE_DRAWING.sections);
      effectiveSections = PUZZLE_DRAWING.sections || 3;
    }
  } else {
    effectiveSections = Math.floor(effectiveSections);
  }

  console.log('🔧 [PuzzleBoard] effectiveSections=', effectiveSections, 'raw=', rawSections, 'typeofRaw=', typeof rawSections, 'gameState.puzzleSections=', gameState?.puzzleSections, 'gameConfig.puzzleSections=', gameConfig?.puzzleSections);

  // PuzzleBoard doesn't forcibly change body scroll here; parent layout
  // (Board/overall app) controls body overflow to avoid layout conflicts.

  // Prevent body scroll while PuzzleBoard is active (fills viewport)
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev || ''; };
  }, []);

  return (
    <>
      <SimplePopup
        open={popup.open}
        message={popup.message}
        onClose={() => setPopup({ open: false, message: "" })}
      />

      <div
        className="board-container"
        style={{
          position: 'fixed',
          inset: 0,
          display: 'flex',
          flexDirection: isMobile ? 'column' : 'row',
          overflow: 'hidden',
          alignItems: 'stretch',
          width: '100%'
        }}
      >
        <PlayersSidebar
          players={players}
          gameState={gameState}
          currentNickname={finalNickname}
          roomId={roomId}
        />

        <div className="board-center" style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, background: 'linear-gradient(135deg, #c7d2fe 0%, #ddd6fe 50%, #fbcfe8 100%)' }}>
          <GameHeader
            roomId={roomId}
            gameState={gameState}
            gameConfig={gameConfig}
            timeLeft={timeLeft}
            isArtist={isDrawer}
            nickname={finalNickname}
            players={players}
            isOwner={isOwner}
            onStartGame={handleStartGame}
            onClearBoard={clearSection}
            onShowPlayers={() => setShowPlayersModal(true)}
            selectedColor={selectedColor}
            onChangeColor={setSelectedColor}
            selectedInstrument={selectedInstrument}
            onChangeInstrument={setSelectedInstrument}
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
                    <strong>{
                      // Try to display the sectionName from assigned drawers when available
                      (gameState?.currentDrawers || []).find(d => d.player.name === finalNickname || (players.find(p => p.name === finalNickname) && d.player.uid === players.find(p => p.name === finalNickname).id))?.sectionName
                      || ['SINISTRA', 'CENTRO', 'DESTRA'][mySection]
                    }</strong>
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

          <main className="board-main" style={isMobile ? { padding: '10px', flex: '1 1 auto', minHeight: 0, overflow: 'auto' } : { padding: '20px' }}>
            <div className="game-content" style={{
              maxWidth: isMobile ? '100%' : '1100px',
              maxHeight: isMobile ? 'calc(100vh - 180px - 200px)' : '50vh',
              height: 'auto',
              flex: 'none'
            }}>
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
                selectedInstrument={selectedInstrument}
                totalSections={effectiveSections}
              />

              {/* Palette solo per i disegnatori */}
              {isDrawer && !hasGuessed && (
                <div className="palette-floating">
                  <Palette
                    selectedColor={selectedColor}
                    onChangeColor={setSelectedColor}
                    selectedInstrument={selectedInstrument}
                    onChangeInstrument={setSelectedInstrument}
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
              roomId={roomId}
              players={players}
              finalNickname={finalNickname}
              finalResults={finalResults}
              onRestart={restartGame}
              minYesVotes={4}
              playerId={playerId}
            />
          )}
        </div>

        {/* Chat inside container on desktop only */}
        {!isMobile && (
          <ChatSidebar
            className="puzzle-mode-chat"
            roomId={roomId}
            nickname={finalNickname}
            messages={messages}
            messagesEndRef={messagesEndRef}
            gameState={gameState}
            timeLeft={timeLeft}
            isArtist={isDrawer}
            hasGuessed={hasGuessed}
            onGuessCorrect={handleGuess}
          />
        )}
      </div>

      {/* Chat outside container on mobile - as sibling */}
      {isMobile && (
        <ChatSidebar
          className="chat-mobile-fullwidth"
          style={{
            width: '100%',
            height: '180px',
            flexShrink: 0,
            borderLeft: 'none',
            borderTop: '2px solid #e2e8f0',
            margin: 0
          }}
          roomId={roomId}
          nickname={finalNickname}
          messages={messages}
          messagesEndRef={messagesEndRef}
          gameState={gameState}
          timeLeft={timeLeft}
          isArtist={isDrawer}
          hasGuessed={hasGuessed}
          onGuessCorrect={handleGuess}
        />
      )}

      {/* Players Modal */}
      <PlayersModal
        isOpen={showPlayersModal}
        onClose={() => setShowPlayersModal(false)}
        players={players}
        gameState={gameState}
        nickname={finalNickname}
        roomId={roomId}
      />
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
