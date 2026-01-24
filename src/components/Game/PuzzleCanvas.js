import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getSectionBounds, isPointInSection } from '../../constants/gameModes/puzzleDrawing';

/**
 * Canvas diviso in sezioni per la modalità Puzzle Drawing
 * Ogni giocatore può disegnare solo nella propria sezione
 */
export default function PuzzleCanvas({ 
  currentColor, 
  brushSize, 
  isDrawing,
  assignedSection, // Sezione assegnata al giocatore (0, 1, 2) o null se sta indovinando
  allStrokes, // Tutti gli stroke da tutte le sezioni
  onStartStroke,
  onAddPoint,
  onFinishStroke,
  showSectionBorders = true
}) {
  const canvasRef = useRef(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [lastPoint, setLastPoint] = useState(null);
  const [ctx, setCtx] = useState(null);
  const sectionBoundsRef = useRef(null);

  // ----------------------
  // FUNZIONI DI DISEGNO
  // ----------------------

  const drawCanvasBackground = useCallback((context, width, height) => {
    if (!context) return;

    // Sfondo bianco
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, width, height);

    // Disegna i bordi delle sezioni
    if (showSectionBorders) {
      const sectionWidth = width / 3;

      context.strokeStyle = '#e2e8f0';
      context.lineWidth = 2;
      context.setLineDash([5, 5]);

      // Linea tra sezione sinistra e centro
      context.beginPath();
      context.moveTo(sectionWidth, 0);
      context.lineTo(sectionWidth, height);
      context.stroke();

      // Linea tra sezione centro e destra
      context.beginPath();
      context.moveTo(sectionWidth * 2, 0);
      context.lineTo(sectionWidth * 2, height);
      context.stroke();

      context.setLineDash([]);

      // Evidenzia la sezione assegnata
      if (assignedSection !== null && assignedSection !== undefined) {
        const bounds = getSectionBounds(assignedSection, width, height);
        context.fillStyle = 'rgba(59, 130, 246, 0.05)';
        context.fillRect(bounds.x, bounds.y, bounds.width, bounds.height);

        context.strokeStyle = '#3b82f6';
        context.lineWidth = 3;
        context.strokeRect(bounds.x + 2, bounds.y + 2, bounds.width - 4, bounds.height - 4);
      }
    }
  }, [showSectionBorders, assignedSection]);

  const drawStroke = useCallback((context, stroke) => {
    if (!stroke || !stroke.points || stroke.points.length < 2) return;

    context.strokeStyle = stroke.color;
    context.lineWidth = stroke.size;
    context.lineCap = 'round';
    context.lineJoin = 'round';

    context.beginPath();
    context.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      context.lineTo(stroke.points[i].x, stroke.points[i].y);
    }

    context.stroke();
  }, []);

  const getCanvasCoordinates = useCallback((e) => {
    if (!canvasRef.current) return null;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    let clientX, clientY;

    if (e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return { x: clientX - rect.left, y: clientY - rect.top };
  }, []);

  const isInAssignedSection = useCallback((x, y) => {
    if (assignedSection === null || assignedSection === undefined) return false;
    if (!canvasRef.current) return false;
    const canvas = canvasRef.current;
    return isPointInSection(x, y, assignedSection, canvas.width, canvas.height);
  }, [assignedSection]);

  // ----------------------
  // USEEFFECT PER INIZIALIZZAZIONE
  // ----------------------

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    sectionBoundsRef.current = (assignedSection !== null && assignedSection !== undefined) 
      ? getSectionBounds(assignedSection, canvas.width, canvas.height) 
      : null;

    setCtx(context);
    drawCanvasBackground(context, canvas.width, canvas.height);
  }, [assignedSection, drawCanvasBackground]);

  // Ridisegna quando cambiano gli stroke
  useEffect(() => {
    if (!ctx || !canvasRef.current) return;
    const canvas = canvasRef.current;

    drawCanvasBackground(ctx, canvas.width, canvas.height);

    if (allStrokes) {
      Object.entries(allStrokes).forEach(([section, strokes]) => {
        const shouldShowSection = assignedSection === null || assignedSection === parseInt(section);
        if (shouldShowSection && Array.isArray(strokes)) {
          strokes.forEach(stroke => drawStroke(ctx, stroke));
        }
      });
    }
  }, [allStrokes, ctx, drawCanvasBackground, drawStroke, assignedSection]);

  // ----------------------
  // HANDLER EVENTI POINTER
  // ----------------------

  const handlePointerDown = useCallback((e) => {
    if (!isDrawing || assignedSection === null || assignedSection === undefined) return;

    e.preventDefault();
    const point = getCanvasCoordinates(e);

    if (!point || !isInAssignedSection(point.x, point.y)) return;

    setIsMouseDown(true);
    setLastPoint(point);

    if (onStartStroke) onStartStroke(point.x, point.y, currentColor, brushSize);
  }, [isDrawing, assignedSection, getCanvasCoordinates, isInAssignedSection, onStartStroke, currentColor, brushSize]);

  const handlePointerMove = useCallback((e) => {
    if (!isMouseDown || !ctx || !lastPoint || !isDrawing) return;

    e.preventDefault();
    const currentPoint = getCanvasCoordinates(e);
    if (!currentPoint) return;

    if (!isInAssignedSection(currentPoint.x, currentPoint.y)) {
      setIsMouseDown(false);
      setLastPoint(null);
      return;
    }

    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(currentPoint.x, currentPoint.y);
    ctx.stroke();

    if (onAddPoint) onAddPoint(currentPoint.x, currentPoint.y);
    setLastPoint(currentPoint);
  }, [isMouseDown, ctx, lastPoint, currentColor, brushSize, isDrawing, getCanvasCoordinates, isInAssignedSection, onAddPoint]);

  const handlePointerUp = useCallback((e) => {
    if (!isMouseDown) return;

    e.preventDefault();
    setIsMouseDown(false);

    if (onFinishStroke) onFinishStroke();
    setLastPoint(null);
  }, [isMouseDown, onFinishStroke]);

  const handleMouseLeave = useCallback(() => {
    if (isMouseDown) {
      setIsMouseDown(false);
      setLastPoint(null);
    }
  }, [isMouseDown]);

  // ----------------------
  // RENDER
  // ----------------------

  return (
    <div style={{ 
      position: 'relative', 
      width: '100%', 
      height: '100%',
      borderRadius: '12px',
      overflow: 'hidden',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
    }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handleMouseLeave}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
        style={{
          width: '100%',
          height: '100%',
          cursor: isDrawing && assignedSection !== null ? 'crosshair' : 'default',
          touchAction: 'none'
        }}
      />

      {/* Indicatore sezione */}
      {assignedSection !== null && assignedSection !== undefined && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: assignedSection === 0 ? '10px' : assignedSection === 1 ? '50%' : 'auto',
          right: assignedSection === 2 ? '10px' : 'auto',
          transform: assignedSection === 1 ? 'translateX(-50%)' : 'none',
          background: 'rgba(59, 130, 246, 0.9)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          fontWeight: '600',
          pointerEvents: 'none',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
        }}>
          La tua sezione: {['Sinistra', 'Centro', 'Destra'][assignedSection]}
        </div>
      )}

      {/* Messaggio per l'indovinatore */}
      {assignedSection === null && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          pointerEvents: 'none',
          color: '#64748b',
          fontSize: '18px',
          fontWeight: '600'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤔</div>
          <div>Guarda e indovina!</div>
          <div style={{ fontSize: '14px', marginTop: '8px', color: '#94a3b8' }}>
            I giocatori stanno creando il puzzle
          </div>
        </div>
      )}
    </div>
  );
}
