import React, { useEffect, useState, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAppAuth } from '../../context/AuthContext';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  AlertCircle, 
  HelpCircle,
  Sparkles
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

      // 1. Fetch quiz info
      const { data: qData, error: qErr } = await supabaseClient
        .from('quizzes')
        .select('*')
        .eq('id', quizId)
        .single();

      if (qErr) throw qErr;
      setQuiz(qData);

      // 2. Fetch or create attempt
      const { data: existingAttempts } = await supabaseClient
        .from('quiz_attempts')
        .select('*')
        .eq('quiz_id', quizId)
        .eq('student_id', user.id)
        .order('attempt_number', { ascending: false });

      let currentAttempt = existingAttempts?.find((a) => a.status === 'IN_PROGRESS' || a.status === 'NOT_STARTED');

      if (!currentAttempt) {
        const attemptCount = existingAttempts?.length || 0;
        if (attemptCount >= (qData.max_attempts || 1)) {
          throw new Error(`Bạn đã hoàn thành tối đa ${qData.max_attempts || 1} lượt làm bài.`);
        }

        const { data: newAtt, error: attErr } = await supabaseClient
          .from('quiz_attempts')
          .insert({
            quiz_id: quizId,
            student_id: user.id,
            attempt_number: attemptCount + 1,
            status: 'IN_PROGRESS',
            started_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (attErr) throw attErr;
        currentAttempt = newAtt;
      }

      setAttempt(currentAttempt);

      // 3. Fetch questions with answer options (Excluding is_correct)
      const { data: qqList, error: qqErr } = await supabaseClient
        .from('quiz_questions')
        .select(`
          order_index,
          points_override,
          questions (
            id,
            type,
            content,
            points,
            answer_options (
              id,
              content,
              order_index
            )
          )
        `)
        .eq('quiz_id', quizId)
        .order('order_index', { ascending: true });

      if (qqErr) throw qqErr;

      const loadedQuestions = (qqList || []).map((qq) => {
        const q = qq.questions;
        const opts = (q.answer_options || []).sort((a, b) => a.order_index - b.order_index);
        return {
          id: q.id,
          type: q.type,
          content: q.content,
          points: qq.points_override || q.points || 1,
          options: opts,
        };
      });

      setQuestions(loadedQuestions);

      // 4. Initialize timer
      if (qData.time_limit_minutes && qData.time_limit_minutes > 0) {
        const startTime = new Date(currentAttempt.started_at).getTime();
        const totalDurationMs = qData.time_limit_minutes * 60 * 1000;
        const elapsedMs = Date.now() - startTime;
        const remainingSeconds = Math.max(0, Math.round((totalDurationMs - elapsedMs) / 1000));
        setTimeLeft(remainingSeconds);
      }
    } catch (err) {
      console.error('Error starting quiz:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
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
          handleSubmitQuiz(); // Auto-submit when time expires
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, result]);

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
        [qId]: { ...current, selected_option_ids: newIds },
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

  const handleSubmitQuiz = async () => {
    if (submitting || result) return;

    if (!window.confirm('Bạn có chắc muốn nộp bài thi không?')) return;

    setSubmitting(true);
    setError(null);

    try {
      const answersPayload = questions.map((q) => ({
        question_id: q.id,
        selected_option_ids: answers[q.id]?.selected_option_ids || [],
        text_answer: answers[q.id]?.text_answer || '',
      }));

      // Calculate score & record in Supabase
      const { data: dbQuestions } = await supabaseClient
        .from('questions')
        .select('id, type, points, explanation, accepted_answers, answer_options(*)')
        .in('id', questions.map((q) => q.id));

      const qMap = new Map((dbQuestions || []).map((q) => [q.id, q]));
      let earnedPoints = 0;
      let totalMaxPoints = 0;
      let hasEssay = false;
      const answerRows = [];
      const detailedResults = [];

      for (const ans of answersPayload) {
        const q = qMap.get(ans.question_id);
        if (!q) continue;

        const qPoints = Number(q.points) || 1;
        totalMaxPoints += qPoints;
        let isCorrect = false;
        let pAwarded = 0;

        if (q.type === 'multiple_choice' || q.type === 'true_false') {
          const correctOpt = q.answer_options.find((o) => o.is_correct);
          if (correctOpt && ans.selected_option_ids[0] === correctOpt.id) {
            isCorrect = true;
            pAwarded = qPoints;
          }
        } else if (q.type === 'multiple_select') {
          const correctIds = q.answer_options.filter((o) => o.is_correct).map((o) => o.id).sort();
          const chosenIds = (ans.selected_option_ids || []).slice().sort();
          if (correctIds.length === chosenIds.length && correctIds.every((id, i) => id === chosenIds[i])) {
            isCorrect = true;
            pAwarded = qPoints;
          }
        } else if (q.type === 'fill_blank') {
          const text = (ans.text_answer || '').trim().toLowerCase();
          const accepted = (q.accepted_answers || []).map((a) => a.trim().toLowerCase());
          if (accepted.includes(text)) {
            isCorrect = true;
            pAwarded = qPoints;
          }
        } else if (q.type === 'essay') {
          hasEssay = true;
          isCorrect = null;
          pAwarded = null;
        }

        if (pAwarded) earnedPoints += pAwarded;

        answerRows.push({
          attempt_id: attempt.id,
          question_id: q.id,
          selected_option_ids: ans.selected_option_ids,
          text_answer: ans.text_answer,
          is_correct: isCorrect,
          points_awarded: pAwarded,
        });

        detailedResults.push({
          question_id: q.id,
          content: q.content,
          is_correct: isCorrect,
          points_awarded: pAwarded,
          max_points: qPoints,
          explanation: q.explanation,
          correct_options: q.answer_options.filter((o) => o.is_correct).map((o) => o.content),
          user_answer: ans.text_answer || ans.selected_option_ids,
        });
      }

      const finalScore = totalMaxPoints > 0 
        ? Number(((earnedPoints / totalMaxPoints) * 10).toFixed(2)) 
        : earnedPoints;

      const finalStatus = hasEssay ? 'PENDING_GRADING' : 'GRADED';

      // Insert quiz answers
      if (answerRows.length > 0) {
        await supabaseClient.from('quiz_answers').insert(answerRows);
      }

      // Update attempt
      await supabaseClient
        .from('quiz_attempts')
        .update({
          score: finalScore,
          status: finalStatus,
          submitted_at: new Date().toISOString(),
        })
        .eq('id', attempt.id);

      setResult({
        score: finalScore,
        status: finalStatus,
        passed: finalScore >= (quiz.pass_score || 5.0),
        passScore: quiz.pass_score || 5.0,
        showAnswers: quiz.show_answer_after_submit,
        detailedResults,
      });
    } catch (err) {
      console.error('Error submitting quiz:', err);
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
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
