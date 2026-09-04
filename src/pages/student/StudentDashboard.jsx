import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { 
  GraduationCap, 
  Calendar, 
  Clock, 
  BookOpen, 
  Plus, 
  Sparkles, 
  Video, 
  CheckCircle2, 
  AlertCircle, 
  Award,
  FileText,
  CreditCard
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { TutorApplicationModal } from './TutorApplicationModal';

export const StudentDashboard = () => {
  const { profile, supabaseClient, user } = useAppAuth();

  const [classes, setClasses] = useState([]);
  const [nextSchedule, setNextSchedule] = useState(null);
  const [pendingAssignments, setPendingAssignments] = useState([]);
  const [recentQuizAttempts, setRecentQuizAttempts] = useState([]);
  const [unpaidTuitionCount, setUnpaidTuitionCount] = useState(0);

  const [isApplyOpen, setIsApplyOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchStudentData = async () => {
    try {
      setLoading(true);
      const now = new Date();

      // 1. Fetch Enrolled Classes
      const { data: memberList } = await supabaseClient
        .from('class_members')
        .select('class_id, classes(id, name, subject, tutor_id, profiles:tutor_id(full_name))');

      const enrolledClasses = (memberList || []).map((m) => m.classes).filter(Boolean);
      setClasses(enrolledClasses);
      const classIds = enrolledClasses.map((c) => c.id);

      if (classIds.length > 0) {
        // 2. Next Upcoming Schedule
        const { data: nextSch } = await supabaseClient
          .from('schedules')
          .select('id, title, class_id, start_time, end_time, meeting_link, classes(name)')
          .in('class_id', classIds)
          .gte('end_time', now.toISOString())
          .order('start_time', { ascending: true })
          .limit(1);

        setNextSchedule(nextSch?.[0] || null);

        // 3. Pending Assignments (Not submitted yet)
        const { data: assignList } = await supabaseClient
          .from('assignments')
          .select(`
            id,
            title,
            class_id,
            deadline,
            max_score,
            classes (name),
            assignment_submissions (id, status)
          `)
          .in('class_id', classIds)
          .order('deadline', { ascending: true });

        const unsubmitted = (assignList || []).filter((a) => {
          const sub = a.assignment_submissions?.[0];
          return !sub;
        });
        setPendingAssignments(unsubmitted.slice(0, 4));

        // 4. Recent Quiz Attempts
        const { data: attList } = await supabaseClient
          .from('quiz_attempts')
          .select(`
            id,
            score,
            status,
            submitted_at,
            quizzes (title, pass_score, classes(name))
          `)
          .eq('student_id', user.id)
          .order('submitted_at', { ascending: false })
          .limit(4);

        setRecentQuizAttempts(attList || []);

        // 5. Unpaid Tuition
        const { data: invList } = await supabaseClient
          .from('tuition_invoices')
          .select('id, status')
          .eq('student_id', user.id)
          .neq('status', 'paid');

        setUnpaidTuitionCount(invList?.length || 0);
      }
    } catch (err) {
      console.error('Error loading student dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchStudentData();
    }
  }, [user?.id, supabaseClient]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Góc Học Tập 🎓
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Chào bạn <strong>{profile?.full_name || 'Học sinh'}</strong>! Chúc bạn một ngày học tập nhiều hứng khởi.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {profile?.role === 'student' && (
            <button className="btn btn-secondary btn-sm" onClick={() => setIsApplyOpen(true)}>
              <Sparkles size={14} color="var(--primary-500)" /> Đăng ký làm Gia Sư
            </button>
          )}
          <Link to="/student/classes" className="btn btn-primary btn-sm">
            <Plus size={14} /> Nhập mã vào lớp
          </Link>
        </div>
      </div>

      {/* Top 3 Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>LỚP ĐANG HỌC</span>
            <GraduationCap size={18} color="var(--primary-500)" />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '8px', color: 'var(--text-primary)' }}>
            {classes.length}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Lớp học đã tham gia</span>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>BÀI TẬP CẦN NỘP</span>
            <Clock size={18} color={pendingAssignments.length > 0 ? 'var(--warning-500)' : 'var(--success-500)'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '8px', color: pendingAssignments.length > 0 ? 'var(--warning-600)' : 'var(--text-primary)' }}>
            {pendingAssignments.length}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>bài tập chưa hoàn thành</span>
        </div>

        <div className="glass-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>HỌC PHÍ</span>
            <CreditCard size={18} color={unpaidTuitionCount > 0 ? 'var(--danger-500)' : 'var(--success-500)'} />
          </div>
          <div style={{ fontSize: '1.75rem', fontWeight: '800', marginTop: '8px', color: unpaidTuitionCount > 0 ? 'var(--danger-600)' : 'var(--success-600)' }}>
            {unpaidTuitionCount > 0 ? `${unpaidTuitionCount} Kì chưa đóng` : 'Đã đóng đủ'}
          </div>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {unpaidTuitionCount > 0 ? 'Cần thanh toán sớm' : 'Không có nợ học phí'}
          </span>
        </div>
      </div>

      {/* Next Upcoming Live Banner */}
      {nextSchedule && (
        <div style={{
          padding: '24px 28px',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
          border: '1px solid rgba(99, 102, 241, 0.25)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <span className="badge badge-primary">BUỔI HỌC TRỰC TUYẾN</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--primary-600)' }}>
                {nextSchedule.classes?.name}
              </span>
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {nextSchedule.title}
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <Clock size={14} color="var(--primary-500)" />
              <span>
                {new Date(nextSchedule.start_time).toLocaleDateString('vi-VN')} ({new Date(nextSchedule.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(nextSchedule.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
              </span>
            </div>
          </div>

          {nextSchedule.meeting_url && (
            <a
              href={nextSchedule.meeting_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ padding: '10px 20px', fontSize: '0.925rem' }}
            >
              <Video size={16} /> Vào Lớp Trực Tuyến
            </a>
          )}
        </div>
      )}

      {/* Grid: Pending Assignments & Recent Quiz Results */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px' }}>
        
        {/* Pending Homework */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={18} color="var(--primary-500)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Bài Tập Cần Nộp</h3>
            </div>
            <Link to="/student/assignments" style={{ fontSize: '0.8125rem', color: 'var(--primary-600)', fontWeight: '600' }}>
              Xem tất cả ➔
            </Link>
          </div>

          {pendingAssignments.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--success-600)', fontSize: '0.875rem' }}>
              <CheckCircle2 size={32} style={{ margin: '0 auto 8px', color: 'var(--success-500)' }} />
              Bạn đã nộp đủ toàn bộ bài tập về nhà!
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {pendingAssignments.map((a) => (
                <div
                  key={a.id}
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
                      {a.title}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {a.classes?.name} • Hạn: {a.deadline ? new Date(a.deadline).toLocaleDateString('vi-VN') : 'Không hạn'}
                    </span>
                  </div>

                  <Link to="/student/assignments" className="btn btn-primary btn-sm" style={{ fontSize: '0.75rem', padding: '4px 10px' }}>
                    Làm bài
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Quiz Scores */}
        <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={18} color="var(--success-600)" />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Điểm Kiểm Tra Gần Đây</h3>
            </div>
            <Link to="/student/assignments" style={{ fontSize: '0.8125rem', color: 'var(--primary-600)', fontWeight: '600' }}>
              Xem chi tiết ➔
            </Link>
          </div>

          {recentQuizAttempts.length === 0 ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
              Chưa có kết quả làm bài kiểm tra nào.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {recentQuizAttempts.map((att) => {
                const isPassed = (att.score || 0) >= (att.quizzes?.pass_score || 5.0);

                return (
                  <div
                    key={att.id}
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
                        {att.quizzes?.title}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {att.quizzes?.classes?.name} • {new Date(att.submitted_at).toLocaleDateString('vi-VN')}
                      </span>
                    </div>

                    <span style={{
                      fontWeight: '800',
                      fontSize: '1rem',
                      color: isPassed ? 'var(--success-600)' : 'var(--danger-600)'
                    }}>
                      {att.score} / 10đ
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* Modal Đăng Ký Làm Gia Sư */}
      <TutorApplicationModal
        isOpen={isApplyOpen}
        onClose={() => setIsApplyOpen(false)}
      />
    </div>
  );
};
