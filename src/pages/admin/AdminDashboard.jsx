import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { ShieldCheck, Users, GraduationCap, BookOpen, Clock, ArrowRight, UserCheck, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

export const AdminDashboard = () => {
  const { profile, supabaseClient } = useAppAuth();

  const [stats, setStats] = useState({
    pendingApplications: 0,
    totalUsers: 0,
    tutorCount: 0,
    studentCount: 0,
    totalClasses: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdminStats = async () => {
      try {
        setLoading(true);

        const [appRes, usersRes, classesRes] = await Promise.all([
          supabaseClient
            .from('tutor_applications')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'PENDING'),
          supabaseClient
            .from('profiles')
            .select('role'),
          supabaseClient
            .from('classes')
            .select('id', { count: 'exact', head: true }),
        ]);

        const allUsers = usersRes.data || [];
        const tutors = allUsers.filter((u) => u.role === 'tutor').length;
        const students = allUsers.filter((u) => u.role === 'student').length;

        setStats({
          pendingApplications: appRes.count || 0,
          totalUsers: allUsers.length,
          tutorCount: tutors,
          studentCount: students,
          totalClasses: classesRes.count || 0,
        });
      } catch (err) {
        console.error('Error fetching admin dashboard stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAdminStats();
  }, [supabaseClient]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Quản Trị Hệ Thống 🛡️
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
          Bảng điều khiển quản trị tổng quan hệ thống LearnMate ({profile?.full_name || 'Admin'}).
        </p>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>ĐƠN XIN LÀM GIA SƯ</span>
            <ShieldCheck size={18} color="var(--warning-500)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '8px', color: stats.pendingApplications > 0 ? 'var(--warning-600)' : 'var(--text-primary)' }}>
            {stats.pendingApplications}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {stats.pendingApplications > 0 ? 'Cần xét duyệt ngay' : 'Không có đơn chờ'}
          </span>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>TỔNG NGƯỜI DÙNG</span>
            <Users size={18} color="var(--primary-500)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '8px', color: 'var(--text-primary)' }}>
            {stats.totalUsers}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {stats.tutorCount} Gia sư • {stats.studentCount} Học sinh
          </span>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>TỔNG LỚP HỌC</span>
            <GraduationCap size={18} color="var(--success-500)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '8px', color: 'var(--success-600)' }}>
            {stats.totalClasses}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lớp học đang mở</span>
        </div>
      </div>

      {/* Quick Navigation Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <ShieldCheck size={20} color="var(--primary-500)" />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Duyệt Đơn Đăng Ký Gia Sư</h3>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Xem xét các yêu cầu nâng cấp tài khoản từ học sinh thành gia sư kèm lời giới thiệu và kinh nghiệm.
          </p>
          <Link to="/admin/applications" className="btn btn-primary btn-sm" style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>
            Xem danh sách đơn ({stats.pendingApplications}) <ArrowRight size={14} />
          </Link>
        </div>

        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <UserCheck size={20} color="var(--success-500)" />
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Quản Lý Người Dùng & Phân Quyền</h3>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Thêm mới tài khoản, chỉnh sửa thông tin, đổi vai trò (Admin / Gia sư / Học sinh) hoặc khóa tài khoản.
          </p>
          <Link to="/admin/users" className="btn btn-secondary btn-sm" style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>
            Quản lý tài khoản <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};
