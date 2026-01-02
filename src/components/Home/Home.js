import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { signOut } from 'firebase/auth';
import { ref, onValue } from 'firebase/database';
import Button from '../common/Button';
import Input from '../common/Input';
import { generateRoomCode, validateNickname, validateRoomCode } from '../../utils/roomUtils';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [xpPoints, setXpPoints] = useState(0);
  const user = auth.currentUser;
  const isGuest = user?.isAnonymous;

  // Load user data from database
  useEffect(() => {
    if (!user) return;

    const userRef = ref(db, `users/${user.uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setXpPoints(data.xp || 0);
      }
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const savedNick = localStorage.getItem('nickname');
    if (savedNick) {
      setNickname(savedNick);
    } else if (isGuest) {
      // Auto-generate nickname for guests
      const guestNick = `Ospite${Math.floor(Math.random() * 9999)}`;
      setNickname(guestNick);
      localStorage.setItem('nickname', guestNick);
    } else if (user?.email) {
      // Use email prefix as default nickname for registered users
      const emailNick = user.email.split('@')[0];
      setNickname(emailNick);
    }
  }, [isGuest, user]);

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

  const createRoom = () => {
    if (!validateNickname(nickname)) {
      alert('⚠️ Inserisci un nickname prima di continuare!');
      return;
    }
    localStorage.setItem('nickname', nickname);
    const roomId = generateRoomCode();
    // Navigate to the play route with nickname
    navigate(`/room/${roomId}/play?nick=${encodeURIComponent(nickname)}`, { replace: true });
  };

  const joinRoom = () => {
    if (!validateRoomCode(roomCode)) {
      alert('⚠️ Inserisci il codice della stanza (6 caratteri)!');
      return;
    }
    // Navigate to room entry page (where they'll be asked for nickname if needed)
    navigate(`/room/${roomCode.toUpperCase()}`, { replace: true });
  };

  return (
    <div className="home-container">
      {/* Header with user info */}
      <header className="home-header">
        <div className="user-info">
          <div className="user-nickname">
            <span className="nickname-icon">{isGuest ? '👤' : '✨'}</span>
            <span className="nickname-text">{nickname || 'Utente'}</span>
            {!isGuest && user?.email && (
              <span style={{ fontSize: 12, color: '#64748b', marginLeft: 8 }}>
                ({user.email})
              </span>
            )}
          </div>
          {/* Only show XP badge for registered users */}
          {!isGuest && (
            <div className="user-stats">
              <span className="xp-badge">⭐ {xpPoints} XP</span>
            </div>
          )}
        </div>
        
        <div className="header-actions">
          {!isGuest && (
            <button className="btn-profile" onClick={() => alert('Profilo - Coming soon!')}>
              👤 Profilo
            </button>
          )}
          <button className="btn-logout" onClick={handleSignOut}>
            🚪 {isGuest ? 'Esci' : 'Logout'}
          </button>
        </div>
      </header>

      {/* Main content */}
      <div className="home-main">
        <div className="home-card">
          <div className="home-title">
            <div className="logo">🎨</div>
            <h1>SketchGuess</h1>
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

          <div className="game-actions">
            <Button onClick={createRoom} variant="primary" icon="➕">
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
                  onKeyDown={(e) => e.key === 'Enter' && joinRoom()}
                  maxLength={6}
                  autoFocus
                />
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button onClick={joinRoom} variant="primary" size="small">
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
        </div>
      </div>

      <div className="home-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
    </div>
  );
}