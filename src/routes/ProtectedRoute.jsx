import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAppAuth } from '../context/AuthContext';

export const ProtectedRoute = ({ allowedRoles = [], children }) => {
  const { isSignedIn, isLoaded, role, loading } = useAppAuth();

  if (!isLoaded || loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-page)',
        color: 'var(--text-secondary)'
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--primary-100)',
            borderTopColor: 'var(--primary-500)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <span>Đang tải thông tin xác thực...</span>
          <style>{`
            @keyframes spin {
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/" replace />;
  }

  if (allowedRoles.length > 0 && role && !allowedRoles.includes(role)) {
    // Redirect to respective home dashboard based on role
    if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (role === 'tutor') return <Navigate to="/teacher/dashboard" replace />;
    return <Navigate to="/student/dashboard" replace />;
  }

  return children;
};
