import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAppAuth } from '../../context/AuthContext';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  AlertCircle 
} from 'lucide-react';

export const StudentQuizTake = () => {
  const { quizId } = useParams();
  const { supabaseClient, user } = useAppAuth();
  const navigate = useNavigate();

  const [quiz, setQuiz] = useState(null);
  const [attempt, setAttempt] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);

  // Student answers: map of questionId -> { selected_option_ids: [], text_answer: '' }
  const [answers, setAnswers] = useState({});

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  // Countdown timer in seconds
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = useRef(null);

  // Post-submit result
  const [result, setResult] = useState(null);

  const startOrResumeQuiz = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Gọi Edge Function bảo mật get-quiz-for-attempt (ẩn hoàn toàn is_correct)
      const { data: edgeData, error: funcErr } = await supabaseClient.functions.invoke('get-quiz-for-attempt', {
        body: { quizId },
      });

      if (funcErr) throw funcErr;
      if (edgeData?.error) throw new Error(edgeData.error);

      setQuiz(edgeData.quiz);
      setAttempt(edgeData.attempt);
      setQuestions(edgeData.questions || []);

      // 2. Khởi tạo đồng hồ đếm ngược nếu có giới hạn thời gian
      if (edgeData.quiz.time_limit_minutes && edgeData.quiz.time_limit_minutes > 0) {
        const startTime = new Date(edgeData.attempt.started_at).getTime();
        const totalDurationMs = edgeData.quiz.time_limit_minutes * 60 * 1000;
        const elapsedMs = Date.now() - startTime;
        const remainingSeconds = Math.max(0, Math.round((totalDurationMs - elapsedMs) / 1000));
        setTimeLeft(remainingSeconds);
      }
    } catch (err) {
      console.error('Error starting quiz:', err);
      setError(err.message || 'Không thể tải đề kiểm tra.');
    } finally {
      setLoading(false);
    }
  };

  const submitQuizToServer = async (isAutoSubmit = false) => {
    if (submitting || result || !attempt?.id) return;

    if (!isAutoSubmit) {
      if (!window.confirm('Bạn có chắc muốn nộp bài thi không?')) return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const answersPayload = questions.map((q) => ({
        question_id: q.id,
        selected_option_ids: answers[q.id]?.selected_option_ids || [],
        text_answer: answers[q.id]?.text_answer || '',
      }));

      // Gọi Edge Function submit-quiz-attempt để chấm điểm server-side
      const { data: submitData, error: submitErr } = await supabaseClient.functions.invoke('submit-quiz-attempt', {
        body: {
          attemptId: attempt.id,
          answers: answersPayload,
        },
      });

      if (submitErr) throw submitErr;
      if (submitData?.error) throw new Error(submitData.error);

      setResult({
        score: submitData.score,
        status: submitData.status,
        passed: submitData.passed,
        passScore: submitData.passScore,
        showAnswers: submitData.showAnswers,
        detailedResults: submitData.results || [],
      });
    } catch (err) {
      console.error('Error submitting quiz:', err);
      setError(err.message || 'Đã có lỗi xảy ra khi nộp bài thi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitQuiz = () => {
    submitQuizToServer(false);
  };

  useEffect(() => {
    if (user?.id && quizId) {
      startOrResumeQuiz();
    }
  }, [quizId, user?.id, supabaseClient]);

  // Countdown timer tick
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || result) return;

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          submitQuizToServer(true); // Auto-submit when time expires
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, result, attempt?.id, questions, answers]);

  const handleSelectOption = (qId, optionId, isMultiple) => {
    setAnswers((prev) => {
      const current = prev[qId] || { selected_option_ids: [], text_answer: '' };
      let newIds = [];
      if (isMultiple) {
        if (current.selected_option_ids.includes(optionId)) {
          newIds = current.selected_option_ids.filter((id) => id !== optionId);
        } else {
          newIds = [...current.selected_option_ids, optionId];
        }
      } else {
        newIds = [optionId];
      }
      return {
        ...prev,
        [qId]: {
          ...current,
          selected_option_ids: newIds,
        },
      };
    });
  };

  const handleTextAnswer = (qId, val) => {
    setAnswers((prev) => ({
      ...prev,
      [qId]: {
        selected_option_ids: [],
        text_answer: val,
      },
    }));
  };

  const formatTimer = (seconds) => {
    if (seconds === null) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Đang tải đề kiểm tra...
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div style={{
        backgroundColor: 'var(--danger-50)',
        color: 'var(--danger-600)',
        padding: '24px',
        borderRadius: 'var(--radius-md)',
        textAlign: 'center'
      }}>
        <AlertCircle size={32} style={{ margin: '0 auto 8px' }} />
        <h3>Không thể vào bài kiểm tra</h3>
        <p style={{ fontSize: '0.875rem', marginTop: '4px' }}>{error || 'Bài kiểm tra không tồn tại hoặc đã hết hạn.'}</p>
        <button className="btn btn-secondary btn-sm" onClick={() => navigate(-1)} style={{ marginTop: '16px' }}>
          Quay lại
        </button>
      </div>
    );
  }

  // Result View
  if (result) {
    return (
      <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div className="glass-card" style={{ padding: '32px', textAlign: 'center' }}>
          {result.passed ? (
            <CheckCircle2 size={64} color="var(--success-500)" style={{ margin: '0 auto 16px' }} />
          ) : (
            <XCircle size={64} color="var(--danger-500)" style={{ margin: '0 auto 16px' }} />
          )}

          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            {result.passed ? 'Chúc mừng bạn đã ĐẠT!' : 'Chưa đạt điểm yêu cầu'}
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            {quiz.title}
          </p>

          <div style={{
            display: 'inline-flex',
            flexDirection: 'column',
            alignItems: 'center',
            margin: '24px auto',
            padding: '16px 36px',
            backgroundColor: 'var(--bg-subtle)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>ĐIỂM SỐ CỦA BẠN</span>
            <span style={{ fontSize: '3rem', fontWeight: '900', color: result.passed ? 'var(--success-600)' : 'var(--danger-600)' }}>
              {result.score} <span style={{ fontSize: '1.25rem', color: 'var(--text-muted)' }}>/ 10</span>
            </span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              Điểm đạt yêu cầu: {result.passScore}/10
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
            <button className="btn btn-primary" onClick={() => navigate(-1)}>
              Quay lại bài học
            </button>
          </div>
        </div>

        {/* Detailed Solutions if allowed */}
        {result.showAnswers && result.detailedResults && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Xem lại đáp án & Giải thích chi tiết</h3>
            {result.detailedResults.map((r, idx) => (
              <div key={idx} className="glass-card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.925rem' }}>
                    Câu {idx + 1}: {r.content}
                  </span>
                  <span className={`badge ${r.is_correct ? 'badge-success' : r.is_correct === false ? 'badge-danger' : 'badge-warning'}`}>
                    {r.is_correct ? 'Đúng' : r.is_correct === false ? 'Sai' : 'Chờ chấm'}
                  </span>
                </div>

                {r.correct_options && r.correct_options.length > 0 && (
                  <div style={{ marginTop: '10px', fontSize: '0.875rem', color: 'var(--success-700)' }}>
                    <strong>Đáp án đúng:</strong> {r.correct_options.join(', ')}
                  </div>
                )}

                {r.explanation && (
                  <div style={{ marginTop: '8px', fontSize: '0.8125rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                    <strong>Giải thích:</strong> {r.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  const currentQ = questions[currentQIndex];
  if (!currentQ) return null;

  return (
    <div style={{ maxWidth: '840px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Quiz Header with Timer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 24px',
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-lg)'
      }}>
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            {quiz.title}
          </h2>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
            Lượt làm {attempt?.attempt_number} / {quiz.max_attempts}
          </span>
        </div>

        {timeLeft !== null && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            backgroundColor: timeLeft < 120 ? 'var(--danger-50)' : 'var(--primary-50)',
            color: timeLeft < 120 ? 'var(--danger-600)' : 'var(--primary-700)',
            borderRadius: 'var(--radius-full)',
            fontWeight: '700',
            fontSize: '1rem'
          }}>
            <Clock size={18} />
            <span>{formatTimer(timeLeft)}</span>
          </div>
        )}
      </div>

      {/* Question Pagination Dots */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {questions.map((q, idx) => {
          const isAnswered = (answers[q.id]?.selected_option_ids?.length > 0) || (answers[q.id]?.text_answer?.trim() !== '');
          const isCurrent = currentQIndex === idx;

          return (
            <button
              key={q.id}
              onClick={() => setCurrentQIndex(idx)}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid',
                borderColor: isCurrent ? 'var(--primary-600)' : 'var(--border-subtle)',
                backgroundColor: isCurrent ? 'var(--primary-500)' : isAnswered ? 'var(--primary-50)' : 'var(--bg-surface)',
                color: isCurrent ? '#fff' : isAnswered ? 'var(--primary-700)' : 'var(--text-secondary)',
                fontWeight: '700',
                fontSize: '0.875rem',
                cursor: 'pointer'
              }}
            >
              {idx + 1}
            </button>
          );
        })}
      </div>

      {/* Current Question Box */}
      <div className="glass-card" style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="badge badge-primary" style={{ fontSize: '0.8125rem' }}>
            Câu hỏi {currentQIndex + 1} / {questions.length} ({currentQ.points} điểm)
          </span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{currentQ.type}</span>
        </div>

        <p style={{ fontSize: '1.125rem', fontWeight: '600', color: 'var(--text-primary)', lineHeight: 1.6 }}>
          {currentQ.content}
        </p>

        {/* Option Selectors */}
        {(currentQ.type === 'multiple_choice' || currentQ.type === 'multiple_select' || currentQ.type === 'true_false') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentQ.options.map((opt, optIdx) => {
              const isSelected = answers[currentQ.id]?.selected_option_ids?.includes(opt.id);
              const isMultiple = currentQ.type === 'multiple_select';

              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelectOption(currentQ.id, opt.id, isMultiple)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '14px',
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid',
                    borderColor: isSelected ? 'var(--primary-500)' : 'var(--border-subtle)',
                    backgroundColor: isSelected ? 'var(--primary-50)' : 'var(--bg-page)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <input
                    type={isMultiple ? 'checkbox' : 'radio'}
                    checked={!!isSelected}
                    onChange={() => {}}
                    style={{ accentColor: 'var(--primary-500)', width: '18px', height: '18px' }}
                  />
                  <span style={{ fontWeight: '700', color: isSelected ? 'var(--primary-700)' : 'var(--text-muted)' }}>
                    {String.fromCharCode(65 + optIdx)}.
                  </span>
                  <span style={{ fontSize: '0.925rem', color: isSelected ? 'var(--primary-900)' : 'var(--text-primary)' }}>
                    {opt.content}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {currentQ.type === 'fill_blank' && (
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>
              Nhập câu trả lời của bạn:
            </label>
            <input
              type="text"
              value={answers[currentQ.id]?.text_answer || ''}
              onChange={(e) => handleTextAnswer(currentQ.id, e.target.value)}
              placeholder="Gõ đáp án vào đây..."
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-page)',
                fontSize: '1rem'
              }}
            />
          </div>
        )}

        {currentQ.type === 'essay' && (
          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '8px' }}>
              Bài làm tự luận:
            </label>
            <textarea
              rows={6}
              value={answers[currentQ.id]?.text_answer || ''}
              onChange={(e) => handleTextAnswer(currentQ.id, e.target.value)}
              placeholder="Trình bày chi tiết lời giải của bạn..."
              style={{
                width: '100%',
                padding: '12px 16px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-page)',
                fontSize: '0.925rem'
              }}
            />
          </div>
        )}

        {/* Navigation Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <button
            className="btn btn-secondary btn-sm"
            onClick={() => setCurrentQIndex((prev) => Math.max(0, prev - 1))}
            disabled={currentQIndex === 0}
          >
            <ArrowLeft size={14} /> Câu trước
          </button>

          {currentQIndex < questions.length - 1 ? (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setCurrentQIndex((prev) => Math.min(questions.length - 1, prev + 1))}
            >
              Câu tiếp theo <ArrowRight size={14} />
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleSubmitQuiz}
              disabled={submitting}
            >
              <Send size={16} /> {submitting ? 'Đang nộp bài...' : 'Nộp bài thi'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
