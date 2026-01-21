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
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    // Log additional context
    console.error('Error stack:', error.stack);
    console.error('Component stack:', errorInfo.componentStack);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
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
          textAlign: 'center',
          background: '#f8fafc'
        }}>
          <h1 style={{ fontSize: 48 }}>😢</h1>
          <h2>Ops! C'è stato un errore</h2>
          <p style={{ color: '#6b7280', margin: '10px 0 20px' }}>
            {this.state.error?.message || 'Errore sconosciuto'}
          </p>
          
          <div style={{ display: 'flex', gap: 10 }}>
            <button 
              onClick={this.handleRetry}
              style={{
                padding: '10px 20px',
                background: '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer'
              }}
            >
              Riprova
            </button>
            
            <button 
              onClick={() => window.location.href = '/'}
              style={{
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

          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: 20, textAlign: 'left', maxWidth: 600 }}>
              <summary style={{ cursor: 'pointer', color: '#6b7280' }}>
                Dettagli errore (solo in sviluppo)
              </summary>
              <pre style={{ 
                background: '#f3f4f6', 
                padding: 10, 
                borderRadius: 4, 
                fontSize: 12,
                overflow: 'auto',
                marginTop: 10
              }}>
                {this.state.error?.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;