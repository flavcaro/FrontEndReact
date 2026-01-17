import React from 'react';

const PALETTE = ['#1e293b','#667eea','#22c55e','#f59e0b','#ef4444','#3b82f6','#ec4899','#14b8a6'];

export default function Palette({ selectedColor, onChangeColor, selectedInstrument = 'pencil', onChangeInstrument }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={() => onChangeInstrument && onChangeInstrument('pencil')}
          title="Pencil"
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: selectedInstrument === 'pencil' ? '3px solid #fff' : '2px solid rgba(0,0,0,0.08)',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16
          }}
        >
          ✏️
        </button>

        <button
          onClick={() => onChangeInstrument && onChangeInstrument('eraser')}
          title="Eraser"
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            border: selectedInstrument === 'eraser' ? '3px solid #fff' : '2px solid rgba(0,0,0,0.08)',
            background: '#fff',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16
          }}
        >
          🧽
        </button>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', opacity: selectedInstrument === 'eraser' ? 0.5 : 1 }}>
        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => onChangeColor && onChangeColor(c)}
            title={c}
            disabled={selectedInstrument === 'eraser'}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              border: c === selectedColor ? '3px solid #fff' : '2px solid rgba(0,0,0,0.08)',
              boxShadow: c === selectedColor ? '0 0 0 3px rgba(99,102,241,0.15)' : undefined,
              background: c,
              cursor: selectedInstrument === 'eraser' ? 'not-allowed' : 'pointer',
              padding: 0
            }}
          />
        ))}
      </div>
    </div>
  );
}
