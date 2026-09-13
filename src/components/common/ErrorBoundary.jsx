import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            backgroundColor: 'var(--bg-page, #f8fafc)',
          }}
        >
          <div
            className="glass-card"
            style={{
              maxWidth: '520px',
              width: '100%',
              padding: '36px 32px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-surface, #ffffff)',
              borderRadius: 'var(--radius-lg, 16px)',
              boxShadow: '0 20px 40px rgba(0,0,0,0.08)',
              border: '1px solid var(--border-subtle, #e2e8f0)',
            }}
          >
            <div
              style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 20px',
              }}
            >
              <AlertTriangle size={32} />
            </div>

            <h2
              style={{
                fontSize: '1.25rem',
                fontWeight: '800',
                color: 'var(--text-primary, #0f172a)',
                marginBottom: '8px',
              }}
            >
              Đã xảy ra sự cố không mong muốn
            </h2>

            <p
              style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary, #64748b)',
                lineHeight: 1.6,
                marginBottom: '24px',
              }}
            >
              Ứng dụng đã ghi nhận lỗi này. Bạn có thể tải lại trang hoặc quay về trang chủ để tiếp tục sử dụng.
            </p>

            {this.state.error && (
              <details
                style={{
                  textAlign: 'left',
                  marginBottom: '24px',
                  padding: '10px 14px',
                  backgroundColor: 'var(--bg-subtle, #f1f5f9)',
                  borderRadius: 'var(--radius-sm, 8px)',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted, #64748b)',
                  cursor: 'pointer',
                }}
              >
                <summary style={{ fontWeight: '600', outline: 'none' }}>Chi tiết kỹ thuật</summary>
                <pre
                  style={{
                    marginTop: '8px',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    color: '#ef4444',
                  }}
                >
                  {this.state.error?.toString()}
                </pre>
              </details>
            )}

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={this.handleGoHome}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Home size={16} /> Về trang chủ
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={this.handleReload}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RefreshCw size={16} /> Tải lại trang
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
