/**
 * ============================================================================
 * App.js - Componente Principale e Routing dell'Applicazione
 * ============================================================================
 * 
 * SCOPO:
 * Questo è il componente root dell'applicazione React. Gestisce:
 * - Routing tra le diverse pagine (Lobby, Home, Profilo, Stanze)
 * - Protezione route con autenticazione
 * - Caricamento configurazione di gioco da Firebase
 * - Error boundary per gestione errori globali
 * 
 * STRUTTURA ROUTE:
 * / → Lobby (login/registrazione)
 * /home → Home (protetta, richiede autenticazione)
 * /profile → Profilo utente (protetta)
 * /room/:roomId → Ingresso stanza (join)
 * /room/:roomId/play → Partita in corso
 * 
 * COMPONENTI WRAPPER:
 * - ProtectedHome: Wrapper con controllo autenticazione per Home
 * - ProtectedProfile: Wrapper con controllo autenticazione per Profilo
 * - RoomEntry: Wrapper per ingresso stanza
 * - RoomPlay: Wrapper per partita con caricamento config
 */

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
import RoomJoin from "./components/Room/RoomJoin";
import Profile from "./components/Profile/Profile";
import Loading from "./components/common/Loading";
import ErrorBoundary from "./components/common/ErrorBoundary";
import "./App.css";
import "./styles/modal-desktop-enhancements.css";
import { GAME_MODES, DEFAULT_DIFFICULTY, DEFAULT_ROUNDS, TURN_DURATION } from './constants/gameConfig';

// ============================================================================
// COMPONENTE: PROTECTED HOME
// ============================================================================
/**
 * Wrapper protetto per la schermata Home.
 * Verifica che l'utente sia autenticato prima di mostrare la Home.
 * Se non autenticato, reindirizza alla Lobby (/).
 * 
 * FLUSSO:
 * 1. Ascolta lo stato di autenticazione con onAuthStateChanged
 * 2. Se utente non autenticato → reindirizza a /
 * 3. Se autenticato → mostra componente Home
 * 4. Durante il caricamento → mostra Loading
 */
function ProtectedHome() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);              // Utente corrente (null se non autenticato)
  const [authLoading, setAuthLoading] = useState(true); // Flag caricamento autenticazione

  // --- EFFECT: CONTROLLO AUTENTICAZIONE ---
  useEffect(() => {
    // onAuthStateChanged è un listener Firebase che si attiva quando lo stato auth cambia
    // (login, logout, refresh token, ecc.)
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        // Utente non autenticato → reindirizza alla lobby
        navigate("/", { replace: true });  // replace: true sostituisce la history (no back button)
      } else {
        // Utente autenticato → salva in stato
        setUser(currentUser);
      }
      setAuthLoading(false);  // Caricamento completato
    });

    // CLEANUP: rimuovi listener quando componente viene smontato
    return unsubscribe;
  }, [navigate]);  // Dipendenza: navigate (stabile, non cambia mai)

  // --- RENDERING CONDIZIONALE ---
  if (authLoading) return <Loading message="Caricamento..." />;
  if (!user) return <Loading message="Reindirizzamento..." />;

  return <Home />;
}

// ============================================================================
// COMPONENTE: PROTECTED PROFILE
// ============================================================================
/**
 * Wrapper protetto per la schermata Profilo.
 * Identico a ProtectedHome ma per il profilo utente.
 * 
 * NOTA: Potrebbe essere refactorizzato in un componente generico
 * ProtectedRoute(Component) per evitare duplicazione.
 */
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

// ============================================================================
// COMPONENTE: ROOM ENTRY
// ============================================================================
/**
 * Wrapper per l'ingresso in una stanza.
 * Estrae il roomId dai parametri URL e lo passa al componente RoomJoin.
 * 
 * URL: /room/:roomId
 * Esempio: /room/ABC123 → roomId = "ABC123"
 */
function RoomEntry() {
  const { roomId } = useParams();  // Estrae roomId dai parametri URL

  // Converti in uppercase per consistenza (i codici stanza sono sempre maiuscoli)
  return <RoomJoin roomId={roomId.toUpperCase()} />;
}

// ============================================================================
// COMPONENTE: ROOM PLAY
// ============================================================================
/**
 * Wrapper per la partita in corso.
 * Gestisce il caricamento della configurazione di gioco da Firebase.
 * 
 * RESPONSABILITÀ:
 * 1. Verifica autenticazione utente
 * 2. Estrae nickname dai query params (?nick=...)
 * 3. Carica configurazione di gioco da Firebase (con fallback)
 * 4. Passa tutto al componente Board
 * 
 * STRATEGIA CARICAMENTO CONFIG:
 * 1. Prova rooms/{roomId}/game (se partita già iniziata)
 * 2. Prova rooms/{roomId}/config (se partita non ancora iniziata)
 * 3. Fallback su localStorage
 * 4. Fallback su URL params
 * 
 * URL: /room/:roomId/play?nick=NomeGiocatore
 */
