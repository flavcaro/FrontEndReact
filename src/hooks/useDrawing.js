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
  const tremblingState = useRef({});
  const inputLagState = useRef({});

  const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  // Invia linee temp con limitazione di frequenza (max 30fps per ridurre il traffico)
  useEffect(() => {
    sendTempLine.current = async (line) => {
      const now = Date.now();
      if (now - lastSendTime.current < 33) return; // Max 30fps invece di 60fps
      lastSendTime.current = now;
      console.debug('[sendTempLine]', nickname, 'points=', (line && line.points && line.points.length) || 0, 'ts=', now);
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
        console.debug('[lines_temp update] count=', data ? Object.keys(data).length : 0);
        
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
      // Clear any pending inputLag scheduled flush for this stroke
      const lagEntry = inputLagState.current && inputLagState.current[currentLine.current.id];
      if (lagEntry) {
        if (lagEntry.timeoutId) clearTimeout(lagEntry.timeoutId);
        delete inputLagState.current[currentLine.current.id];
      }

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
    // Clear any pending inputLag scheduled flush for the current stroke
    if (currentLine.current) {
      const lagEntry = inputLagState.current && inputLagState.current[currentLine.current.id];
      if (lagEntry) {
        if (lagEntry.timeoutId) clearTimeout(lagEntry.timeoutId);
        delete inputLagState.current[currentLine.current.id];
      }
    }
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

    // Initialize trembling state for this stroke if effect active
    const trembling = getEffect('tremblingLines');
    if (trembling && trembling.params) {
      const now = Date.now();
      // Determine amplitude range and frequency change interval
      const ampRange = trembling.params._amplitudeRange || (trembling.params.amplitude ? { min: trembling.params.amplitude, max: trembling.params.amplitude } : null);
      const freqRange = trembling.params._frequencyRange || (trembling.params.frequency ? { min: trembling.params.frequency, max: trembling.params.frequency } : null);

      const pickInRange = (r) => {
        if (!r) return 1;
        const min = Number(r.min);
        const max = Number(r.max);
        return Math.floor(Math.random() * (max - min + 1)) + min;
      };

      const initialAmp = pickInRange(ampRange);
      const freqMs = pickInRange(freqRange);

      tremblingState.current[currentLine.current.id] = {
        amp: initialAmp,
        freqMs: Math.max(16, freqMs), // at least ~60Hz updates if used as ms, clamp lower bound
        lastChange: now,
        microAmp: Math.max(1, initialAmp * (0.3 + Math.random() * 0.9)),
        microRate: 0.004 + Math.random() * 0.03, // radians per ms
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2
      };
    }

    // Initialize input-lag state for this stroke if active
    const inputLag = getEffect('inputLag');
    if (inputLag && inputLag.params) {
      // support params defined as { min, max } or nested ranges
      const minDelay = Number(inputLag.params.min ?? inputLag.params._minRange?.min ?? 80);
      const maxDelay = Number(inputLag.params.max ?? inputLag.params._minRange?.max ?? minDelay + 180);
      const delayMs = randInt(minDelay, maxDelay);

      // dropChance scales with delay (longer delay -> more likely to drop points)
      const dropChance = Math.min(0.75, 0.05 + ((delayMs - minDelay) / Math.max(1, (maxDelay - minDelay))) * 0.6);

      inputLagState.current[currentLine.current.id] = {
          delayMs,
          // buffer-based packetized flush
          buffer: [],
          timeoutId: null,
          flushScheduled: false,
          firstApplied: false,
          dropChance,
          // allow packet size override via params (optional)
          packetMin: Number(inputLag.params.packetMin ?? 1),
          packetMax: Number(inputLag.params.packetMax ?? 4)
        };
      // keep a direct reference to the line object so delayed flushes can update it
      inputLagState.current[currentLine.current.id].lineRef = currentLine.current;
    }

    // If noPreview effect is active, don't add local preview (still send temp to others)
    // For inputLag we delay/show preview only when the first delayed point is applied
    const noPreview = !!getEffect('noPreview');
    const hasInputLag = !!getEffect('inputLag');
    if (!noPreview && !hasInputLag) {
      setLines((prev) => [...prev, currentLine.current]);
    }
    // If no inputLag, send immediate temp; otherwise sending happens when delayed points apply
    if (sendTempLine.current && !hasInputLag) sendTempLine.current(currentLine.current);
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
    if (trembling && trembling.params) {
      const state = tremblingState.current[currentLine.current.id];
      const now = Date.now();

      // If we have per-stroke state, possibly update amplitude based on frequency
      let amp = 1;
      let microAmp = 0.5;
      let microRate = 0.003;
      let phaseX = 0;
      let phaseY = 0;

      if (state) {
        // update amplitude periodically according to freqMs
        if (now - state.lastChange >= state.freqMs) {
          const min = Number(trembling.params._amplitudeRange?.min ?? trembling.params.amplitude ?? 1);
          const max = Number(trembling.params._amplitudeRange?.max ?? trembling.params.amplitude ?? 1);
          state.amp = Math.floor(Math.random() * (max - min + 1)) + min;
          state.lastChange = now;
          // randomize micro params a bit
          state.microAmp = Math.max(0.6, state.amp * (0.25 + Math.random() * 1.0));
          state.microRate = 0.004 + Math.random() * 0.03;
          state.phaseX = Math.random() * Math.PI * 2;
          state.phaseY = Math.random() * Math.PI * 2;
        }

        amp = state.amp || 1;
        microAmp = state.microAmp || 0.5;
        microRate = state.microRate || 0.003;
        phaseX = state.phaseX || 0;
        phaseY = state.phaseY || 0;
      } else {
        // fallback: pick fresh amp per point from preserved range if available
        if (trembling.params._amplitudeRange) {
          const min = Number(trembling.params._amplitudeRange.min);
          const max = Number(trembling.params._amplitudeRange.max);
          amp = Math.floor(Math.random() * (max - min + 1)) + min;
        } else if (trembling.params.amplitude) {
          amp = Number(trembling.params.amplitude) || 1;
        }
      }

      // Optionally modulate amplitude by stroke speed (faster => slightly less tremble)
      let speed = 0;
      if (pts.length >= 2) {
        const lastX = pts[pts.length - 2] * stage.width();
        const lastY = pts[pts.length - 1] * stage.height();
        const dx = pos.x - lastX;
        const dy = pos.y - lastY;
        speed = Math.sqrt(dx * dx + dy * dy);
      }
      const speedFactor = Math.max(0.15, 1 - speed / (stage.width() * 0.5));
      amp = amp * speedFactor;

      // Compose main random jitter and a micro sinusoidal jitter for extra chaos
      const jitterX = (Math.random() * 2 - 1) * (amp / stage.width());
      const jitterY = (Math.random() * 2 - 1) * (amp / stage.height());
      const microX = (microAmp * Math.sin((now + phaseX) * microRate)) / stage.width();
      const microY = (microAmp * Math.sin((now + phaseY) * (microRate * 1.3))) / stage.height();

      normalizedX = Math.min(1, Math.max(0, normalizedX + jitterX + microX));
      normalizedY = Math.min(1, Math.max(0, normalizedY + jitterY + microY));
    }

    const newPointSet = [...pts, normalizedX, normalizedY];

    // Handle input lag: schedule this point to be applied after delay (may drop/stutter)
    const inputLag = getEffect('inputLag');
    if (inputLag && inputLagState.current && inputLagState.current[currentLine.current.id]) {
      const state = inputLagState.current[currentLine.current.id];
      const point = { x: normalizedX, y: normalizedY };
      state.buffer.push(point);

      // Schedule a flush if none scheduled
      if (!state.flushScheduled) {
        state.flushScheduled = true;
          const lineId = currentLine.current && currentLine.current.id;
          const jitter = Math.floor(Math.random() * 120) - 60; // +/-60ms jitter for larger stutter
          const to = setTimeout(function flush() {
            // if the stroke was finished/cleared, abort
            if (!lineId || !inputLagState.current || !inputLagState.current[lineId]) return;
            const state = inputLagState.current[lineId];
            state.flushScheduled = false;

          // determine packet size
          const packetMin = Math.max(1, state.packetMin || 1);
          const packetMax = Math.max(packetMin, state.packetMax || 1);
          const available = state.buffer.length;
          const packetSize = Math.min(available, randInt(packetMin, Math.min(packetMax, Math.max(1, Math.floor(available)) )));

          // apply up to packetSize points (with possible drops)
          let applied = 0;
          for (let i = 0; i < packetSize; i++) {
            const p = state.buffer.shift();
            if (!p) break;
            if (Math.random() < state.dropChance) {
              continue; // drop this point to create stutter
            }

            if (!state.firstApplied) {
              // add initial preview now on the stored lineRef
              const lineRef = state.lineRef;
              if (!lineRef) continue;
              lineRef.points = [...lineRef.points];
              setLines((prev) => [...prev, lineRef]);
              state.firstApplied = true;
            }

            const lineRef = state.lineRef;
            if (!lineRef) continue;
            lineRef.points = [...lineRef.points, p.x, p.y];
            applied += 1;
          }

          if (applied > 0 && sendTempLine.current) {
            const lr = state.lineRef || null;
            if (lr) sendTempLine.current(lr);
          }

          // if buffer still has points, schedule another flush soon (bursty behavior)
          if (state.buffer.length > 0) {
            state.flushScheduled = true;
            const nextJitter = Math.floor(Math.random() * 80) - 40;
            state.timeoutId = setTimeout(flush, Math.max(6, Math.floor(state.delayMs * 0.6) + nextJitter));
          } else {
            state.timeoutId = null;
          }
        }, Math.max(0, state.delayMs + jitter));
        state.timeoutId = to;
      }

      // Do not update immediate preview; buffered flush will add points and preview
    } else {
      // No input lag: update immediately for smooth preview
      currentLine.current.points = newPointSet;
    }

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