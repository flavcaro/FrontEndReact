import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";
import Lobby from "./components/Lobby/Lobby";
import Board from "./components/Game/Board";
import Loading from "./components/common/Loading";
import ErrorBoundary from "./components/common/ErrorBoundary";
import "./App.css";

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    let nick = query.get("nick");

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

  if (!isReady || !nickname) return <Loading message="Entrando nella stanza..." />;

  return <Board roomId={roomId.toUpperCase()} nickname={nickname} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
