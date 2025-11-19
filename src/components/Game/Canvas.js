import React from 'react';
import { Stage, Layer, Line } from "react-konva";

export default function Canvas({ 
  lines, 
  onMouseDown, 
  onMouseMove, 
  onMouseUp 
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
          {lines.map((line, i) => (
            <Line
              key={line.id || i}
              points={line.points}
              stroke={line.temp ? "#cbd5e1" : "#1e293b"}
              strokeWidth={3}
              tension={0.5}
              lineCap="round"
              lineJoin="round"
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
}
