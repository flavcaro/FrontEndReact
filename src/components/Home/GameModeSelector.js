/* filepath: src/components/Home/GameModeSelector.js */
import React, { useState } from 'react';
import { 
  GAME_MODES, 
  DEFAULT_GAME_MODE, 
  TURN_TIME_OPTIONS,
  DIFFICULTY_LEVELS,
  DEFAULT_DIFFICULTY,
  ROUNDS_OPTIONS,
  DEFAULT_ROUNDS
} from '../../constants/gameConfig';
import Button from '../common/Button';

export default function GameModeSelector({ onSelectMode, onCancel }) {
  const [selectedMode, setSelectedMode] = useState(DEFAULT_GAME_MODE.id);
  const [selectedTime, setSelectedTime] = useState('classic'); // Default to 60 seconds
  const [selectedDifficulty, setSelectedDifficulty] = useState(DEFAULT_DIFFICULTY.id);
  const [selectedRounds, setSelectedRounds] = useState(DEFAULT_ROUNDS);

  const handleConfirm = () => {
    const mode = Object.values(GAME_MODES).find(m => m.id === selectedMode);
    const timeOption = Object.values(TURN_TIME_OPTIONS).find(t => t.id === selectedTime);
    const difficulty = Object.values(DIFFICULTY_LEVELS).find(d => d.id === selectedDifficulty);
    const rounds = selectedRounds;

    onSelectMode({
      ...mode,
      ...timeOption, // Include time properties
      difficulty: difficulty,
      roundsPerGame: rounds
    });
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
        maxWidth: '600px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        animation: 'slideUp 0.4s ease-out'
      }}>
        <h2 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: '#1e293b',
          marginBottom: '8px',
          textAlign: 'center'
        }}>
          🎮 Configura Partita
        </h2>
        <p style={{
          color: '#64748b',
          fontSize: '14px',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          Personalizza la tua esperienza di gioco
        </p>

        {/* Game Mode Selection */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            fontSize: '16px',
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
                <div style={{ fontSize: '24px' }}>{mode.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                    {mode.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
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
            fontSize: '16px',
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
                  <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px' }}>
                    {timeOption.name}
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
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
            fontSize: '16px',
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
                  fontSize: '14px',
                  marginBottom: '4px'
                }}>
                  {difficulty.name}
                </div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>
                  {difficulty.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Rounds Selection */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            fontSize: '16px',
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
                  fontSize: '16px',
                  marginBottom: '2px'
                }}>
                  {option.label}
                </div>
                <div style={{ fontSize: '10px', color: '#64748b' }}>
                  {option.description}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div style={{
          padding: '16px',
          background: '#f8fafc',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px solid #e2e8f0'
        }}>
          <div style={{
            fontSize: '12px',
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
            fontSize: '13px',
            color: '#334155'
          }}>
            <div>
              <strong>Modalità:</strong> {GAME_MODES[selectedMode.toUpperCase()].name}
            </div>
            <div>
              <strong>Tempo per turno:</strong> {TURN_TIME_OPTIONS[selectedTime.toUpperCase()].name}
            </div>
            <div>
              <strong>Difficoltà:</strong> {DIFFICULTY_LEVELS[selectedDifficulty.toUpperCase()].name}
            </div>
            <div>
              <strong>Round:</strong> {selectedRounds} turni totali
            </div>
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