import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { 
  Users, 
  Calendar, 
  AlertCircle, 
  BookOpen, 
  Clock, 
  ArrowRight, 
  Plus, 
  Video, 
  CheckCircle2, 
  DollarSign, 
  Award,
  ChevronRight,
  TrendingUp,
  Receipt
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const TeacherDashboard = () => {
  const { profile, supabaseClient } = useAppAuth();

  const [stats, setStats] = useState({
    classCount: 0,
    studentCount: 0,
    pendingGradingCount: 0,
    totalTuitionCollected: 0,
    totalTuitionPending: 0,
  });

  // The 4 Core Dashboard Blocks
  const [upcomingSchedule, setUpcomingSchedule] = useState(null);
  const [unmarkedSchedules, setUnmarkedSchedules] = useState([]);
  const [pendingSubmissions, setPendingSubmissions] = useState([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);

  const [loading, setLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // 1. Classes & Students Count
      const { data: classesData } = await supabaseClient.from('classes').select('id');
      const classIds = (classesData || []).map((c) => c.id);

      const { count: studentCount } = await supabaseClient
        .from('class_members')
        .select('*', { count: 'exact', head: true });

      // 2. Upcoming Schedule (Next 24 hours)
      const { data: upSch } = await supabaseClient
        .from('schedules')
        .select('*, classes(name)')
        .gte('start_time', now.toISOString())
        .lte('start_time', in24Hours.toISOString())
        .order('start_time', { ascending: true })
        .limit(1);

      setUpcomingSchedule(upSch?.[0] || null);

      // 3. Past Schedules with No Attendance Marked
      if (classIds.length > 0) {
        const { data: pastSch } = await supabaseClient
          .from('schedules')
          .select('*, classes(name), attendance(count)')
          .in('class_id', classIds)
          .lt('end_time', now.toISOString())
          .order('end_time', { ascending: false })
          .limit(10);

        const unmarked = (pastSch || []).filter((s) => (s.attendance?.[0]?.count || 0) === 0);
        setUnmarkedSchedules(unmarked);
      }

      // 4. Pending Assignment Submissions needing grading
      const { data: subList } = await supabaseClient
        .from('assignment_submissions')
        .select(`
          id,
          submitted_at,
          assignments (id, title, max_score, classes(name)),
          profiles:student_id (full_name)
        `)
        .eq('status', 'SUBMITTED')
        .order('submitted_at', { ascending: true })
        .limit(5);

      setPendingSubmissions(subList || []);

      // 5. Tuition Overview
      const { data: invList } = await supabaseClient
        .from('tuition_invoices')
        .select('amount_due, amount_paid, status, period, due_date, profiles:student_id(full_name), classes(name)');

      let collected = 0;
      let pending = 0;
      const unpaid = [];

      (invList || []).forEach((inv) => {
        collected += Number(inv.amount_paid) || 0;
        const due = Math.max(0, (Number(inv.amount_due) || 0) - (Number(inv.amount_paid) || 0));
        if (inv.status !== 'paid') {
          pending += due;
          unpaid.push(inv);
        }
      });

      setUnpaidInvoices(unpaid.slice(0, 5));

      setStats({
        classCount: classesData?.length || 0,
        studentCount: studentCount || 0,
        pendingGradingCount: subList?.length || 0,
        totalTuitionCollected: collected,
        totalTuitionPending: pending,
      });
    } catch (err) {
      console.error('Error fetching teacher dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [supabaseClient]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Sổ Gia Sư 👋
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Chào mừng thầy/cô <strong>{profile?.full_name || 'Gia sư'}</strong>! Dưới đây là tình hình lớp học hôm nay.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <Link to="/teacher/schedules" className="btn btn-secondary btn-sm">
            <Calendar size={16} /> Lên lịch dạy
          </Link>
          <Link to="/teacher/classes" className="btn btn-primary btn-sm">
            <Plus size={16} /> Quản lý lớp
          </Link>
        </div>
      </div>

      {/* Top 4 Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>LỚP ĐANG DẠY</span>
            <Users size={18} color="var(--primary-500)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '8px', color: 'var(--text-primary)' }}>
            {stats.classCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stats.studentCount} học sinh đang học</span>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>BÀI TẬP CẦN CHẤM</span>
            <AlertCircle size={18} color={stats.pendingGradingCount > 0 ? 'var(--warning-500)' : 'var(--success-500)'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '8px', color: stats.pendingGradingCount > 0 ? 'var(--warning-600)' : 'var(--text-primary)' }}>
            {stats.pendingGradingCount}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>bài nộp chưa chấm điểm</span>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>ĐÃ THU THÁNG NÀY</span>
            <TrendingUp size={18} color="var(--success-500)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '8px', color: 'var(--success-600)' }}>
            {stats.totalTuitionCollected.toLocaleString('vi-VN')} đ
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Học phí đã nhận</span>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>HỌC PHÍ CHƯA THU</span>
            <Receipt size={18} color="var(--primary-500)" />
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', marginTop: '8px', color: 'var(--primary-600)' }}>
            {stats.totalTuitionPending.toLocaleString('vi-VN')} đ
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Cần thu từ học sinh</span>
        </div>
      </div>

      {/* 4 Core SRS Blocks (2x2 Grid) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        
        {/* Block 1: Sắp Diễn Ra */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={18} color="var(--primary-500)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Buổi Dạy Sắp Tới (24h)</h3>
            </div>
            <Link to="/teacher/schedules" style={{ fontSize: '0.8125rem', color: 'var(--primary-600)', fontWeight: '600' }}>
              Xem lịch ➔
            </Link>
          </div>

          {upcomingSchedule ? (
            <div style={{
              backgroundColor: 'var(--bg-page)',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div>
                <span className="badge badge-primary" style={{ marginBottom: '4px' }}>
                  {upcomingSchedule.classes?.name}
                </span>
                <h4 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {upcomingSchedule.title}
                </h4>
              </div>

              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                Thời gian: {new Date(upcomingSchedule.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(upcomingSchedule.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} ({new Date(upcomingSchedule.start_time).toLocaleDateString('vi-VN')})
              </div>

              {upcomingSchedule.meeting_url && (
                <a
                  href={upcomingSchedule.meeting_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary btn-sm"
                  style={{ marginTop: '6px', justifyContent: 'center' }}
                >
                  <Video size={14} /> Bắt đầu phòng học Zoom/Meet
                </a>
              )}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Không có buổi học nào trong 24 giờ tới.
            </div>
          )}
        </div>

        {/* Block 2: Chưa Điểm Danh */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="var(--warning-500)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>
                Chưa Điểm Danh ({unmarkedSchedules.length})
              </h3>
            </div>
            <Link to="/teacher/schedules" style={{ fontSize: '0.8125rem', color: 'var(--primary-600)', fontWeight: '600' }}>
              Tất cả ➔
            </Link>
          </div>

          {unmarkedSchedules.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--success-600)', fontSize: '0.875rem' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 8px', color: 'var(--success-500)' }} />
              Đã hoàn thành điểm danh tất cả các buổi học trước!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {unmarkedSchedules.map((sch) => (
                <div
                  key={sch.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-page)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: '700', fontSize: '0.875rem', display: 'block' }}>
                      {sch.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {sch.classes?.name} • {new Date(sch.start_time).toLocaleDateString('vi-VN')}
                    </span>
                  </div>

                  <Link to="/teacher/schedules" className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                    Điểm danh
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Block 3: Bài Tập Cần Chấm */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="var(--primary-500)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Bài Tập Cần Chấm</h3>
            </div>
            <Link to="/teacher/assignments" style={{ fontSize: '0.8125rem', color: 'var(--primary-600)', fontWeight: '600' }}>
              Xem bài tập ➔
            </Link>
          </div>

          {pendingSubmissions.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Không có bài nộp nào đang chờ chấm điểm.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingSubmissions.map((sub) => (
                <div
                  key={sub.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-page)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: '700', fontSize: '0.875rem', display: 'block' }}>
                      {sub.profiles?.full_name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {sub.assignments?.title} ({sub.assignments?.classes?.name})
                    </span>
                  </div>

                  <Link to="/teacher/assignments" className="btn btn-secondary btn-sm" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                    Chấm điểm
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Block 4: Học Phí Chưa Thu */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Receipt size={18} color="var(--success-600)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Học Phí Chưa Thu</h3>
            </div>
            <Link to="/teacher/tuition" style={{ fontSize: '0.8125rem', color: 'var(--primary-600)', fontWeight: '600' }}>
              Sổ học phí ➔
            </Link>
          </div>

          {unpaidInvoices.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--success-600)', fontSize: '0.875rem' }}>
              Đã thu đủ toàn bộ học phí của các lớp!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {unpaidInvoices.map((inv, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 14px',
                    backgroundColor: 'var(--bg-page)',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <div>
                    <span style={{ fontWeight: '700', fontSize: '0.875rem', display: 'block' }}>
                      {inv.profiles?.full_name}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {inv.period} ({inv.classes?.name})
                    </span>
                  </div>

                  <span style={{ fontWeight: '700', color: 'var(--primary-600)', fontSize: '0.875rem' }}>
                    {Number(inv.amount_due).toLocaleString('vi-VN')} đ
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
