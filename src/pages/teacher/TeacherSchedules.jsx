import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Filter
} from 'lucide-react';
import { ErrorState } from '../../components/common';
import { 
  WeeklyTimetable, 
  MiniCalendar, 
  CreateScheduleModal, 
  ScheduleDetailModal 
} from '../../components/schedule';

export const TeacherSchedules = () => {
  const { supabaseClient, user } = useAppAuth();

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(''); // '' means All Classes
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Selected date for calendar & timetable navigation
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Create Schedule Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createInitialDateTime, setCreateInitialDateTime] = useState(null);

  // Schedule Detail & Attendance Modal
  const [activeScheduleDetail, setActiveScheduleDetail] = useState(null);

  const fetchClassesAndSchedules = async () => {
    try {
      setLoading(true);
      setFetchError(null);

      // 1. Fetch tutor classes
      const { data: classList, error: cErr } = await supabaseClient
        .from('classes')
        .select('id, name, subject')
        .order('created_at', { ascending: false });

      if (cErr) throw cErr;
      setClasses(classList || []);

      const classIds = (classList || []).map((c) => c.id);

      if (classIds.length > 0) {
        let query = supabaseClient
          .from('schedules')
          .select(`
            *,
            classes (id, name, subject),
            attendance (count)
          `)
          .order('start_time', { ascending: true });

        if (selectedClassId) {
          query = query.eq('class_id', selectedClassId);
        } else {
          query = query.in('class_id', classIds);
        }

        const { data: schList, error: sErr } = await query;
        if (sErr) throw sErr;
        setSchedules(schList || []);
      } else {
        setSchedules([]);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setFetchError(err.message || 'Không thể tải lịch dạy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (supabaseClient) {
      fetchClassesAndSchedules();
    }
  }, [selectedClassId, supabaseClient]);

  // Handle clicking empty slot in weekly timetable
  const handleSlotClick = (dayDate, hour) => {
    setCreateInitialDateTime({ date: dayDate, hour });
    setIsCreateOpen(true);
  };

  const handleOpenCreateGeneral = () => {
    setCreateInitialDateTime({ date: selectedDate, hour: 8 });
    setIsCreateOpen(true);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Lịch Dạy & Điểm Danh
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Quản lý thời khóa biểu tuần, lên lịch học Zoom/Meet và điểm danh sĩ số lớp.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* Class Filter Dropdown */}
          {classes.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: 'var(--bg-surface)', padding: '6px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
              <Filter size={16} color="var(--text-muted)" />
              <select
                value={selectedClassId}
                onChange={(e) => setSelectedClassId(e.target.value)}
                style={{
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="">Tất cả các lớp ({classes.length})</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.subject})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            className="btn btn-primary"
            onClick={handleOpenCreateGeneral}
            disabled={classes.length === 0}
            style={{ fontWeight: '700' }}
          >
            <Plus size={16} /> Lên lịch buổi học
          </button>
        </div>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang tải thời khóa biểu...
        </div>
      ) : fetchError ? (
        <ErrorState message={fetchError} onRetry={fetchClassesAndSchedules} />
      ) : classes.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <CalendarIcon size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Chưa có lớp học nào</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
            Vui lòng tạo lớp học trước khi lên lịch giảng dạy.
          </p>
        </div>
      ) : (
        /* Main 2-column Schedule Layout */
        <div className="schedule-main-layout">
          {/* Left Column: Weekly Timetable */}
          <div>
            <WeeklyTimetable
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              schedules={schedules}
              isTeacher={true}
              onSlotClick={handleSlotClick}
              onScheduleClick={(sch) => setActiveScheduleDetail(sch)}
              title="Lịch giảng dạy"
            />
          </div>

          {/* Right Column: Mini Calendar Widget */}
          <div>
            <MiniCalendar
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate}
              schedules={schedules}
            />

            {/* Quick Helper Note for Teacher */}
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
                Mẹo thao tác nhanh:
              </strong>
              • Nhấp trực tiếp vào ô khung giờ trên bảng để tạo lịch nhanh cho giờ đó.<br />
              • Nhấp vào thẻ buổi học để xem link Meet và thực hiện điểm danh sĩ số.
            </div>
          </div>
        </div>
      )}

      {/* Create Schedule Modal (with Recurring feature) */}
      <CreateScheduleModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        classes={classes}
        selectedClassId={selectedClassId || classes[0]?.id || ''}
        initialDateTime={createInitialDateTime}
        onSuccess={fetchClassesAndSchedules}
        supabaseClient={supabaseClient}
      />

      {/* Schedule Detail & Attendance Modal */}
      <ScheduleDetailModal
        isOpen={Boolean(activeScheduleDetail)}
        onClose={() => setActiveScheduleDetail(null)}
        schedule={activeScheduleDetail}
        isTeacher={true}
        currentUser={user}
        supabaseClient={supabaseClient}
        onScheduleUpdated={fetchClassesAndSchedules}
        onScheduleDeleted={fetchClassesAndSchedules}
      />
    </div>
  );
};
