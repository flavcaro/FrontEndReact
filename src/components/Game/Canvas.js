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
        // Canvas quadrata (1:1)
        let size = Math.min(clientWidth, clientHeight);
        setDimensions({ width: size, height: size });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

    return (
      <div className="canvas-wrapper" ref={containerRef} style={{ width: dimensions.width || '100%', height: dimensions.height || '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
        {dimensions.width > 0 && dimensions.height > 0 && (
          <Stage
            width={dimensions.width}
            height={dimensions.height}
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
                    points={line.points.map((p, i) => i % 2 === 0 ? p * dimensions.width : p * dimensions.height)}
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
