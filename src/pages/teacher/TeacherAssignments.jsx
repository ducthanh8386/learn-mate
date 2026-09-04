import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { uploadFileToStorage, getSignedDownloadUrl } from '../../lib/storage';
import { 
  FileText, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Upload, 
  Download, 
  X, 
  AlertCircle,
  Users,
  Award
} from 'lucide-react';

export const TeacherAssignments = () => {
  const { supabaseClient, user } = useAppAuth();

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal create assignment
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline] = useState('');
  const [maxScore, setMaxScore] = useState(10);
  const [allowLate, setAllowLate] = useState(false);
  const [file, setFile] = useState(null);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Submissions review modal
  const [activeAssignmentForReview, setActiveAssignmentForReview] = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [subLoading, setSubLoading] = useState(false);

  // Grade state: map submissionId -> { score, feedback }
  const [gradingScores, setGradingScores] = useState({});

  const fetchClassesAndAssignments = async () => {
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

        const { data: assignList, error: aErr } = await supabaseClient
          .from('assignments')
          .select(`
            *,
            assignment_submissions (count)
          `)
          .eq('class_id', targetClassId)
          .order('created_at', { ascending: false });

        if (aErr) throw aErr;
        setAssignments(assignList || []);
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassesAndAssignments();
  }, [selectedClassId, supabaseClient]);

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      if (!title.trim()) throw new Error('Vui lòng nhập tên bài tập.');

      let attachmentPath = null;
      if (file) {
        const uploadRes = await uploadFileToStorage(supabaseClient, 'materials', selectedClassId, file);
        attachmentPath = uploadRes.path;
      }

      const { error: insErr } = await supabaseClient
        .from('assignments')
        .insert({
          class_id: selectedClassId,
          title: title.trim(),
          description: description.trim() || null,
          deadline: deadline ? new Date(deadline).toISOString() : null,
          max_score: Number(maxScore) || 10,
          allow_late_submission: allowLate,
          attachment_url: attachmentPath,
        });

      if (insErr) throw insErr;

      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
      setDeadline('');
      setFile(null);
      await fetchClassesAndAssignments();
    } catch (err) {
      console.error('Error creating assignment:', err);
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const openSubmissionsReview = async (assignment) => {
    setActiveAssignmentForReview(assignment);
    try {
      setSubLoading(true);
      const { data, error } = await supabaseClient
        .from('assignment_submissions')
        .select(`
          *,
          profiles:student_id (full_name, avatar_url)
        `)
        .eq('assignment_id', assignment.id)
        .order('submitted_at', { ascending: false });

      if (error) throw error;
      setSubmissions(data || []);

      const initGrading = {};
      (data || []).forEach((sub) => {
        initGrading[sub.id] = {
          score: sub.score !== null ? sub.score : '',
          feedback: sub.feedback || '',
        };
      });
      setGradingScores(initGrading);
    } catch (err) {
      console.error('Error fetching submissions:', err);
    } finally {
      setSubLoading(false);
    }
  };

  const handleSaveGrade = async (submissionId) => {
    const item = gradingScores[submissionId];
    if (!item) return;

    try {
      const scoreNum = Number(item.score);
      const { error } = await supabaseClient
        .from('assignment_submissions')
        .update({
          score: isNaN(scoreNum) ? null : scoreNum,
          feedback: item.feedback.trim() || null,
          status: 'GRADED',
          graded_at: new Date().toISOString(),
        })
        .eq('id', submissionId);

      if (error) throw error;
      alert('Đã lưu điểm và nhận xét thành công!');
    } catch (err) {
      alert('Lỗi chấm điểm: ' + err.message);
    }
  };

  const handleDownloadFile = async (filePath) => {
    try {
      const signedUrl = await getSignedDownloadUrl(supabaseClient, 'submissions', filePath);
      window.open(signedUrl, '_blank');
    } catch (err) {
      alert('Không thể mở file: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Bài Tập Về Nhà
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Giao bài tập tự luận, thu file bài làm học sinh và chấm điểm nhận xét.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setIsCreateOpen(true)}
          disabled={!selectedClassId}
        >
          <Plus size={16} /> Giao bài tập mới
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

      {/* Assignments List */}
      {loading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang tải danh sách bài tập...
        </div>
      ) : assignments.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <FileText size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Chưa có bài tập nào</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px', marginBottom: '20px' }}>
            Giao bài tập về nhà cho lớp để học sinh nộp file và nhận điểm nhận xét từ bạn.
          </p>
          {selectedClassId && (
            <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} /> Giao bài đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {assignments.map((item) => {
            const subCount = item.assignment_submissions?.[0]?.count || 0;

            return (
              <div key={item.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {item.title}
                  </h3>
                  <span className="badge badge-primary">
                    Thang {item.max_score}đ
                  </span>
                </div>

                {item.description && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineClamp: 2 }}>
                    {item.description}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '16px', fontSize: '0.8125rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Clock size={14} />
                    <span>Hạn nộp: {item.deadline ? new Date(item.deadline).toLocaleDateString('vi-VN') : 'Không hạn'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} />
                    <span>{subCount} bài đã nộp</span>
                  </div>
                </div>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => openSubmissionsReview(item)}
                  style={{ width: '100%', marginTop: 'auto', justifyContent: 'space-between' }}
                >
                  <span>Xem danh sách bài nộp & chấm điểm</span>
                  <Award size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Giao Bài Tập */}
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
            maxWidth: '560px',
            width: '100%',
            backgroundColor: 'var(--bg-surface)',
            padding: '32px',
            position: 'relative'
          }}>
            <button
              onClick={() => setIsCreateOpen(false)}
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

            <form onSubmit={handleCreateAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Giao Bài Tập Về Nhà</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Học sinh sẽ nhận được thông báo để làm và nộp bài</p>
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

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                  Tiêu đề bài tập *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="VD: Bài tập tự luyện chuyên đề 2 - Hình không gian"
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-page)',
                    color: 'var(--text-primary)'
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                    Hạn nộp
                  </label>
                  <input
                    type="datetime-local"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-page)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                    Thang điểm tối đa
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={maxScore}
                    onChange={(e) => setMaxScore(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-page)',
                      color: 'var(--text-primary)'
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                  Yêu cầu / Hướng dẫn làm bài
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ghi rõ yêu cầu nộp file ảnh chụp hoặc file word/pdf..."
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-page)',
                    color: 'var(--text-primary)',
                    resize: 'vertical'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                  Đính kèm file đề bài (PDF / Word - Tùy chọn)
                </label>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.png,.jpg"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-page)',
                    fontSize: '0.875rem'
                  }}
                />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={allowLate}
                  onChange={(e) => setAllowLate(e.target.checked)}
                  style={{ accentColor: 'var(--primary-500)' }}
                />
                <span>Cho phép học sinh nộp trễ sau hạn</span>
              </label>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)} style={{ flex: 1 }}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={createLoading} style={{ flex: 1 }}>
                  {createLoading ? 'Đang tạo...' : 'Giao bài ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Chấm Điểm & Xem Bài Nộp */}
      {activeAssignmentForReview && (
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
            maxWidth: '840px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            backgroundColor: 'var(--bg-surface)',
            padding: '32px',
            position: 'relative'
          }}>
            <button
              onClick={() => setActiveAssignmentForReview(null)}
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
                Bài Nộp: {activeAssignmentForReview.title}
              </h2>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                Tổng số bài đã nộp: {submissions.length}
              </span>
            </div>

            {subLoading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Đang tải danh sách bài làm...
              </div>
            ) : submissions.length === 0 ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Chưa có học sinh nào nộp bài tập này.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {submissions.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      padding: '20px',
                      backgroundColor: 'var(--bg-page)',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '14px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' }}>
                          {sub.profiles?.full_name || 'Học sinh'}
                        </span>
                        <span className={`badge ${sub.status === 'GRADED' ? 'badge-success' : 'badge-warning'}`}>
                          {sub.status === 'GRADED' ? 'Đã chấm điểm' : 'Chờ chấm'}
                        </span>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Nộp lúc: {new Date(sub.submitted_at).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    {sub.text_content && (
                      <div style={{ fontSize: '0.875rem', backgroundColor: 'var(--bg-surface)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                        <strong>Nội dung trả lời:</strong>
                        <p style={{ marginTop: '4px', whiteSpace: 'pre-wrap' }}>{sub.text_content}</p>
                      </div>
                    )}

                    {sub.file_urls && sub.file_urls.length > 0 && (
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {sub.file_urls.map((fPath, fIdx) => (
                          <button
                            key={fIdx}
                            className="btn btn-secondary btn-sm"
                            onClick={() => handleDownloadFile(fPath)}
                          >
                            <Download size={14} /> Xem file đính kèm {fIdx + 1}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Grading Form */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.8125rem', fontWeight: '600' }}>Điểm ({activeAssignmentForReview.max_score}đ):</span>
                        <input
                          type="number"
                          min="0"
                          max={activeAssignmentForReview.max_score}
                          step="0.25"
                          value={gradingScores[sub.id]?.score ?? ''}
                          onChange={(e) => setGradingScores({
                            ...gradingScores,
                            [sub.id]: { ...gradingScores[sub.id], score: e.target.value }
                          })}
                          placeholder="Điểm"
                          style={{
                            width: '70px',
                            padding: '6px 8px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-subtle)',
                            backgroundColor: '#fff',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>

                      <input
                        type="text"
                        value={gradingScores[sub.id]?.feedback ?? ''}
                        onChange={(e) => setGradingScores({
                          ...gradingScores,
                          [sub.id]: { ...gradingScores[sub.id], feedback: e.target.value }
                        })}
                        placeholder="Nhận xét cho học sinh..."
                        style={{
                          flex: 1,
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-subtle)',
                          backgroundColor: '#fff',
                          fontSize: '0.875rem'
                        }}
                      />

                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleSaveGrade(sub.id)}
                      >
                        Lưu điểm
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
