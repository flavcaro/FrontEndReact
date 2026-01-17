import React from 'react';

const PALETTE = ['#1e293b','#667eea','#22c55e','#f59e0b','#ef4444','#3b82f6','#ec4899','#14b8a6'];

export default function Palette({ selectedColor, onChangeColor }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      {PALETTE.map((c) => (
        <button
          key={c}
          onClick={() => onChangeColor && onChangeColor(c)}
          title={c}
          style={{
            width: 28,
            height: 28,
            borderRadius: 6,
            border: c === selectedColor ? '3px solid #fff' : '2px solid rgba(0,0,0,0.08)',
            boxShadow: c === selectedColor ? '0 0 0 3px rgba(99,102,241,0.15)' : undefined,
            background: c,
            cursor: 'pointer',
            padding: 0
          }}
        />
      ))}
    </div>
  );
}
