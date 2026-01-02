import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase';
import { onAuthStateChanged } from 'firebase/auth';
import Button from '../common/Button';
import Input from '../common/Input';
import Loading from '../common/Loading';
import { validateNickname } from '../../utils/roomUtils';
import '../Lobby/Lobby.css';

export default function RoomJoin({ roomId }) {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState('');
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);

      // Auto-fill nickname for authenticated users
      if (currentUser) {
        const savedNick = localStorage.getItem('nickname');
        if (savedNick) {
          setNickname(savedNick);
        } else if (currentUser.isAnonymous) {
          const guestNick = `Ospite${Math.floor(Math.random() * 9999)}`;
          setNickname(guestNick);
        } else if (currentUser.email) {
          const emailNick = currentUser.email.split('@')[0];
          setNickname(emailNick);
        }
      }
    });
    return unsubscribe;
  }, []);

  const handleJoinRoom = () => {
    if (!validateNickname(nickname)) {
      alert('⚠️ Inserisci un nickname valido!');
      return;
    }

    localStorage.setItem('nickname', nickname);
    navigate(`/room/${roomId}/play?nick=${encodeURIComponent(nickname)}`, { replace: true });
  };

  const handleBackToAuth = () => {
    navigate('/', { replace: true });
  };

  if (authLoading) {
    return <Loading message="Caricamento..." />;
  }

  if (!user) {
    // Not authenticated - show message and redirect to login
    return (
      <div className="lobby-container">
        <div className="lobby-card">
          <div className="lobby-header">
            <div className="logo">🎨</div>
            <h1>Stanza: {roomId}</h1>
            <p>Devi accedere per entrare in questa stanza</p>
          </div>

          <div className="info-box" style={{ marginBottom: 24 }}>
            <span className="info-icon">🔒</span>
            <span className="info-text">
              Per giocare devi prima accedere come ospite o con un account registrato.
            </span>
          </div>

          <div className="lobby-actions">
            <Button onClick={handleBackToAuth} variant="primary" icon="🔑">
              Vai al Login
            </Button>
          </div>
        </div>

        <div className="lobby-bg-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
        </div>
      </div>
    );
  }

  // User is authenticated - show nickname input
  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <div className="lobby-header">
          <div className="logo">🎨</div>
          <h1>Entra nella Stanza</h1>
          <p>Stanza: <strong style={{ color: '#6366f1', fontFamily: 'monospace' }}>{roomId}</strong></p>
        </div>

        {user.isAnonymous && (
          <div className="info-box" style={{ marginBottom: 24, background: '#fef3c7', borderLeft: '4px solid #f59e0b' }}>
            <span className="info-icon">ℹ️</span>
            <span className="info-text" style={{ color: '#92400e' }}>
              Stai entrando come ospite. I tuoi progressi non verranno salvati.
            </span>
          </div>
        )}

        <Input
          label="👤 Il tuo nickname"
          placeholder="Inserisci il tuo nickname..."
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleJoinRoom()}
          maxLength={15}
          autoFocus
        />

        <div className="lobby-actions">
          <Button onClick={handleJoinRoom} variant="primary" icon="🚪">
            Entra nella Stanza
          </Button>

          <Button onClick={() => navigate('/home')} variant="secondary" icon="◀">
            Torna alla Home
          </Button>
        </div>
      </div>

      <div className="lobby-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
    </div>
  );
}