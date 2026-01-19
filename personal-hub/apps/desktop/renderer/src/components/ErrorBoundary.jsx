import React from 'react';
import { AlertTriangle } from 'lucide-react';
import Button from './Button';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
          textAlign: 'center'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: '20px'
          }}>
            <AlertTriangle size={32} color="#ef4444" />
          </div>

          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '8px',
            color: 'var(--text-primary)'
          }}>
            Something went wrong
          </h3>

          <p style={{
            fontSize: '14px',
            color: 'var(--text-tertiary)',
            marginBottom: '20px',
            maxWidth: '400px'
          }}>
            An error occurred while rendering this component. Try refreshing or contact support if the problem persists.
          </p>

          {this.state.error && (
            <details style={{
              marginBottom: '20px',
              padding: '12px',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-sm)',
              maxWidth: '500px',
              width: '100%',
              textAlign: 'left'
            }}>
              <summary style={{
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '600',
                color: 'var(--text-secondary)',
                marginBottom: '8px'
              }}>
                Error Details
              </summary>
              <pre style={{
                fontSize: '11px',
                fontFamily: 'monospace',
                color: '#ef4444',
                overflow: 'auto',
                margin: 0
              }}>
                {this.state.error.toString()}
                {this.state.errorInfo && '\n\n' + this.state.errorInfo.componentStack}
              </pre>
            </details>
          )}

          <Button onClick={this.handleReset}>
            Try Again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
