import { useState, useEffect, useRef } from "react";
import { Stage, Layer, Line } from "react-konva";
import throttle from "lodash.throttle";
import { db } from "./firebase";
import { ref, set, push, onValue, remove } from "firebase/database";

export default function Board({ roomId, nickname }) {
  const [lines, setLines] = useState([]);
  const [players, setPlayers] = useState([]);
  const isDrawing = useRef(false);
  const currentLine = useRef(null);
  const playerRefRef = useRef(null);

  // ------------------------------
  // 👤 Aggiungi giocatore appena entra
  // ------------------------------
  useEffect(() => {
    const addPlayer = async () => {
      const newRef = push(ref(db, `rooms/${roomId}/players`));
      await set(newRef, { name: nickname, joinedAt: Date.now() });
      playerRefRef.current = newRef;
    };
    addPlayer();

    // Rimuovi giocatore quando lascia la pagina
    return () => {
      if (playerRefRef.current) remove(playerRefRef.current);
      remove(ref(db, `rooms/${roomId}/lines_temp/${nickname}`));
    };
  }, [roomId, nickname]);

  // ------------------------------
  // 👥 Lista giocatori online in tempo reale
  // ------------------------------
  useEffect(() => {
    const playersRef = ref(db, `rooms/${roomId}/players`);
    const listener = onValue(playersRef, (snapshot) => {
      const data = snapshot.val() || {};
      const online = Object.entries(data).map(([id, value]) => ({ id, ...value }));
      setPlayers(online);
    });
    return () => listener();
  }, [roomId]);

  // ------------------------------
  // ✏️ Linee definitive
  // ------------------------------
  useEffect(() => {
    const linesRef = ref(db, `rooms/${roomId}/lines`);
    const listener = onValue(linesRef, (snapshot) => {
      const data = snapshot.val() || {};
      const saved = Object.entries(data).map(([id, value]) => ({ ...value, temp: false }));
      setLines((prev) => {
        const tempLines = prev.filter((l) => l.temp);
        return [...saved, ...tempLines];
      });
    });
    return () => listener();
  }, [roomId]);

  // ------------------------------
  // ✏️ Linee temporanee degli altri utenti
  // ------------------------------
  useEffect(() => {
    const tempRef = ref(db, `rooms/${roomId}/lines_temp`);
    const listener = onValue(tempRef, (snapshot) => {
      const data = snapshot.val() || {};
      const otherTemp = Object.entries(data)
        .filter(([id]) => id !== nickname)
        .map(([id, value]) => ({ ...value, temp: true }));
      setLines((prev) => {
        const myTemp = prev.filter((l) => l.temp && l.user === nickname);
        const saved = prev.filter((l) => !l.temp);
        return [...saved, ...myTemp, ...otherTemp];
      });
    });
    return () => listener();
  }, [roomId, nickname]);

  // ------------------------------
  // 💾 Salva linea definitiva
  // ------------------------------
  const saveLine = async (line) => {
    const lineRef = push(ref(db, `rooms/${roomId}/lines`));
    await set(lineRef, { ...line, createdAt: Date.now() });
  };

  // ------------------------------
  // 🔁 Aggiorna linea temporanea (throttled)
  // ------------------------------
  const sendTempLine = useRef(
    throttle(async (line) => {
      await set(ref(db, `rooms/${roomId}/lines_temp/${nickname}`), {
        ...line,
        updatedAt: Date.now(),
      });
    }, 150)
  );

  // ------------------------------
  // 🎨 Eventi mouse
  // ------------------------------
  const handleMouseDown = (e) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    currentLine.current = { points: [pos.x, pos.y], user: nickname };
    setLines((prev) => [...prev, currentLine.current]);
    sendTempLine.current(currentLine.current);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current) return;
    const pos = e.target.getStage().getPointerPosition();
    currentLine.current.points = [...currentLine.current.points, pos.x, pos.y];
    setLines((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = currentLine.current;
      return updated;
    });
    sendTempLine.current(currentLine.current);
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
  // 🧹 Pulisci lavagna
  // ------------------------------
  const clearBoard = async () => {
    await Promise.all([
      remove(ref(db, `rooms/${roomId}/lines`)),
      remove(ref(db, `rooms/${roomId}/lines_temp`)),
    ]);
    setLines([]);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 20 }}>
      <h2>🏠 Stanza: {roomId}</h2>
      <p>Ciao <b>{nickname}</b>! Condividi il link per far entrare altri giocatori:</p>
      <input
        value={`${window.location.origin}/room/${roomId}`}
        readOnly
        onClick={(e) => e.target.select()}
        style={{ width: 400, textAlign: "center", padding: 8, borderRadius: 6, border: "1px solid #ccc", marginBottom: 20 }}
      />

      <Stage
        width={800}
        height={500}
        style={{ background: "white", borderRadius: 10, boxShadow: "0 0 10px #ccc", cursor: "crosshair" }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <Layer>
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke={line.temp ? "#888" : "#222"}
              strokeWidth={3}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          ))}
        </Layer>
      </Stage>

      <button
        onClick={clearBoard}
        style={{ marginTop: 20, padding: "10px 20px", background: "#f44336", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
      >
        🗑️ Pulisci lavagna
      </button>

      <div style={{ marginTop: 30, background: "white", padding: 15, borderRadius: 8, boxShadow: "0 0 5px #ccc", width: 250, textAlign: "left" }}>
        <h3>👥 Giocatori online:</h3>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {players.map((p) => (
            <li key={p.id} style={{ padding: "5px 0" }}>👤 {p.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
