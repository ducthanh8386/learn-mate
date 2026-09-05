import React, { useEffect, useState, useMemo } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Video, 
  CheckCircle2, 
  Users
} from 'lucide-react';
import { SkeletonTimetable } from '../../components/common';
import { 
  WeeklyTimetable, 
  MiniCalendar, 
  ScheduleDetailModal 
} from '../../components/schedule';

export const StudentSchedules = () => {
  const { supabaseClient, user } = useAppAuth();

  const [activeTab, setActiveTab] = useState('timetable'); // 'timetable' | 'history'
  const [schedules, setSchedules] = useState([]);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selected date for calendar & timetable navigation
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Active schedule for detail / classmates modal
  const [activeScheduleDetail, setActiveScheduleDetail] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Get student enrolled class IDs
      const { data: memberData, error: mErr } = await supabaseClient
        .from('class_members')
        .select('class_id');

      if (mErr) throw mErr;
      const classIds = (memberData || []).map((m) => m.class_id);

      if (classIds.length > 0) {
        // Fetch schedules for these classes
        const { data: schList, error: sErr } = await supabaseClient
          .from('schedules')
          .select(`
            id,
            class_id,
            title,
            start_time,
            end_time,
            meeting_url,
            status,
            classes (id, name, subject)
          `)
          .in('class_id', classIds)
          .order('start_time', { ascending: true });

        if (sErr) throw sErr;
        setSchedules(schList || []);

        // Fetch attendance records for this student
        const { data: attList, error: aErr } = await supabaseClient
          .from('attendance')
          .select(`
            id,
            status,
            note,
            marked_at,
            schedules (title, start_time, end_time),
            classes (name, subject)
          `)
          .eq('student_id', user.id)
          .order('marked_at', { ascending: false });

        if (aErr) throw aErr;
        setAttendanceHistory(attList || []);
      } else {
        setSchedules([]);
        setAttendanceHistory([]);
      }
    } catch (err) {
      console.error('Error fetching student schedules:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id && supabaseClient) {
      fetchData();
    }
  }, [user?.id, supabaseClient]);

  const upcomingSchedules = useMemo(() => {
    const now = new Date();
    return schedules.filter((s) => new Date(s.end_time) >= now);
  }, [schedules]);

  const nextSession = upcomingSchedules[0];

  // Attendance stats memoized
  const totalMarked = attendanceHistory.length;
  const presentCount = useMemo(() => {
    return attendanceHistory.filter((a) => a.status === 'present' || a.status === 'late').length;
  }, [attendanceHistory]);

  const attendanceRate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Thời Khóa Biểu & Điểm Danh
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
          Theo dõi lịch học các lớp, phòng họp Google Meet/Zoom và lịch sử chuyên cần của bạn.
        </p>
      </div>

      {/* Next Upcoming Live Session Banner */}
      {nextSession && (
        <div style={{
          padding: '20px 24px',
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
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0 }}>
              {nextSession.title}
            </h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              <Clock size={16} color="var(--primary-500)" />
              <span>
                {new Date(nextSession.start_time).toLocaleDateString('vi-VN')} ({new Date(nextSession.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {new Date(nextSession.end_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setActiveScheduleDetail(nextSession)}
              style={{ fontWeight: '700' }}
            >
              <Users size={16} /> Xem lớp & bạn bè
            </button>

            {nextSession.meeting_url && (
              <a
                href={nextSession.meeting_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary"
                style={{ padding: '10px 20px', fontSize: '0.925rem', fontWeight: '700' }}
              >
                <Video size={16} /> Vào Lớp Trực Tuyến
              </a>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'timetable' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('timetable')}
        >
          <CalendarIcon size={14} /> Thời khóa biểu tuần
        </button>
        <button
          type="button"
          className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('history')}
        >
          <CheckCircle2 size={14} /> Lịch sử điểm danh ({attendanceRate}% Chuyên cần)
        </button>
      </div>

      {/* Tab: Timetable & Calendar */}
      {activeTab === 'timetable' && (
        <div>
          {loading ? (
            <SkeletonTimetable />
          ) : (
            <div className="schedule-main-layout">
              {/* Left Column: Weekly Timetable */}
              <div>
                <WeeklyTimetable
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  schedules={schedules}
                  isTeacher={false}
                  onScheduleClick={(sch) => setActiveScheduleDetail(sch)}
                  title="Lịch học cá nhân"
                />
              </div>

              {/* Right Column: Mini Calendar */}
              <div>
                <MiniCalendar
                  selectedDate={selectedDate}
                  onSelectDate={setSelectedDate}
                  schedules={schedules}
                />

                <div
                  style={{
                    marginTop: '16px',
                    padding: '14px',
                    backgroundColor: 'rgba(99, 102, 241, 0.05)',
                    border: '1px solid rgba(99, 102, 241, 0.15)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                  }}
                >
                  <strong style={{ color: 'var(--primary-600)', display: 'block', marginBottom: '4px' }}>
                    Hướng dẫn học sinh:
                  </strong>
                  • Nhấp vào buổi học trên lịch để xem link Google Meet / Zoom và danh sách bạn cùng lớp.<br />
                  • Nhấp vào các ngày trên lịch nhỏ bên phải để chuyển nhanh đến tuần tương ứng.
                </div>
              </div>
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
                Dữ liệu sẽ xuất hiện sau khi giáo viên điểm danh các buổi học đã diễn ra.
              </p>
            </div>
          ) : (
            <div className="glass-card table-responsive">
              <table style={{ width: '100%', minWidth: '600px', borderCollapse: 'collapse', textAlign: 'left' }}>
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

      {/* Schedule Detail & Classmate Roster Modal */}
      <ScheduleDetailModal
        isOpen={Boolean(activeScheduleDetail)}
        onClose={() => setActiveScheduleDetail(null)}
        schedule={activeScheduleDetail}
        isTeacher={false}
        currentUser={user}
        supabaseClient={supabaseClient}
      />
    </div>
  );
};
