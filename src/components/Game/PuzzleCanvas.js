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
  selectedInstrument = 'pencil',
  totalSections = 3
}) {
  const bgCanvasRef = useRef(null); // Background layer (static)
  const drawCanvasRef = useRef(null); // Drawing layer (with eraser support)
  const drawCtxRef = useRef(null);
  const currentStrokeRef = useRef(null);

  const [isPointerDown, setIsPointerDown] = useState(false);
  const [lastPoint, setLastPoint] = useState(null);

  /* -----------------------------
     CANVAS UTILS
  ----------------------------- */

  const getCanvasPoint = useCallback((e) => {
    const canvas = drawCanvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    const source = e.touches?.[0] ?? e;

    const clientX = source.clientX - rect.left;
    const clientY = source.clientY - rect.top;

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: clientX * scaleX,
      y: clientY * scaleY,
      nx: clientX / rect.width,
      ny: clientY / rect.height
    };
  }, []);

  const isAllowedPoint = useCallback((x, y) => {
    if (assignedSection === null || !drawCanvasRef.current) return false;
    const canvas = drawCanvasRef.current;
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
    // Sfondo bianco opaco
    ctx.fillStyle = 'rgba(255, 255, 255, 1)';
    ctx.fillRect(0, 0, w, h);

    if (!showSectionBorders) return;

    const sectionW = w / totalSections;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#475569';
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
    ctx.lineWidth = stroke.eraser ? stroke.size * 8 : stroke.size;

    if (stroke.eraser) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.strokeStyle = 'rgba(0,0,0,1)';
    } else {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = stroke.color;
    }

    const pts = stroke.points.map(p => {
      if (p.nx !== undefined && p.ny !== undefined) {
        return { x: p.nx * ctx.canvas.width, y: p.ny * ctx.canvas.height };
      }
      return { x: p.x, y: p.y };
    });

    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    pts.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.stroke();

    ctx.globalCompositeOperation = 'source-over';
  }, []);

  /* -----------------------------
     INIT & REDRAW
  ----------------------------- */

  // Initialize canvases
  useEffect(() => {
    const bgCanvas = bgCanvasRef.current;
    const drawCanvas = drawCanvasRef.current;
    if (!bgCanvas || !drawCanvas) return;

    const container = bgCanvas.parentElement;
    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    const maxWidth = containerWidth - 4;
    const maxHeight = containerHeight - 4;

    const dpr = window.devicePixelRatio || 1;

    // Setup background canvas
    bgCanvas.width = maxWidth * dpr;
    bgCanvas.height = maxHeight * dpr;
    bgCanvas.style.width = `${maxWidth}px`;
    bgCanvas.style.height = `${maxHeight}px`;

    const bgCtx = bgCanvas.getContext('2d');
    bgCtx.scale(dpr, dpr);
    drawBackground(bgCtx, maxWidth, maxHeight);

    // Setup drawing canvas
    drawCanvas.width = maxWidth * dpr;
    drawCanvas.height = maxHeight * dpr;
    drawCanvas.style.width = `${maxWidth}px`;
    drawCanvas.style.height = `${maxHeight}px`;

    const drawCtx = drawCanvas.getContext('2d');
    drawCtx.scale(dpr, dpr);
    drawCtxRef.current = drawCtx;
  }, [drawBackground, totalSections]);

  // Redraw strokes on drawing canvas
  useEffect(() => {
    const ctx = drawCtxRef.current;
    const canvas = drawCanvasRef.current;
    if (!ctx || !canvas) return;

    const w = parseFloat(canvas.style.width) || canvas.width;
    const h = parseFloat(canvas.style.height) || canvas.height;

    // Clear only the drawing layer
    ctx.clearRect(0, 0, w, h);

    if (!allStrokes) return;

    Object.entries(allStrokes).forEach(([section, strokes]) => {
      const visible = assignedSection === null || Number(section) === assignedSection;
      if (!visible) return;
      strokes.forEach(s => drawStroke(ctx, s));
    });

    if (currentStrokeRef.current) {
      drawStroke(ctx, currentStrokeRef.current);
    }
  }, [allStrokes, assignedSection, drawStroke]);

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
      points: p.nx !== undefined ? [{ nx: p.nx, ny: p.ny }] : [{ x: p.x, y: p.y }],
      size: brushSize,
      color: eraser ? null : currentColor,
      eraser
    };
    onStartStroke?.(p.nx !== undefined ? p.nx : p.x, p.ny !== undefined ? p.ny : p.y, eraser ? null : currentColor, brushSize, eraser);
  }, [isDrawing, assignedSection, brushSize, currentColor, selectedInstrument, getCanvasPoint, isAllowedPoint, onStartStroke]);

  const handleMove = useCallback((e) => {
    if (!isPointerDown || !lastPoint) return;

    const ctx = drawCtxRef.current;
    const p = getCanvasPoint(e);
    if (!ctx || !p || !isAllowedPoint(p.nx, p.ny)) return;

    ctx.lineWidth = selectedInstrument === 'eraser' ? brushSize * 8 : brushSize;
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
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      {/* Background canvas - static layer */}
      <canvas
        ref={bgCanvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none'
        }}
      />
      {/* Drawing canvas - interactive layer */}
      <canvas
        ref={drawCanvasRef}
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          touchAction: 'none'
        }}
      />
    </div>
  );
}
