import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { 
  Calendar, 
  Video, 
  Plus, 
  AlertCircle, 
  Users, 
  ExternalLink, 
  X
} from 'lucide-react';
import { ErrorState, FormField } from '../../components/common';

export const TeacherSchedules = () => {
  const { supabaseClient } = useAppAuth();

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Create Schedule Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Attendance Sheet Modal
  const [activeScheduleForAttendance, setActiveScheduleForAttendance] = useState(null);
  const [classStudents, setClassStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({}); // student_id -> { status: 'present'|'absent'|'late'|'excused', note: '' }
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [saveAttendanceLoading, setSaveAttendanceLoading] = useState(false);

  const fetchClassesAndSchedules = async () => {
    try {
      setLoading(true);
      const { data: classList } = await supabaseClient
        .from('classes')
        .select('id, name, subject')
        .order('created_at', { ascending: false });

      setClasses(classList || []);
      const targetClassId = selectedClassId || classList?.[0]?.id;
      if (targetClassId) {
        if (!selectedClassId) setSelectedClassId(targetClassId);

        const { data: schList, error: sErr } = await supabaseClient
          .from('schedules')
          .select(`
            *,
            attendance (count)
          `)
          .eq('class_id', targetClassId)
          .order('start_time', { ascending: true });

        if (sErr) throw sErr;
        setSchedules(schList || []);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
      setFetchError(err.message || 'Không thể tải lịch dạy.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassesAndSchedules();
  }, [selectedClassId, supabaseClient]);

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      if (!title.trim() || !startTime || !endTime) {
        throw new Error('Vui lòng điền đầy đủ tiêu đề, giờ bắt đầu và giờ kết thúc.');
      }

      const { error: insErr } = await supabaseClient
        .from('schedules')
        .insert({
          class_id: selectedClassId,
          title: title.trim(),
          start_time: new Date(startTime).toISOString(),
          end_time: new Date(endTime).toISOString(),
          meeting_url: meetingUrl.trim() || null,
          status: 'scheduled',
        });

      if (insErr) throw insErr;

      setIsCreateOpen(false);
      setTitle('');
      setStartTime('');
      setEndTime('');
      setMeetingUrl('');
      await fetchClassesAndSchedules();
    } catch (err) {
      console.error('Error creating schedule:', err);
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const openAttendanceModal = async (schedule) => {
    setActiveScheduleForAttendance(schedule);
    try {
      setAttendanceLoading(true);

      // 1. Fetch class students
      const { data: members, error: mErr } = await supabaseClient
        .from('class_members')
        .select(`
          student_id,
          profiles:student_id (id, full_name, avatar_url, phone)
        `)
        .eq('class_id', schedule.class_id);

      if (mErr) throw mErr;
      const students = members?.map((m) => m.profiles).filter(Boolean) || [];
      setClassStudents(students);

      // 2. Fetch existing attendance records for this schedule
      const { data: existingAttendance } = await supabaseClient
        .from('attendance')
        .select('id, schedule_id, student_id, status, note')
        .eq('schedule_id', schedule.id);

      const aMap = {};
      // Default all to 'present' if not marked yet
      students.forEach((st) => {
        aMap[st.id] = { status: 'present', note: '' };
      });

      (existingAttendance || []).forEach((att) => {
        aMap[att.student_id] = { status: att.status, note: att.note || '' };
      });

      setAttendanceMap(aMap);
    } catch (err) {
      console.error('Error loading attendance sheet:', err);
    } finally {
      setAttendanceLoading(false);
    }
  };

  const handleSaveAttendance = async () => {
    setSaveAttendanceLoading(true);
    try {
      const records = classStudents.map((st) => ({
        schedule_id: activeScheduleForAttendance.id,
        class_id: activeScheduleForAttendance.class_id,
        student_id: st.id,
        status: attendanceMap[st.id]?.status || 'present',
        note: attendanceMap[st.id]?.note?.trim() || null,
        marked_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await supabaseClient
        .from('attendance')
        .upsert(records, { onConflict: 'schedule_id,student_id' });

      if (upsertErr) throw upsertErr;

      // Update schedule status to completed if past
      await supabaseClient
        .from('schedules')
        .update({ status: 'completed' })
        .eq('id', activeScheduleForAttendance.id);

      alert('Đã lưu bảng điểm danh thành công!');
      setActiveScheduleForAttendance(null);
      await fetchClassesAndSchedules();
    } catch (err) {
      alert('Lỗi lưu điểm danh: ' + err.message);
    } finally {
      setSaveAttendanceLoading(false);
    }
  };

  const updateStudentStatus = (studentId, status) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
  };

  const updateStudentNote = (studentId, note) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], note },
    }));
  };

  const now = new Date();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Lịch Dạy & Điểm Danh
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Lên lịch học Zoom/Google Meet và quản lý điểm danh sĩ số từng buổi học.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setIsCreateOpen(true)}
          disabled={!selectedClassId}
        >
          <Plus size={16} /> Lên lịch buổi học mới
        </button>
      </div>

      {/* Class Selector */}
      {classes.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-surface)', padding: '12px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Chọn Lớp:</span>
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-page)',
              color: 'var(--text-primary)',
              fontWeight: '600'
            }}
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.subject})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Schedules List */}
      {loading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang tải lịch dạy...
        </div>
      ) : fetchError ? (
        <ErrorState message={fetchError} onRetry={fetchClassesAndSchedules} />
      ) : schedules.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <Calendar size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Chưa có buổi học nào được lên lịch</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px', marginBottom: '20px' }}>
            Tạo buổi học kèm link Zoom/Meet để học sinh nhận thông báo và tham gia lớp học.
          </p>
          {selectedClassId && (
            <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} /> Lên lịch buổi đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {schedules.map((sch) => {
            const startD = new Date(sch.start_time);
            const endD = new Date(sch.end_time);
            const isPast = endD < now;
            const isAttendanceMarked = (sch.attendance?.[0]?.count || 0) > 0;

            return (
              <div key={sch.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {sch.title}
                  </h3>
                  <span className={`badge ${
                    sch.status === 'completed' ? 'badge-success' : isPast ? 'badge-warning' : 'badge-primary'
                  }`}>
                    {sch.status === 'completed' ? 'Đã diễn ra' : isPast ? 'Chưa điểm danh' : 'Sắp diễn ra'}
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={14} color="var(--primary-500)" />
                    <span>{startD.toLocaleDateString('vi-VN')} ({startD.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} - {endD.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })})</span>
                  </div>

                  {sch.meeting_url && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Video size={14} color="var(--success-500)" />
                      <a
                        href={sch.meeting_url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--primary-600)', textDecoration: 'underline', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                      >
                        {sch.meeting_url}
                      </a>
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: 'auto', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  {sch.meeting_url && (
                    <a
                      href={sch.meeting_url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-secondary btn-sm"
                      style={{ flex: 1 }}
                    >
                      <ExternalLink size={14} /> Vào lớp
                    </a>
                  )}

                  <button
                    className={`btn btn-sm ${isAttendanceMarked ? 'btn-secondary' : 'btn-primary'}`}
                    onClick={() => openAttendanceModal(sch)}
                    style={{ flex: 1.2 }}
                  >
                    <Users size={14} /> {isAttendanceMarked ? 'Xem điểm danh' : 'Điểm danh'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Lên Lịch Buổi Học */}
      {isCreateOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            maxWidth: '520px',
            width: '100%',
            backgroundColor: 'var(--bg-surface)',
            padding: '32px',
            position: 'relative'
          }}>
            <button
              onClick={() => setIsCreateOpen(false)}
              aria-label="Đóng cửa sổ"
              title="Đóng"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <form onSubmit={handleCreateSchedule} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Lên Lịch Buổi Học Mới</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Tạo lịch trực tuyến Zoom/Meet cho lớp</p>
              </div>

              {createError && (
                <div style={{
                  backgroundColor: 'var(--danger-50)',
                  color: 'var(--danger-600)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  <span>{createError}</span>
                </div>
              )}

              <FormField
                id="schedule-title"
                label="Tiêu đề buổi dạy"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Buổi 12: Chữa đề thi thử Đại học số 1"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <FormField
                  id="schedule-start-time"
                  label="Giờ bắt đầu"
                  type="datetime-local"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />

                <FormField
                  id="schedule-end-time"
                  label="Giờ kết thúc"
                  type="datetime-local"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>

              <FormField
                id="schedule-meeting-url"
                label="Liên kết phòng học Zoom / Google Meet"
                type="url"
                value={meetingUrl}
                onChange={(e) => setMeetingUrl(e.target.value)}
                placeholder="VD: https://meet.google.com/abc-defg-hij"
              />

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)} style={{ flex: 1 }}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={createLoading} style={{ flex: 1 }}>
                  {createLoading ? 'Đang tạo...' : 'Lên lịch ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Bảng Điểm Danh Buổi Học */}
      {activeScheduleForAttendance && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 100,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            maxWidth: '680px',
            width: '100%',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'var(--bg-surface)',
            padding: '32px',
            position: 'relative'
          }}>
            <button
              onClick={() => setActiveScheduleForAttendance(null)}
              aria-label="Đóng cửa sổ"
              title="Đóng"
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer'
              }}
            >
              <X size={20} />
            </button>

            <div style={{ marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
                Bảng Điểm Danh: {activeScheduleForAttendance.title}
              </h2>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Thời gian: {new Date(activeScheduleForAttendance.start_time).toLocaleDateString('vi-VN')} • Sĩ số: {classStudents.length} học sinh
              </span>
            </div>

            {attendanceLoading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Đang tải danh sách học sinh...
              </div>
            ) : classStudents.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Lớp học chưa có học sinh nào tham gia.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {classStudents.map((st) => {
                  const currentStatus = attendanceMap[st.id]?.status || 'present';

                  return (
                    <div
                      key={st.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 16px',
                        backgroundColor: 'var(--bg-page)',
                        borderRadius: 'var(--radius-md)',
                        border: '1px solid var(--border-subtle)',
                        flexWrap: 'wrap',
                        gap: '12px'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: '700', fontSize: '0.925rem', color: 'var(--text-primary)' }}>
                          {st.full_name}
                        </span>
                        {st.phone && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({st.phone})</span>
                        )}
                      </div>

                      {/* Status Toggle Buttons */}
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${currentStatus === 'present' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => updateStudentStatus(st.id, 'present')}
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          Có mặt
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${currentStatus === 'late' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => updateStudentStatus(st.id, 'late')}
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          Đi trễ
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${currentStatus === 'excused' ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => updateStudentStatus(st.id, 'excused')}
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          Có phép
                        </button>
                        <button
                          type="button"
                          className={`btn btn-sm ${currentStatus === 'absent' ? 'btn-danger' : 'btn-secondary'}`}
                          onClick={() => updateStudentStatus(st.id, 'absent')}
                          style={{ padding: '4px 10px', fontSize: '0.75rem' }}
                        >
                          Vắng
                        </button>
                      </div>
                    </div>
                  );
                })}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                  <button
                    className="btn btn-secondary"
                    onClick={() => setActiveScheduleForAttendance(null)}
                  >
                    Hủy
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveAttendance}
                    disabled={saveAttendanceLoading}
                  >
                    {saveAttendanceLoading ? 'Đang lưu...' : 'Lưu Điểm Danh'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
