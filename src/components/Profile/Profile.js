import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../firebase';
import { 
  signOut, 
  updateEmail, 
  updatePassword, 
  reauthenticateWithCredential, 
  EmailAuthProvider 
} from 'firebase/auth';
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
  
  // Account edit states
  const [editingAccount, setEditingAccount] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (!user) {
      navigate('/home', { replace: true });
      return;
    }

    const userRef = ref(db, `users/${user.uid}`);
    const unsubscribe = onValue(userRef, (snapshot) => {
      try {
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
      } catch (error) {
        console.error('Error in profile user data listener:', error);
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

  const reauthenticate = async (password) => {
    const credential = EmailAuthProvider.credential(
      user.email,
      password
    );
    return await reauthenticateWithCredential(user, credential);
  };

  const handleUpdateEmail = async () => {
    if (!newEmail || !newEmail.includes('@')) {
      alert('⚠️ Inserisci un\'email valida!');
      return;
    }

    if (!currentPassword) {
      alert('⚠️ Inserisci la tua password attuale per confermare!');
      return;
    }

    setIsUpdating(true);
    try {
      // Reauthentica l'utente prima di aggiornare l'email
      await reauthenticate(currentPassword);
      await updateEmail(user, newEmail);
      alert('✅ Email aggiornata con successo!');
      setEditingAccount(false);
      setCurrentPassword('');
      setNewEmail('');
    } catch (error) {
      console.error('Error updating email:', error);
      if (error.code === 'auth/wrong-password') {
        alert('❌ Password corrente non corretta');
      } else if (error.code === 'auth/email-already-in-use') {
        alert('❌ Questa email è già in uso');
      } else if (error.code === 'auth/requires-recent-login') {
        alert('❌ Per motivi di sicurezza, effettua nuovamente il login prima di modificare l\'email');
      } else {
        alert('❌ Errore durante l\'aggiornamento dell\'email: ' + error.message);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      alert('⚠️ La password deve contenere almeno 6 caratteri!');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('⚠️ Le password non corrispondono!');
      return;
    }

    if (!currentPassword) {
      alert('⚠️ Inserisci la tua password attuale per confermare!');
      return;
    }

    setIsUpdating(true);
    try {
      // Reauthentica l'utente prima di aggiornare la password
      await reauthenticate(currentPassword);
      await updatePassword(user, newPassword);
      alert('✅ Password aggiornata con successo!');
      setEditingAccount(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error('Error updating password:', error);
      if (error.code === 'auth/wrong-password') {
        alert('❌ Password corrente non corretta');
      } else if (error.code === 'auth/requires-recent-login') {
        alert('❌ Per motivi di sicurezza, effettua nuovamente il login prima di modificare la password');
      } else {
        alert('❌ Errore durante l\'aggiornamento della password: ' + error.message);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingAccount(false);
    setNewEmail('');
    setNewPassword('');
    setConfirmPassword('');
    setCurrentPassword('');
  };

  const winRate = userData.gamesPlayed > 0 
    ? ((userData.gamesWon / userData.gamesPlayed) * 100).toFixed(1) 
    : 0;

  const avgScore = userData.gamesPlayed > 0 
    ? (userData.totalScore / userData.gamesPlayed).toFixed(0) 
    : 0;

  const calculateLevel = (xp) => {
    // Progressione crescente: Livello N richiede 100 * (N-1) * N / 2 XP
    let level = 1;
    while (true) {
      const xpForNextLevel = 100 * level * (level + 1) / 2;
      if (xp < xpForNextLevel) break;
      level++;
    }
    return level;
  };

  const getXpForLevel = (level) => {
    // XP minimo per raggiungere livello N
    if (level <= 1) return 0;
    return 100 * (level - 1) * level / 2;
  };

  const level = calculateLevel(userData.xp);
  const xpForCurrentLevel = getXpForLevel(level); // XP minimo per livello attuale
  const xpForNextLevel = getXpForLevel(level + 1); // XP minimo per prossimo livello
  const xpNeeded = xpForNextLevel - xpForCurrentLevel; // XP necessari per salire
  const xpProgress = ((userData.xp - xpForCurrentLevel) / xpNeeded) * 100;

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
                {/* <span className="xp-text">{userData.xp - xpForCurrentLevel} / {xpNeeded} XP (Totale: {userData.xp})</span> */}
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
          <div className="section-title-with-action">
            <h3 className="section-title">ℹ️ Informazioni Account</h3>
            {!editingAccount && (
              <button 
                className="edit-account-btn"
                onClick={() => {
                  setEditingAccount(true);
                  setNewEmail(user?.email || '');
                }}
              >
                ✏️ Modifica Credenziali
              </button>
            )}
          </div>

          {!editingAccount ? (
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
                <span className="info-value" style={{ fontSize: '0.9em', color: '#64748b' }}>
                  {user?.uid}
                </span>
              </div>
            </div>
          ) : (
            <div className="account-edit-form">
              <div className="edit-section">
                <h4 className="edit-section-title">📧 Modifica Email</h4>
                <Input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Nuova email"
                />
                <Button 
                  onClick={handleUpdateEmail} 
                  variant="primary" 
                  size="small"
                  disabled={isUpdating || !newEmail || newEmail === user?.email}
                >
                  {isUpdating ? '⏳ Aggiornamento...' : '✓ Aggiorna Email'}
                </Button>
              </div>

              <div className="edit-section">
                <h4 className="edit-section-title">🔒 Modifica Password</h4>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nuova password (min. 6 caratteri)"
                />
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Conferma nuova password"
                />
                <Button 
                  onClick={handleUpdatePassword} 
                  variant="primary" 
                  size="small"
                  disabled={isUpdating || !newPassword || !confirmPassword}
                >
                  {isUpdating ? '⏳ Aggiornamento...' : '✓ Aggiorna Password'}
                </Button>
              </div>

              <div className="edit-section password-confirmation">
                <h4 className="edit-section-title">🔐 Conferma Identità</h4>
                <p className="security-notice">
                  Per motivi di sicurezza, inserisci la tua password attuale per confermare le modifiche.
                </p>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Password attuale"
                />
              </div>

              <div className="edit-actions-bottom">
                <Button 
                  onClick={handleCancelEdit} 
                  variant="tertiary" 
                  disabled={isUpdating}
                >
                  ✕ Annulla
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="profile-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
      </div>
    </div>
  );
}
