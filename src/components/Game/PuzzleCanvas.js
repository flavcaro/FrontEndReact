import React, { useEffect, useRef, useState, useCallback } from 'react';
import { getSectionBounds, isPointInSection } from '../../constants/gameModes/puzzleDrawing';

export default function PuzzleCanvas({
  currentColor,
  brushSize,
  isDrawing,
  assignedSection,
  allStrokes,
  onStartStroke,
  onAddPoint,
  onFinishStroke,
  showSectionBorders = true,
  selectedInstrument = 'pencil', // 'pencil' | 'eraser'
  totalSections = 3 // Numero totale di sezioni (2 o 3)
}) {
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const currentStrokeRef = useRef(null);

  const [isPointerDown, setIsPointerDown] = useState(false);
  const [lastPoint, setLastPoint] = useState(null);

  /* -----------------------------
     CANVAS UTILS
  ----------------------------- */

  const getCanvasPoint = useCallback((e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const source = e.touches?.[0] ?? e;

    // Calcola le coordinate del mouse relative al canvas visualizzato
    const clientX = source.clientX - rect.left;
    const clientY = source.clientY - rect.top;

    // Scala le coordinate in base al rapporto tra dimensioni interne e dimensioni CSS
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: clientX * scaleX,
      y: clientY * scaleY
    };
  }, []);

  const isAllowedPoint = useCallback((x, y) => {
    if (assignedSection === null || !canvasRef.current) return false;
    return isPointInSection(
      x,
      y,
      assignedSection,
      canvasRef.current.width,
      canvasRef.current.height,
      totalSections
    );
  }, [assignedSection, totalSections]);

  /* -----------------------------
     DRAW HELPERS
  ----------------------------- */

  const drawBackground = useCallback((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    if (!showSectionBorders) return;

    const sectionW = w / totalSections;
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;

    ctx.beginPath();
    for (let i = 1; i < totalSections; i++) {
      ctx.moveTo(sectionW * i, 0);
      ctx.lineTo(sectionW * i, h);
    }
    ctx.stroke();

    ctx.setLineDash([]);

    if (assignedSection !== null) {
      const b = getSectionBounds(assignedSection, w, h, totalSections);
      ctx.fillStyle = 'rgba(59,130,246,0.05)';
      ctx.fillRect(b.x, b.y, b.width, b.height);

      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x + 2, b.y + 2, b.width - 4, b.height - 4);
    }
  }, [assignedSection, showSectionBorders, totalSections]);

  const drawStroke = useCallback((ctx, stroke) => {
    if (!stroke?.points?.length) return;

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = stroke.size;

    if (stroke.eraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
    }

    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    stroke.points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();

    ctx.globalCompositeOperation = 'source-over';
  }, []);

  /* -----------------------------
     REDRAW
  ----------------------------- */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctxRef.current = ctx;

    console.log('🔧 [PuzzleCanvas] init drawBackground totalSections=', totalSections);

    const size = Math.min(canvas.parentElement.clientWidth, window.innerHeight * 0.7);
    canvas.width = size;
    canvas.height = size;

    drawBackground(ctx, canvas.width, canvas.height);
  }, [drawBackground, totalSections]);

  useEffect(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    drawBackground(ctx, canvas.width, canvas.height);

    if (!allStrokes) return;

    Object.entries(allStrokes).forEach(([section, strokes]) => {
      const visible =
        assignedSection === null || Number(section) === assignedSection;

      if (!visible) return;

      strokes.forEach(s => drawStroke(ctx, s));
    });

    if (currentStrokeRef.current) {
      drawStroke(ctx, currentStrokeRef.current);
    }
  }, [allStrokes, assignedSection, drawBackground, drawStroke]);

  /* -----------------------------
     POINTER EVENTS
  ----------------------------- */

  const handleDown = useCallback((e) => {
    if (!isDrawing || assignedSection === null) return;

    const p = getCanvasPoint(e);
    if (!p || !isAllowedPoint(p.x, p.y)) return;

    setIsPointerDown(true);
    setLastPoint(p);

    const eraser = selectedInstrument === 'eraser';

    currentStrokeRef.current = {
      points: [p],
      size: brushSize,
      color: eraser ? null : currentColor,
      eraser
    };

    onStartStroke?.(p.x, p.y, currentColor, brushSize, eraser);
  }, [isDrawing, assignedSection, brushSize, currentColor, selectedInstrument, getCanvasPoint, isAllowedPoint, onStartStroke]);

  const handleMove = useCallback((e) => {
    if (!isPointerDown || !lastPoint) return;

    const ctx = ctxRef.current;
    const p = getCanvasPoint(e);
    if (!ctx || !p || !isAllowedPoint(p.x, p.y)) return;

    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round';

    if (selectedInstrument === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = currentColor;
    }

    ctx.beginPath();
    ctx.moveTo(lastPoint.x, lastPoint.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    currentStrokeRef.current.points.push(p);
    onAddPoint?.(p.x, p.y);
    setLastPoint(p);
  }, [isPointerDown, lastPoint, brushSize, currentColor, selectedInstrument, getCanvasPoint, isAllowedPoint, onAddPoint]);

  const handleUp = useCallback(() => {
    if (!isPointerDown) return;
    setIsPointerDown(false);
    currentStrokeRef.current = null;
    setLastPoint(null);
    onFinishStroke?.();
  }, [isPointerDown, onFinishStroke]);

  /* -----------------------------
     RENDER
  ----------------------------- */

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
        style={{ width: '100%', height: '100%', touchAction: 'none', display: 'block' }}
      />
    </div>
  );
}
