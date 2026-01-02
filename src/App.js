import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import Lobby from "./components/Lobby/Lobby";
import Home from "./components/Home/Home";
import Board from "./components/Game/Board";
import Loading from "./components/common/Loading";
import ErrorBoundary from "./components/common/ErrorBoundary";
import "./App.css";

function ProtectedHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        navigate("/", { replace: true });
      } else {
        setUser(currentUser);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, [navigate]);

  if (authLoading) return <Loading message="Verificando autenticazione..." />;
  if (!user) return <Loading message="Reindirizzamento..." />;

  return <Home />;
}

function Room() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        // Not authenticated, redirect to lobby
        alert("⚠️ Devi essere autenticato per entrare in una stanza!");
        navigate("/", { replace: true });
      } else {
        setUser(currentUser);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, [navigate]);

  useEffect(() => {
    if (!user || authLoading) return;

    const query = new URLSearchParams(window.location.search);
    let nick = query.get("nick");

    if (!nick || nick.trim() === "") {
      const savedNick = localStorage.getItem("nickname");
      if (savedNick) {
        nick = savedNick;
      } else {
        const userNick = prompt("Inserisci il tuo nickname:");
        if (!userNick || userNick.trim() === "") {
          alert("Devi inserire un nickname!");
          navigate("/home", { replace: true });
          return;
        }
        nick = userNick.trim();
      }
      navigate(`/room/${roomId}?nick=${encodeURIComponent(nick)}`, { replace: true });
    }

    setNickname(nick);
    setIsReady(true);
  }, [navigate, roomId, user, authLoading]);

  if (authLoading) return <Loading message="Verificando autenticazione..." />;
  if (!user) return <Loading message="Reindirizzamento..." />;
  if (!isReady || !nickname) return <Loading message="Entrando nella stanza..." />;

  return <Board roomId={roomId.toUpperCase()} nickname={nickname} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/home" element={<ProtectedHome />} />
          <Route path="/room/:roomId" element={<Room />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
