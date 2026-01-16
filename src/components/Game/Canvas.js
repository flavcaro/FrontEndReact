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
            // Mostra le linee temporanee in nero per tutti tranne che per gli altri giocatori che stanno disegnando
            let strokeColor = "#1e293b";
            // Se NON sono l'artista, tutte le linee sono nere
            // Se SONO l'artista, solo le mie temp sono nere, le temp degli altri (teoricamente non dovrebbero esserci) sono grigie
            if (isArtist) {
              if (line.temp && line.user !== nickname) {
                strokeColor = "#cbd5e1";
              }
            }
            // Se non sono l'artista, tutte nere (anche le temp)
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
