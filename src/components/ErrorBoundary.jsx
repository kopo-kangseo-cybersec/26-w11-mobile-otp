import React from 'react';
import { ShieldAlert, RefreshCw } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#0b0f19',
          color: '#f3f4f6',
          fontFamily: 'sans-serif',
          padding: '20px'
        }}>
          <div style={{
            maxWidth: '540px',
            background: '#111827',
            border: '1px solid #ef4444',
            borderRadius: '16px',
            padding: '30px',
            textAlign: 'center',
            boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
          }}>
            <ShieldAlert size={48} color="#ef4444" style={{ marginBottom: '16px' }} />
            <h2 style={{ fontSize: '20px', marginBottom: '10px' }}>화면 렌더링 중 오류가 발생했습니다</h2>
            <p style={{ fontSize: '14px', color: '#9ca3af', marginBottom: '16px', wordBreak: 'break-all' }}>
              {this.state.error?.message || '알 수 없는 오류'}
            </p>
            <button
              onClick={this.handleReload}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: '#3b82f6',
                color: '#fff',
                border: 'none',
                padding: '10px 20px',
                borderRadius: '8px',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} /> 새로고침하여 다시 시도
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
