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

function Home() {
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");

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
      alert("Inserisci un nickname prima di continuare!");
      return;
    }
    const roomId = Math.random().toString(36).substring(2, 8);
    navigate(`/room/${roomId}?nick=${encodeURIComponent(nickname)}`, { replace: true });
  };

  // 🔹 Unisciti a una stanza esistente
  const joinRoom = () => {
    if (!nickname.trim()) {
      alert("Inserisci un nickname prima di continuare!");
      return;
    }
    const input = prompt("Inserisci il codice stanza:");
    if (input)
      navigate(`/room/${input}?nick=${encodeURIComponent(nickname)}`, { replace: true });
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
        onKeyDown={(e) => e.key === "Enter" && createRoom()}
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
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    let nick = query.get("nick");

    // 🔹 Se manca il nickname, chiedilo all’utente
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
