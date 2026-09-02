import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { uploadFileToStorage, getSignedDownloadUrl } from '../../lib/storage';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  Upload, 
  Download, 
  X, 
  AlertCircle,
  Award,
  Send,
  HelpCircle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const StudentAssignments = () => {
  const { supabaseClient, user } = useAppAuth();

  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' | 'quizzes'
  const [assignments, setAssignments] = useState([]);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Submit modal state
  const [activeAssignmentForSubmit, setActiveAssignmentForSubmit] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [files, setFiles] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);

      // 1. Fetch student's enrolled classes
      const { data: memberData } = await supabaseClient
        .from('class_members')
        .select('class_id');

      const classIds = (memberData || []).map((m) => m.class_id);

      if (classIds.length > 0) {
        // Fetch assignments
        const { data: assignList } = await supabaseClient
          .from('assignments')
          .select(`
            *,
            classes (name, subject),
            assignment_submissions (
              id,
              status,
              score,
              feedback,
              submitted_at,
              file_urls,
              text_content
            )
          `)
          .in('class_id', classIds)
          .order('deadline', { ascending: true });

        setAssignments(assignList || []);

        // Fetch published quizzes
        const { data: quizList } = await supabaseClient
          .from('quizzes')
          .select(`
            *,
            classes (name, subject),
            quiz_attempts (
              id,
              score,
              status,
              attempt_number,
              submitted_at
            )
          `)
          .in('class_id', classIds)
          .eq('status', 'PUBLISHED')
          .order('created_at', { ascending: false });

        setQuizzes(quizList || []);
      }
    } catch (err) {
      console.error('Error fetching student assignments & quizzes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id, supabaseClient]);

  const openSubmitModal = (assign) => {
    setActiveAssignmentForSubmit(assign);
    const existingSub = assign.assignment_submissions?.find((s) => true);
    setTextContent(existingSub?.text_content || '');
    setFiles([]);
    setSubmitError(null);
  };

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);

    try {
      const isPastDeadline = activeAssignmentForSubmit?.deadline && new Date(activeAssignmentForSubmit.deadline) < new Date();
      if (isPastDeadline && !activeAssignmentForSubmit?.allow_late_submission) {
        throw new Error('Bài tập đã hết hạn nộp và giáo viên không cho phép nộp muộn.');
      }

      if (!textContent.trim() && files.length === 0) {
        throw new Error('Vui lòng nhập nội dung bài làm hoặc tải lên ít nhất 1 file đính kèm.');
      }

      // Upload files to submissions bucket under student_id folder
      const uploadedFilePaths = [];
      for (const file of files) {
        const uploadRes = await uploadFileToStorage(
          supabaseClient,
          'submissions',
          user.id,
          file
        );
        uploadedFilePaths.push(uploadRes.path);
      }

      // Check if existing submission to update or insert new
      const existingSub = activeAssignmentForSubmit.assignment_submissions?.[0];

      if (existingSub) {
        const combinedFiles = [...(existingSub.file_urls || []), ...uploadedFilePaths];
        const { error: updErr } = await supabaseClient
          .from('assignment_submissions')
          .update({
            text_content: textContent.trim() || null,
            file_urls: combinedFiles,
            submitted_at: new Date().toISOString(),
            status: 'SUBMITTED',
          })
          .eq('id', existingSub.id);

        if (updErr) throw updErr;
      } else {
        const { error: insErr } = await supabaseClient
          .from('assignment_submissions')
          .insert({
            assignment_id: activeAssignmentForSubmit.id,
            student_id: user.id,
            text_content: textContent.trim() || null,
            file_urls: uploadedFilePaths,
            status: 'SUBMITTED',
          });

        if (insErr) throw insErr;
      }

      setActiveAssignmentForSubmit(null);
      await fetchData();
    } catch (err) {
      console.error('Error submitting homework:', err);
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Bài Tập & Điểm Thi 📊
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
          Xem danh sách bài tập về nhà, đề kiểm tra và kết quả chấm điểm của bạn.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'assignments' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('assignments')}
        >
          <FileText size={14} /> Bài tập về nhà ({assignments.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'quizzes' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('quizzes')}
        >
          <HelpCircle size={14} /> Đề kiểm tra ({quizzes.length})
        </button>
      </div>

      {/* Tab: Assignments */}
      {activeTab === 'assignments' && (
        <div>
          {loading ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Đang tải danh sách bài tập...
            </div>
          ) : assignments.length === 0 ? (
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
              <CheckCircle2 size={48} color="var(--success-500)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Không có bài tập nào cần nộp</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
                Thầy/cô chưa giao bài tập mới cho các lớp của bạn.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {assignments.map((item) => {
                const sub = item.assignment_submissions?.[0];
                const isGraded = sub?.status === 'GRADED';
                const isSubmitted = !!sub;
                const isPastDeadline = item.deadline && new Date(item.deadline) < new Date();
                const canSubmit = !isPastDeadline || item.allow_late_submission;

                return (
                  <div key={item.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <span className="badge badge-primary" style={{ marginBottom: '6px' }}>
                          {item.classes?.name}
                        </span>
                        <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {item.title}
                        </h3>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                        <span className={`badge ${
                          isGraded ? 'badge-success' : isSubmitted ? 'badge-primary' : 'badge-warning'
                        }`}>
                          {isGraded ? 'Đã chấm điểm' : isSubmitted ? 'Đã nộp bài' : 'Chưa nộp'}
                        </span>
                        {isPastDeadline && (
                          <span className={`badge ${item.allow_late_submission ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '0.7rem' }}>
                            {item.allow_late_submission ? 'Cho phép nộp muộn' : 'Đã hết hạn'}
                          </span>
                        )}
                      </div>
                    </div>

                    {item.description && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineClamp: 2 }}>
                        {item.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: isPastDeadline ? 'var(--danger-600)' : 'var(--text-secondary)' }}>
                      <Clock size={14} />
                      <span>Hạn nộp: {item.deadline ? new Date(item.deadline).toLocaleString('vi-VN') : 'Không hạn'}</span>
                    </div>

                    {/* Graded Feedback Box */}
                    {isGraded && (
                      <div style={{ backgroundColor: 'var(--success-50)', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--success-100)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--success-700)' }}>ĐIỂM SỐ:</span>
                          <span style={{ fontSize: '1.25rem', fontWeight: '900', color: 'var(--success-700)' }}>
                            {sub.score} / {item.max_score}đ
                          </span>
                        </div>
                        {sub.feedback && (
                          <p style={{ fontSize: '0.8125rem', color: 'var(--success-700)', marginTop: '4px' }}>
                            <strong>Nhận xét:</strong> {sub.feedback}
                          </p>
                        )}
                      </div>
                    )}

                    <button
                      className={`btn btn-sm ${!canSubmit && !isSubmitted ? 'btn-secondary' : isGraded ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => openSubmitModal(item)}
                      disabled={!canSubmit && !isSubmitted}
                      style={{ width: '100%', marginTop: 'auto', justifyContent: 'center' }}
                    >
                      <Upload size={14} />
                      <span>
                        {!canSubmit && !isSubmitted 
                          ? 'Đã hết hạn nộp' 
                          : isSubmitted 
                          ? 'Xem lại / Nộp lại bài' 
                          : 'Nộp bài làm ngay'}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab: Quizzes */}
      {activeTab === 'quizzes' && (
        <div>
          {loading ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Đang tải danh sách đề kiểm tra...
            </div>
          ) : quizzes.length === 0 ? (
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
              <HelpCircle size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Không có đề kiểm tra nào</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
                Thầy/cô chưa mở đề kiểm tra trắc nghiệm cho lớp của bạn.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {quizzes.map((quiz) => {
                const bestAttempt = quiz.quiz_attempts?.sort((a, b) => (b.score || 0) - (a.score || 0))?.[0];
                const attemptCount = quiz.quiz_attempts?.length || 0;

                return (
                  <div key={quiz.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div>
                      <span className="badge badge-primary" style={{ marginBottom: '6px' }}>
                        {quiz.classes?.name}
                      </span>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {quiz.title}
                      </h3>
                    </div>

                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} />
                        <span>{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} phút` : 'Tự do'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Lượt làm: {attemptCount} / {quiz.max_attempts}</span>
                      </div>
                    </div>

                    {bestAttempt && (
                      <div style={{ backgroundColor: 'var(--bg-subtle)', padding: '10px 14px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Điểm cao nhất:</span>
                        <span style={{ fontSize: '1.125rem', fontWeight: '800', color: bestAttempt.score >= (quiz.pass_score || 5) ? 'var(--success-600)' : 'var(--danger-600)' }}>
                          {bestAttempt.score} / 10đ
                        </span>
                      </div>
                    )}

                    <Link
                      to={`/student/quizzes/${quiz.id}`}
                      className="btn btn-primary btn-sm"
                      style={{ width: '100%', marginTop: 'auto', justifyContent: 'center' }}
                    >
                      <span>{attemptCount > 0 ? 'Làm lại bài thi' : 'Bắt đầu làm bài'}</span>
                    </Link>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal Nộp Bài Tập */}
      {activeAssignmentForSubmit && (
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
              onClick={() => setActiveAssignmentForSubmit(null)}
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

            <form onSubmit={handleSubmitAssignment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
                  Nộp Bài Tập: {activeAssignmentForSubmit.title}
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Nhập nội dung văn bản và/hoặc tải lên file bài làm
                </p>
              </div>

              {activeAssignmentForSubmit?.deadline && new Date(activeAssignmentForSubmit.deadline) < new Date() && (
                <div style={{
                  backgroundColor: activeAssignmentForSubmit.allow_late_submission ? 'var(--warning-50)' : 'var(--danger-50)',
                  color: activeAssignmentForSubmit.allow_late_submission ? 'var(--warning-700)' : 'var(--danger-700)',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  fontSize: '0.875rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <AlertCircle size={16} />
                  <span>
                    {activeAssignmentForSubmit.allow_late_submission
                      ? 'Bài tập đã quá hạn nộp nhưng giáo viên cho phép nộp muộn.'
                      : 'Bài tập đã hết hạn nộp! Bạn không thể nộp bài được nữa.'}
                  </span>
                </div>
              )}

              {submitError && (
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
                  <span>{submitError}</span>
                </div>
              )}

              <div>
                <label htmlFor="assignment-text-content" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                  Nội dung bài làm (văn bản)
                </label>
                <textarea
                  id="assignment-text-content"
                  rows={4}
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Nhập câu trả lời hoặc ghi chú gửi thầy/cô..."
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
                <label htmlFor="assignment-file-upload" style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                  Tải lên file bài tập (Ảnh chụp, PDF, Word)
                </label>
                <input
                  id="assignment-file-upload"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => setFiles(Array.from(e.target.files || []))}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    backgroundColor: 'var(--bg-page)',
                    fontSize: '0.875rem'
                  }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Hỗ trợ tải lên nhiều file cùng lúc (Tối đa 10MB/file)
                </span>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveAssignmentForSubmit(null)} style={{ flex: 1 }}>
                  Hủy
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || (activeAssignmentForSubmit?.deadline && new Date(activeAssignmentForSubmit.deadline) < new Date() && !activeAssignmentForSubmit.allow_late_submission)}
                  style={{ flex: 1 }}
                >
                  {submitting ? 'Đang gửi bài...' : 'Nộp bài ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
