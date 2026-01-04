import React, { useState } from 'react';
import Button from '../common/Button';
import { extractRoomCode } from '../../utils/roomUtils';

export default function RoomActions({ onCreateRoom, onJoinRoom }) {
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [roomInput, setRoomInput] = useState('');
  const [inputError, setInputError] = useState('');

  const handleJoinRoom = () => {
    setInputError('');
    
    const roomCode = extractRoomCode(roomInput);
    
    if (!roomCode) {
      setInputError('⚠️ Inserisci un codice valido (6 caratteri) o un link completo!');
      return;
    }

    onJoinRoom(roomCode);
    setRoomInput('');
    setShowJoinInput(false);
  };

  const handleInputChange = (e) => {
    setRoomInput(e.target.value);
    setInputError(''); // Clear error when user types
  };

  const handleCancel = () => {
    setShowJoinInput(false);
    setRoomInput('');
    setInputError('');
  };

  return (
    <div className="game-actions">
      <Button onClick={onCreateRoom} variant="primary" icon="➕">
        Crea Nuova Stanza
      </Button>

      <div className="divider">
        <span>oppure</span>
      </div>

      {!showJoinInput ? (
        <Button onClick={() => setShowJoinInput(true)} variant="secondary" icon="🔗">
          Unisciti a una Stanza
        </Button>
      ) : (
        <div className="join-section">
          <div style={{ marginBottom: 12 }}>
            <label 
              className="lobby-label" 
              style={{ 
                fontSize: 14, 
                fontWeight: 600, 
                color: '#334155', 
                marginBottom: 8,
                display: 'block'
              }}
            >
              🔗 Codice o Link della Stanza
            </label>
            <input
              type="text"
              className="lobby-input"
              placeholder="ABC123 o incolla il link completo..."
              value={roomInput}
              onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
              autoFocus
              style={{
                fontFamily: roomInput.includes('://') ? 'inherit' : "'Courier New', monospace",
                fontSize: roomInput.includes('://') ? '13px' : '16px',
                textAlign: roomInput.includes('://') ? 'left' : 'center'
              }}
            />
            {inputError && (
              <div style={{
                color: '#dc2626',
                fontSize: '12px',
                marginTop: '6px',
                padding: '6px 10px',
                background: '#fee2e2',
                borderRadius: '6px'
              }}>
                {inputError}
              </div>
            )}
            <div style={{
              fontSize: '12px',
              color: '#64748b',
              marginTop: '8px',
              textAlign: 'center'
            }}>
              💡 Incolla il link che ti ha inviato un amico o inserisci il codice a 6 caratteri
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={handleJoinRoom} variant="primary" size="small" style={{ flex: 1 }}>
              ✓ Entra
            </Button>
            <Button 
              onClick={handleCancel}
              variant="tertiary"
              size="small"
            >
              ✕ Annulla
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}