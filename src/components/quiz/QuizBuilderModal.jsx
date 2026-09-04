import React, { useState, useEffect } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { X, CheckSquare, Square, Clock, ShieldCheck, Shuffle, AlertCircle } from 'lucide-react';

export const QuizBuilderModal = ({ isOpen, onClose, courseId, classId, onSaved }) => {
  const { supabaseClient } = useAppAuth();

  const [lessons, setLessons] = useState([]);
  const [availableQuestions, setAvailableQuestions] = useState([]);

  // Form states
  const [lessonId, setLessonId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [maxAttempts, setMaxAttempts] = useState(1);
  const [passScore, setPassScore] = useState(5.0);
  const [shuffleQuestions, setShuffleQuestions] = useState(false);
  const [shuffleAnswers, setShuffleAnswers] = useState(false);
  const [showAnswerAfterSubmit, setShowAnswerAfterSubmit] = useState(true);
  const [status, setStatus] = useState('PUBLISHED');

  // Selected questions: map of questionId -> pointsOverride
  const [selectedQuestions, setSelectedQuestions] = useState({});

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;

    const fetchPrerequisites = async () => {
      try {
        setLoading(true);
        // 1. Fetch lessons in this course
        const { data: moduleList } = await supabaseClient
          .from('modules')
          .select('id, title, lessons(id, title)')
          .eq('course_id', courseId);

        const allLessons = [];
        (moduleList || []).forEach((m) => {
          (m.lessons || []).forEach((l) => {
            allLessons.push({ ...l, moduleTitle: m.title });
          });
        });
        setLessons(allLessons);
        if (allLessons.length > 0 && !lessonId) {
          setLessonId(allLessons[0].id);
        }

        // 2. Fetch questions for this course
        const { data: qList, error: qErr } = await supabaseClient
          .from('questions')
          .select('id, course_id, question_text, question_type, difficulty, points, explanation, created_at')
          .eq('course_id', courseId)
          .order('created_at', { ascending: false });

        if (qErr) throw qErr;
        setAvailableQuestions(qList || []);

        // Pre-select all questions by default
        const initSelected = {};
        (qList || []).forEach((q) => {
          initSelected[q.id] = q.points || 1;
        });
        setSelectedQuestions(initSelected);
      } catch (err) {
        console.error('Error fetching quiz prerequisites:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrerequisites();
  }, [isOpen, courseId, supabaseClient]);

  if (!isOpen) return null;

  const toggleSelectQuestion = (qId, defaultPoints) => {
    setSelectedQuestions((prev) => {
      const next = { ...prev };
      if (next[qId] !== undefined) {
        delete next[qId];
      } else {
        next[qId] = defaultPoints || 1;
      }
      return next;
    });
  };

  const handlePointsOverride = (qId, val) => {
    setSelectedQuestions((prev) => ({
      ...prev,
      [qId]: Number(val) || 1,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (!title.trim()) throw new Error('Vui lòng nhập tên đề kiểm tra.');
      const selectedIds = Object.keys(selectedQuestions);
      if (selectedIds.length === 0) throw new Error('Vui lòng chọn ít nhất 1 câu hỏi vào đề.');

      // 1. Insert quiz
      const { data: insertedQuiz, error: qErr } = await supabaseClient
        .from('quizzes')
        .insert({
          lesson_id: lessonId || null,
          class_id: classId,
          title: title.trim(),
          description: description.trim() || null,
          time_limit_minutes: Number(timeLimitMinutes) || null,
          max_attempts: Number(maxAttempts) || 1,
          pass_score: Number(passScore) || 5.0,
          shuffle_questions: shuffleQuestions,
          shuffle_answers: shuffleAnswers,
          question_count: selectedIds.length,
          show_answer_after_submit: showAnswerAfterSubmit,
          status,
        })
        .select()
        .single();

      if (qErr) throw qErr;

      // 2. Insert quiz_questions junctions
      const quizQuestionsPayload = selectedIds.map((qId, index) => ({
        quiz_id: insertedQuiz.id,
        question_id: qId,
        order_index: index,
        points_override: selectedQuestions[qId],
      }));

      const { error: qqErr } = await supabaseClient
        .from('quiz_questions')
        .insert(quizQuestionsPayload);

      if (qqErr) throw qqErr;

      if (onSaved) onSaved();
      onClose();
    } catch (err) {
      console.error('Error creating quiz:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
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
        maxWidth: '780px',
        width: '100%',
        maxHeight: '90vh',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-surface)',
        padding: '32px',
        position: 'relative'
      }}>
        <button
          onClick={onClose}
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

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <h2 style={{ fontSize: '1.375rem', fontWeight: '800' }}>Tạo Đề Kiểm Tra (Quiz Builder)</h2>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
              Cấu hình thời gian, số lần làm bài và chọn câu hỏi từ ngân hàng
            </p>
          </div>

          {error && (
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
              <span>{error}</span>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                Tên bài kiểm tra *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Kiểm tra 15 phút - Chương 1 Đạo Hàm"
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
                Gắn vào Bài học (Tùy chọn)
              </label>
              <select
                value={lessonId}
                onChange={(e) => setLessonId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-page)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="">-- Đề kiểm tra chung cho khóa --</option>
                {lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.moduleTitle}: {l.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Config Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '4px' }}>
                Thời gian làm (phút)
              </label>
              <input
                type="number"
                min="1"
                max="180"
                value={timeLimitMinutes}
                onChange={(e) => setTimeLimitMinutes(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-page)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '4px' }}>
                Số lượt làm tối đa
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-page)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '4px' }}>
                Điểm đạt (Thang 10)
              </label>
              <input
                type="number"
                min="0"
                max="10"
                step="0.5"
                value={passScore}
                onChange={(e) => setPassScore(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-page)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: '600', marginBottom: '4px' }}>
                Trạng thái
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  backgroundColor: 'var(--bg-page)',
                  color: 'var(--text-primary)'
                }}
              >
                <option value="PUBLISHED">Công khai</option>
                <option value="DRAFT">Bản nháp</option>
              </select>
            </div>
          </div>

          {/* Checkbox Options */}
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', backgroundColor: 'var(--bg-subtle)', padding: '12px 16px', borderRadius: 'var(--radius-md)' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={shuffleQuestions}
                onChange={(e) => setShuffleQuestions(e.target.checked)}
                style={{ accentColor: 'var(--primary-500)' }}
              />
              <span>Xáo trộn thứ tự câu hỏi</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={shuffleAnswers}
                onChange={(e) => setShuffleAnswers(e.target.checked)}
                style={{ accentColor: 'var(--primary-500)' }}
              />
              <span>Xáo trộn thứ tự đáp án (A,B,C,D)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.875rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showAnswerAfterSubmit}
                onChange={(e) => setShowAnswerAfterSubmit(e.target.checked)}
                style={{ accentColor: 'var(--primary-500)' }}
              />
              <span>Xem đáp án & giải thích sau khi nộp</span>
            </label>
          </div>

          {/* Question Selection Section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                CHỌN CÂU HỎI VÀO ĐỀ ({Object.keys(selectedQuestions).length} / {availableQuestions.length} câu)
              </span>
            </div>

            {availableQuestions.length === 0 ? (
              <div style={{ padding: '20px', backgroundColor: 'var(--bg-page)', borderRadius: 'var(--radius-md)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
                Khóa học chưa có câu hỏi nào trong ngân hàng. Hãy tạo câu hỏi trước khi tạo đề kiểm tra.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                {availableQuestions.map((q, idx) => {
                  const isSelected = selectedQuestions[q.id] !== undefined;

                  return (
                    <div
                      key={q.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        backgroundColor: isSelected ? 'var(--primary-50)' : 'var(--bg-page)',
                        border: '1px solid',
                        borderColor: isSelected ? 'var(--primary-300)' : 'var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        gap: '12px'
                      }}
                    >
                      <div
                        style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, cursor: 'pointer' }}
                        onClick={() => toggleSelectQuestion(q.id, q.points)}
                      >
                        {isSelected ? (
                          <CheckSquare size={18} color="var(--primary-600)" />
                        ) : (
                          <Square size={18} color="var(--text-muted)" />
                        )}
                        <span style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                          <strong>Câu {idx + 1}:</strong> {q.content}
                        </span>
                      </div>

                      {isSelected && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Điểm:</span>
                          <input
                            type="number"
                            min="0.5"
                            step="0.5"
                            value={selectedQuestions[q.id]}
                            onChange={(e) => handlePointsOverride(q.id, e.target.value)}
                            style={{
                              width: '60px',
                              padding: '4px 6px',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border-subtle)',
                              backgroundColor: '#fff',
                              fontSize: '0.8125rem'
                            }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
              Hủy
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
              {loading ? 'Đang tạo...' : 'Tạo Đề Kiểm Tra'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
