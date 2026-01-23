import { useState, useEffect, useRef, useCallback } from "react";
import { ref, set, push, onValue, remove } from "firebase/database";
import { db } from "../firebase";

export function useDrawing(roomId, nickname, isArtist, gameActive, showResults = false, selectedColor = '#1e293b', allGuessed = false, selectedInstrument = 'pencil', chaosEffects = []) {
  const [lines, setLines] = useState([]);
  const isDrawing = useRef(false);
  const currentLine = useRef(null);
  const sendTempLine = useRef(null);
  const lineIdCounter = useRef(0);

  const lastSendTime = useRef(0);

  // Invia linee temp con limitazione di frequenza (max 30fps per ridurre il traffico)
  useEffect(() => {
    sendTempLine.current = async (line) => {
      const now = Date.now();
      if (now - lastSendTime.current < 33) return; // Max 30fps invece di 60fps
      lastSendTime.current = now;
      
      await set(ref(db, `rooms/${roomId}/lines_temp/${nickname}`), {
        ...line,
        updatedAt: now,
      });
    };

    return () => {
      remove(ref(db, `rooms/${roomId}/lines_temp/${nickname}`));
    };
  }, [roomId, nickname]);

  // Helper: check active chaos effects (memoized to satisfy hook deps)
  const hasEffect = useCallback((id) => Array.isArray(chaosEffects) && chaosEffects.some(e => e && e.id === id), [chaosEffects]);
  const getEffect = useCallback((id) => Array.isArray(chaosEffects) && chaosEffects.find(e => e && e.id === id), [chaosEffects]);

  const randomHexColor = () => {
    const r = Math.floor(Math.random() * 256);
    const g = Math.floor(Math.random() * 256);
    const b = Math.floor(Math.random() * 256);
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
  };

  // Listener linee definitive
  useEffect(() => {
    const linesRef = ref(db, `rooms/${roomId}/lines`);
    const unsubscribe = onValue(linesRef, (snapshot) => {
      try {
        if (!gameActive) {
          setLines([]);
          return;
        }
        const data = snapshot.val();
        if (!data || Object.keys(data).length === 0) {
          setLines((prev) => prev.filter((l) => l.temp)); // Solo temp
          return;
        }
        const saved = Object.entries(data).map(([firebaseKey, value]) => {
          return { 
            ...value, 
            points: value.points || [],
            id: firebaseKey,
            temp: false 
          };
        });
        setLines((prev) => {
          const tempLines = prev.filter((l) => l.temp);
          return [...saved, ...tempLines];
        });
      } catch (error) {
        console.error('Error in lines listener:', error);
      }
    });
    return unsubscribe;
  }, [roomId, gameActive]);

  // Listener linee temporanee
  useEffect(() => {
    const tempRef = ref(db, `rooms/${roomId}/lines_temp`);
    const unsubscribe = onValue(tempRef, (snapshot) => {
      try {
        if (!gameActive) {
          return;
        }
        const data = snapshot.val();
        
        setLines((prev) => {
          // Mantieni le linee salvate
          const saved = prev.filter((l) => !l.temp);

          // Mantieni la mia linea temporanea corrente (se sto disegnando)
          const noPreview = !!getEffect('noPreview');
          const myTemp = isDrawing.current && currentLine.current && !noPreview ? [currentLine.current] : [];

          // Aggiungi le linee temporanee degli altri giocatori
          const otherTemp = [];
          if (data && Object.keys(data).length > 0) {
            Object.entries(data).forEach(([user, value]) => {
              if (user !== nickname && value && value.points && value.points.length > 0) {
                otherTemp.push({ 
                  ...value, 
                  points: value.points,
                  id: `temp-${user}`,
                  temp: true 
                });
              }
            });
          }

          return [...saved, ...myTemp, ...otherTemp];
        });
      } catch (error) {
        console.error('Error in temp lines listener:', error);
      }
    });
    return unsubscribe;
  }, [roomId, nickname, gameActive, getEffect]);

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

  // Global mouse and touch event listeners to handle drawing outside canvas
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

    const handleGlobalTouchEnd = () => {
      if (isDrawing.current) {
        stopDrawing();
      }
    };

    window.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('mouseleave', handleGlobalMouseLeave);
    window.addEventListener('touchend', handleGlobalTouchEnd);
    window.addEventListener('touchcancel', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('mouseleave', handleGlobalMouseLeave);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
      window.removeEventListener('touchcancel', handleGlobalTouchEnd);
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

  // Eventi mouse e touch
  const handleMouseDown = (e) => {
    if (!isArtist || !gameActive || showResults || allGuessed) return;
    
    // Previeni il comportamento di default per touch events
    if (e.evt && e.evt.type.includes('touch')) {
      e.evt.preventDefault();
    }
    
    const pos = e.target.getStage().getPointerPosition();
    const stage = e.target.getStage();
    if (!pos || pos.x < 0 || pos.y < 0 || pos.x > stage.width() || pos.y > stage.height()) {
      return;
    }
    isDrawing.current = true;
    lineIdCounter.current += 1;
    const normalizedX = pos.x / stage.width();
    const normalizedY = pos.y / stage.height();
    // Random color per stroke if effect active
    const randomColorActive = hasEffect('randomColor');
    const strokeColor = selectedInstrument === 'eraser' ? null : (randomColorActive ? randomHexColor() : selectedColor);

    currentLine.current = {
      id: `${nickname}-${Date.now()}-${lineIdCounter.current}`,
      points: [normalizedX, normalizedY],
      user: nickname,
      temp: true,
      color: strokeColor,
      eraser: selectedInstrument === 'eraser'
    };

    // If noPreview effect is active, don't add local preview (still send temp to others)
    const noPreview = !!getEffect('noPreview');
    if (!noPreview) {
      setLines((prev) => [...prev, currentLine.current]);
    }
    if (sendTempLine.current) sendTempLine.current(currentLine.current);
  };

  const handleMouseMove = (e) => {
    if (!isDrawing.current || !isArtist || !currentLine.current || allGuessed) return;
    
    // Previeni il comportamento di default per touch events
    if (e.evt && e.evt.type.includes('touch')) {
      e.evt.preventDefault();
    }
    
    const pos = e.target.getStage().getPointerPosition();
    const stage = e.target.getStage();
    if (!pos || pos.x < 0 || pos.y < 0 || pos.x > stage.width() || pos.y > stage.height()) {
      return;
    }
    
    // Aggiungi il punto solo se la distanza dal precedente è almeno 2px (aumentato per ridurre frequenza)
    const pts = currentLine.current.points;
    if (pts.length >= 2) {
      const lastX = pts[pts.length - 2] * stage.width(); // denormalize for distance
      const lastY = pts[pts.length - 1] * stage.height();
      const dx = pos.x - lastX;
      const dy = pos.y - lastY;
      if (Math.sqrt(dx * dx + dy * dy) < 2) return; // Aumentato da 1 a 2px
    }
    
    // Normalized coords
    let normalizedX = pos.x / stage.width();
    let normalizedY = pos.y / stage.height();

    // Apply trembling lines effect (jitter points) if active
    const trembling = getEffect('tremblingLines');
    if (trembling && trembling.params && trembling.params.amplitude) {
      const amp = Number(trembling.params.amplitude) || 1; // pixels
      const jitterX = (Math.random() * 2 - 1) * (amp / stage.width());
      const jitterY = (Math.random() * 2 - 1) * (amp / stage.height());
      normalizedX = Math.min(1, Math.max(0, normalizedX + jitterX));
      normalizedY = Math.min(1, Math.max(0, normalizedY + jitterY));
    }

    currentLine.current.points = [...pts, normalizedX, normalizedY];

    // Aggiorna immediatamente la linea locale per feedback visivo fluido
    const noPreview = !!getEffect('noPreview');
    if (!noPreview) {
      setLines((prev) => {
        const updated = [...prev];
        const myTempIndex = updated.findIndex((l) => l.temp && l.user === nickname);
        if (myTempIndex !== -1) {
          updated[myTempIndex] = { ...currentLine.current };
        }
        return updated;
      });
    }

    // Invio al server limitato (ora a 30fps)
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