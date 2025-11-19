import React from 'react';

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
      <div className="logo" style={{ fontSize: 64 }}>🎨</div>
      <p style={{ fontSize: 18, marginTop: 16 }}>{message}</p>
    </div>
  );
}