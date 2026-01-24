import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Line } from "react-konva";

export default function Canvas({ 
  lines = [], 
  onMouseDown, 
  onMouseMove, 
  onMouseUp,
  isArtist,
  nickname,
  chaosEffects
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (!containerRef.current) return;

      const container = containerRef.current;
      const clientWidth = container.clientWidth;

      // Calculate available vertical space in the viewport.
      // Subtract header/chat/players heights when layout stacks them (portrait / narrow screens).
      const vh = window.innerHeight || document.documentElement.clientHeight;
      const header = document.querySelector('.board-header');
      const chat = document.querySelector('.chat-sidebar');
      const players = document.querySelector('.players-sidebar');

      const headerH = header && header.offsetParent !== null ? header.getBoundingClientRect().height : 0;
      const chatH = chat && chat.offsetParent !== null ? chat.getBoundingClientRect().height : 0;
      const playersH = players && players.offsetParent !== null ? players.getBoundingClientRect().height : 0;

      const isPortrait = window.matchMedia && window.matchMedia('(orientation: portrait)').matches;

      // If portrait or narrow, chat and players are stacked vertically and should be subtracted.
      const subtract = isPortrait || window.innerWidth <= 1024 ? (headerH + chatH + playersH + 12) : (headerH + 12);

      const availableHeight = Math.max(160, Math.floor(vh - subtract));

      // Use square canvas: limited by available width and availableHeight
      const size = Math.max(160, Math.min(clientWidth, availableHeight));
      setDimensions({ width: size, height: size });
    };

    updateDimensions();

    const node = containerRef.current;
    let ro;
    if (typeof ResizeObserver !== 'undefined' && node) {
      ro = new ResizeObserver(updateDimensions);
      ro.observe(node);
    }

    window.addEventListener('resize', updateDimensions);
    document.addEventListener('fullscreenchange', updateDimensions);

    return () => {
      if (ro && node) ro.unobserve(node);
      window.removeEventListener('resize', updateDimensions);
      document.removeEventListener('fullscreenchange', updateDimensions);
    };
  }, []);

  // Build combined visual styles while preserving multiple transforms
  const visualEffects = Array.isArray(chaosEffects) ? chaosEffects.filter(e => e && e.type === 'visual') : [];
  const transformParts = [];
  const otherStyle = {};
  visualEffects.forEach(effect => {
    if (effect.style) {
      if (effect.style.transform) transformParts.push(effect.style.transform);
      Object.keys(effect.style).forEach(k => {
        if (k !== 'transform') otherStyle[k] = effect.style[k];
      });
    }
  });

  const wrapperStyle = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
    transform: transformParts.join(' '),
    transformOrigin: 'center center',
    ...otherStyle
  };

  // If tremble visual present, animate inner container instead of overriding transforms
  const trembleActive = Array.isArray(chaosEffects) && chaosEffects.some(e => e && e.id === 'trembleVisual');

  // Ensure keyframes for tremble animation exist once
  useEffect(() => {
    if (!trembleActive) return;
    const styleId = 'chaos-tremble-keyframes';
    if (document.getElementById(styleId)) return;
    const style = document.createElement('style');
    style.id = styleId;
    style.innerHTML = `@keyframes chaos-tremble { 0% { transform: translate(0,0); } 25% { transform: translate(-1px,1px); } 50% { transform: translate(1px,-1px); } 75% { transform: translate(-1px,-1px); } 100% { transform: translate(0,0); } }`;
    document.head.appendChild(style);
  }, [trembleActive]);

  const innerStyle = trembleActive ? { animation: 'chaos-tremble 0.12s infinite' } : {};

  return (
    <div
      className="canvas-wrapper"
      ref={containerRef}
      style={wrapperStyle}
    >
      {/* Artist feedback badge: show which malus affect the current artist */}
      {isArtist && Array.isArray(chaosEffects) && chaosEffects.length > 0 && (
        <div style={{ position: 'absolute', left: 12, top: 12, zIndex: 30 }}>
          <div style={{ background: 'rgba(255,245,245,0.95)', color: '#7f1d1d', padding: '8px 10px', borderRadius: 8, boxShadow: '0 2px 6px rgba(0,0,0,0.12)', fontWeight: 700 }}>
            <div style={{ fontSize: 12, opacity: 0.9 }}>Malus attivo</div>
            <div style={{ fontSize: 14, marginTop: 4 }}>
              {chaosEffects.map((e, i) => (
                <span key={e.id + i} style={{ display: 'inline-block', marginRight: 8 }}>
                  {e.name}{e.params ? ` (${Object.entries(e.params).map(([k,v]) => `${k}:${v}`).join(',')})` : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', ...innerStyle }}>
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Stage
            width={dimensions.width}
            height={dimensions.height}
            className="canvas-stage"
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={onMouseDown}
            onTouchMove={onMouseMove}
            onTouchEnd={onMouseUp}
          >
            <Layer>
              {lines.map((line, i) => {
                let strokeColor = line && line.color ? line.color : "#1e293b";
                if (isArtist && line && line.temp && line.user !== nickname) {
                  strokeColor = "#cbd5e1";
                }

                const pts = Array.isArray(line && line.points) ? line.points : [];

                return (
                  <Line
                    key={(line && line.id) || i}
                    points={pts.map((p, idx) => (idx % 2 === 0 ? p * dimensions.width : p * dimensions.height))}
                    stroke={strokeColor}
                    strokeWidth={line && line.eraser ? 20 : 3}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={line && line.eraser ? 'destination-out' : 'source-over'}
                  />
                );
              })}
            </Layer>
          </Stage>
        )}
      </div>
    </div>
  );
}