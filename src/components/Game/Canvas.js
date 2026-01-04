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
            // Show other players' temporary lines in gray, everything else in black
            const isOtherTempLine = line.temp && line.user !== nickname;
            const strokeColor = isOtherTempLine ? "#cbd5e1" : "#1e293b";
            
            return (
              <Line
                key={line.id || i}
                points={line.points}
                stroke={strokeColor}
                strokeWidth={3}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
              />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
