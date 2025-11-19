// App.jsx
import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";
import Board from "./Board";
import "./App.css";

function Home() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  // 🔹 Recupera nickname salvato localmente (se esiste)
  useEffect(() => {
    const savedNick = localStorage.getItem("nickname");
    if (savedNick) setNickname(savedNick);
  }, []);

  // 🔹 Salva automaticamente il nickname quando cambia
  useEffect(() => {
    if (nickname.trim()) localStorage.setItem("nickname", nickname);
  }, [nickname]);

  // 🔹 Crea una nuova stanza
  const createRoom = () => {
    if (!nickname.trim()) {
      alert("⚠️ Inserisci un nickname prima di continuare!");
      return;
    }
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    navigate(`/room/${roomId}?nick=${encodeURIComponent(nickname)}`, { replace: true });
  };

  // 🔹 Unisciti a una stanza esistente
  const joinRoom = () => {
    if (!nickname.trim()) {
      alert("⚠️ Inserisci un nickname prima di continuare!");
      return;
    }
    if (!roomCode.trim()) {
      alert("⚠️ Inserisci il codice della stanza!");
      return;
    }
    navigate(`/room/${roomCode.toUpperCase()}?nick=${encodeURIComponent(nickname)}`, { replace: true });
  };

  return (
    <div className="lobby-container">
      <div className="lobby-card">
        {/* Header */}
        <div className="lobby-header">
          <div className="logo">🎨</div>
          <h1>SketchGuess</h1>
          <p>Disegna, indovina, divertiti con gli amici!</p>
        </div>

        {/* Nickname Input */}
        <div className="lobby-section">
          <label className="lobby-label">👤 Il tuo nickname</label>
          <input
            type="text"
            className="lobby-input"
            placeholder="Inserisci il tuo nome..."
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && createRoom()}
            maxLength={15}
          />
        </div>

        {/* Action Buttons */}
        <div className="lobby-actions">
          <button className="lobby-btn primary" onClick={createRoom}>
            <span className="btn-icon">➕</span>
            <span className="btn-text">Crea Nuova Stanza</span>
          </button>

          <div className="divider">
            <span>oppure</span>
          </div>

          {!showJoinInput ? (
            <button 
              className="lobby-btn secondary" 
              onClick={() => setShowJoinInput(true)}
            >
              <span className="btn-icon">🔗</span>
              <span className="btn-text">Unisciti a una Stanza</span>
            </button>
          ) : (
            <div className="join-section">
              <input
                type="text"
                className="lobby-input code-input"
                placeholder="Codice stanza (es. ABC123)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                maxLength={6}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="lobby-btn primary small" onClick={joinRoom}>
                  Entra
                </button>
                <button 
                  className="lobby-btn tertiary small" 
                  onClick={() => {
                    setShowJoinInput(false);
                    setRoomCode("");
                  }}
                >
                  Annulla
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Info */}
        <div className="lobby-footer">
          <div className="info-box">
            <span className="info-icon">ℹ️</span>
            <span className="info-text">
              Crea una stanza per ottenere un codice da condividere con i tuoi amici!
            </span>
          </div>
        </div>
      </div>

      {/* Background Decoration */}
      <div className="lobby-bg-shapes">
        <div className="shape shape-1"></div>
        <div className="shape shape-2"></div>
        <div className="shape shape-3"></div>
      </div>
    </div>
  );
}

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    let nick = query.get("nick");

    // 🔹 Se manca il nickname, chiedilo all'utente
    if (!nick || nick.trim() === "") {
      const userNick = prompt("Inserisci il tuo nickname:");
      if (!userNick || userNick.trim() === "") {
        alert("Devi inserire un nickname!");
        navigate("/", { replace: true });
        return;
      }
      nick = userNick.trim();
      navigate(`/room/${roomId}?nick=${encodeURIComponent(nick)}`, { replace: true });
    }

    setNickname(nick);
    setIsReady(true);
  }, [navigate, roomId]);

  if (!isReady || !nickname) return null;

  return <Board roomId={roomId.toUpperCase()} nickname={nickname} />;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:roomId" element={<Room />} />
      </Routes>
    </Router>
  );
}
