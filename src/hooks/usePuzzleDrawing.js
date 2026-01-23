import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, push, onValue, off } from 'firebase/database';
import { db } from '../firebase';

/**
 * Hook per gestire il disegno nella modalità Puzzle Drawing
 * Sincronizza gli stroke di tutti i giocatori in tempo reale
 */
export function usePuzzleDrawing(roomId, assignedSection, isActive) {
  const [strokes, setStrokes] = useState({
    0: [], // Sezione sinistra
    1: [], // Sezione centro
    2: []  // Sezione destra
  });
  
  const currentStrokeRef = useRef(null);

  // Ascolta gli stroke dal database
  useEffect(() => {
    if (!roomId || !isActive) return;

    const strokesRefs = [0, 1, 2].map(section => 
      ref(db, `rooms/${roomId}/puzzleStrokes/section${section}`)
    );

    const unsubscribers = strokesRefs.map((strokeRef, section) => {
      const handleStrokeUpdate = (snapshot) => {
        const data = snapshot.val();
        const strokesArray = data ? Object.values(data) : [];
        
        setStrokes(prev => ({
          ...prev,
          [section]: strokesArray
        }));
      };

      onValue(strokeRef, handleStrokeUpdate);

      return () => off(strokeRef, 'value', handleStrokeUpdate);
    });

    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }, [roomId, isActive]);

  // Inizia un nuovo stroke
  const startStroke = useCallback((x, y, color, size) => {
    currentStrokeRef.current = {
      points: [{ x, y }],
      color,
      size,
      section: assignedSection,
      timestamp: Date.now()
    };
  }, [assignedSection]);

  // Aggiungi un punto allo stroke corrente
  const addPoint = useCallback((x, y) => {
    if (currentStrokeRef.current) {
      currentStrokeRef.current.points.push({ x, y });
    }
  }, []);

  // Completa e salva lo stroke
  const finishStroke = useCallback(async () => {
    if (!currentStrokeRef.current || !roomId || assignedSection === null) return;

    const stroke = currentStrokeRef.current;
    
    // Salva nel database
    try {
      const strokeRef = ref(db, `rooms/${roomId}/puzzleStrokes/section${assignedSection}`);
      await push(strokeRef, stroke);
    } catch (error) {
      console.error('Errore salvando lo stroke:', error);
    }

    currentStrokeRef.current = null;
  }, [roomId, assignedSection]);

  return {
    strokes,
    startStroke,
    addPoint,
    finishStroke
  };
}
