import React, { useState, useEffect, useRef } from "react";
import { Stage, Layer, Line } from "react-konva";
import {
  doc,
  onSnapshot,
  setDoc,
  collection,
  addDoc,
  serverTimestamp,
  deleteDoc,
  query,
  onSnapshot as onCollectionSnapshot,
} from "firebase/firestore";
import { db } from "./firebase";

export default function Board({ roomId, nickname }) {
  const [lines, setLines] = useState([]);
  const [players, setPlayers] = useState([]);
  const isDrawing = useRef(false);
  const playerRef = useRef(null);

  // 🎯 Aggiungi giocatore alla stanza
  useEffect(() => {
    const addPlayer = async () => {
      const player = {
        name: nickname,
        joinedAt: serverTimestamp(),
      };
      const ref = await addDoc(collection(db, "rooms", roomId, "players"), player);
      playerRef.current = ref;
    };

    addPlayer();

    // Rimuovi giocatore quando lascia la pagina
    return () => {
      if (playerRef.current) {
        deleteDoc(playerRef.current);
      }
    };
  }, [roomId, nickname]);

  // 👥 Ascolta la lista dei giocatori in tempo reale
  useEffect(() => {
    const q = query(collection(db, "rooms", roomId, "players"));
    const unsub = onCollectionSnapshot(q, (snapshot) => {
      const online = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPlayers(online);
    });
    return unsub;
  }, [roomId]);

  // ✏️ Ascolta i disegni in tempo reale
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "rooms", roomId), (snap) => {
      const data = snap.data();
      if (data?.lines) setLines(data.lines);
    });
    return unsub;
  }, [roomId]);

  // 💾 Salva linee su Firestore
  const saveLines = async (newLines) => {
    const ref = doc(db, "rooms", roomId);
    await setDoc(ref, { lines: newLines }, { merge: true });
  };

  const handleMouseDown = (e) => {
    isDrawing.current = true;
    const pos = e.target.getStage().getPointerPosition();
    const newLines = [...lines, { points: [pos.x, pos.y], user: nickname }];
    setLines(newLines);
    saveLines(newLines);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current) return;
    const stage = e.target.getStage();
    const point = stage.getPointerPosition();
    let lastLine = lines[lines.length - 1];
    lastLine.points = lastLine.points.concat([point.x, point.y]);
    const newLines = lines.slice(0, lines.length - 1).concat(lastLine);
    setLines(newLines);
    saveLines(newLines);
  };

  const handleMouseUp = () => {
    isDrawing.current = false;
  };

  const clearBoard = async () => {
    setLines([]);
    const ref = doc(db, "rooms", roomId);
    await setDoc(ref, { lines: [] }, { merge: true });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        background: "#f7f7f7",
        minHeight: "100vh",
        padding: 20,
      }}
    >
      <h2>🖌️ Stanza: {roomId}</h2>
      <p>
        Ciao <b>{nickname}</b>! Condividi il link per far entrare altri giocatori:
      </p>
      <input
        value={window.location.href}
        readOnly
        onClick={(e) => e.target.select()}
        style={{
          width: 400,
          textAlign: "center",
          padding: 8,
          borderRadius: 6,
          border: "1px solid #ccc",
          marginBottom: 20,
        }}
      />

      <Stage
        width={800}
        height={500}
        style={{
          background: "white",
          borderRadius: 10,
          boxShadow: "0 0 10px #ccc",
          cursor: "crosshair",
        }}
        onMouseDown={handleMouseDown}
        onMousemove={handleMouseMove}
        onMouseup={handleMouseUp}
      >
        <Layer>
          {lines.map((line, i) => (
            <Line
              key={i}
              points={line.points}
              stroke="#222"
              strokeWidth={3}
              tension={0.5}
              lineCap="round"
            />
          ))}
        </Layer>
      </Stage>

      <button
        onClick={clearBoard}
        style={{
          marginTop: 20,
          padding: "10px 20px",
          background: "#f44336",
          color: "white",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
        }}
      >
        🧹 Pulisci lavagna
      </button>

      <div
        style={{
          marginTop: 30,
          background: "white",
          padding: 15,
          borderRadius: 8,
          boxShadow: "0 0 5px #ccc",
          width: 250,
          textAlign: "left",
        }}
      >
        <h3>👥 Giocatori online:</h3>
        <ul>
          {players.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
