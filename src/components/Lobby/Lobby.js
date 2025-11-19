import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../common/Button";
import Input from "../common/Input";
import { generateRoomCode, validateNickname, validateRoomCode } from "../../utils/roomUtils";
import "./Lobby.css";

export default function Lobby() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [showJoinInput, setShowJoinInput] = useState(false);

  useEffect(() => {
    const savedNick = localStorage.getItem("nickname");
    if (savedNick) setNickname(savedNick);
  }, []);

  useEffect(() => {
    if (nickname.trim()) localStorage.setItem("nickname", nickname);
  }, [nickname]);

  const createRoom = () => {
    if (!validateNickname(nickname)) {
      alert("⚠️ Inserisci un nickname prima di continuare!");
      return;
    }
    const roomId = generateRoomCode();
    navigate(`/room/${roomId}?nick=${encodeURIComponent(nickname)}`, { replace: true });
  };

  const joinRoom = () => {
    if (!validateNickname(nickname)) {
      alert("⚠️ Inserisci un nickname prima di continuare!");
      return;
    }
    if (!validateRoomCode(roomCode)) {
      alert("⚠️ Inserisci il codice della stanza!");
      return;
    }
    navigate(`/room/${roomCode.toUpperCase()}?nick=${encodeURIComponent(nickname)}`, { replace: true });
  };

  return (
    <div className="lobby-container">
      <div className="lobby-card">
        <div className="lobby-header">
          <div className="logo">🎨</div>
          <h1>SketchGuess</h1>
          <p>Disegna, indovina, divertiti con gli amici!</p>
        </div>

        <Input
          label="👤 Il tuo nickname"
          placeholder="Inserisci il tuo nome..."
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && createRoom()}
          maxLength={15}
        />

        <div className="lobby-actions">
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
                placeholder="Codice stanza (es. ABC123)"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && joinRoom()}
                maxLength={6}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <Button onClick={joinRoom} variant="primary" size="small">
                  Entra
                </Button>
                <Button 
                  onClick={() => {
                    setShowJoinInput(false);
                    setRoomCode("");
                  }}
                  variant="tertiary"
                  size="small"
                >
                  Annulla
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="lobby-footer">
          <div className="info-box">
            <span className="info-icon">ℹ️</span>
            <span className="info-text">
              Crea una stanza per ottenere un codice da condividere con i tuoi amici!
            </span>
          </div>
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