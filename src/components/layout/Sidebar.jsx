import React, { useRef } from 'react';
import { NavLink } from 'react-router-dom';
import { useAppAuth } from '../../context/AuthContext';
import { 
  BookOpen, 
  Users, 
  Calendar, 
  FileText, 
  CreditCard, 
  ShieldCheck, 
  GraduationCap,
  LayoutDashboard
} from 'lucide-react';

const routePreloaders = {
  '/admin/dashboard': () => import('../../pages/admin/AdminDashboard'),
  '/admin/applications': () => import('../../pages/admin/AdminApplications'),
  '/admin/users': () => import('../../pages/admin/AdminUsers'),
  '/teacher/dashboard': () => import('../../pages/teacher/TeacherDashboard'),
  '/teacher/classes': () => import('../../pages/teacher/TeacherClasses'),
  '/teacher/students': () => import('../../pages/teacher/TeacherStudents'),
  '/teacher/courses': () => import('../../pages/teacher/TeacherCourses'),
  '/teacher/quizzes': () => import('../../pages/teacher/TeacherQuizzes'),
  '/teacher/assignments': () => import('../../pages/teacher/TeacherAssignments'),
  '/teacher/schedules': () => import('../../pages/teacher/TeacherSchedules'),
  '/teacher/tuition': () => import('../../pages/teacher/TeacherTuition'),
  '/student/dashboard': () => import('../../pages/student/StudentDashboard'),
  '/student/classes': () => import('../../pages/student/StudentClasses'),
  '/student/schedules': () => import('../../pages/student/StudentSchedules'),
  '/student/assignments': () => import('../../pages/student/StudentAssignments'),
  '/student/tuition': () => import('../../pages/student/StudentTuition'),
};

export const Sidebar = () => {
  const { role } = useAppAuth();
  const hoverTimerRef = useRef(null);

  const handleMouseEnter = (to) => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = setTimeout(() => {
      if (routePreloaders[to]) {
        routePreloaders[to]();
      }
    }, 100);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const getNavItems = () => {
    switch (role) {
      case 'admin':
        return [
          { to: '/admin/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
          { to: '/admin/applications', label: 'Duyệt gia sư', icon: ShieldCheck },
          { to: '/admin/users', label: 'Người dùng', icon: Users },
        ];
      case 'tutor':
        return [
          { to: '/teacher/dashboard', label: 'Sổ Gia Sư', icon: LayoutDashboard },
          { to: '/teacher/classes', label: 'Lớp học', icon: Users },
          { to: '/teacher/students', label: 'Học sinh & Báo cáo', icon: GraduationCap },
          { to: '/teacher/courses', label: 'Khóa học & Bài giảng', icon: BookOpen },
          { to: '/teacher/quizzes', label: 'Đề thi & Câu hỏi', icon: FileText },
          { to: '/teacher/assignments', label: 'Bài tập về nhà', icon: FileText },
          { to: '/teacher/schedules', label: 'Lịch dạy & Điểm danh', icon: Calendar },
          { to: '/teacher/tuition', label: 'Học phí', icon: CreditCard },
        ];
      case 'student':
      default:
        return [
          { to: '/student/dashboard', label: 'Góc học tập', icon: LayoutDashboard },
          { to: '/student/classes', label: 'Lớp của tôi', icon: GraduationCap },
          { to: '/student/schedules', label: 'Lịch học', icon: Calendar },
          { to: '/student/assignments', label: 'Bài tập & Điểm thi', icon: FileText },
          { to: '/student/tuition', label: 'Học phí', icon: CreditCard },
        ];
    }
  };

  const navItems = getNavItems();

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      backgroundColor: 'var(--bg-surface)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      padding: '24px 16px',
      gap: '24px',
      flexShrink: 0
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px' }}>
        <div style={{
          width: '36px',
          height: '36px',
          borderRadius: '10px',
          backgroundColor: 'var(--primary-500)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontWeight: '700',
          fontSize: '18px'
        }}>
          L
        </div>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: '700', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
            LearnMate
          </h2>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>LMS Gia Sư</span>
        </div>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              onMouseEnter={() => handleMouseEnter(item.to)}
              onMouseLeave={handleMouseLeave}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                fontWeight: isActive ? '600' : '500',
                color: isActive ? 'var(--primary-600)' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--primary-50)' : 'transparent',
                transition: 'all 0.15s ease'
              })}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
};

