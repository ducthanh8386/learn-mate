import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppAuth } from '../../context/AuthContext';
import { exportToExcel } from '../../lib/excelExport';
import { 
  Users, 
  Search, 
  FileSpreadsheet, 
  CheckCircle2, 
  Award, 
  CreditCard, 
  X, 
  Eye,
  UserMinus,
  AlertCircle
} from 'lucide-react';
import { formatCurrency } from '../../lib/formatters';
import { ErrorState } from '../../components/common';

export const TeacherStudents = () => {
  const { supabaseClient } = useAppAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const classIdParam = searchParams.get('classId');

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState(classIdParam || '');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Student Detail Modal
  const [activeStudent, setActiveStudent] = useState(null);
  const [studentDetail, setStudentDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Remove Student from Class states
  const [studentToRemove, setStudentToRemove] = useState(null);
  const [removingStudent, setRemovingStudent] = useState(false);
  const [removeError, setRemoveError] = useState(null);
  const [successToast, setSuccessToast] = useState(null);

  const fetchClassesAndStudents = async () => {
    try {
      setLoading(true);
      const { data: classList } = await supabaseClient
        .from('classes')
        .select('id, name, subject')
        .order('created_at', { ascending: false });

      setClasses(classList || []);

      // Determine active target class
      let targetClassId = selectedClassId;
      if (!targetClassId || !classList?.some((c) => c.id === targetClassId)) {
        targetClassId = (classIdParam && classList?.some((c) => c.id === classIdParam))
          ? classIdParam
          : classList?.[0]?.id || '';
      }

      if (targetClassId) {
        if (selectedClassId !== targetClassId) setSelectedClassId(targetClassId);

        // Fetch students enrolled in this class
        const { data: memberList, error: mErr } = await supabaseClient
          .from('class_members')
          .select(`
            joined_at,
            student_id,
            profiles:student_id (id, full_name, avatar_url, phone, is_active)
          `)
          .eq('class_id', targetClassId);

        if (mErr) throw mErr;

        // Fetch attendance stats for this class
        const { data: attList } = await supabaseClient
          .from('attendance')
          .select('student_id, status')
          .eq('class_id', targetClassId);

        // Fetch quiz scores for students in this class
        const { data: quizAttempts } = await supabaseClient
          .from('quiz_attempts')
          .select('student_id, score, status, quizzes!inner(class_id)')
          .eq('quizzes.class_id', targetClassId);

        // Fetch tuition status for students in this class
        const { data: invList } = await supabaseClient
          .from('tuition_invoices')
          .select('student_id, status, amount_due, amount_paid')
          .eq('class_id', targetClassId);

        // Aggregate stats per student
        const enrichedStudents = (memberList || []).map((m) => {
          const sId = m.student_id;
          const rawProf = Array.isArray(m.profiles) ? m.profiles[0] : m.profiles;
          const stProfile = rawProf ? {
            ...rawProf,
            full_name: rawProf.full_name?.trim() || 'Học sinh',
          } : {
            id: sId,
            full_name: 'Học sinh',
            phone: null,
            avatar_url: null,
            is_active: true,
          };

          // Attendance rate
          const studentAtts = (attList || []).filter((a) => a.student_id === sId);
          const presentCount = studentAtts.filter((a) => a.status === 'present' || a.status === 'late').length;
          const attRate = studentAtts.length > 0 ? Math.round((presentCount / studentAtts.length) * 100) : 100;

          // Average Quiz Score
          const studentScores = (quizAttempts || []).filter((q) => q.student_id === sId && q.score !== null);
          const avgScore = studentScores.length > 0 
            ? (studentScores.reduce((sum, q) => sum + Number(q.score), 0) / studentScores.length).toFixed(1)
            : '—';

          // Tuition status
          const studentInvoices = (invList || []).filter((i) => i.student_id === sId);
          const hasUnpaid = studentInvoices.some((i) => i.status !== 'paid');

          return {
            id: sId,
            profile: stProfile,
            joined_at: m.joined_at,
            attendanceRate: attRate,
            totalSessions: studentAtts.length,
            averageScore: avgScore,
            tuitionStatus: studentInvoices.length === 0 ? 'Chưa có hóa đơn' : hasUnpaid ? 'Còn nợ học phí' : 'Đã hoàn tất',
            hasUnpaid,
          };
        });

        setStudents(enrichedStudents);
      } else {
        setStudents([]);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
      setFetchError(err.message || 'Không thể tải danh sách học sinh.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassesAndStudents();
  }, [selectedClassId, supabaseClient]);

  const handleClassChange = (newClassId) => {
    setSelectedClassId(newClassId);
    setSearchParams({ classId: newClassId });
  };

  const openStudentDetail = async (student) => {
    setActiveStudent(student);
    try {
      setDetailLoading(true);

      // Fetch student detail data
      const [attRes, quizRes, assignRes, tuitionRes] = await Promise.all([
        supabaseClient
          .from('attendance')
          .select('id, schedule_id, status, note, schedules(title, start_time)')
          .eq('student_id', student.id)
          .eq('class_id', selectedClassId),
        supabaseClient
          .from('quiz_attempts')
          .select('id, quiz_id, score, status, started_at, submitted_at, quizzes(title, pass_score)')
          .eq('student_id', student.id),
        supabaseClient
          .from('assignment_submissions')
          .select('id, assignment_id, score, status, submitted_at, feedback, file_url, assignments(title, max_score)')
          .eq('student_id', student.id),
        supabaseClient
          .from('tuition_invoices')
          .select('id, period, amount_due, amount_paid, status, due_date, paid_at, note')
          .eq('student_id', student.id)
          .eq('class_id', selectedClassId),
      ]);

      setStudentDetail({
        attendance: attRes.data || [],
        quizzes: quizRes.data || [],
        assignments: assignRes.data || [],
        tuition: tuitionRes.data || [],
      });
    } catch (err) {
      console.error('Error loading student detailed report:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  // Remove student from class
  const handleConfirmRemoveStudent = async () => {
    if (!studentToRemove || !selectedClassId) return;
    setRemovingStudent(true);
    setRemoveError(null);

    try {
      const { error } = await supabaseClient
        .from('class_members')
        .delete()
        .eq('class_id', selectedClassId)
        .eq('student_id', studentToRemove.id);

      if (error) throw error;

      const studentName = studentToRemove.profile?.full_name || 'Học sinh';
      setStudents((prev) => prev.filter((st) => st.id !== studentToRemove.id));
      setStudentToRemove(null);

      if (activeStudent?.id === studentToRemove.id) {
        setActiveStudent(null);
      }

      setSuccessToast(`Đã xóa học sinh ${studentName} khỏi lớp học thành công.`);
      setTimeout(() => setSuccessToast(null), 4000);
    } catch (err) {
      console.error('Error removing student from class:', err);
      setRemoveError(err.message || 'Không thể xóa học sinh khỏi lớp.');
    } finally {
      setRemovingStudent(false);
    }
  };

  // Excel Export Handlers
  const handleExportRoster = () => {
    const className = classes.find((c) => c.id === selectedClassId)?.name || 'Lop';
    const data = students.map((st, idx) => ({
      STT: idx + 1,
      'Họ và tên': st.profile?.full_name || 'Học sinh',
      'Số điện thoại': st.profile?.phone || '—',
      'Ngày tham gia': new Date(st.joined_at).toLocaleDateString('vi-VN'),
      'Tỷ lệ chuyên cần (%)': `${st.attendanceRate}%`,
      'Điểm kiểm tra TB': st.averageScore,
      'Tình trạng học phí': st.tuitionStatus,
    }));

    exportToExcel(data, `Danh_Sach_Lop_${className}`, 'DanhSachHocSinh');
  };

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter((st) =>
      st.profile?.full_name?.toLowerCase().includes(query) ||
      st.profile?.phone?.includes(query)
    );
  }, [students, searchQuery]);

  const currentClassName = classes.find((c) => c.id === selectedClassId)?.name || 'lớp học';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Toast thông báo thành công */}
      {successToast && (
        <div style={{
          position: 'fixed',
          top: '24px',
          right: '24px',
          backgroundColor: 'var(--success-600)',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          zIndex: 1000,
          fontSize: '0.875rem',
          fontWeight: '600'
        }}>
          <CheckCircle2 size={18} />
          <span>{successToast}</span>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Hồ Sơ Học Sinh & Báo Cáo
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Theo dõi tiến độ học tập, kết quả bài thi, điểm danh, quản lý thành viên và xuất báo cáo Excel.
          </p>
        </div>

        <button
          className="btn btn-secondary"
          onClick={handleExportRoster}
          disabled={students.length === 0}
        >
          <FileSpreadsheet size={16} color="var(--success-600)" /> Xuất Báo Cáo Excel (.xlsx)
        </button>
      </div>

      {/* Class Selector & Search */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: 'var(--bg-surface)',
        padding: '14px 20px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)'
      }}>
        {classes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Chọn Lớp:</span>
            <select
              value={selectedClassId}
              onChange={(e) => handleClassChange(e.target.value)}
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '280px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc SĐT..."
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              fontSize: '0.875rem',
              width: '100%'
            }}
          />
        </div>
      </div>

      {/* Students Table */}
      {loading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang tải danh sách học sinh...
        </div>
      ) : fetchError ? (
        <ErrorState message={fetchError} onRetry={fetchClassesAndStudents} />
      ) : filteredStudents.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <Users size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Lớp chưa có học sinh nào</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
            Chia sẻ mã lớp học (Class Code) để học sinh nhập mã và tham gia lớp.
          </p>
        </div>
      ) : (
        <div className="glass-card table-responsive">
          <table style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Học sinh</th>
                <th style={{ padding: '12px 16px' }}>Số điện thoại</th>
                <th style={{ padding: '12px 16px' }}>Chuyên cần</th>
                <th style={{ padding: '12px 16px' }}>Điểm kiểm tra TB</th>
                <th style={{ padding: '12px 16px' }}>Học phí</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((st) => (
                <tr
                  key={st.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    fontSize: '0.875rem'
                  }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-100)',
                        color: 'var(--primary-700)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '0.875rem'
                      }}>
                        {st.profile?.full_name?.charAt(0)?.toUpperCase() || 'H'}
                      </div>
                      <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>
                        {st.profile?.full_name || 'Học sinh'}
                      </span>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                    {st.profile?.phone || '—'}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span className={`badge ${
                      st.attendanceRate >= 80 ? 'badge-success' : st.attendanceRate >= 50 ? 'badge-warning' : 'badge-danger'
                    }`}>
                      {st.attendanceRate}% ({st.totalSessions} buổi)
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--primary-700)' }}>
                    {st.averageScore !== '—' ? `${st.averageScore} / 10` : 'Chưa có điểm'}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span className={`badge ${st.hasUnpaid ? 'badge-danger' : 'badge-success'}`}>
                      {st.tuitionStatus}
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openStudentDetail(st)}
                        style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        title="Xem chi tiết hồ sơ học tập"
                      >
                        <Eye size={14} /> Xem chi tiết
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          setStudentToRemove(st);
                          setRemoveError(null);
                        }}
                        style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                        title="Xóa / Mời học sinh ra khỏi lớp"
                      >
                        <UserMinus size={14} /> Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Chi Tiết Hồ Sơ Học Sinh */}
      {activeStudent && (
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
            maxWidth: '720px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-surface)',
            padding: '32px',
            position: 'relative'
          }}>
            <button
              onClick={() => setActiveStudent(null)}
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
              <h2 style={{ fontSize: '1.375rem', fontWeight: '800' }}>
                Hồ Sơ: {activeStudent.profile?.full_name}
              </h2>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                SĐT: {activeStudent.profile?.phone || 'Chưa cập nhật'} • Ngày vào lớp: {new Date(activeStudent.joined_at).toLocaleDateString('vi-VN')}
              </span>
            </div>

            {detailLoading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Đang tải dữ liệu học tập...
              </div>
            ) : studentDetail && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Attendance History Box */}
                <div style={{ backgroundColor: 'var(--bg-page)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ fontSize: '0.925rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CheckCircle2 size={16} color="var(--success-500)" /> Điểm danh ({activeStudent.attendanceRate}% Chuyên cần)
                  </h4>
                  {studentDetail.attendance.length === 0 ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Chưa có dữ liệu điểm danh.</span>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      {studentDetail.attendance.map((a) => (
                        <span key={a.id} className={`badge ${a.status === 'present' ? 'badge-success' : a.status === 'late' ? 'badge-warning' : 'badge-danger'}`}>
                          {a.schedules?.title}: {a.status === 'present' ? 'Có mặt' : a.status === 'late' ? 'Đi trễ' : 'Vắng'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Quizzes & Homework Scores */}
                <div style={{ backgroundColor: 'var(--bg-page)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ fontSize: '0.925rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Award size={16} color="var(--primary-500)" /> Kết quả Đề thi & Bài tập
                  </h4>
                  {studentDetail.quizzes.length === 0 && studentDetail.assignments.length === 0 ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Chưa làm bài kiểm tra hoặc bài tập nào.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {studentDetail.quizzes.map((q) => (
                        <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                          <span>{q.quizzes?.title}</span>
                          <strong style={{ color: (q.score || 0) >= 5 ? 'var(--success-600)' : 'var(--danger-600)' }}>
                            {q.score} / 10đ
                          </strong>
                        </div>
                      ))}
                      {studentDetail.assignments.map((as) => (
                        <div key={as.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                          <span>[Bài tập] {as.assignments?.title}</span>
                          <strong>{as.score !== null ? `${as.score} / ${as.assignments?.max_score}đ` : 'Chờ chấm'}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Tuition Invoices */}
                <div style={{ backgroundColor: 'var(--bg-page)', padding: '16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                  <h4 style={{ fontSize: '0.925rem', fontWeight: '700', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CreditCard size={16} color="var(--primary-500)" /> Lịch sử học phí
                  </h4>
                  {studentDetail.tuition.length === 0 ? (
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Chưa có hóa đơn học phí.</span>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {studentDetail.tuition.map((inv) => (
                        <div key={inv.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem' }}>
                          <span>{inv.period} ({formatCurrency(inv.amount_due)})</span>
                          <span className={`badge ${inv.status === 'paid' ? 'badge-success' : 'badge-danger'}`}>
                            {inv.status === 'paid' ? 'Đã thu' : 'Chưa đóng'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer Modal Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '12px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)'
                }}>
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => {
                      setStudentToRemove(activeStudent);
                      setRemoveError(null);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <UserMinus size={14} /> Mời học sinh ra khỏi lớp
                  </button>

                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveStudent(null)}
                  >
                    Đóng
                  </button>
                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Xác Nhận Xóa Học Sinh Khỏi Lớp */}
      {studentToRemove && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.55)',
          backdropFilter: 'blur(8px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 110,
          padding: '20px'
        }}>
          <div className="glass-card" style={{
            maxWidth: '480px',
            width: '100%',
            backgroundColor: 'var(--bg-surface)',
            padding: '28px',
            position: 'relative',
            borderRadius: 'var(--radius-lg)',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px', marginBottom: '16px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--danger-50)',
                color: 'var(--danger-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <AlertCircle size={22} />
              </div>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)', marginBottom: '4px' }}>
                  Xóa Học Sinh Khỏi Lớp?
                </h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                  Bạn có chắc muốn xóa học sinh <strong style={{ color: 'var(--text-primary)' }}>{studentToRemove.profile?.full_name}</strong> ra khỏi lớp <strong style={{ color: 'var(--text-primary)' }}>{currentClassName}</strong>?
                </p>
              </div>
            </div>

            <div style={{
              backgroundColor: 'var(--bg-subtle)',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              marginBottom: '20px',
              fontSize: '0.8125rem',
              color: 'var(--text-secondary)',
              lineHeight: '1.5'
            }}>
              ⚠️ <strong>Lưu ý:</strong> Học sinh này sẽ không thể tiếp tục truy cập bài giảng, tài liệu, lịch học và bài tập của lớp này. Tài khoản người dùng của học sinh vẫn được bảo toàn trong hệ thống.
            </div>

            {removeError && (
              <div style={{
                backgroundColor: 'var(--danger-50)',
                color: 'var(--danger-600)',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.8125rem',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={15} />
                <span>{removeError}</span>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setStudentToRemove(null);
                  setRemoveError(null);
                }}
                disabled={removingStudent}
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmRemoveStudent}
                disabled={removingStudent}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <UserMinus size={15} />
                {removingStudent ? 'Đang xóa...' : 'Xác nhận xóa'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

