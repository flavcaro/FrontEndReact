import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { useUserData } from "../../hooks/useUserData";
import Button from "../common/Button";
import Input from "../common/Input";
import { generateRoomCode, validateNickname, extractRoomCode } from "../../utils/roomUtils";
import { ref, get, onValue, set } from "firebase/database";
import { db } from "../../firebase";
import { generateUniqueNickname } from "../../utils/nicknameUtils";
import { CLASSICA } from "../../constants/gameModes/classica";
import { SOPRAVVIVENZA } from "../../constants/gameModes/sopravvivenza";
import { CHAOS_TOOLS } from "../../constants/gameModes/chaosTools";
import { PUZZLE_DRAWING } from "../../constants/gameModes/puzzleDrawing";
import classicGif from "../../sprites/classic.gif";

import "../../styles/home.css";
import RoomActions from "./RoomActions";
import CustomCreateForm from "./CustomCreateForm";
import Leaderboard from "./Leaderboard";
import { subscribeLeaderboard } from "../../services/userService";

export default function Home() {
  const navigate = useNavigate();
  const { nickname, setNickname, xpPoints, level, user, isGuest } = useUserData();
  const [joinCode, setJoinCode] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [nickError, setNickError] = useState("");
  const [topFour, setTopFour] = useState([]);
  const [leaderboardCount, setLeaderboardCount] = useState(0);
  const [myPosition, setMyPosition] = useState(null);
  const [loadingLeaderboardPreview, setLoadingLeaderboardPreview] = useState(false);
  const [userStats, setUserStats] = useState(null);
  const [isSavingNick, setIsSavingNick] = useState(false);
  const [savedNick, setSavedNick] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  // preview shows only real leaderboard data from Firebase
  const [modeOptions, setModeOptions] = useState({
    [CLASSICA.id]: { turnDuration: CLASSICA.turnDuration || 60, rounds: 3, difficulty: 'medium' },
    [SOPRAVVIVENZA.id]: { turnDuration: SOPRAVVIVENZA.turnDuration || 30, rounds: 3, difficulty: 'medium' },
    [CHAOS_TOOLS.id]: { turnDuration: CHAOS_TOOLS.turnDuration || 45, rounds: 3, difficulty: 'medium' },
    [PUZZLE_DRAWING.id]: { turnDuration: PUZZLE_DRAWING.turnDuration || 90, rounds: 3, difficulty: 'medium', sections: 3, cycles: 1 }
  });
  const [selectedModeId, setSelectedModeId] = useState(CLASSICA.id);

  const handleQuickCreateRoom = (gameMode) => {
    if (!validateNickname(nickname)) {
      setNickError('Inserisci un nickname valido');
      setShowCustomModal(false);
      setTimeout(() => {
        const input = document.querySelector('.nickname-inputs .lobby-input');
        if (input) input.focus();
      }, 50);
      return;
    }
    const roomId = generateRoomCode();
    localStorage.setItem('nickname', nickname);
    // Persist a richer mode config so RoomPlay can detect survival/chaos before the game starts
    const cfg = {
      id: gameMode.id,
      name: gameMode.name,
      turnDuration: gameMode.turnDuration || 60,
      rounds: 3,
      roundsPerGame: 3,
      difficulty: { id: 'medium', name: 'Media' },
      survivalMode: gameMode.survivalMode || false,
      startingLives: gameMode.startingLives || null,
      hasChaosEffects: gameMode.hasChaosEffects || false
    };
    localStorage.setItem(`room_${roomId}_mode`, JSON.stringify(cfg));
    navigate(`/room/${roomId}/play?nick=${encodeURIComponent(nickname)}`);
  };

  const handleJoinRoom = () => {
    const code = extractRoomCode(joinCode);
    if (!code) {
      alert('Codice stanza non valido');
      return;
    }
    (async () => {
      try {
       // Verifica unicità nickname nella stanza target
        const playersRef = ref(db, `rooms/${code}/players`);
        const snap = await get(playersRef);
        const existing = snap.val() || {};
        const latestList = Object.entries(existing).map(([id, p]) => ({ id, ...p }));
        const unique = generateUniqueNickname(nickname, latestList) || nickname;
        if (unique !== nickname) {
        // Genera nickname univoco se necessario
          setNickname(unique);
          localStorage.setItem('nickname', unique);
        } else {
          localStorage.setItem('nickname', nickname);
        }
      } catch (err) {
        console.warn('Could not verify nickname uniqueness before join', err);
        localStorage.setItem('nickname', nickname);
      }
      navigate(`/room/${code}`);
    })();
  };

  const handleRoomActionsJoin = (roomCode) => {
    (async () => {
      try {
        const playersRef = ref(db, `rooms/${roomCode}/players`);
        const snap = await get(playersRef);
        const existing = snap.val() || {};
        const latestList = Object.entries(existing).map(([id, p]) => ({ id, ...p }));
        const unique = generateUniqueNickname(nickname, latestList) || nickname;
        if (unique !== nickname) {
          setNickname(unique);
          localStorage.setItem('nickname', unique);
        } else {
          localStorage.setItem('nickname', nickname);
        }
      } catch (err) {
        console.warn('Could not verify nickname uniqueness before join via RoomActions', err);
        localStorage.setItem('nickname', nickname);
      }
      navigate(`/room/${roomCode}`);
      setShowCustomModal(false);
    })();
  };

  const handleSaveNickname = async () => {
    const nick = (nickname || '').trim();
    if (!nick) {
      setNickError('Inserisci un nickname valido');
      return;
    }
    try {
      setIsSavingNick(true);
      localStorage.setItem('nickname', nick);
      // if we have an authenticated user (including anonymous), persist to realtime DB under users/{uid}/nickname
      if (user && user.uid) {
        await set(ref(db, `users/${user.uid}/nickname`), nick);
      }
      setNickError('');
      // visual feedback: mark as saved briefly
      setSavedNick(true);
      setTimeout(() => setSavedNick(false), 2500);
    } catch (err) {
      console.warn('Could not save nickname to DB', err);
      setNickError('Errore nel salvataggio');
    } finally {
      setIsSavingNick(false);
    }
  };

  const setModeOption = (modeId, key, value) => {
    setModeOptions(prev => ({ ...prev, [modeId]: { ...prev[modeId], [key]: value } }));
  };

  const handleCreateFromModal = async () => {
    const gameModes = [CLASSICA, SOPRAVVIVENZA, CHAOS_TOOLS, PUZZLE_DRAWING];
    const gameMode = gameModes.find((m) => m.id === selectedModeId) || CLASSICA;
    const opts = { ...(modeOptions[selectedModeId] || {}) };
    const allowedDurations = [60, 45, 30];
    const allowedRounds = [3, 6, 9];
    if (!allowedDurations.includes(opts.turnDuration)) {
      opts.turnDuration = gameMode.turnDuration && allowedDurations.includes(gameMode.turnDuration) ? gameMode.turnDuration : 60;
    }
    if (!allowedRounds.includes(opts.rounds)) {
      opts.rounds = 3;
    }

    const roomId = generateRoomCode();
    localStorage.setItem('nickname', nickname);
    const cfg = {
      id: gameMode.id,
      name: gameMode.name,
      turnDuration: opts.turnDuration,
      rounds: opts.rounds,
      roundsPerGame: opts.rounds,
      difficulty: { id: opts.difficulty || 'medium', name: opts.difficulty === 'easy' ? 'Facile' : opts.difficulty === 'hard' ? 'Difficile' : 'Media' },
      survivalMode: gameMode.survivalMode || false,
      startingLives: gameMode.startingLives || null,
      hasChaosEffects: gameMode.hasChaosEffects || false
    };
    // Aggiungi configurazione sezioni e cicli per Puzzle Drawing solo se rilevante
    if (selectedModeId === 'puzzleDrawing') {
      cfg.puzzleSections = typeof opts.sections !== 'undefined' ? opts.sections : 3;
      cfg.puzzleCycles = typeof opts.cycles !== 'undefined' ? opts.cycles : 1;
    }
    localStorage.setItem(`room_${roomId}_mode`, JSON.stringify(cfg));
    
    // Salva la configurazione in Firebase per tutti i giocatori
    try {
      await set(ref(db, `rooms/${roomId}/config`), cfg);
      console.log('✅ Configurazione salvata in Firebase:', cfg);
    } catch (error) {
      console.error('❌ Errore salvando configurazione in Firebase:', error);
    }
    
    navigate(`/room/${roomId}/play?nick=${encodeURIComponent(nickname)}`);
    setShowCustomModal(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("nickname");
    navigate("/");
  };

  React.useEffect(() => {
    // Allow normal body scroll on Home so mobile can scroll content
    const prev = document.body.style.overflow;
    document.body.style.overflow = prev || 'auto';
    return () => {
      document.body.style.overflow = prev || '';
    };
  }, []);

  // close mobile menu when clicking outside
  React.useEffect(() => {
    if (!showMobileMenu) return;
    const onDoc = () => setShowMobileMenu(false);
    document.addEventListener('click', onDoc);
    return () => document.removeEventListener('click', onDoc);
  }, [showMobileMenu]);

  React.useEffect(() => {
    let mounted = true;
    setLoadingLeaderboardPreview(true);
    const unsub = subscribeLeaderboard(async (list) => {
      if (!mounted) return;
      try {
        // keep a record of how many entries the leaderboard query returned
        setLeaderboardCount(Array.isArray(list) ? list.length : 0);
        const top = list.slice(0,4);
        // enrich top entries with latest users/{uid} data when possible
        const uids = Array.from(new Set(top.map(u => u.uid).filter(Boolean)));
        if (uids.length > 0) {
          const fetches = uids.map(async (uid) => {
            try {
              const snap = await get(ref(db, `users/${uid}`));
              return [uid, snap.val() || null];
            } catch (err) {
              console.warn('Could not fetch user for preview', uid, err);
              return [uid, null];
            }
          });
          const fetched = await Promise.all(fetches);
          const usersMap = Object.fromEntries(fetched);
          const mergedTop = top.map((u) => (u.uid && usersMap[u.uid]) ? { ...u, nickname: usersMap[u.uid].nickname || u.nickname, level: usersMap[u.uid].level || u.level, gamesPlayed: usersMap[u.uid].gamesPlayed || u.gamesPlayed } : u);
          setTopFour(mergedTop);
        } else {
          setTopFour(top);
        }
        // determine current user's position by uid or nickname
        const currentId = user && user.uid ? user.uid : null;
        const foundByUid = currentId ? list.findIndex(u => u.uid === currentId) : -1;
        let found = foundByUid;
        if (found === -1 && nickname) {
          found = list.findIndex(u => (u.email === nickname) || (u.displayName === nickname) || (u.nickname === nickname));
        }
        setMyPosition(found >= 0 ? found + 1 : null);
      } catch (err) {
        console.warn('Error enriching top preview', err);
        setTopFour((Array.isArray(list) ? list.slice(0,4) : []));
      } finally {
        setLoadingLeaderboardPreview(false);
      }
    }, 1000, 'totalScore');
    return () => { mounted = false; if (typeof unsub === 'function') unsub(); };
  }, [user, nickname]);

  React.useEffect(() => {
    if (!user || !user.uid) return;
    const uRef = ref(db, `users/${user.uid}`);
    const unsub = onValue(uRef, (snap) => {
      setUserStats(snap.val() || null);
    }, (err) => {
      console.warn('Could not subscribe to user stats', err);
    });
    return () => { if (typeof unsub === 'function') unsub(); };
  }, [user]);

  // Open profile modal: try to fetch full user record if uid present
  const openUserProfile = async (u) => {
    setProfileData(null);
    setShowProfileModal(true);
    if (!u) return;
    if (u.uid) {
      try {
        setProfileLoading(true);
        const snap = await get(ref(db, `users/${u.uid}`));
        const data = snap.val() || {};
        setProfileData({ ...u, ...data });
      } catch (err) {
        console.warn('Could not fetch user profile', err);
        setProfileData(u);
      } finally {
        setProfileLoading(false);
      }
    } else {
      // use available data from leaderboard entry
      setProfileData(u);
    }
  };

  return (
    <div className="home" style={{ minHeight: '100vh' }}>
      <header className="home-header">
        <div className="logo">
          <img src={classicGif} alt="SketchUp" className="logo-icon" style={{ width: '40px', height: '40px', imageRendering: 'pixelated' }} />
          <span className="logo-text">SketchUp</span>
        </div>
        {/* Mobile compact nickname+XP badge shown top-left on small screens */}
        <div className="mobile-nickname-badge" aria-hidden={nickname ? 'false' : 'true'}>
          <span className="mobile-nick-text">{nickname || (isGuest ? 'Ospite' : '')}</span>
          <span className="mobile-nick-xp">⭐ {xpPoints || 0}</span>
        </div>
        {/* Mobile hamburger - visible only on small screens via CSS */}
        <button className="mobile-hamburger" onClick={(e) => { e.stopPropagation(); setShowMobileMenu(s => !s); }} aria-label="Menu">☰</button>
        {showMobileMenu && (
          <>
            <div className="mobile-menu-backdrop" onClick={() => setShowMobileMenu(false)} />
            <div className="mobile-menu" onClick={(e) => e.stopPropagation()}>
              <ul>
                {user && !isGuest && (
                  <li><button onClick={() => { navigate('/profile'); setShowMobileMenu(false); }}><span className="menu-icon">👤</span> Profilo</button></li>
                )}
                <li><button onClick={() => { setShowLeaderboard(true); setShowMobileMenu(false); }}><span className="menu-icon">🏆</span> Classifica</button></li>
                <li><button onClick={() => { handleLogout(); setShowMobileMenu(false); }}><span className="menu-icon">🚪</span> Logout</button></li>
              </ul>
            </div>
          </>
        )}
        {user && (
            <div className="header-right">
            <div className="user-stats-header">
              <span className="level-badge">🏆 Lv.{level}</span>
              <span className="xp-badge">⭐ {xpPoints} XP</span>
            </div>
            <span className="user-name">{nickname || (user && (user.email ? user.email.split('@')[0] : user.email) )}</span>
            {!isGuest && (
              <button className="header-profile-btn" onClick={() => navigate('/profile')}>
                <span className="btn-ico">👤</span>
                <span className="btn-label">Profilo</span>
              </button>
            )}
            <button className="header-leaderboard-btn" onClick={() => setShowLeaderboard(true)}>
              <span className="btn-ico">🏆</span>
              <span className="btn-label">Classifica</span>
            </button>
            <button className="logout-btn" onClick={handleLogout}>
              <span className="btn-label">Logout</span>
            </button>
          </div>
        )}
      </header>

      {/* HERO SECTION removed - replaced by combined top row */}

      {/* COMBINED TOP ROW: HERO | MODES | JOIN+NICKNAME */}
      <section className="home-top-row">
        <div className="home-row-grid">
          {/* Mobile CTA column (rendered as first child so it can be ordered on mobile) */}
          <div className="mobile-cta-column">
            <div className="mobile-create-btn-wrapper">
              <Button onClick={() => setShowCustomModal(true)} className="mobile-create-btn">
                🎨 Crea stanza personalizzata
              </Button>
            </div>
          </div>
          <div className="hero-column">
            <div className="hero-text-side">
              <div className="hero-illustration">
                <img src={classicGif} alt="SketchUp" className="main-emoji" style={{ width: '120px', height: '120px', imageRendering: 'pixelated' }} />
                <div className="floating-elements">
                  <div className="float-1">🖌️</div>
                  <div className="float-2">✏️</div>
                  <div className="float-3">🎯</div>
                  <div className="float-4">🏆</div>
                </div>
              </div>
              <div className="hero-content">
                <h2>SketchUp</h2>
                <h3>Disegna in tutte le salse!</h3>
              </div>
              <div className="hero-create-inline">
                <Button onClick={() => setShowCustomModal(true)} className="create-btn inline-create-btn">
                  🎨 Crea stanza personalizzata
                </Button>
              </div>
            </div>
          </div>

          <div className="modes-column">
            <div className="quick-create-section">
              <h2 className="quick-create-title">🎮 Scegli la tua modalità</h2>
              <h2 className="quick-create-subtitle">Clicca su una modalità per creare una stanza!</h2>
              <div className="quick-buttons-grid">
                {[CLASSICA, SOPRAVVIVENZA, CHAOS_TOOLS, PUZZLE_DRAWING].map((mode) => {
                  const rawDiff = (modeOptions && modeOptions[mode.id] && modeOptions[mode.id].difficulty) || 'medium';
                  const diffLabel = rawDiff === 'easy' ? 'Facile' : rawDiff === 'hard' ? 'Difficile' : 'Media';
                  return (
                    <div key={mode.id} className="quick-button-card" onClick={() => handleQuickCreateRoom(mode)}>
                      <div className="quick-button-icon">
                        {mode.sprite ? (
                          <img 
                            src={mode.sprite} 
                            alt={mode.name}
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: 'contain',
                              imageRendering: 'pixelated'
                            }}
                          />
                        ) : (
                          mode.icon
                        )}
                      </div>
                      <div className="quick-button-content">
                        <h3>{mode.name}</h3>
                        <p>
                          {mode.turnDuration || 60} secondi
                          {mode.id !== 'puzzleDrawing' && ' • 3 round'}
                        </p>
                        <div className="mode-difficulty">Difficoltà: {diffLabel}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="join-column">
            <div className="join-card compact-join">
              <h3>Unisciti a una stanza esistente</h3>
              <p className="join-subtitle">Hai ricevuto un codice? Inseriscilo qui per giocare con i tuoi amici!</p>
              <div className="join-inputs">
                <Input
                  placeholder="Inserisci codice stanza"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                />
                <Button variant="secondary" size="small" onClick={handleJoinRoom}>🔗 Unisciti</Button>
              </div>
            </div>
          </div>

          {/* Right column: nickname + leaderboard (desktop right-side) */}
          <div className="right-column">
            <div className="nickname-card compact-nick">
              <div className="nickname-header">Il tuo nickname</div>
              <div className="nickname-inputs">
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={15}
                  placeholder="Come vuoi chiamarti?"
                />
                <Button
                  variant="tertiary"
                  size="small"
                  className={`save-nick-btn ${isSavingNick ? 'saving' : ''} ${savedNick ? 'saved' : ''}`}
                  onClick={handleSaveNickname}
                  disabled={isSavingNick}
                >
                  {savedNick ? 'Salvato' : isSavingNick ? 'Salvando...' : 'Salva'}
                </Button>
              </div>
              <div className="save-feedback" aria-live="polite" style={{ textAlign: 'center', marginTop: 8 }}>
                {savedNick ? 'Nickname salvato' : ''}
              </div>
              {isGuest && <div className="guest-badge">Giocando come ospite</div>}
              {nickError && <div className="nickname-error">{nickError}</div>}
              {userStats && (
                <div style={{ marginTop: 8, fontSize: 13, color: '#374151' }}>
                  <span style={{ fontWeight: 700, marginRight: 8 }}>⭐ {userStats.totalScore || 0}</span>
                  <span style={{ color: '#64748b' }}>Best: {userStats.bestScore || 0}</span>
                </div>
              )}
            </div>

            <div className="leaderboard-preview-card compact-leaderboard">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <h3 style={{ margin: 0 }}>Classifica (Top 4)</h3>
                </div>
                  <button className="header-leaderboard-btn preview-vedi-btn" onClick={() => setShowLeaderboard(true)}>Vedi tutto</button>
                </div>
              <div style={{ marginTop: 8 }}>
                {(() => {
                  const display = (topFour && topFour.length > 0) ? topFour.slice(0,4) : [];
                  return (
                    <>
                      {display.length > 0 ? (
                        <ol style={{ paddingLeft: 12, margin: '8px 0', opacity: loadingLeaderboardPreview ? 0.85 : 1 }}>
                          {display.map((u, i) => (
                            <li
                              key={u.uid || i}
                              className="leader-row-btn"
                              tabIndex={0}
                              onClick={() => openUserProfile(u)}
                              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openUserProfile(u); }}
                            >
                              <div className="leader-left">
                                <div className="leader-avatar">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🏅'}</div>
                                <div>
                                  <div className="leader-name">{u.nickname || (u.email ? u.email.split('@')[0] : (u.displayName || (`Utente-${(u.uid||'').slice(0,6)}`)))}</div>
                                  <div className="leader-meta">Lv.{u.level || 1} • {u.gamesPlayed || 0} partite</div>
                                </div>
                              </div>
                              <div className="leader-score">⭐ {u.totalScore || 0}</div>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <div style={{ fontSize: 13, color: '#64748b', minHeight: 40, display: 'flex', alignItems: 'center' }}>Nessun dato disponibile</div>
                      )}
                      {/* If there are more than 4 entries, hint how many additional users exist */}
                      {leaderboardCount > 4 && (
                        <div style={{ marginTop: 6, fontSize: 12, color: '#475569' }}>{`... e altri ${leaderboardCount - 4}`}</div>
                      )}
                      {loadingLeaderboardPreview && (
                        <div className="loading-inline" style={{ marginTop: 6 }}>
                          <div className="small-spinner" aria-hidden="true"></div>
                          <div style={{ fontSize: 12, color: '#64748b' }}>Aggiornamento in tempo reale…</div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
              <div className="your-position" style={{ marginTop: 6, fontSize: 13, color: '#334155' }}>
                La tua posizione: {myPosition ? `#${myPosition}` : '— Fuori top 1000'}
              </div>
            </div>

            {/* PROFILE MODAL for public user info */}
            {showProfileModal && (
              <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
                <div className="modal-content profile-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
                  <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div className="modal-illustration">👤</div>
                      <div>
                        <h2>{profileLoading ? 'Caricamento...' : (profileData?.nickname || profileData?.displayName || 'Profilo Utente')}</h2>
                        <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Info pubbliche</p>
                      </div>
                    </div>
                    <button className="modal-close" onClick={() => setShowProfileModal(false)}>✕</button>
                  </div>
                  <div className="modal-body">
                    {profileLoading ? (
                      <div>Caricamento…</div>
                    ) : (
                      <div style={{ display: 'grid', gap: 12 }}>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <div style={{ width: 72, height: 72, borderRadius: 12, background: '#eef2ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>👤</div>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 18 }}>{profileData?.nickname || profileData?.displayName || (profileData?.email ? profileData.email.split('@')[0] : 'Utente')}</div>
                            <div style={{ color: '#64748b' }}>Lv. {profileData?.level || 1} • ⭐ {profileData?.totalScore || 0}</div>
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: 12, justifyContent: 'space-between' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 800 }}>{profileData?.gamesPlayed || 0}</div>
                            <div style={{ color: '#64748b' }}>Partite</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 800 }}>{profileData?.wins || 0}</div>
                            <div style={{ color: '#64748b' }}>Vittorie</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontWeight: 800 }}>{profileData?.xpPoints || profileData?.xp || 0}</div>
                            <div style={{ color: '#64748b' }}>XP</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* CUSTOM MODAL */}
      {showCustomModal && (
        <div className="modal-overlay" onClick={() => setShowCustomModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="modal-illustration">🎨</div>
                <div>
                  <h2>Crea stanza personalizzata</h2>
                  <p style={{ margin: 0, fontSize: 13, color: '#64748b' }}>Scegli durata, round e difficoltà</p>
                </div>
              </div>
              <button className="modal-close" onClick={() => setShowCustomModal(false)}>✕</button>
            </div>

            <div className="modal-body">
              <CustomCreateForm
                selectedModeId={selectedModeId}
                setSelectedModeId={(id) => {
                  const map = {
                    classica: CLASSICA.id,
                    sopravvivenza: SOPRAVVIVENZA.id,
                    chaos_tools: CHAOS_TOOLS.id,
                    // accept both variants from the form ('puzzleDrawing' and 'puzzle_drawing')
                    puzzle_drawing: PUZZLE_DRAWING.id,
                    puzzleDrawing: PUZZLE_DRAWING.id
                  };
                  const resolved = map[id] || CLASSICA.id;
                  setSelectedModeId(resolved);
                }}
                modeOptions={modeOptions}
                setModeOption={setModeOption}
                onCreate={handleCreateFromModal}
                onCancel={() => setShowCustomModal(false)}
              />
              <hr style={{ border: 'none', borderTop: '1px solid #e6edf3', margin: '12px 0' }} />
              <RoomActions
                onCreateRoom={() => handleQuickCreateRoom(CLASSICA)}
                onJoinRoom={handleRoomActionsJoin}
                showCreate={false}
              />
              {/* We hide the default "Crea Nuova Stanza" button here because the custom form already has a create action */}
            </div>
          </div>
        </div>
      )}

      <Leaderboard show={showLeaderboard} onClose={() => setShowLeaderboard(false)} />

      <div className="bg-elements">
        <div className="bg-shape shape-1"></div>
        <div className="bg-shape shape-2"></div>
        <div className="bg-shape shape-3"></div>
      </div>
    </div>
  );
}
