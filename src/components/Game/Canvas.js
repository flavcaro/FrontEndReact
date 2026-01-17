import React from 'react';
import { Stage, Layer, Line } from "react-konva";

export default function Canvas({ 
  lines, 
  onMouseDown, 
  onMouseMove, 
  onMouseUp,
  isArtist,
  nickname
}) {
  return (
    <div className="canvas-wrapper">
      <Stage
        width={900}
        height={600}
        className="canvas-stage"
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <Layer>
          {lines.map((line, i) => {
            // Hide transient (temp) strokes from viewers who are not the artist.
            if (line.temp && !isArtist) {
              return null;
            }

            // Use the line's saved color for everyone when available.
            // If the viewer is the artist, show other players' temp lines muted.
            let strokeColor = line.color || "#1e293b";

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
  );
}
