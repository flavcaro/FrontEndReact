import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Line } from "react-konva";

export default function Canvas({ 
  lines, 
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
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        const size = Math.min(clientWidth, clientHeight);
        setDimensions({ width: size, height: size });
      }
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

  const chaosStyle = chaosEffects ? chaosEffects.reduce((acc, effect) => ({ ...acc, ...effect.style }), {}) : {};

  return (
    <div
      className="canvas-wrapper"
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
        ...chaosStyle
      }}
    >
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
              let strokeColor = line.color || "#1e293b";
              if (isArtist && line.temp && line.user !== nickname) {
                strokeColor = "#cbd5e1";
              }

              return (
                <Line
                  key={line.id || i}
                  points={line.points.map((p, idx) => (idx % 2 === 0 ? p * dimensions.width : p * dimensions.height))}
                  stroke={strokeColor}
                  strokeWidth={line.eraser ? 20 : 3}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={line.eraser ? 'destination-out' : 'source-over'}
                />
              );
            })}
          </Layer>
        </Stage>
      )}
    </div>
  );
}