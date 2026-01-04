import React, { useState } from 'react';
import Button from '../common/Button';

export default function RoomActions({ onCreateRoom, onJoinRoom }) {
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [roomCode, setRoomCode] = useState('');

  const handleJoinRoom = () => {
    onJoinRoom(roomCode);
    setRoomCode('');
    setShowJoinInput(false);
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
          <input
            type="text"
            className="lobby-input code-input"
            placeholder="ABC123"
            value={roomCode}
            onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
            maxLength={6}
            autoFocus
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={handleJoinRoom} variant="primary" size="small">
              ✓ Entra
            </Button>
            <Button 
              onClick={() => {
                setShowJoinInput(false);
                setRoomCode('');
              }}
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