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
import RoomJoin from "./components/Room/RoomJoin";
import Profile from "./components/Profile/Profile";
import Loading from "./components/common/Loading";
import ErrorBoundary from "./components/common/ErrorBoundary";
import "./App.css";
import { GAME_MODES, DEFAULT_DIFFICULTY, DEFAULT_ROUNDS, TURN_DURATION } from './constants/gameConfig';

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

  if (authLoading) return <Loading message="Caricamento..." />;
  if (!user) return <Loading message="Reindirizzamento..." />;

  return <Home />;
}

function ProtectedProfile() {
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

  if (authLoading) return <Loading message="Caricamento profilo..." />;
  if (!user) return <Loading message="Reindirizzamento..." />;

  return <Profile />;
}

function RoomEntry() {
  const { roomId } = useParams();
  return <RoomJoin roomId={roomId.toUpperCase()} />;
}

function RoomPlay() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");
  const [gameConfig, setGameConfig] = useState(null);
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        alert("⚠️ Sessione scaduta! Devi rifare l'accesso.");
        navigate(`/room/${roomId}`, { replace: true });
      } else {
        setUser(currentUser);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, [navigate, roomId]);

  useEffect(() => {
    if (!user || authLoading) return;

    const query = new URLSearchParams(window.location.search);
    const nick = query.get("nick");

    if (!nick || nick.trim() === "") {
      alert("⚠️ Nickname mancante!");
      navigate(`/room/${roomId}`, { replace: true });
      return;
    }

    // Try to get game config from localStorage (for room creator)
    const storedConfigKey = `room_${roomId}_mode`;
    const storedConfig = localStorage.getItem(storedConfigKey);

    if (storedConfig) {
      try {
        const config = JSON.parse(storedConfig);
        console.log("Loaded config from localStorage:", config); // Debug
        setGameConfig(config);
      } catch (e) {
        console.error("Error parsing stored config:", e);
      }
    }

    // If no stored config, try to infer from URL param `mode`
    if (!storedConfig) {
      const modeParam = query.get('mode');
      if (modeParam) {
        const modeObj = Object.values(GAME_MODES).find(m => m.id === modeParam);
        if (modeObj) {
          const inferred = {
            ...modeObj,
            difficulty: DEFAULT_DIFFICULTY,
            roundsPerGame: DEFAULT_ROUNDS,
            turnDuration: modeObj.turnDuration || TURN_DURATION
          };
          console.log('Inferred game config from URL mode param:', inferred);
          setGameConfig(inferred);
        }
      }
    }

    setNickname(nick);
    setIsReady(true);
  }, [navigate, roomId, user, authLoading]);

  if (authLoading) return <Loading message="Verificando autenticazione..." />;
  if (!user) return <Loading message="Reindirizzamento..." />;
  if (!isReady || !nickname) return <Loading message="Entrando nella stanza..." />;

  return <Board roomId={roomId.toUpperCase()} nickname={nickname} gameConfig={gameConfig} />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          <Route path="/" element={<Lobby />} />
          <Route path="/home" element={<ProtectedHome />} />
          <Route path="/profile" element={<ProtectedProfile />} />
          <Route path="/room/:roomId" element={<RoomEntry />} />
          <Route path="/room/:roomId/play" element={<RoomPlay />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
