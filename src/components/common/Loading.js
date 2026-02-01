import React from 'react';
import classicGif from '../../sprites/logo.gif';

export default function Loading({ message = "Caricamento..." }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      color: 'white'
    }}>
      <div className="logo">
        <img src={classicGif} alt="SketchUp" style={{ width: '72px', height: '72px', imageRendering: 'pixelated' }} />
      </div>
      <p style={{ fontSize: 18, marginTop: 16 }}>{message}</p>
    </div>
  );
}