import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          padding: 20,
          textAlign: 'center'
        }}>
          <h1 style={{ fontSize: 48 }}>😢</h1>
          <h2>Qualcosa è andato storto!</h2>
          <button 
            onClick={() => window.location.href = '/'}
            style={{
              marginTop: 20,
              padding: '10px 20px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Torna alla Home
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;