function RoomPlay() {
  const { roomId } = useParams();                       // ID stanza da URL
  const navigate = useNavigate();
  const [nickname, setNickname] = useState("");         // Nickname giocatore
  const [gameConfig, setGameConfig] = useState(null);   // Configurazione di gioco
  const [user, setUser] = useState(null);               // Utente autenticato
  const [authLoading, setAuthLoading] = useState(true); // Flag caricamento auth
  const [configLoaded, setConfigLoaded] = useState(false); // Flag per evitare loop di caricamento

  // --- EFFECT 1: CONTROLLO AUTENTICAZIONE ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        // Sessione scaduta → reindirizza a ingresso stanza
        alert("⚠️ Sessione scaduta! Devi rifare l'accesso.");
        navigate(`/room/${roomId}`, { replace: true });
      } else {
        setUser(currentUser);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, [navigate, roomId]);

  // --- EFFECT 2: CARICAMENTO NICKNAME E CONFIG ---
  useEffect(() => {
    // Skip se: utente non caricato, auth in caricamento, o config già caricata
    if (!user || authLoading || configLoaded) return;

    // --- ESTRAZIONE NICKNAME DA URL ---
    const query = new URLSearchParams(window.location.search);
    const nick = query.get("nick");  // Leggi parametro ?nick=...

    if (!nick || nick.trim() === "") {
      // Nickname mancante → reindirizza a ingresso stanza
      alert("⚠️ Nickname mancante!");
      navigate(`/room/${roomId}`, { replace: true });
      return;
    }

    // --- FUNZIONE: CARICA CONFIGURAZIONE DI GIOCO ---
    const loadGameConfig = async () => {
      try {
        // STRATEGIA 1: Leggi da rooms/{roomId}/game (se partita già iniziata)
        const gameRef = ref(db, `rooms/${roomId}/game`);
        const gameSnap = await get(gameRef);
        const gameData = gameSnap.val();

        if (gameData) {
          // Partita già iniziata → ricostruisci config dai dati di gioco
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
            survivalThreshold: gameData.survivalThreshold || null,
            // Configurazione specifica per Puzzle Drawing
            puzzleSections: gameData.puzzleSections,
            puzzleCycles: gameData.puzzleCycles
          };
          console.log('✅ Config caricata da Firebase (game):', configFromDB);
          setGameConfig(configFromDB);
        } else {
          // STRATEGIA 2: Leggi da rooms/{roomId}/config (partita non ancora iniziata)
          const configRef = ref(db, `rooms/${roomId}/config`);
          const configSnap = await get(configRef);
          const configData = configSnap.val();

          if (configData) {
            console.log('✅ Config caricata da Firebase (config):', configData);
            setGameConfig(configData);
          } else {
            console.log('⚠️ Nessuna config nel DB, uso fallback');

            // STRATEGIA 3: Fallback su localStorage
            const storedConfigKey = `room_${roomId}_mode`;
            const storedConfig = localStorage.getItem(storedConfigKey);

            if (storedConfig) {
              const config = JSON.parse(storedConfig);
              console.log("📦 Config da localStorage:", config);
              setGameConfig(config);
            } else {
              // STRATEGIA 4: Ultimo tentativo - inferisci da URL params
              const modeParam = query.get('mode');
              if (modeParam) {
                // Cerca la modalità corrispondente in GAME_MODES
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
        }

        // Marca come caricato per evitare loop
        setConfigLoaded(true);
      } catch (error) {
        console.error('❌ Errore caricamento config:', error);
        setConfigLoaded(true); // Anche in caso di errore, non riprovare
      }
    };

    loadGameConfig();
    setNickname(nick);
  }, [navigate, roomId, user, authLoading, configLoaded]);

  // --- RENDERING ---
  // Passa roomId (uppercase), nickname e gameConfig al componente Board
  return <Board roomId={roomId.toUpperCase()} nickname={nickname} gameConfig={gameConfig} />;
}

// ============================================================================
// COMPONENTE PRINCIPALE: APP
// ============================================================================
/**
 * Componente root dell'applicazione.
 * Configura il routing e avvolge tutto in ErrorBoundary per gestione errori.
 * 
 * ROUTE DEFINITE:
 * / → Lobby (login/registrazione)
 * /home → Home (protetta)
 * /profile → Profilo (protetto)
 * /room/:roomId → Ingresso stanza
 * /room/:roomId/play → Partita in corso
 * 
 * ERROR BOUNDARY:
 * Cattura errori React e mostra una schermata di errore invece di crashare l'app.
 */
export default function App() {
  return (
    <ErrorBoundary>
      <Router>
        <Routes>
          {/* Route pubblica: Lobby */}
          <Route path="/" element={<Lobby />} />

          {/* Route protette: richiedono autenticazione */}
          <Route path="/home" element={<ProtectedHome />} />
          <Route path="/profile" element={<ProtectedProfile />} />

          {/* Route stanze */}
          <Route path="/room/:roomId" element={<RoomEntry />} />
          <Route path="/room/:roomId/play" element={<RoomPlay />} />
        </Routes>
      </Router>
    </ErrorBoundary>
  );
}
