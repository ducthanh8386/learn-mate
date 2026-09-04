import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { 
  Calendar, 
  Clock, 
  Video, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  AlertCircle,
  Sparkles,
  Users
} from 'lucide-react';

export const StudentSchedules = () => {
  const { supabaseClient, user } = useAppAuth();

  const [activeTab, setActiveTab] = useState('upcoming'); // 'upcoming' | 'history'
  const [schedules, setSchedules] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Get student enrolled class IDs
      const { data: memberData } = await supabaseClient
        .from('class_members')
        .select('class_id');

      const classIds = (memberData || []).map((m) => m.class_id);

      if (classIds.length > 0) {
        // Fetch schedules
        const { data: schList, error: sErr } = await supabaseClient
          .from('schedules')
          .select(`
            *,
            classes (name, subject)
          `)
          .in('class_id', classIds)
          .order('start_time', { ascending: true });

        if (sErr) throw sErr;
        setSchedules(schList || []);

        // Fetch attendance records for this student
        const { data: attList, error: aErr } = await supabaseClient
          .from('attendance')
          .select(`
            *,
            schedules (title, start_time, end_time),
            classes (name, subject)
          `)
          .eq('student_id', user.id)
          .order('marked_at', { ascending: false });

        if (aErr) throw aErr;
        setAttendanceHistory(attList || []);
      }
    } catch (err) {
      console.error('Error fetching student schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id, supabaseClient]);

  const now = new Date();
  const upcomingSchedules = schedules.filter((s) => new Date(s.end_time) >= now);
  const nextSession = upcomingSchedules[0];

  // Attendance stats
  const totalMarked = attendanceHistory.length;
  const presentCount = attendanceHistory.filter((a) => a.status === 'present' || a.status === 'late').length;
  const attendanceRate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Lịch Học & Điểm Danh
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
          Theo dõi lịch học trực tuyến Zoom/Meet và lịch sử chuyên cần của bạn.
        </p>
      </div>

      {/* Next Upcoming Live Banner */}
      {nextSession && (
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
              <span className="badge badge-primary">BUỔI HỌC TIẾP THEO</span>
              <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--primary-600)' }}>
                {nextSession.classes?.name}
              </span>
            </div>
            <h2 style={{ fontSize: '1.375rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {nextSession.title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <Clock size={16} color="var(--primary-500)" />
              <span>
                {new Date(nextSession.start_time).toLocaleDateString('vi-VN')} ({new Date(nextSession.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(nextSession.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
              </span>
            </div>
          </div>

          {nextSession.meeting_url ? (
            <a
              href={nextSession.meeting_url}
              target="_blank"
              rel="noreferrer"
              className="btn btn-primary"
              style={{ padding: '12px 24px', fontSize: '1rem', fontWeight: '700' }}
            >
              <Video size={18} /> Vào Lớp Trực Tuyến
            </a>
          ) : (
            <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Gia sư chưa cập nhật link phòng học</span>
          )}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <Calendar size={14} /> Lịch học sắp tới ({upcomingSchedules.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('history')}
        >
          <CheckCircle2 size={14} /> Lịch sử điểm danh ({attendanceRate}% Chuyên cần)
        </button>
      </div>

      {/* Tab: Upcoming Schedules */}
      {activeTab === 'upcoming' && (
        <div>
          {loading ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Đang tải lịch học...
            </div>
          ) : upcomingSchedules.length === 0 ? (
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
              <Calendar size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Không có buổi học nào sắp tới</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
                Thầy/cô sẽ sớm lên lịch học mới cho các lớp của bạn.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {upcomingSchedules.map((sch) => {
                const startD = new Date(sch.start_time);
                const endD = new Date(sch.end_time);

                return (
                  <div key={sch.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <span className="badge badge-primary" style={{ marginBottom: '6px' }}>
                        {sch.classes?.name}
                      </span>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {sch.title}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      <Clock size={14} color="var(--primary-500)" />
                      <span>{startD.toLocaleDateString('vi-VN')} ({startD.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {endD.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})</span>
                    </div>

                    {sch.meeting_url ? (
                      <a
                        href={sch.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        className="btn btn-primary btn-sm"
                        style={{ marginTop: 'auto', justifyContent: 'center' }}
                      >
                        <Video size={14} /> Vào lớp học
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 'auto' }}>
                        Chưa có liên kết phòng học
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Attendance History */}
      {activeTab === 'history' && (
        <div>
          {loading ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Đang tải lịch sử điểm danh...
            </div>
          ) : attendanceHistory.length === 0 ? (
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
              <CheckCircle2 size={48} color="var(--success-500)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Chưa có dữ liệu điểm danh</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
                Dữ liệu sẽ xuất hiện sau khi thầy/cô điểm danh các buổi học đã diễn ra.
              </p>
            </div>
          ) : (
            <div className="glass-card" style={{ overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                    <th style={{ padding: '12px 16px' }}>Buổi học</th>
                    <th style={{ padding: '12px 16px' }}>Lớp</th>
                    <th style={{ padding: '12px 16px' }}>Thời gian</th>
                    <th style={{ padding: '12px 16px' }}>Kết quả điểm danh</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceHistory.map((att) => {
                    const isPresent = att.status === 'present';
                    const isLate = att.status === 'late';
                    const isExcused = att.status === 'excused';

                    return (
                      <tr
                        key={att.id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          fontSize: '0.875rem'
                        }}
                      >
                        <td style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {att.schedules?.title || 'Buổi học'}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                          {att.classes?.name}
                        </td>
                        <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                          {att.schedules?.start_time ? new Date(att.schedules.start_time).toLocaleDateString('vi-VN') : '—'}
                        </td>
                        <td style={{ padding: '14px 16px' }}>
                          <span className={`badge ${
                            isPresent ? 'badge-success' : isLate ? 'badge-warning' : isExcused ? 'badge-primary' : 'badge-danger'
                          }`}>
                            {isPresent ? 'Có mặt' : isLate ? 'Đi trễ' : isExcused ? 'Có phép' : 'Vắng mặt'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
