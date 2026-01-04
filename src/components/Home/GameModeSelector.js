/* filepath: src/components/Home/GameModeSelector.js */
import React, { useState } from 'react';
import { GAME_MODES, DEFAULT_GAME_MODE } from '../../constants/gameConfig';
import Button from '../common/Button';

export default function GameModeSelector({ onSelectMode, onCancel }) {
  const [selectedMode, setSelectedMode] = useState(DEFAULT_GAME_MODE.id);

  const handleConfirm = () => {
    const mode = Object.values(GAME_MODES).find(m => m.id === selectedMode);
    onSelectMode(mode);
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
        maxWidth: '500px',
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
          🎮 Scegli Modalità
        </h2>
        <p style={{
          color: '#64748b',
          fontSize: '14px',
          marginBottom: '24px',
          textAlign: 'center'
        }}>
          Seleziona come vuoi giocare
        </p>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          marginBottom: '24px'
        }}>
          {Object.values(GAME_MODES).map((mode) => (
            <div
              key={mode.id}
              onClick={() => setSelectedMode(mode.id)}
              style={{
                padding: '20px',
                border: selectedMode === mode.id 
                  ? '3px solid #6366f1' 
                  : '2px solid #e2e8f0',
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                background: selectedMode === mode.id 
                  ? 'linear-gradient(135deg, #eef2ff, #e0e7ff)' 
                  : 'white',
                transform: selectedMode === mode.id ? 'scale(1.02)' : 'scale(1)',
                boxShadow: selectedMode === mode.id 
                  ? '0 4px 12px rgba(99, 102, 241, 0.2)' 
                  : 'none'
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                marginBottom: '12px'
              }}>
                <div style={{
                  fontSize: '32px',
                  width: '50px',
                  height: '50px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: selectedMode === mode.id 
                    ? '#6366f1' 
                    : '#f1f5f9',
                  borderRadius: '12px',
                  transition: 'all 0.2s'
                }}>
                  {mode.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    color: '#1e293b',
                    marginBottom: '4px'
                  }}>
                    {mode.name}
                  </h3>
                  <p style={{
                    fontSize: '13px',
                    color: '#64748b',
                    lineHeight: '1.4'
                  }}>
                    {mode.description}
                  </p>
                </div>
                {selectedMode === mode.id && (
                  <div style={{
                    fontSize: '24px',
                    color: '#6366f1'
                  }}>
                    ✓
                  </div>
                )}
              </div>
              <div style={{
                display: 'flex',
                gap: '16px',
                fontSize: '12px',
                color: '#64748b',
                paddingLeft: '66px'
              }}>
                <div>⏱️ {mode.turnDuration}s per turno</div>
                <div>🔄 {mode.roundsPerGame} round</div>
              </div>
            </div>
          ))}
        </div>

        {/* Coming Soon Modes */}
        <div style={{
          padding: '16px',
          background: '#f8fafc',
          borderRadius: '12px',
          marginBottom: '24px',
          border: '1px dashed #cbd5e1'
        }}>
          <div style={{
            fontSize: '12px',
            color: '#64748b',
            fontWeight: '600',
            marginBottom: '8px'
          }}>
            🚀 PROSSIMAMENTE
          </div>
          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap'
          }}>
            <span style={{
              background: '#e0e7ff',
              color: '#6366f1',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: '600'
            }}>
              ⚡ Modalità Veloce
            </span>
            <span style={{
              background: '#fef3c7',
              color: '#f59e0b',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: '600'
            }}>
              👥 A Squadre
            </span>
            <span style={{
              background: '#fee2e2',
              color: '#ef4444',
              padding: '6px 12px',
              borderRadius: '8px',
              fontSize: '11px',
              fontWeight: '600'
            }}>
              🎯 Solo Parole Difficili
            </span>
          </div>
        </div>

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