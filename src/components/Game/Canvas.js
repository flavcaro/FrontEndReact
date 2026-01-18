import React, { useRef, useEffect, useState } from 'react';
import { Stage, Layer, Line } from "react-konva";

export default function Canvas({ 
  lines, 
  onMouseDown, 
  onMouseMove, 
  onMouseUp,
  isArtist,
  nickname
}) {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        // Usa il rapporto 16:10 (1.6) e limiti più grandi
        const aspectRatio = 16 / 10;
          let width = clientWidth;
          let height = width / aspectRatio;
          if (height > clientHeight) {
            height = clientHeight;
            width = height * aspectRatio;
          }
        setDimensions({ width, height });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

    return (
      <div className="canvas-wrapper" ref={containerRef}>
        {dimensions.width > 0 && dimensions.height > 0 && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '90vw',
            height: '70vh',
            maxWidth: dimensions.width,
            maxHeight: dimensions.height,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <Stage
              width={Math.min(dimensions.width, window.innerWidth * 0.9)}
              height={Math.min(dimensions.height, window.innerHeight * 0.7)}
              className="canvas-stage"
              onMouseDown={onMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
            >
              <Layer>
                {lines.map((line, i) => {
                  // Use the line's saved color for everyone when available.
                  let strokeColor = line.color || "#1e293b";

                  // If the viewer is the artist, show other players' temp lines muted.
                  if (isArtist && line.temp && line.user !== nickname) {
                    strokeColor = "#cbd5e1";
                  }

                  return (
                    <Line
                      key={line.id || i}
                      points={line.points}
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
          </div>
        )}
      </div>
  );
}
