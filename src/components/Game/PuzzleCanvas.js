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
      // Return both pixel coords (canvas internal pixels) and normalized coords (0..1)
      x: clientX * scaleX,
      y: clientY * scaleY,
      nx: clientX / rect.width,
      ny: clientY / rect.height
    };
  }, []);

  const isAllowedPoint = useCallback((x, y) => {
    if (assignedSection === null || !canvasRef.current) return false;
    // x,y may be normalized or pixel coords; detect normalized (0..1)
    const canvas = canvasRef.current;
    const px = (x > 0 && x <= 1) ? Math.round(x * canvas.width) : x;
    const py = (y > 0 && y <= 1) ? Math.round(y * canvas.height) : y;
    return isPointInSection(
      px,
      py,
      assignedSection,
      canvas.width,
      canvas.height,
      totalSections
    );
  }, [assignedSection, totalSections]);

  /* -----------------------------
     DRAW HELPERS
  ----------------------------- */

  const drawBackground = useCallback((ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    // Sfondo trasparente o leggermente colorato per integrarsi con il gradiente
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(0, 0, w, h);

    if (!showSectionBorders) return;

    const sectionW = w / totalSections;
    ctx.setLineDash([4, 4]);
    // Colore più visibile sia su mobile che desktop
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 1;

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

    // Points are stored normalized (nx, ny) or pixel; detect and map to pixels
    const pts = stroke.points.map(p => {
      if (p.nx !== undefined && p.ny !== undefined) {
        return { x: p.nx * ctx.canvas.width, y: p.ny * ctx.canvas.height };
      }
      // legacy support: numeric x/y pixels
      return { x: p.x, y: p.y };
    });

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
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

    // Su mobile sottrae spazio per chat (180px) + header (~150px), su desktop usa 0.4 della viewport
    const isMobile = window.innerWidth <= 768;
    const availableHeight = isMobile 
      ? window.innerHeight - 380  // Sottrae chat + header + margini + padding extra
      : window.innerHeight * 0.4;  // Su desktop 40% della viewport
    const size = Math.min(canvas.parentElement.clientWidth * 0.9, availableHeight);
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
      const visible = assignedSection === null || Number(section) === assignedSection;

      if (!visible) return;

      strokes.forEach(s => drawStroke(ctx, s));
    });

    if (currentStrokeRef.current) {
      // currentStrokeRef may hold normalized points (nx,ny)
      drawStroke(ctx, currentStrokeRef.current);
    }
  }, [allStrokes, assignedSection, drawBackground, drawStroke]);

  /* -----------------------------
     POINTER EVENTS
  ----------------------------- */

  const handleDown = useCallback((e) => {
    if (!isDrawing || assignedSection === null) return;

    const p = getCanvasPoint(e);
    if (!p || !isAllowedPoint(p.nx, p.ny)) return;

    setIsPointerDown(true);
    setLastPoint(p);

    const eraser = selectedInstrument === 'eraser';

    currentStrokeRef.current = {
      // store normalized coords for cross-client compatibility
      points: p.nx !== undefined ? [{ nx: p.nx, ny: p.ny }] : [{ x: p.x, y: p.y }],
      size: brushSize,
      color: eraser ? null : currentColor,
      eraser
    };
    onStartStroke?.(p.nx !== undefined ? p.nx : p.x, p.ny !== undefined ? p.ny : p.y, currentColor, brushSize, eraser);
  }, [isDrawing, assignedSection, brushSize, currentColor, selectedInstrument, getCanvasPoint, isAllowedPoint, onStartStroke]);

  const handleMove = useCallback((e) => {
    if (!isPointerDown || !lastPoint) return;

    const ctx = ctxRef.current;
    const p = getCanvasPoint(e);
    if (!ctx || !p || !isAllowedPoint(p.nx, p.ny)) return;

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

    currentStrokeRef.current.points.push(p.nx !== undefined ? { nx: p.nx, ny: p.ny } : { x: p.x, y: p.y });
    onAddPoint?.(p.nx !== undefined ? p.nx : p.x, p.ny !== undefined ? p.ny : p.y);
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
