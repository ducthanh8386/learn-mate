import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

/**
 * Reusable ErrorState Component
 * Hiển thị thông báo khi gặp lỗi tải dữ liệu từ Supabase/Network kèm nút "Thử lại"
 */
export const ErrorState = ({
  message = 'Không thể tải dữ liệu. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.',
  onRetry,
  style = {},
}) => {
  return (
    <div
      className="glass-card"
      role="alert"
      style={{
        padding: '32px 24px',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        backgroundColor: 'var(--danger-50)',
        border: '1px solid var(--danger-100)',
        borderRadius: 'var(--radius-lg)',
        ...style,
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          backgroundColor: 'var(--danger-100)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--danger-600)',
        }}
      >
        <AlertCircle size={24} />
      </div>

      <div>
        <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--danger-700)', margin: 0 }}>
          Đã xảy ra lỗi
        </h4>
        <p style={{ fontSize: '0.875rem', color: 'var(--danger-600)', marginTop: '4px', maxWidth: '480px' }}>
          {message}
        </p>
      </div>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="btn btn-sm btn-secondary"
          style={{
            marginTop: '4px',
            borderColor: 'var(--danger-200)',
            color: 'var(--danger-700)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <RotateCcw size={14} />
          <span>Thử lại</span>
        </button>
      )}
    </div>
  );
};
