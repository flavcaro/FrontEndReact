import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth } from "../../firebase";
import { useUserData } from "../../hooks/useUserData";
import Button from "../common/Button";
import Input from "../common/Input";
import { generateRoomCode, validateNickname, extractRoomCode } from "../../utils/roomUtils";
import { CLASSICA } from "../../constants/gameModes/classica";
import { SOPRAVVIVENZA } from "../../constants/gameModes/sopravvivenza";
import { CHAOS_TOOLS } from "../../constants/gameModes/chaosTools";
import { PUZZLE_DRAWING } from "../../constants/gameModes/puzzleDrawing";

import "../../styles/home.css";
import RoomActions from "./RoomActions";
import CustomCreateForm from "./CustomCreateForm";

export default function Home() {
  const navigate = useNavigate();
  const { nickname, setNickname, xpPoints, level, user, isGuest } = useUserData();
  const [joinCode, setJoinCode] = useState("");
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [nickError, setNickError] = useState("");
  const [modeOptions, setModeOptions] = useState({
    [CLASSICA.id]: { turnDuration: CLASSICA.turnDuration || 60, rounds: 3, difficulty: 'medium' },
    [SOPRAVVIVENZA.id]: { turnDuration: SOPRAVVIVENZA.turnDuration || 30, rounds: 3, difficulty: 'medium' },
    [CHAOS_TOOLS.id]: { turnDuration: CHAOS_TOOLS.turnDuration || 45, rounds: 3, difficulty: 'medium' },
    [PUZZLE_DRAWING.id]: { turnDuration: PUZZLE_DRAWING.turnDuration || 90, rounds: 3, difficulty: 'medium' }
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
    localStorage.setItem('nickname', nickname);
    navigate(`/room/${code}`);
  };

  const handleRoomActionsJoin = (roomCode) => {
    localStorage.setItem('nickname', nickname);
    navigate(`/room/${roomCode}`);
    setShowCustomModal(false);
  };

  const setModeOption = (modeId, key, value) => {
    setModeOptions(prev => ({ ...prev, [modeId]: { ...prev[modeId], [key]: value } }));
  };

  const handleCreateFromModal = () => {
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
      difficulty: { id: opts.difficulty || 'medium', name: opts.difficulty === 'easy' ? 'Facile' : opts.difficulty === 'hard' ? 'Difficile' : 'Media' },
      survivalMode: gameMode.survivalMode || false,
      startingLives: gameMode.startingLives || null,
      hasChaosEffects: gameMode.hasChaosEffects || false
    };
    localStorage.setItem(`room_${roomId}_mode`, JSON.stringify(cfg));
    navigate(`/room/${roomId}/play?nick=${encodeURIComponent(nickname)}`);
    setShowCustomModal(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    localStorage.removeItem("nickname");
    navigate("/");
  };

  return (
    <div className="home">
      <header className="home-header">
        <div className="logo">🎨 SketchUp</div>
        {user && (
          <div className="header-right">
            <div className="user-stats-header">
              <span className="level-badge">🏆 Lv.{level}</span>
              <span className="xp-badge">⭐ {xpPoints} XP</span>
            </div>
            <span className="user-name">{user.email}</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        )}
      </header>

      {/* HERO SECTION removed - replaced by combined top row */}

      {/* COMBINED TOP ROW: HERO | MODES | JOIN+NICKNAME */}
      <section className="home-top-row">
        <div className="home-row-grid">
          <div className="hero-column">
            <div className="hero-text-side">
              <div className="hero-illustration">
                <div className="main-emoji">🎨</div>
                <div className="floating-elements">
                  <div className="float-1">🖌️</div>
                  <div className="float-2">✏️</div>
                  <div className="float-3">🎯</div>
                  <div className="float-4">🏆</div>
                </div>
              </div>
              <div className="hero-content">
                <h1>Il gioco di disegno dove indovini le parole</h1>
                <p>Un giocatore disegna, gli altri indovinano. Divertente e creativo!</p>
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
                      <div className="quick-button-icon">{mode.icon}</div>
                      <div className="quick-button-content">
                        <h3>{mode.name}</h3>
                        <p>{mode.turnDuration || 60} secondi • 3 round</p>
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

            <div className="nickname-card compact-nick">
              <div className="nickname-header">Il tuo nickname</div>
              <div className="nickname-inputs">
                <Input
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={15}
                  placeholder="Come vuoi chiamarti?"
                />
                <Button variant="tertiary" size="small" onClick={() => { localStorage.setItem('nickname', nickname); setNickError(''); }}>
                  💾 Salva
                </Button>
              </div>
              {isGuest && <div className="guest-badge">Giocando come ospite</div>}
              {nickError && <div className="nickname-error">{nickError}</div>}
            </div>
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
                    puzzle_drawing: PUZZLE_DRAWING.id,
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
              />
            </div>
          </div>
        </div>
      )}

      <div className="bg-elements">
        <div className="bg-shape shape-1"></div>
        <div className="bg-shape shape-2"></div>
        <div className="bg-shape shape-3"></div>
      </div>
    </div>
  );
}
