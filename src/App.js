import React, { useState } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";
import Board from "./Board";

function Home() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");

  const createRoom = () => {
    if (!nickname.trim()) {
      alert("Inserisci un nickname prima di continuare!");
      return;
    }
    const roomId = Math.random().toString(36).substring(2, 8);
    navigate(`/room/${roomId}?nick=${encodeURIComponent(nickname)}`);
  };

  const joinRoom = () => {
    if (!nickname.trim()) {
      alert("Inserisci un nickname prima di continuare!");
      return;
    }
    const input = prompt("Inserisci il codice stanza:");
    if (input) navigate(`/room/${input}?nick=${encodeURIComponent(nickname)}`);
  };

  return (
    <div style={{ textAlign: "center", marginTop: 100 }}>
      <h1>🎨 SketchGuess — Multiplayer Board</h1>
      <p>Condividi una stanza e disegna in tempo reale con altri giocatori!</p>

      <input
        type="text"
        placeholder="Il tuo nickname..."
        value={nickname}
        onChange={(e) => setNickname(e.target.value)}
        style={{
          padding: "10px 15px",
          borderRadius: 6,
          border: "1px solid #ccc",
          marginTop: 20,
          marginBottom: 20,
        }}
      />

      <div>
        <button
          onClick={createRoom}
          style={{
            padding: "10px 20px",
            marginRight: 10,
            borderRadius: 8,
            background: "#4caf50",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          ➕ Crea Stanza
        </button>
        <button
          onClick={joinRoom}
          style={{
            padding: "10px 20px",
            borderRadius: 8,
            background: "#2196f3",
            color: "white",
            border: "none",
            cursor: "pointer",
          }}
        >
          🔗 Unisciti a Stanza
        </button>
      </div>
    </div>
  );
}

function Room() {
  const { roomId } = useParams();
  const query = new URLSearchParams(window.location.search);
  const nickname = query.get("nick") || "Anonimo";
  return <Board roomId={roomId} nickname={nickname} />;
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
