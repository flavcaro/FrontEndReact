import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useUserData } from '../../hooks/useUserData';
import Button from '../common/Button';
import Input from '../common/Input';
import UserHeader from './UserHeader';
import RoomActions from './RoomActions';
import GameModeSelector from './GameModeSelector';
import { generateRoomCode, validateNickname, validateRoomCode } from '../../utils/roomUtils';

export default function Home() {
  const navigate = useNavigate();
  const { nickname, setNickname, xpPoints, user, isGuest } = useUserData();
  const [showModeSelector, setShowModeSelector] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('nickname');
      navigate('/', { replace: true });
    } catch (error) {
      alert('Errore durante il logout');
    }
  };

  const saveNickname = () => {
    if (!validateNickname(nickname)) {
      alert('⚠️ Inserisci un nickname valido (almeno 1 carattere)!');
      return;
    }
    localStorage.setItem('nickname', nickname);
    alert('✅ Nickname salvato!');
  };

  const initiateCreateRoom = () => {
    if (!validateNickname(nickname)) {
      alert('⚠️ Inserisci un nickname prima di continuare!');
      return;
    }
    localStorage.setItem('nickname', nickname);
    setShowModeSelector(true);
  };

  const createRoom = (gameMode) => {
    const roomId = generateRoomCode();
    // Store game mode in localStorage for the room
    localStorage.setItem(`room_${roomId}_mode`, JSON.stringify(gameMode));
    navigate(`/room/${roomId}/play?nick=${encodeURIComponent(nickname)}&mode=${gameMode.id}`, { replace: true });
    setShowModeSelector(false);
  };

  const joinRoom = (roomCode) => {
    if (!validateRoomCode(roomCode)) {
      alert('⚠️ Inserisci il codice della stanza (6 caratteri)!');
      return;
    }
    navigate(`/room/${roomCode.toUpperCase()}`, { replace: true });
  };

  return (
    <div className="home-container">
      <UserHeader 
        nickname={nickname}
        isGuest={isGuest}
        user={user}
        xpPoints={xpPoints}
        onSignOut={handleSignOut}
        navigate={navigate}
      />

      <div className="home-main">
        <div className="home-card">
          <div className="home-title">
            <div className="logo">🎨</div>
            <h1>SketchUp</h1>
            <p>Benvenuto{isGuest ? ', Ospite' : ''}! Scegli come vuoi giocare</p>
          </div>

          {isGuest && (
            <div className="info-box" style={{ marginBottom: 20, background: '#fef3c7', borderLeft: '4px solid #f59e0b' }}>
              <span className="info-icon">ℹ️</span>
              <span className="info-text" style={{ color: '#92400e' }}>
                <strong>Stai giocando come ospite.</strong><br />
                I tuoi progressi non verranno salvati. Crea un account per tenere traccia delle tue statistiche!
              </span>
            </div>
          )}

          <div className="nickname-section">
            <Input
              label="👤 Il tuo nickname"
              placeholder="Inserisci il tuo nome..."
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              maxLength={15}
            />
            <Button onClick={saveNickname} variant="tertiary" size="small">
              💾 Salva Nickname
            </Button>
          </div>

          <RoomActions onCreateRoom={initiateCreateRoom} onJoinRoom={joinRoom} />
        </div>
      </div>

      {showModeSelector && (
        <GameModeSelector 
          onSelectMode={createRoom}
          onCancel={() => setShowModeSelector(false)}
        />
      )}

      <div className="home-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
    </div>
  );
}