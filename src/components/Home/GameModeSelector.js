/* filepath: src/components/Home/GameModeSelector.js */
import React, { useState } from 'react';
import { 
  GAME_MODES, 
  DEFAULT_GAME_MODE, 
  TURN_TIME_OPTIONS,
  DIFFICULTY_LEVELS,
  DEFAULT_DIFFICULTY,
  ROUNDS_OPTIONS,
  DEFAULT_ROUNDS,
  SURVIVAL_DEFAULT_THRESHOLD
} from '../../constants/gameConfig';
import Button from '../common/Button';

export default function GameModeSelector({ onSelectMode, onCancel }) {
  const [selectedMode, setSelectedMode] = useState(DEFAULT_GAME_MODE.id);
  const [selectedTime, setSelectedTime] = useState('classic'); // Default to 60 seconds
  const [selectedDifficulty, setSelectedDifficulty] = useState(DEFAULT_DIFFICULTY.id);
  const [selectedRounds, setSelectedRounds] = useState(DEFAULT_ROUNDS);
  const [survivalThresholdType, setSurvivalThresholdType] = useState(SURVIVAL_DEFAULT_THRESHOLD.thresholdType);
  const [survivalThresholdValue, setSurvivalThresholdValue] = useState(SURVIVAL_DEFAULT_THRESHOLD.thresholdValue);

  // Debug: check if sprites are loaded
  console.log('GameModes with sprites:', Object.values(GAME_MODES).map(m => ({ 
    name: m.name, 
    hasSprite: !!m.sprite,
    sprite: m.sprite 
  })));

  const handleConfirm = () => {
    const mode = Object.values(GAME_MODES).find(m => m.id === selectedMode);
    const timeOption = Object.values(TURN_TIME_OPTIONS).find(t => t.id === selectedTime);
    const difficulty = Object.values(DIFFICULTY_LEVELS).find(d => d.id === selectedDifficulty);
    const rounds = selectedRounds;

    const payload = {
       // Spread delle proprietà della modalità
      ...mode,
       // Proprietà esplicite per tempo/turno
      turnDuration: timeOption?.turnDuration || mode.turnDuration,
      turnTimeId: timeOption?.id || null,
      turnTimeName: timeOption?.name || null,
      difficulty: difficulty,
      roundsPerGame: rounds
    };

// Configurazione sopravvivenza (condizionale)
    if (mode?.survivalMode) {
      payload.survivalThreshold = {
        thresholdType: survivalThresholdType,
        thresholdValue: Number(survivalThresholdValue)
      };
    }

    onSelectMode(payload);
  };


  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      animation: 'fadeIn 0.3s ease-out'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '24px',
        padding: '32px',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        scrollbarWidth: 'none',
        msOverflowStyle: 'none',
        animation: 'slideUp 0.4s ease-out'
      }}
      className="hide-scrollbar">
        <h2 style={{
          fontSize: '38px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          🎮 Configura Partita
        </h2>
        <p style={{
          color: '#64748b',
          fontSize: '26px',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          Personalizza la tua esperienza di gioco
        </p>

        {/* Game Mode Selection */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            fontSize: '26px',
            fontWeight: '600',
            color: '#334155',
            marginBottom: '12px'
          }}>
            🎨 Modalità di Gioco
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {Object.values(GAME_MODES).map((mode) => (
              <div
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                style={{
                  padding: '16px',
                  border: selectedMode === mode.id 
                    ? '3px solid #6366f1' 
                    : '2px solid #e2e8f0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: selectedMode === mode.id 
                    ? 'linear-gradient(135deg, #eef2ff, #e0e7ff)' 
                    : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                {mode.sprite ? (
                  <img 
                    src={mode.sprite} 
                    alt={mode.name}
                    style={{ 
                      width: '48px', 
                      height: '48px', 
                      objectFit: 'contain',
                      imageRendering: 'pixelated'
                    }}
                  />
                ) : (
                  <div style={{ fontSize: '24px' }}>{mode.icon}</div>
                )}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '26px' }}>
                    {mode.name}
                  </div>
                  <div style={{ fontSize: '24px', color: '#64748b' }}>
                    {mode.description}
                  </div>
                </div>
                {selectedMode === mode.id && (
                  <div style={{ fontSize: '20px', color: '#6366f1' }}>✓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Turn Time Selection */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            fontSize: '26px',
            fontWeight: '600',
            color: '#334155',
            marginBottom: '12px'
          }}>
            ⏱️ Tempo per Turno
          </h3>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            {Object.values(TURN_TIME_OPTIONS).map((timeOption) => (
              <div
                key={timeOption.id}
                onClick={() => setSelectedTime(timeOption.id)}
                style={{
                  padding: '16px',
                  border: selectedTime === timeOption.id 
                    ? '3px solid #6366f1' 
                    : '2px solid #e2e8f0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: selectedTime === timeOption.id 
                    ? 'linear-gradient(135deg, #eef2ff, #e0e7ff)' 
                    : 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}
              >
                <div style={{ fontSize: '24px' }}>{timeOption.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '26px' }}>
                    {timeOption.name}
                  </div>
                  <div style={{ fontSize: '24px', color: '#64748b' }}>
                    {timeOption.description}
                  </div>
                </div>
                {selectedTime === timeOption.id && (
                  <div style={{ fontSize: '20px', color: '#6366f1' }}>✓</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Difficulty Selection */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            fontSize: '26px',
            fontWeight: '600',
            color: '#334155',
            marginBottom: '12px'
          }}>
            🎯 Difficoltà
          </h3>
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            {Object.values(DIFFICULTY_LEVELS).map((difficulty) => (
              <button
                key={difficulty.id}
                onClick={() => setSelectedDifficulty(difficulty.id)}
                style={{
                  flex: '1 1 calc(33.333% - 8px)',
                  minWidth: '140px',
                  padding: '16px 12px',
                  border: selectedDifficulty === difficulty.id 
                    ? `3px solid ${difficulty.color}` 
                    : '2px solid #e2e8f0',
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  background: selectedDifficulty === difficulty.id 
                    ? `${difficulty.color}15` 
                    : 'white',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: '32px', marginBottom: '8px' }}>
                  {difficulty.icon}
                </div>
                <div style={{
                  fontWeight: '600',
                  color: selectedDifficulty === difficulty.id ? difficulty.color : '#334155',
                  fontSize: '26px',
                  marginBottom: '4px'
                }}>
                  {difficulty.name}
                </div>
                <div style={{ fontSize: '23px', color: '#64748b' }}>
                  {difficulty.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Rounds Selection - Nascosto per Puzzle Drawing */}
        {selectedMode !== 'puzzleDrawing' && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: '26px',
              fontWeight: '600',
              color: '#334155',
              marginBottom: '12px'
            }}>
              🔄 Numero di Round
            </h3>
            <div style={{
              display: 'flex',
              gap: '8px'
            }}>
              {ROUNDS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => setSelectedRounds(option.value)}
                  style={{
                    flex: 1,
                    padding: '16px 12px',
                    border: selectedRounds === option.value 
                      ? '3px solid #6366f1' 
                      : '2px solid #e2e8f0',
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: selectedRounds === option.value 
                      ? 'linear-gradient(135deg, #eef2ff, #e0e7ff)' 
                      : 'white',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '24px', marginBottom: '6px' }}>
                    {option.icon}
                  </div>
                  <div style={{
                    fontWeight: '700',
                    color: selectedRounds === option.value ? '#6366f1' : '#334155',
                    fontSize: '26px',
                    marginBottom: '2px'
                  }}>
                    {option.label}
                  </div>
                  <div style={{ fontSize: '20px', color: '#64748b' }}>
                    {option.description}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Info per Puzzle Drawing */}
        {selectedMode === 'puzzleDrawing' && (
          <div style={{ 
            marginBottom: '24px',
            padding: '16px',
            background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
            borderRadius: '12px',
            border: '2px solid #6366f1'
          }}>
            <div style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              color: '#6366f1',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🧩 Round Puzzle Drawing
            </div>
            <div style={{ fontSize: '24px', color: '#334155', lineHeight: '1.5' }}>
              I round continuano finché <strong>tutti i giocatori hanno indovinato almeno una volta</strong>. 
              Minimo {Object.values(GAME_MODES).find(m => m.id === 'puzzleDrawing')?.minPlayers || 4} giocatori richiesti.
            </div>
          </div>
        )}

        {/* Survival Threshold (only for survival mode) */}
        {Object.values(GAME_MODES).find(m => m.id === selectedMode)?.survivalMode && (
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{
              fontSize: '26px',
              fontWeight: '600',
              color: '#334155',
              marginBottom: '12px'
            }}>
              ⚖️ Soglia Sopravvivenza
            </h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6 }}>Tipo</label>
                <select value={survivalThresholdType} onChange={(e) => setSurvivalThresholdType(e.target.value)}>
                  <option value="turn">Per Turno</option>
                  <option value="game">Per Partita</option>
                </select>
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6 }}>Valore soglia</label>
                <input type="number" min={0} value={survivalThresholdValue} onChange={(e) => setSurvivalThresholdValue(e.target.value)} style={{ width: 120, padding: 8 }} />
              </div>
              <div style={{ color: '#64748b', fontSize: 16 }}>
                Se sotto soglia, il giocatore perde 1 vita
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        <div style={{
          padding: '16px',
          background: '#f8fafc',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            fontSize: '22px',
            color: '#64748b',
            fontWeight: '600',
            marginBottom: '8px'
          }}>
            📋 RIEPILOGO CONFIGURAZIONE
          </div>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            fontSize: '23px',
            color: '#334155'
          }}>
            <div>
              <strong>Modalità:</strong> {Object.values(GAME_MODES).find(m => m.id === selectedMode)?.name}
            </div>
            <div>
              <strong>Tempo per turno:</strong> {Object.values(TURN_TIME_OPTIONS).find(t => t.id === selectedTime)?.name}
            </div>
            <div>
              <strong>Difficoltà:</strong> {Object.values(DIFFICULTY_LEVELS).find(d => d.id === selectedDifficulty)?.name}
            </div>
            {selectedMode !== 'puzzleDrawing' && (
              <div>
                <strong>Round:</strong> {selectedRounds} turni totali
              </div>
            )}
            {selectedMode === 'puzzleDrawing' && (
              <div>
                <strong>Round:</strong> Fino a quando tutti hanno indovinato
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{
          display: 'flex',
          gap: '12px'
        }}>
          <Button 
            onClick={handleConfirm} 
            variant="primary"
            style={{ flex: 1 }}
          >
            ✓ Conferma e Crea Stanza
          </Button>
          <Button 
            onClick={onCancel} 
            variant="secondary"
            style={{ minWidth: '100px' }}
          >
            ✕ Annulla
          </Button>
        </div>
      </div>
    </div>
  );
}