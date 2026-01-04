import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { signOut } from 'firebase/auth';
import { ref, onValue, set } from 'firebase/database';
import Button from '../common/Button';
import Input from '../common/Input';
import './Profile.css';

export default function Profile() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const isGuest = user?.isAnonymous;

  const [userData, setUserData] = useState({
    nickname: '',
    xp: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    totalScore: 0,
    bestScore: 0,
    createdAt: null,
  });
  const [editingNickname, setEditingNickname] = useState(false);
  const [newNickname, setNewNickname] = useState('');

  useEffect(() => {
    if (!user) {
      navigate('/home', { replace: true });
      return;
    }

    const userRef = ref(db, `users/${user.uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setUserData(data);
        setNewNickname(data.nickname || '');
      } else {
        // Initialize user data if not exists
        const initialData = {
          nickname: localStorage.getItem('nickname') || user.email?.split('@')[0] || 'Giocatore',
          xp: 0,
          gamesPlayed: 0,
          gamesWon: 0,
          totalScore: 0,
          bestScore: 0,
          createdAt: Date.now(),
        };
        set(userRef, initialData);
        setUserData(initialData);
        setNewNickname(initialData.nickname);
      }
    });

    return () => unsubscribe();
  }, [user, navigate]);

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      localStorage.removeItem('nickname');
      navigate('/', { replace: true });
    } catch (error) {
      alert('Errore durante il logout');
    }
  };

  const handleSaveNickname = async () => {
    if (!newNickname || newNickname.trim().length === 0) {
      alert('⚠️ Inserisci un nickname valido!');
      return;
    }

    try {
      const userRef = ref(db, `users/${user.uid}/nickname`);
      await set(userRef, newNickname.trim());
      localStorage.setItem('nickname', newNickname.trim());
      setEditingNickname(false);
      alert('✅ Nickname aggiornato!');
    } catch (error) {
      alert('❌ Errore durante l\'aggiornamento del nickname');
    }
  };

  const winRate = userData.gamesPlayed > 0 
    ? ((userData.gamesWon / userData.gamesPlayed) * 100).toFixed(1) 
    : 0;

  const avgScore = userData.gamesPlayed > 0 
    ? (userData.totalScore / userData.gamesPlayed).toFixed(0) 
    : 0;

  const calculateLevel = (xp) => {
    return Math.floor(xp / 100) + 1;
  };

  const level = calculateLevel(userData.xp);
  const xpForNextLevel = level * 100;
  const xpProgress = ((userData.xp % 100) / 100) * 100;

  if (isGuest) {
    return (
      <div className="profile-container">
        <div className="profile-card">
          <div className="profile-header">
            <Button 
              onClick={() => navigate('/home')} 
              variant="tertiary" 
              size="small"
              icon="←"
            >
              Indietro
            </Button>
            <h2>👤 Profilo</h2>
          </div>

          <div className="guest-message">
            <div className="guest-icon">🚫</div>
            <h3>Profilo non disponibile</h3>
            <p>Stai giocando come ospite. I profili sono disponibili solo per gli utenti registrati.</p>
            <div style={{ marginTop: 20 }}>
              <Button onClick={handleSignOut} variant="primary">
                🚪 Esci e Registrati
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-container">
      <div className="profile-card">
        {/* Header */}
        <div className="profile-header">
          <Button 
            onClick={() => navigate('/home')} 
            variant="tertiary" 
            size="small"
            icon="←"
          >
            Indietro
          </Button>
          <h2>👤 Il tuo Profilo</h2>
          <Button 
            onClick={handleSignOut} 
            variant="tertiary" 
            size="small"
            icon="🚪"
          >
            Logout
          </Button>
        </div>

        {/* User Info Section */}
        <div className="profile-section user-section">
          <div className="user-avatar">
            <span className="avatar-icon">✨</span>
          </div>
          
          <div className="user-details">
            {!editingNickname ? (
              <div className="nickname-display">
                <h3>{userData.nickname || 'Giocatore'}</h3>
                <button 
                  className="edit-nickname-btn"
                  onClick={() => setEditingNickname(true)}
                >
                  ✏️ Modifica
                </button>
              </div>
            ) : (
              <div className="nickname-edit">
                <Input
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  placeholder="Nuovo nickname"
                  maxLength={15}
                />
                <div className="edit-actions">
                  <Button onClick={handleSaveNickname} variant="primary" size="small">
                    ✓ Salva
                  </Button>
                  <Button 
                    onClick={() => {
                      setEditingNickname(false);
                      setNewNickname(userData.nickname);
                    }} 
                    variant="tertiary" 
                    size="small"
                  >
                    ✕ Annulla
                  </Button>
                </div>
              </div>
            )}
            
            <p className="user-email">{user?.email}</p>
            
            {/* Level Progress */}
            <div className="level-section">
              <div className="level-info">
                <span className="level-badge">🏆 Livello {level}</span>
                <span className="xp-text">{userData.xp} / {xpForNextLevel} XP</span>
              </div>
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ width: `${xpProgress}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="profile-section">
          <h3 className="section-title">📊 Statistiche</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon">🎮</div>
              <div className="stat-value">{userData.gamesPlayed}</div>
              <div className="stat-label">Partite Giocate</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">🏆</div>
              <div className="stat-value">{userData.gamesWon}</div>
              <div className="stat-label">Vittorie</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📈</div>
              <div className="stat-value">{winRate}%</div>
              <div className="stat-label">Win Rate</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">⭐</div>
              <div className="stat-value">{userData.bestScore}</div>
              <div className="stat-label">Miglior Punteggio</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">📊</div>
              <div className="stat-value">{avgScore}</div>
              <div className="stat-label">Punteggio Medio</div>
            </div>

            <div className="stat-card">
              <div className="stat-icon">💯</div>
              <div className="stat-value">{userData.totalScore}</div>
              <div className="stat-label">Punteggio Totale</div>
            </div>
          </div>
        </div>

        {/* Account Info */}
        <div className="profile-section">
          <h3 className="section-title">ℹ️ Informazioni Account</h3>
          <div className="info-list">
            <div className="info-item">
              <span className="info-label">Account creato:</span>
              <span className="info-value">
                {userData.createdAt 
                  ? new Date(userData.createdAt).toLocaleDateString('it-IT', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })
                  : 'N/A'
                }
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">Email:</span>
              <span className="info-value">{user?.email}</span>
            </div>
            <div className="info-item">
              <span className="info-label">ID Utente:</span>
              <span className="info-value" style={{ fontSize: '0.8em', color: '#64748b' }}>
                {user?.uid}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="profile-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>
    </div>
  );
}
