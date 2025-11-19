import { useState, useEffect, useRef, useCallback } from "react";
import { Stage, Layer, Line } from "react-konva";
import throttle from "lodash.throttle";
import { db } from "./firebase";
import { ref, set, push, onValue, remove } from "firebase/database";
import "./App.css";

const WORDS = [
  "gatto", "casa", "albero", "sole", "mare", "montagna", "fiore", "macchina",
  "telefono", "computer", "pizza", "gelato", "bicicletta", "aereo", "nave",
  "libro", "penna", "orologio", "scarpa", "cappello", "ombrello", "chitarra",
  "pianoforte", "pallone", "stella", "luna", "nuvola", "pioggia", "neve"
];

const TURN_DURATION = 60;

export default function Board({ roomId, nickname }) {
  const [lines, setLines] = useState([]);
  const [players, setPlayers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [gameState, setGameState] = useState(null);
  const [inputMessage, setInputMessage] = useState("");
  const [timeLeft, setTimeLeft] = useState(TURN_DURATION);
  
  const isDrawing = useRef(false);
  const currentLine = useRef(null);
  const playerRefRef = useRef(null);
  const sendTempLine = useRef(null);
  const messagesEndRef = useRef(null);
  const timerRef = useRef(null);
  const lineIdCounter = useRef(0);

  const isArtist = gameState?.currentArtist === nickname;
  const hasGuessed = gameState?.guessedPlayers?.includes(nickname);

  // ------------------------------
  // 🔄 Passa al turno successivo
  // ------------------------------
  const nextTurn = useCallback(async () => {
    // 1️⃣ Disattiva temporaneamente il gioco per bloccare i listener
    await set(ref(db, `rooms/${roomId}/game/active`), false);
    
    // 2️⃣ Pulisci tutto dal database
    await Promise.all([
      remove(ref(db, `rooms/${roomId}/lines`)),
      remove(ref(db, `rooms/${roomId}/lines_temp`))
    ]);
    
    // 3️⃣ Pulisci lo stato locale
    setLines([]);
    
    // 4️⃣ Piccolo delay per assicurarsi che tutti i client abbiano ricevuto l'aggiornamento
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // 5️⃣ Avvia il nuovo turno
    const currentIndex = players.findIndex(p => p.name === gameState?.currentArtist);
    const nextIndex = (currentIndex + 1) % players.length;
    const nextArtist = players[nextIndex]?.name;
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];

    await set(ref(db, `rooms/${roomId}/game`), {
      active: true,
      currentArtist: nextArtist,
      word,
      turnStartedAt: Date.now(),
      guessedPlayers: [],
      round: (gameState?.round || 1) + 1
    });
  }, [roomId, players, gameState?.currentArtist, gameState?.round]);

  // ------------------------------
  // ⏭️ Fine turno manuale (tutti hanno indovinato)
  // ------------------------------
  const endTurnManually = useCallback(async () => {
    await push(ref(db, `rooms/${roomId}/chat`), {
      user: "Sistema",
      message: `🎉 Tutti hanno indovinato! La parola era: ${gameState?.word}`,
      timestamp: Date.now(),
      isSystem: true
    });

    setTimeout(() => nextTurn(), 2000);
  }, [roomId, gameState?.word, nextTurn]);

  // ------------------------------
  // ⏭️ Fine turno automatica (timeout)
  // ------------------------------
  const endTurnAutomatically = useCallback(async () => {
    await push(ref(db, `rooms/${roomId}/chat`), {
      user: "Sistema",
      message: `⏰ Tempo scaduto! La parola era: ${gameState?.word}`,
      timestamp: Date.now(),
      isSystem: true
    });

    setTimeout(() => nextTurn(), 3000);
  }, [roomId, gameState?.word, nextTurn]);

  // ------------------------------
  // 👤 Aggiungi giocatore
  // ------------------------------
  useEffect(() => {
    const addPlayer = async () => {
      const newRef = push(ref(db, `rooms/${roomId}/players`));
      await set(newRef, { name: nickname, joinedAt: Date.now(), score: 0 });
      playerRefRef.current = newRef;
    };
    addPlayer();

    return () => {
      if (playerRefRef.current) remove(playerRefRef.current);
      remove(ref(db, `rooms/${roomId}/lines_temp/${nickname}`));
    };
  }, [roomId, nickname]);

  // ------------------------------
  // 🔁 Throttle linee temp
  // ------------------------------
  useEffect(() => {
    sendTempLine.current = throttle(async (line) => {
      await set(ref(db, `rooms/${roomId}/lines_temp/${nickname}`), {
        ...line,
        updatedAt: Date.now(),
      });
    }, 150);

    return () => {
      if (sendTempLine.current?.cancel) sendTempLine.current.cancel();
      remove(ref(db, `rooms/${roomId}/lines_temp/${nickname}`));
    };
  }, [roomId, nickname]);

  // ------------------------------
  // 👥 Lista giocatori
  // ------------------------------
  useEffect(() => {
    const playersRef = ref(db, `rooms/${roomId}/players`);
    const unsubscribe = onValue(playersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const online = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => (b.score || 0) - (a.score || 0));
      setPlayers(online);
    });
    return unsubscribe;
  }, [roomId]);

  // ------------------------------
  // 🎮 Stato del gioco
  // ------------------------------
  useEffect(() => {
    const gameRef = ref(db, `rooms/${roomId}/game`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      const data = snapshot.val();
      setGameState(data);
      if (data?.turnStartedAt) {
        const elapsed = Math.floor((Date.now() - data.turnStartedAt) / 1000);
        setTimeLeft(Math.max(0, TURN_DURATION - elapsed));
      }
    });
    return unsubscribe;
  }, [roomId]);

  // ------------------------------
  // ⏱️ Timer
  // ------------------------------
  useEffect(() => {
    // Pulisci timer precedente
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (!gameState?.active) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          timerRef.current = null;
          endTurnAutomatically();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [gameState?.active, gameState?.round, endTurnAutomatically]);

  // ------------------------------
  // 💬 Messaggi chat
  // ------------------------------
  useEffect(() => {
    const chatRef = ref(db, `rooms/${roomId}/chat`);
    const unsubscribe = onValue(chatRef, (snapshot) => {
      const data = snapshot.val() || {};
      const msgs = Object.entries(data)
        .map(([id, value]) => ({ id, ...value }))
        .sort((a, b) => a.timestamp - b.timestamp);
      setMessages(msgs);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    });
    return unsubscribe;
  }, [roomId]);

  // ------------------------------
  // ✏️ Linee definitive
  // ------------------------------
  useEffect(() => {
    const linesRef = ref(db, `rooms/${roomId}/lines`);
    const unsubscribe = onValue(linesRef, (snapshot) => {
      // 🔒 Non aggiornare le linee se il gioco non è attivo
      if (!gameState?.active) {
        setLines([]);
        return;
      }
      
      const data = snapshot.val() || {};
      const saved = Object.entries(data).map(([firebaseKey, value]) => ({ 
        ...value, 
        id: firebaseKey,
        temp: false 
      }));
      setLines((prev) => {
        const tempLines = prev.filter((l) => l.temp);
        return [...saved, ...tempLines];
      });
    });
    return unsubscribe;
  }, [roomId, gameState?.active]);

  // ------------------------------
  // ✏️ Linee temporanee
  // ------------------------------
  useEffect(() => {
    const tempRef = ref(db, `rooms/${roomId}/lines_temp`);
    const unsubscribe = onValue(tempRef, (snapshot) => {
      // 🔒 Non aggiornare le linee se il gioco non è attivo
      if (!gameState?.active) {
        return;
      }
      
      const data = snapshot.val() || {};
      const otherTemp = Object.entries(data)
        .filter(([user]) => user !== nickname)
        .map(([user, value]) => ({ 
          ...value, 
          id: `temp-${user}-${value.updatedAt || Date.now()}`,
          temp: true 
        }));
      setLines((prev) => {
        const myTemp = prev.filter((l) => l.temp && l.user === nickname);
        const saved = prev.filter((l) => !l.temp);
        return [...saved, ...myTemp, ...otherTemp];
      });
    });
    return unsubscribe;
  }, [roomId, nickname, gameState?.active]);

  // ------------------------------
  // 🎲 Inizia gioco
  // ------------------------------
  const startGame = async () => {
    const firstArtist = players[0]?.name;
    const word = WORDS[Math.floor(Math.random() * WORDS.length)];
    
    await set(ref(db, `rooms/${roomId}/game`), {
      active: true,
      currentArtist: firstArtist,
      word,
      turnStartedAt: Date.now(),
      guessedPlayers: [],
      round: 1
    });

    await Promise.all([
      remove(ref(db, `rooms/${roomId}/lines`)),
      remove(ref(db, `rooms/${roomId}/lines_temp`)),
      set(ref(db, `rooms/${roomId}/chat`), null)
    ]);
    setLines([]);
  };

  // ------------------------------
  // 💾 Salva linea
  // ------------------------------
  const saveLine = async (line) => {
    const lineRef = push(ref(db, `rooms/${roomId}/lines`));
    await set(lineRef, { ...line, createdAt: Date.now() });
  };

  // ------------------------------
  // 🧹 Pulisci lavagna (manuale)
  // ------------------------------
  const clearBoard = async () => {
    await Promise.all([
      remove(ref(db, `rooms/${roomId}/lines`)),
      remove(ref(db, `rooms/${roomId}/lines_temp`)),
    ]);
    setLines([]);
  };

  // ------------------------------
  // 🎨 Eventi mouse
  // ------------------------------
  const handleMouseDown = (e) => {
    if (!isArtist || !gameState?.active) return;
    
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    lineIdCounter.current += 1;
    currentLine.current = { 
      id: `${nickname}-${Date.now()}-${lineIdCounter.current}`,
      points: [pos.x, pos.y], 
      user: nickname,
      temp: true
    };
    setLines((prev) => [...prev, currentLine.current]);
    if (sendTempLine.current) sendTempLine.current(currentLine.current);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current || !isArtist) return;
    const pos = e.target.getStage().getPointerPosition();
    currentLine.current.points = [...currentLine.current.points, pos.x, pos.y];
    setLines((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = currentLine.current;
      return updated;
    });
    if (sendTempLine.current) sendTempLine.current(currentLine.current);
  };

  const handleMouseUp = async () => {
    if (!isDrawing.current) return;
    isDrawing.current = false;
    if (currentLine.current) {
      await saveLine(currentLine.current);
      await remove(ref(db, `rooms/${roomId}/lines_temp/${nickname}`));
      currentLine.current = null;
    }
  };

  // ------------------------------
  // 💬 Invia messaggio/indovina
  // ------------------------------
  const sendMessage = useCallback(async () => {
    if (!inputMessage.trim() || !gameState?.active) return;

    const msg = inputMessage.trim().toLowerCase();
    const correctWord = gameState?.word?.toLowerCase();

    // 🎯 Controllo risposta
    if (!isArtist && !hasGuessed && msg === correctWord) {
      const pointsEarned = 100;
      const playerRef = players.find(p => p.name === nickname);
      
      if (playerRef) {
        await set(ref(db, `rooms/${roomId}/players/${playerRef.id}/score`), 
          (playerRef.score || 0) + pointsEarned
        );
      }

      const updatedGuessedPlayers = [...(gameState.guessedPlayers || []), nickname];
      
      await set(ref(db, `rooms/${roomId}/game/guessedPlayers`), updatedGuessedPlayers);

      await push(ref(db, `rooms/${roomId}/chat`), {
        user: "Sistema",
        message: `🎉 ${nickname} ha indovinato! (+${pointsEarned} punti)`,
        timestamp: Date.now(),
        isSystem: true
      });

      setInputMessage("");

      // Se tutti hanno indovinato, passa al turno successivo
      const totalPlayers = players.length;
      const artistCount = 1;
      const guessedCount = updatedGuessedPlayers.length;
      
      if (guessedCount >= totalPlayers - artistCount) {
        // Ferma il timer
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        
        setTimeout(() => endTurnManually(), 1000);
      }
    } else {
      // Messaggio normale
      await push(ref(db, `rooms/${roomId}/chat`), {
        user: nickname,
        message: inputMessage,
        timestamp: Date.now(),
        isSystem: false
      });
      setInputMessage("");
    }
  }, [inputMessage, gameState, isArtist, hasGuessed, players, nickname, roomId, endTurnManually]);

  return (
    <div className="board-container">
      {/* Sidebar Sinistra - Giocatori */}
      <aside className="players-sidebar">
        <div className="sidebar-header">
          <h3>👥 Giocatori</h3>
          <span className="players-badge">{players.length}</span>
        </div>
        
        <ul className="players-list">
          {players.map((p) => (
            <li 
              key={p.id} 
              className={p.name === nickname ? 'player-current' : ''}
              style={{
                border: p.name === gameState?.currentArtist ? '2px solid #22c55e' : 'none',
                background: p.name === gameState?.currentArtist ? '#dcfce7' : undefined
              }}
            >
              <div className="player-avatar">
                {p.name === gameState?.currentArtist ? '🎨' : p.name.charAt(0).toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div className="player-name">{p.name}</div>
                <div style={{ fontSize: 11, color: '#64748b' }}>{p.score || 0} punti</div>
              </div>
              {p.name === nickname && <span className="you-tag">Tu</span>}
              {gameState?.guessedPlayers?.includes(p.name) && <span style={{ fontSize: 18 }}>✅</span>}
            </li>
          ))}
        </ul>

        <div className="share-box">
          <label>🔗 Invita amici</label>
          <input
            value={`${window.location.origin}/room/${roomId}`}
            readOnly
            onClick={(e) => e.target.select()}
          />
        </div>
      </aside>

      {/* Main Area - Canvas */}
      <main className="board-main">
        <header className="board-header">
          <div className="room-info">
            <div>
              <div className="room-label">Stanza</div>
              <div className="room-code">{roomId}</div>
            </div>
            
            {gameState?.active && (
              <div style={{ marginLeft: 40 }}>
                <div className="room-label">
                  {isArtist ? '🎨 Stai disegnando' : hasGuessed ? '✅ Hai indovinato!' : '🤔 Indovina la parola'}
                </div>
                <div style={{ fontSize: 20, fontWeight: 700, color: isArtist ? '#22c55e' : '#6366f1' }}>
                  {isArtist ? gameState.word : '_ '.repeat(gameState.word?.length || 0)}
                </div>
              </div>
            )}
          </div>

          <div className="header-actions">
            {gameState?.active && (
              <div style={{ 
                fontSize: 24, 
                fontWeight: 700, 
                color: timeLeft < 10 ? '#ef4444' : '#6366f1',
                background: timeLeft < 10 ? '#fee2e2' : '#eef2ff',
                padding: '8px 16px',
                borderRadius: 8
              }}>
                ⏱️ {timeLeft}s
              </div>
            )}
            
            {!gameState?.active && players.length >= 2 && (
              <button onClick={startGame} className="btn-start">
                🎮 Inizia Partita
              </button>
            )}
            
            {isArtist && gameState?.active && (
              <button onClick={clearBoard} className="btn-clear">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
                Pulisci
              </button>
            )}
          </div>
        </header>

        <div className="canvas-wrapper">
          <Stage
            width={900}
            height={600}
            className="canvas-stage"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
            <Layer>
              {lines.map((line, i) => (
                <Line
                  key={line.id || i}
                  points={line.points}
                  stroke={line.temp ? "#cbd5e1" : "#1e293b"}
                  strokeWidth={3}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                />
              ))}
            </Layer>
          </Stage>
        </div>
      </main>

      {/* Sidebar Destra - Chat */}
      <aside className="chat-sidebar">
        <div className="sidebar-header">
          <h3>💬 Chat</h3>
        </div>

        <div className="chat-messages">
          {messages.map((msg) => (
            <div 
              key={msg.id} 
              className={msg.isSystem ? 'chat-message system' : 'chat-message'}
            >
              {!msg.isSystem && (
                <div className="chat-user">{msg.user}</div>
              )}
              <div className="chat-text">{msg.message}</div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="chat-input">
          <input
            type="text"
            placeholder={hasGuessed ? "Hai già indovinato!" : "Scrivi la tua risposta..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
            disabled={!gameState?.active || isArtist || hasGuessed}
          />
          <button 
            onClick={sendMessage}
            disabled={!gameState?.active || isArtist || hasGuessed}
          >
            ➤
          </button>
        </div>
      </aside>
    </div>
  );
}
