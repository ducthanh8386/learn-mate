import React from 'react';
import { SignInButton, SignUpButton, useUser } from '@clerk/clerk-react';
import { Navigate, Link } from 'react-router-dom';
import { BookOpen, ShieldCheck, GraduationCap, Sparkles, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAppAuth } from '../context/AuthContext';

export const LandingPage = () => {
  const { isSignedIn, role } = useAppAuth();

  if (isSignedIn) {
    if (role === 'admin') return <Navigate to="/admin/dashboard" replace />;
    if (role === 'tutor') return <Navigate to="/teacher/dashboard" replace />;
    return <Navigate to="/student/dashboard" replace />;
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-page)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        padding: '16px 40px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--glass-bg)',
        backdropFilter: 'var(--glass-blur)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
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
          <span style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>LearnMate</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link to="/auth">
            <button className="btn btn-secondary">Đăng nhập</button>
          </Link>
          <Link to="/auth">
            <button className="btn btn-primary">Bắt đầu ngay</button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 20px' }}>
        <div style={{ maxWidth: '800px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px' }}>
          <div className="badge badge-primary" style={{ padding: '6px 14px', fontSize: '0.875rem', gap: '6px' }}>
            <Sparkles size={14} /> Nền tảng LMS Gia Sư & Trung Tâm Tinh Gọn
          </div>

          <h1 style={{
            fontSize: '3rem',
            lineHeight: 1.15,
            fontWeight: '800',
            letterSpacing: '-0.03em',
            color: 'var(--text-primary)'
          }}>
            Quản lý lớp học thông minh, đồng hành cùng từng học sinh
          </h1>

          <p style={{ fontSize: '1.125rem', color: 'var(--text-secondary)', maxWidth: '640px', lineHeight: 1.6 }}>
            Tích hợp toàn diện: Lịch dạy, bài giảng YouTube, ngân hàng câu hỏi, bài tập về nhà, điểm danh và quản lý học phí chỉ trong một trang sổ điện tử tinh giản.
          </p>

          <div style={{ display: 'flex', gap: '16px', marginTop: '12px' }}>
            <Link to="/auth">
              <button className="btn btn-primary" style={{ padding: '12px 28px', fontSize: '1rem' }}>
                Tham gia ngay <ArrowRight size={18} />
              </button>
            </Link>
          </div>

          {/* Key Features Preview */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '20px',
            width: '100%',
            marginTop: '40px'
          }}>
            <div className="glass-card" style={{ padding: '24px', textAlign: 'left' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--primary-50)', color: 'var(--primary-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <BookOpen size={20} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '6px' }}>Khóa học & Bài giảng</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Cây nội dung 3 cấp, nhúng video YouTube & tài liệu nén PDF an toàn.</p>
            </div>

            <div className="glass-card" style={{ padding: '24px', textAlign: 'left' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--success-50)', color: 'var(--success-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <GraduationCap size={20} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '6px' }}>Đề thi & Tự chấm</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Chấm điểm tự động qua Serverless Edge Function bảo mật cao.</p>
            </div>

            <div className="glass-card" style={{ padding: '24px', textAlign: 'left' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'var(--warning-50)', color: 'var(--warning-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <ShieldCheck size={20} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '6px' }}>Sổ Gia Sư Vận Hành</h3>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Lịch Zoom/Meet, điểm danh 1 chạm, theo dõi tiến độ và học phí.</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};
