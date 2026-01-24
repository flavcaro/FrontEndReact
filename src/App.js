import React, { useState, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
  useParams,
} from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase";
import { ref, get } from "firebase/database";
import Lobby from "./components/Lobby/Lobby";
import Home from "./components/Home/Home";
import Board from "./components/Game/Board";
import PuzzleBoard from "./components/Game/PuzzleBoard";
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
  const [configLoaded, setConfigLoaded] = useState(false); // Flag per evitare loop

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
    if (!user || authLoading || configLoaded) return; // Skip se già caricato!

    const query = new URLSearchParams(window.location.search);
    const nick = query.get("nick");

    if (!nick || nick.trim() === "") {
      alert("⚠️ Nickname mancante!");
      navigate(`/room/${roomId}`, { replace: true });
      return;
    }

    // Leggi la configurazione dal database Firebase
    const loadGameConfig = async () => {
      try {
        const gameRef = ref(db, `rooms/${roomId}/game`);
        const gameSnap = await get(gameRef);
        const gameData = gameSnap.val();

        if (gameData) {
          // Ricostruisci la config dal database
          const configFromDB = {
            id: gameData.gameModeId || 'classica',
            name: gameData.mode || 'Classica',
            difficulty: {
              id: gameData.difficultyId || 'medium',
              name: gameData.difficulty || 'Medio'
            },
            turnDuration: gameData.turnDuration || TURN_DURATION,
            roundsPerGame: gameData.roundsPerPlayer || DEFAULT_ROUNDS,
            survivalMode: gameData.survivalMode || false,
            hasChaosEffects: gameData.hasChaosEffects || false,
            survivalThreshold: gameData.survivalThreshold || null
          };
          console.log('✅ Config caricata da Firebase:', configFromDB);
          setGameConfig(configFromDB);
        } else {
          console.log('⚠️ Nessuna config nel DB, uso fallback');
          // Fallback: prova localStorage o URL
          const storedConfigKey = `room_${roomId}_mode`;
          const storedConfig = localStorage.getItem(storedConfigKey);
          
          if (storedConfig) {
            const config = JSON.parse(storedConfig);
            console.log("📦 Config da localStorage:", config);
            setGameConfig(config);
          } else {
            // Ultimo tentativo: infer from URL
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
                console.log('🔍 Config inferita da URL:', inferred);
                setGameConfig(inferred);
              }
            }
          }
        }
        
        setConfigLoaded(true); // Marca come caricato!
      } catch (error) {
        console.error('❌ Errore caricamento config:', error);
        setConfigLoaded(true); // Anche in caso di errore, non riprovare
      }
    };

    loadGameConfig();
    setNickname(nick);
    setIsReady(true);
  }, [navigate, roomId, user, authLoading, configLoaded]); // Aggiungi configLoaded alle dipendenze

  if (authLoading) return <Loading message="Verificando autenticazione..." />;
  if (!user) return <Loading message="Reindirizzamento..." />;
  if (!isReady || !nickname) return <Loading message="Entrando nella stanza..." />;

  // Determina quale Board renderizzare in base alla modalità
  const isPuzzleMode = gameConfig?.id === 'puzzleDrawing' || gameConfig?.gameModeId === 'puzzleDrawing';

  if (isPuzzleMode) {
    return <PuzzleBoard roomId={roomId.toUpperCase()} nickname={nickname} gameConfig={gameConfig} />;
  }

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
