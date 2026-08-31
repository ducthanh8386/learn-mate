import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { QuestionEditorModal } from '../../components/quiz/QuestionEditorModal';
import { QuizBuilderModal } from '../../components/quiz/QuizBuilderModal';
import { 
  FileText, 
  HelpCircle, 
  Plus, 
  Clock, 
  CheckCircle2, 
  Trash2, 
  Layers, 
  FolderOpen,
  Filter,
  Eye
} from 'lucide-react';

export const TeacherQuizzes = () => {
  const { supabaseClient, user } = useAppAuth();

  const [activeTab, setActiveTab] = useState('quizzes'); // 'quizzes' | 'questions'
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState('');

  const [quizzes, setQuizzes] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);

  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [isQuizModalOpen, setIsQuizModalOpen] = useState(false);

  const fetchCourses = async () => {
    try {
      const { data: courseList } = await supabaseClient
        .from('courses')
        .select('id, title, class_id, classes(name)')
        .order('created_at', { ascending: false });

      setCourses(courseList || []);
      if (courseList && courseList.length > 0 && !selectedCourseId) {
        setSelectedCourseId(courseList[0].id);
      }
    } catch (err) {
      console.error('Error fetching courses:', err);
    }
  };

  const fetchData = async () => {
    if (!selectedCourseId) return;

    try {
      setLoading(true);

      // Fetch Quizzes for this course's class
      const currentCourse = courses.find((c) => c.id === selectedCourseId);
      if (currentCourse) {
        const { data: qzList } = await supabaseClient
          .from('quizzes')
          .select(`
            *,
            quiz_questions(count),
            quiz_attempts(count)
          `)
          .eq('class_id', currentCourse.class_id)
          .order('created_at', { ascending: false });

        setQuizzes(qzList || []);
      }

      // Fetch Questions for this course
      const { data: qList } = await supabaseClient
        .from('questions')
        .select(`
          *,
          answer_options (*),
          quiz_answers (is_correct)
        `)
        .eq('course_id', selectedCourseId)
        .order('created_at', { ascending: false });

      const enrichedQuestions = (qList || []).map((q) => {
        const answers = q.quiz_answers || [];
        const totalAnswered = answers.length;
        const correctCount = answers.filter((a) => a.is_correct === true).length;
        const accuracyRate = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : null;

        return {
          ...q,
          totalAnswered,
          accuracyRate,
        };
      });

      setQuestions(enrichedQuestions);
    } catch (err) {
      console.error('Error fetching quizzes/questions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourses();
  }, [supabaseClient]);

  useEffect(() => {
    if (selectedCourseId) {
      fetchData();
    }
  }, [selectedCourseId, courses]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Đề Thi & Ngân Hàng Câu Hỏi 📝
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Quản lý ngân hàng câu hỏi dùng chung và soạn đề kiểm tra trắc nghiệm/tự luận.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            className="btn btn-secondary"
            onClick={() => setIsQuestionModalOpen(true)}
            disabled={!selectedCourseId}
          >
            <Plus size={16} /> + Thêm Câu hỏi
          </button>
          <button
            className="btn btn-primary"
            onClick={() => setIsQuizModalOpen(true)}
            disabled={!selectedCourseId}
          >
            <Plus size={16} /> + Tạo Đề Kiểm Tra
          </button>
        </div>
      </div>

      {/* Course Selector */}
      {courses.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', backgroundColor: 'var(--bg-surface)', padding: '12px 18px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
          <Filter size={16} color="var(--primary-500)" />
          <span style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Chọn Khóa học:</span>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-page)',
              color: 'var(--text-primary)',
              fontWeight: '600'
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({c.classes?.name})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '8px' }}>
        <button
          className={`btn btn-sm ${activeTab === 'quizzes' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('quizzes')}
        >
          <FileText size={14} /> Đề kiểm tra ({quizzes.length})
        </button>
        <button
          className={`btn btn-sm ${activeTab === 'questions' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('questions')}
        >
          <HelpCircle size={14} /> Ngân hàng câu hỏi ({questions.length})
        </button>
      </div>

      {/* Tab Content: Quizzes */}
      {activeTab === 'quizzes' && (
        <div>
          {loading ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Đang tải danh sách đề kiểm tra...
            </div>
          ) : quizzes.length === 0 ? (
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
              <FileText size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Chưa có đề kiểm tra nào</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px', marginBottom: '20px' }}>
                Soạn đề kiểm tra từ ngân hàng câu hỏi để học sinh làm bài và chấm điểm tự động.
              </p>
              {selectedCourseId && (
                <button className="btn btn-primary" onClick={() => setIsQuizModalOpen(true)}>
                  <Plus size={16} /> Tạo đề kiểm tra đầu tiên
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
              {quizzes.map((quiz) => {
                const questionCount = quiz.quiz_questions?.[0]?.count || 0;
                const attemptCount = quiz.quiz_attempts?.[0]?.count || 0;

                return (
                  <div key={quiz.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {quiz.title}
                      </h3>
                      <span className={`badge ${quiz.status === 'PUBLISHED' ? 'badge-success' : 'badge-warning'}`}>
                        {quiz.status === 'PUBLISHED' ? 'Công khai' : 'Bản nháp'}
                      </span>
                    </div>

                    {quiz.description && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineClamp: 2 }}>
                        {quiz.description}
                      </p>
                    )}

                    <div style={{ display: 'flex', gap: '16px', fontSize: '0.8125rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <HelpCircle size={14} />
                        <span>{questionCount} Câu hỏi</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Clock size={14} />
                        <span>{quiz.time_limit_minutes ? `${quiz.time_limit_minutes} phút` : 'Không giới hạn'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CheckCircle2 size={14} color="var(--success-500)" />
                        <span>{attemptCount} Lượt nộp</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Questions */}
      {activeTab === 'questions' && (
        <div>
          {loading ? (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Đang tải ngân hàng câu hỏi...
            </div>
          ) : questions.length === 0 ? (
            <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
              <HelpCircle size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
              <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Ngân hàng câu hỏi đang trống</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px', marginBottom: '20px' }}>
                Thêm các câu hỏi trắc nghiệm, đúng/sai, điền từ hoặc tự luận để tái sử dụng cho các đề thi.
              </p>
              {selectedCourseId && (
                <button className="btn btn-primary" onClick={() => setIsQuestionModalOpen(true)}>
                  <Plus size={16} /> Thêm câu hỏi đầu tiên
                </button>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {questions.map((q, qIdx) => (
                <div key={q.id} className="glass-card" style={{ padding: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        backgroundColor: 'var(--primary-50)',
                        color: 'var(--primary-700)',
                        fontWeight: '700',
                        fontSize: '0.8125rem'
                      }}>
                        Câu {qIdx + 1}
                      </span>
                      <div>
                        <p style={{ fontSize: '0.925rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                          {q.content}
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Loại: {q.type} • Điểm: {q.points}
                          </span>
                          {q.accuracyRate !== null && (
                            <span className={`badge ${
                              q.accuracyRate >= 70 ? 'badge-success' : q.accuracyRate >= 40 ? 'badge-warning' : 'badge-danger'
                            }`} style={{ fontSize: '0.6875rem' }}>
                              Độ chính xác: {q.accuracyRate}% ({q.totalAnswered} lượt)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Options display */}
                  {q.answer_options && q.answer_options.length > 0 && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px', marginTop: '12px' }}>
                      {q.answer_options.map((opt, optIdx) => (
                        <div
                          key={opt.id}
                          style={{
                            padding: '8px 12px',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid',
                            borderColor: opt.is_correct ? 'var(--success-500)' : 'var(--border-subtle)',
                            backgroundColor: opt.is_correct ? 'var(--success-50)' : 'var(--bg-page)',
                            fontSize: '0.875rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px'
                          }}
                        >
                          <span style={{ fontWeight: '700', color: opt.is_correct ? 'var(--success-700)' : 'var(--text-muted)' }}>
                            {String.fromCharCode(65 + optIdx)}.
                          </span>
                          <span style={{ color: opt.is_correct ? 'var(--success-700)' : 'var(--text-primary)' }}>
                            {opt.content}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {q.explanation && (
                    <div style={{ marginTop: '10px', fontSize: '0.8125rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                      <strong>Giải thích:</strong> {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {selectedCourse && (
        <>
          <QuestionEditorModal
            isOpen={isQuestionModalOpen}
            onClose={() => setIsQuestionModalOpen(false)}
            courseId={selectedCourse.id}
            classId={selectedCourse.class_id}
            onSaved={fetchData}
          />
          <QuizBuilderModal
            isOpen={isQuizModalOpen}
            onClose={() => setIsQuizModalOpen(false)}
            courseId={selectedCourse.id}
            classId={selectedCourse.class_id}
            onSaved={fetchData}
          />
        </>
      )}
    </div>
  );
};
