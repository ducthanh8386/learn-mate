import React from 'react';
import { UserButton } from '@clerk/clerk-react';
import { useAppAuth } from '../../context/AuthContext';
import { Bell, Moon, Sun, ShieldAlert, Sparkles, UserCheck, Menu } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { NotificationBell } from '../notifications/NotificationBell';

export const Header = ({ onToggleMobileSidebar }) => {
  const { profile, role, realRole, isImpersonating, setImpersonatedRole } = useAppAuth();
  const [isDark, setIsDark] = React.useState(false);
  const navigate = useNavigate();

  const toggleTheme = () => {
    const nextTheme = isDark ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextTheme);
    setIsDark(!isDark);
  };

  const handleSwitchRole = (newRole) => {
    if (newRole === realRole) {
      setImpersonatedRole(null);
    } else {
      setImpersonatedRole(newRole);
    }

    // Navigate to role home
    if (newRole === 'admin') navigate('/admin/dashboard');
    else if (newRole === 'tutor') navigate('/teacher/dashboard');
    else navigate('/student/dashboard');
  };

  const getRoleBadge = (r) => {
    switch (r) {
      case 'admin':
        return <span className="badge badge-danger">Admin</span>;
      case 'tutor':
        return <span className="badge badge-primary">Gia sư</span>;
      case 'student':
      default:
        return <span className="badge badge-success">Học sinh</span>;
    }
  };

  return (
    <header style={{
      height: 'var(--header-height)',
      backgroundColor: 'var(--bg-surface)',
      borderBottom: '1px solid var(--border-subtle)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      position: 'sticky',
      top: 0,
      zIndex: 10
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Mobile Hamburger Toggle */}
        <button
          onClick={onToggleMobileSidebar}
          className="mobile-only btn btn-secondary btn-sm"
          style={{ padding: '6px 8px', borderRadius: 'var(--radius-sm)' }}
          aria-label="Mở menu thanh bên"
          title="Mở menu"
        >
          <Menu size={20} />
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="desktop-only" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Vai trò:</span>
          {getRoleBadge(role)}
        </div>

        {/* Role Switcher for Admin test mode */}
        {realRole === 'admin' && (
          <div className="desktop-only" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            backgroundColor: 'var(--bg-subtle)',
            padding: '4px 10px',
            borderRadius: 'var(--radius-full)',
            border: '1px solid var(--border-subtle)'
          }}>
            <Sparkles size={14} color="var(--primary-500)" />
            <span style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' }}>Xem với tư cách:</span>
            <select
              value={role}
              onChange={(e) => handleSwitchRole(e.target.value)}
              style={{
                border: 'none',
                backgroundColor: 'transparent',
                fontSize: '0.8125rem',
                fontWeight: '700',
                color: 'var(--primary-600)',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="admin">Quản trị Admin</option>
              <option value="tutor">Gia Sư (Tutor)</option>
              <option value="student">Học Sinh (Student)</option>
            </select>
            {isImpersonating && (
              <span className="badge badge-warning" style={{ fontSize: '0.6875rem', padding: '1px 6px' }}>
                Test Mode
              </span>
            )}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={toggleTheme}
          className="btn btn-secondary btn-sm"
          style={{ padding: '8px', borderRadius: 'var(--radius-full)' }}
          title="Đổi giao diện Sáng / Tối"
        >
          {isDark ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <NotificationBell />

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <UserButton afterSignOutUrl="/" />
          {profile && (
            <div className="desktop-only" style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.full_name || 'Người dùng'}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
