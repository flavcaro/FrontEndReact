import { useState, useEffect, useCallback, useRef } from 'react';
import { ref, push, onValue, off, remove } from 'firebase/database';
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
  const startStroke = useCallback((x, y, color, size, isEraser = false) => {
    console.log('🖊️ [usePuzzleDrawing] startStroke:', { x, y, color, size, isEraser, assignedSection });
    currentStrokeRef.current = {
      points: [{ x, y }],
      color: isEraser ? null : color,
      size,
      section: assignedSection,
      timestamp: Date.now(),
      eraser: isEraser
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
    console.log('💾 [usePuzzleDrawing] Salvando stroke:', stroke);
    
    // Salva nel database
    try {
      const strokeRef = ref(db, `rooms/${roomId}/puzzleStrokes/section${assignedSection}`);
      await push(strokeRef, stroke);
      console.log('✅ [usePuzzleDrawing] Stroke salvato con successo');
    } catch (error) {
      console.error('❌ [usePuzzleDrawing] Errore salvando lo stroke:', error);
    }

    currentStrokeRef.current = null;
  }, [roomId, assignedSection]);

  // Pulisci solo la sezione assegnata
  const clearSection = useCallback(async () => {
    console.log('🗑️ [usePuzzleDrawing] clearSection chiamato:', { assignedSection, roomId });
    if (assignedSection === null || !roomId) {
      console.log('⚠️ [usePuzzleDrawing] clearSection ignorato: sezione non assegnata');
      return;
    }

    try {
      const sectionRef = ref(db, `rooms/${roomId}/puzzleStrokes/section${assignedSection}`);
      await remove(sectionRef);
      console.log('✅ [usePuzzleDrawing] Sezione pulita con successo');
      
      // Aggiorna lo stato locale
      setStrokes(prev => ({
        ...prev,
        [assignedSection]: []
      }));
    } catch (error) {
      console.error('❌ [usePuzzleDrawing] Errore pulendo la sezione:', error);
    }
  }, [roomId, assignedSection]);

  return {
    strokes,
    startStroke,
    addPoint,
    finishStroke,
    clearSection
  };
}
