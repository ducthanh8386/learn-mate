import React, { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  AlertCircle, 
  Trash2,
  Search,
  UserCheck,
  Video
} from 'lucide-react';

export const ScheduleDetailModal = ({
  isOpen,
  onClose,
  schedule,
  isTeacher = false,
  currentUser = null,
  supabaseClient,
  onScheduleUpdated,
  onScheduleDeleted,
}) => {
  const [students, setStudents] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState(null);

  const fetchClassAndAttendance = useCallback(async () => {
    if (!schedule?.id) return;
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch enrolled students in this class
      const { data: members, error: mErr } = await supabaseClient
        .from('class_members')
        .select(`
          student_id,
          joined_at,
          profiles:student_id (id, full_name, avatar_url, phone)
        `)
        .eq('class_id', schedule.class_id);

      if (mErr) throw mErr;

      const studentList = (members || []).map((m) => {
        if (m.profiles?.full_name) {
          return {
            ...m.profiles,
            id: m.student_id, // ensure student_id is used as id
          };
        }
        return {
          id: m.student_id,
          full_name: 'Học sinh',
          avatar_url: null,
          phone: null,
        };
      });

      // Sort alphabetically by full name
      studentList.sort((a, b) => (a.full_name || '').localeCompare(b.full_name || '', 'vi'));
      setStudents(studentList);

      // 2. Fetch attendance for this schedule
      const { data: attList, error: aErr } = await supabaseClient
        .from('attendance')
        .select('id, student_id, status, note')
        .eq('schedule_id', schedule.id);

      if (aErr) throw aErr;

      const aMap = {};
      studentList.forEach((st) => {
        aMap[st.id] = { status: 'present', note: '' };
      });

      (attList || []).forEach((att) => {
        aMap[att.student_id] = { status: att.status, note: att.note || '' };
      });

      setAttendanceMap(aMap);
    } catch (err) {
      console.error('Error fetching schedule details:', err);
      setError(err.message || 'Không thể tải thông tin lớp học.');
    } finally {
      setLoading(false);
    }
  }, [schedule?.id, schedule?.class_id, supabaseClient]);

  useEffect(() => {
    if (isOpen && schedule?.id) {
      fetchClassAndAttendance();
    }
  }, [isOpen, schedule?.id, fetchClassAndAttendance]);

  if (!isOpen || !schedule) return null;

  const startD = new Date(schedule.start_time);
  const endD = new Date(schedule.end_time);

  // Split Vietnamese full name into Last/Middle name and First name
  const splitFullName = (fullName = '') => {
    const trimmed = fullName.trim();
    if (!trimmed) return { hoDem: '—', ten: '—' };
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return { hoDem: '', ten: parts[0] };
    const ten = parts.pop();
    const hoDem = parts.join(' ');
    return { hoDem, ten };
  };

  // Filtered student list by search
  const filteredStudents = students.filter((st) =>
    (st.full_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Stats for teacher
  const presentCount = Object.values(attendanceMap).filter(
    (a) => a.status === 'present' || a.status === 'late'
  ).length;

  const handleUpdateStatus = (studentId, status) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [studentId]: { ...prev[studentId], status },
    }));
  };

  const handleSaveAttendance = async () => {
    if (students.length === 0) {
      alert('Lớp học chưa có học sinh để lưu điểm danh.');
      return;
    }
    setSaving(true);
    try {
      const records = students.map((st) => ({
        schedule_id: schedule.id,
        class_id: schedule.class_id,
        student_id: st.id,
        status: attendanceMap[st.id]?.status || 'present',
        note: attendanceMap[st.id]?.note?.trim() || null,
        marked_at: new Date().toISOString(),
      }));

      const { error: upsertErr } = await supabaseClient
        .from('attendance')
        .upsert(records, { onConflict: 'schedule_id,student_id' });

      if (upsertErr) throw upsertErr;

      // Update schedule status to completed
      await supabaseClient
        .from('schedules')
        .update({ status: 'completed' })
        .eq('id', schedule.id);

      alert('Đã lưu bảng điểm danh thành công!');
      if (onScheduleUpdated) onScheduleUpdated();
      onClose();
    } catch (err) {
      alert('Lỗi lưu điểm danh: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa buổi học "${schedule.title}" không?`)) {
      return;
    }

    setDeleting(true);
    try {
      const { error: delErr } = await supabaseClient
        .from('schedules')
        .delete()
        .eq('id', schedule.id);

      if (delErr) throw delErr;

      alert('Đã xóa buổi học thành công!');
      if (onScheduleDeleted) onScheduleDeleted(schedule.id);
      onClose();
    } catch (err) {
      alert('Lỗi khi xóa buổi học: ' + err.message);
    } finally {
      setDeleting(false);
    }
  };

  // Check current student attendance status
  const myStatus = currentUser?.id ? attendanceMap[currentUser.id]?.status : null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
    >
      <div
        className="glass-card"
        style={{
          maxWidth: '780px',
          width: '100%',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-surface)',
          padding: 0,
          borderRadius: 'var(--radius-lg)',
          overflow: 'hidden',
          boxShadow: '0 24px 48px rgba(0, 0, 0, 0.25)',
        }}
      >
        {/* Banner Header - Inspired by Student Class Detail */}
        <div
          style={{
            background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
            color: '#ffffff',
            padding: '18px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: '800' }}>
                {schedule.classes?.name ? `Học phần: ${schedule.classes.name}` : schedule.title}
              </span>
              <span style={{ opacity: 0.9 }}>–</span>
              <span style={{ fontSize: '0.875rem', fontWeight: '700', opacity: 0.95 }}>
                {startD.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} -{' '}
                {endD.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
              </span>
              {isTeacher ? (
                <span
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.2)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                  }}
                >
                  Có mặt ({presentCount}/{students.length})
                </span>
              ) : myStatus ? (
                <span
                  style={{
                    backgroundColor:
                      myStatus === 'present'
                        ? '#10b981'
                        : myStatus === 'late'
                        ? '#f59e0b'
                        : '#ef4444',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                  }}
                >
                  {myStatus === 'present'
                    ? 'Có mặt'
                    : myStatus === 'late'
                    ? 'Đi trễ'
                    : 'Vắng mặt'}
                </span>
              ) : null}
            </div>
            <span style={{ fontSize: '0.8125rem', opacity: 0.85 }}>
              {schedule.title} • Ngày {startD.toLocaleDateString('vi-VN')}
            </span>
          </div>

          <button
            onClick={onClose}
            aria-label="Đóng cửa sổ"
            title="Đóng"
            style={{
              background: 'none',
              border: 'none',
              color: '#ffffff',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
          }}
        >
          {error && (
            <div
              style={{
                backgroundColor: 'var(--danger-50)',
                color: 'var(--danger-600)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Quick Info Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              backgroundColor: 'var(--bg-page)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <span style={{ fontSize: '0.875rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                Lớp: {schedule.classes?.name || 'Lớp học'}
              </span>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                Sĩ số: <strong>{students.length} học sinh</strong>
                {schedule.meeting_url && ' • Phòng học: Trực tuyến'}
              </div>
            </div>

            {schedule.meeting_url && (
              <a
                href={schedule.meeting_url}
                target="_blank"
                rel="noreferrer"
                className="btn btn-primary btn-sm"
                style={{ padding: '8px 16px', fontWeight: '700' }}
              >
                <Video size={16} /> Vào Lớp Trực Tuyến
              </a>
            )}
          </div>

          {/* Search bar for student list */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.925rem', fontWeight: '800', color: 'var(--text-primary)' }}>
              {isTeacher ? 'Bảng Điểm Danh Lớp Học' : 'Danh Sách Thành Viên Lớp Học'} ({students.length})
            </span>

            <div style={{ position: 'relative', width: '220px' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
              />
              <input
                type="text"
                placeholder="Tìm học sinh..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '6px 12px 6px 30px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-page)',
                  fontSize: '0.8125rem',
                }}
              />
            </div>
          </div>

          {/* Student Roster Table */}
          {loading ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Đang tải danh sách thành viên...
            </div>
          ) : students.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Lớp học chưa có học sinh nào.
            </div>
          ) : (
            <div className="table-responsive" style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '550px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
                    <th style={{ padding: '10px 14px', fontSize: '0.8125rem', fontWeight: '700', width: '60px', textAlign: 'center' }}>
                      STT
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '0.8125rem', fontWeight: '700' }}>
                      Họ đệm
                    </th>
                    <th style={{ padding: '10px 14px', fontSize: '0.8125rem', fontWeight: '700' }}>
                      Tên
                    </th>
                    {isTeacher ? (
                      <th style={{ padding: '10px 14px', fontSize: '0.8125rem', fontWeight: '700', textAlign: 'right' }}>
                        Điểm danh
                      </th>
                    ) : (
                      <th style={{ padding: '10px 14px', fontSize: '0.8125rem', fontWeight: '700', textAlign: 'right' }}>
                        Trạng thái
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {filteredStudents.map((st, idx) => {
                    const { hoDem, ten } = splitFullName(st.full_name);
                    const currentStatus = attendanceMap[st.id]?.status || 'present';

                    return (
                      <tr
                        key={st.id}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          backgroundColor: idx % 2 === 0 ? 'var(--bg-surface)' : 'var(--bg-page)',
                        }}
                      >
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                          {idx + 1}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {hoDem || '—'}
                        </td>
                        <td style={{ padding: '10px 14px', fontSize: '0.875rem', fontWeight: '700', color: 'var(--primary-600)' }}>
                          {ten}
                        </td>

                        {isTeacher ? (
                          <td style={{ padding: '8px 14px', textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '4px' }}>
                              <button
                                type="button"
                                className={`btn btn-sm ${currentStatus === 'present' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => handleUpdateStatus(st.id, 'present')}
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                              >
                                Có mặt
                              </button>
                              <button
                                type="button"
                                className={`btn btn-sm ${currentStatus === 'late' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => handleUpdateStatus(st.id, 'late')}
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                              >
                                Trễ
                              </button>
                              <button
                                type="button"
                                className={`btn btn-sm ${currentStatus === 'excused' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => handleUpdateStatus(st.id, 'excused')}
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                              >
                                Có phép
                              </button>
                              <button
                                type="button"
                                className={`btn btn-sm ${currentStatus === 'absent' ? 'btn-danger' : 'btn-secondary'}`}
                                onClick={() => handleUpdateStatus(st.id, 'absent')}
                                style={{ padding: '3px 8px', fontSize: '0.75rem' }}
                              >
                                Vắng
                              </button>
                            </div>
                          </td>
                        ) : (
                          <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                            <span className="badge badge-success" style={{ fontSize: '0.75rem' }}>
                              Học viên
                            </span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          style={{
            padding: '14px 24px',
            backgroundColor: 'var(--bg-page)',
            borderTop: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          {isTeacher ? (
            <>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDeleteSchedule}
                disabled={deleting}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Trash2 size={14} /> {deleting ? 'Đang xóa...' : 'Xóa buổi học'}
              </button>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                  Đóng
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={handleSaveAttendance}
                  disabled={saving}
                >
                  <UserCheck size={16} /> {saving ? 'Đang lưu...' : 'Lưu Điểm Danh'}
                </button>
              </div>
            </>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose}>
                Đóng
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
