import { useState, useEffect, useRef, useCallback } from "react";
import { ref, set, push, onValue, remove } from "firebase/database";
import throttle from "lodash.throttle";
import { db } from "../firebase";

export function useDrawing(roomId, nickname, isArtist, gameActive) {
  const [lines, setLines] = useState([]);
  const isDrawing = useRef(false);
  const currentLine = useRef(null);
  const sendTempLine = useRef(null);
  const lineIdCounter = useRef(0);

  // Throttle linee temp
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

  // Listener linee definitive
  useEffect(() => {
    const linesRef = ref(db, `rooms/${roomId}/lines`);
    const unsubscribe = onValue(linesRef, (snapshot) => {
      if (!gameActive) {
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
  }, [roomId, gameActive]);

  // Listener linee temporanee
  useEffect(() => {
    const tempRef = ref(db, `rooms/${roomId}/lines_temp`);
    const unsubscribe = onValue(tempRef, (snapshot) => {
      if (!gameActive) {
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
  }, [roomId, nickname, gameActive]);

  // Salva linea
  const saveLine = async (line) => {
    const lineRef = push(ref(db, `rooms/${roomId}/lines`));
    await set(lineRef, { ...line, createdAt: Date.now() });
  };

  // Pulisci lavagna
  const clearBoard = useCallback(async () => {
    await Promise.all([
      remove(ref(db, `rooms/${roomId}/lines`)),
      remove(ref(db, `rooms/${roomId}/lines_temp`)),
    ]);
    setLines([]);
  }, [roomId]);

  // Eventi mouse
  const handleMouseDown = (e) => {
    if (!isArtist || !gameActive) return;
    
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

  return {
    lines,
    clearBoard,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
}
