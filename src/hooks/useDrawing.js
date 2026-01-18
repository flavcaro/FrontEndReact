import { useState, useEffect, useRef, useCallback } from "react";
import { ref, set, push, onValue, remove } from "firebase/database";
import throttle from "lodash.throttle";
import { db } from "../firebase";

export function useDrawing(roomId, nickname, isArtist, gameActive, showResults = false, selectedColor = '#1e293b', allGuessed = false, selectedInstrument = 'pencil') {
  const [lines, setLines] = useState([]);
  const isDrawing = useRef(false);
  const currentLine = useRef(null);
  const sendTempLine = useRef(null);
  const lineIdCounter = useRef(0);

  // Throttle linee temp - ridotto a 50ms per maggiore fluidità
  useEffect(() => {
    sendTempLine.current = throttle(async (line) => {
      await set(ref(db, `rooms/${roomId}/lines_temp/${nickname}`), {
        ...line,
        updatedAt: Date.now(),
      });
    }, 50);

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
      const data = snapshot.val();
      if (!data || Object.keys(data).length === 0) {
        setLines((prev) => prev.filter((l) => l.temp)); // Solo temp
        return;
      }
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
      const data = snapshot.val();
      
      setLines((prev) => {
        // Mantieni le linee salvate e la mia linea temporanea corrente
        const saved = prev.filter((l) => !l.temp);
        const myTemp = prev.filter((l) => l.temp && l.user === nickname);
        
        // Aggiungi le linee temporanee degli altri
        const otherTemp = [];
        if (data && Object.keys(data).length > 0) {
          Object.entries(data).forEach(([user, value]) => {
            if (user !== nickname && value && value.points) {
              otherTemp.push({ 
                ...value, 
                id: `temp-${user}`,
                temp: true 
              });
            }
          });
        }
        
        return [...saved, ...myTemp, ...otherTemp];
      });
    });
    return unsubscribe;
  }, [roomId, nickname, gameActive]);

  // Salva linea
  const saveLine = useCallback(async (line) => {
    const lineRef = push(ref(db, `rooms/${roomId}/lines`));
    await set(lineRef, { ...line, createdAt: Date.now() });
  }, [roomId]);

  // Function to stop drawing and save the line
  const stopDrawing = useCallback(async () => {
    if (!isDrawing.current || showResults || !isArtist || !gameActive || allGuessed) return;
    isDrawing.current = false;
    if (currentLine.current) {
      await saveLine(currentLine.current);
      await remove(ref(db, `rooms/${roomId}/lines_temp/${nickname}`));
      currentLine.current = null;
    }
  }, [showResults, isArtist, gameActive, allGuessed, saveLine, roomId, nickname]);

  // Global mouse event listeners to handle drawing outside canvas
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDrawing.current) {
        stopDrawing();
      }
    };

    const handleGlobalMouseLeave = () => {
      if (isDrawing.current) {
        stopDrawing();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mouseleave', handleGlobalMouseLeave);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseLeave);
    };
  }, [isArtist, gameActive, showResults, allGuessed, roomId, nickname, stopDrawing]);

  // Ensure we clear any in-progress temp drawing when the player loses drawing privileges
  useEffect(() => {
    const shouldClear = !isArtist || !gameActive || showResults || allGuessed;
    if (!shouldClear) return;

    isDrawing.current = false;
    currentLine.current = null;
    setLines((prev) => prev.filter((l) => !(l.temp && l.user === nickname)));
    remove(ref(db, `rooms/${roomId}/lines_temp/${nickname}`)).catch(() => {});
  }, [isArtist, gameActive, showResults, allGuessed, roomId, nickname]);

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
    if (!isArtist || !gameActive || showResults || allGuessed) return;
    
    const pos = e.target.getStage().getPointerPosition();
    const stage = e.target.getStage();
    
    // Check if mouse is outside canvas boundaries
    if (!pos || pos.x < 0 || pos.y < 0 || pos.x > stage.width() || pos.y > stage.height()) {
      return;
    }
    
    isDrawing.current = true;
    lineIdCounter.current += 1;
    currentLine.current = { 
      id: `${nickname}-${Date.now()}-${lineIdCounter.current}`,
      points: [pos.x, pos.y], 
      user: nickname,
      temp: true,
      color: selectedInstrument === 'eraser' ? null : selectedColor,
      eraser: selectedInstrument === 'eraser'
    };
    setLines((prev) => [...prev, currentLine.current]);
    if (sendTempLine.current) sendTempLine.current(currentLine.current);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current || !isArtist || !currentLine.current || allGuessed) return;
    const pos = e.target.getStage().getPointerPosition();
    
    // Check if mouse is outside canvas boundaries
    const stage = e.target.getStage();
    if (!pos || pos.x < 0 || pos.y < 0 || pos.x > stage.width() || pos.y > stage.height()) {
      return;
    }
    
    currentLine.current.points = [...currentLine.current.points, pos.x, pos.y];
    setLines((prev) => {
      const updated = [...prev];
      updated[updated.length - 1] = currentLine.current;
      return updated;
    });
    if (sendTempLine.current) sendTempLine.current(currentLine.current);
  };

  const handleMouseUp = () => {
    return stopDrawing();
  };

  return {
    lines,
    clearBoard,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp
  };
}