import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppAuth } from '../../context/AuthContext';
import { LessonContentEditor } from '../../components/course/LessonContentEditor';
import { 
  ArrowLeft, 
  Plus, 
  Layers, 
  BookOpen, 
  ChevronDown, 
  ChevronRight, 
  Trash2, 
  Eye, 
  EyeOff, 
  AlertCircle,
  FileText,
  Video
} from 'lucide-react';

export const CourseDetail = () => {
  const { courseId } = useParams();
  const { supabaseClient } = useAppAuth();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Expanded states
  const [expandedLessons, setExpandedLessons] = useState({});

  // Module creation state
  const [isAddingModule, setIsAddingModule] = useState(false);
  const [moduleTitle, setModuleTitle] = useState('');

  // Lesson creation state
  const [activeModuleForLesson, setActiveModuleForLesson] = useState(null);
  const [lessonTitle, setLessonTitle] = useState('');
  const [lessonDesc, setLessonDesc] = useState('');

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch course info
      const { data: courseData, error: cErr } = await supabaseClient
        .from('courses')
        .select(`
          *,
          classes (id, name, subject)
        `)
        .eq('id', courseId)
        .single();

      if (cErr) throw cErr;
      setCourse(courseData);

      // 2. Fetch modules with lessons & contents
      const { data: moduleData, error: mErr } = await supabaseClient
        .from('modules')
        .select(`
          *,
          lessons (
            *,
            lesson_contents (*)
          )
        `)
        .eq('course_id', courseId)
        .order('order_index', { ascending: true });

      if (mErr) throw mErr;

      // Sort lessons inside each module by order_index
      const sortedModules = (moduleData || []).map((m) => ({
        ...m,
        lessons: (m.lessons || []).sort((a, b) => a.order_index - b.order_index),
      }));

      setModules(sortedModules);
    } catch (err) {
      console.error('Error fetching course detail:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseData();
  }, [courseId, supabaseClient]);

  const handleAddModule = async (e) => {
    e.preventDefault();
    if (!moduleTitle.trim()) return;

    try {
      const nextOrder = modules.length;
      const { error: insErr } = await supabaseClient
        .from('modules')
        .insert({
          course_id: courseId,
          class_id: course.class_id,
          title: moduleTitle.trim(),
          order_index: nextOrder,
        });

      if (insErr) throw insErr;

      setModuleTitle('');
      setIsAddingModule(false);
      await fetchCourseData();
    } catch (err) {
      alert('Lỗi tạo chương: ' + err.message);
    }
  };

  const handleDeleteModule = async (moduleId) => {
    if (!window.confirm('Xóa chương này sẽ xóa tất cả các bài học bên trong. Bạn chắc chắn chứ?')) return;
    try {
      const { error: delErr } = await supabaseClient
        .from('modules')
        .delete()
        .eq('id', moduleId);

      if (delErr) throw delErr;
      await fetchCourseData();
    } catch (err) {
      alert('Lỗi xóa chương: ' + err.message);
    }
  };

  const handleAddLesson = async (e, moduleId, existingLessonCount) => {
    e.preventDefault();
    if (!lessonTitle.trim()) return;

    try {
      const { error: insErr } = await supabaseClient
        .from('lessons')
        .insert({
          module_id: moduleId,
          class_id: course.class_id,
          title: lessonTitle.trim(),
          description: lessonDesc.trim() || null,
          order_index: existingLessonCount,
          status: 'PUBLISHED',
        });

      if (insErr) throw insErr;

      setLessonTitle('');
      setLessonDesc('');
      setActiveModuleForLesson(null);
      await fetchCourseData();
    } catch (err) {
      alert('Lỗi tạo bài học: ' + err.message);
    }
  };

  const handleDeleteLesson = async (lessonId) => {
    if (!window.confirm('Bạn có chắc muốn xóa bài học này?')) return;
    try {
      const { error: delErr } = await supabaseClient
        .from('lessons')
        .delete()
        .eq('id', lessonId);

      if (delErr) throw delErr;
      await fetchCourseData();
    } catch (err) {
      alert('Lỗi xóa bài học: ' + err.message);
    }
  };

  const togglePublishLesson = async (lessonId, currentStatus) => {
    try {
      const nextStatus = currentStatus === 'PUBLISHED' ? 'DRAFT' : 'PUBLISHED';
      const { error: updErr } = await supabaseClient
        .from('lessons')
        .update({ status: nextStatus })
        .eq('id', lessonId);

      if (updErr) throw updErr;
      await fetchCourseData();
    } catch (err) {
      alert('Lỗi đổi trạng thái: ' + err.message);
    }
  };

  const toggleExpandLesson = (lessonId) => {
    setExpandedLessons((prev) => ({
      ...prev,
      [lessonId]: !prev[lessonId],
    }));
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Đang tải thông tin giáo trình...
      </div>
    );
  }

  if (error || !course) {
    return (
      <div style={{
        backgroundColor: 'var(--danger-50)',
        color: 'var(--danger-600)',
        padding: '24px',
        borderRadius: 'var(--radius-md)',
        textAlign: 'center'
      }}>
        <AlertCircle size={32} style={{ margin: '0 auto 8px' }} />
        <h3>Không tìm thấy khóa học</h3>
        <p style={{ fontSize: '0.875rem', marginTop: '4px' }}>{error || 'Khóa học không tồn tại hoặc đã bị xóa.'}</p>
        <Link to="/teacher/courses" className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }}>
          Quay lại danh sách khóa học
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Link to="/teacher/courses" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={16} /> Quay lại danh sách khóa học
        </Link>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span className="badge badge-primary">{course.classes?.name}</span>
              <span className={`badge ${course.status === 'PUBLISHED' ? 'badge-success' : 'badge-warning'}`}>
                {course.status === 'PUBLISHED' ? 'Đã xuất bản' : 'Bản nháp'}
              </span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', marginTop: '8px', letterSpacing: '-0.02em' }}>
              {course.title}
            </h1>
            {course.description && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
                {course.description}
              </p>
            )}
          </div>

          <button className="btn btn-primary" onClick={() => setIsAddingModule(true)}>
            <Plus size={16} /> Thêm Chương Mới
          </button>
        </div>
      </div>

      {/* Add Module Form */}
      {isAddingModule && (
        <form onSubmit={handleAddModule} className="glass-card" style={{ padding: '20px', display: 'flex', gap: '12px', alignItems: 'center', backgroundColor: 'var(--bg-subtle)' }}>
          <input
            type="text"
            required
            autoFocus
            value={moduleTitle}
            onChange={(e) => setModuleTitle(e.target.value)}
            placeholder="Tên chương học mới (VD: Chương 1: Hàm số và Đồ thị)"
            style={{
              flex: 1,
              padding: '10px 14px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--text-primary)'
            }}
          />
          <button type="submit" className="btn btn-primary btn-sm">Lưu chương</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setIsAddingModule(false)}>Hủy</button>
        </form>
      )}

      {/* Modules & Lessons Tree */}
      {modules.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center', borderStyle: 'dashed' }}>
          <Layers size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Chưa có chương học nào</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px', marginBottom: '20px' }}>
            Bắt đầu cấu trúc khóa học bằng việc tạo chương học đầu tiên.
          </p>
          <button className="btn btn-primary" onClick={() => setIsAddingModule(true)}>
            <Plus size={16} /> Tạo chương đầu tiên
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {modules.map((mod, modIdx) => (
            <div key={mod.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Module Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '8px',
                    backgroundColor: 'var(--primary-50)',
                    color: 'var(--primary-600)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    fontSize: '0.875rem'
                  }}>
                    {modIdx + 1}
                  </span>
                  <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                    {mod.title}
                  </h3>
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => setActiveModuleForLesson(mod.id)}
                    style={{ fontSize: '0.75rem', padding: '6px 10px' }}
                  >
                    <Plus size={14} /> Thêm bài học
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleDeleteModule(mod.id)}
                    style={{ padding: '6px', color: 'var(--danger-600)' }}
                    title="Xóa chương này"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Add Lesson Form inside this Module */}
              {activeModuleForLesson === mod.id && (
                <form
                  onSubmit={(e) => handleAddLesson(e, mod.id, mod.lessons?.length || 0)}
                  style={{
                    padding: '16px',
                    backgroundColor: 'var(--bg-subtle)',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    border: '1px solid var(--border-subtle)'
                  }}
                >
                  <input
                    type="text"
                    required
                    autoFocus
                    value={lessonTitle}
                    onChange={(e) => setLessonTitle(e.target.value)}
                    placeholder="Tên bài học (VD: Bài 1: Khảo sát sự biến thiên của hàm số)"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem'
                    }}
                  />
                  <input
                    type="text"
                    value={lessonDesc}
                    onChange={(e) => setLessonDesc(e.target.value)}
                    placeholder="Mô tả tóm tắt nội dung bài học (tùy chọn)"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.875rem'
                    }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                    <button type="button" className="btn btn-secondary btn-sm" onClick={() => setActiveModuleForLesson(null)}>
                      Hủy
                    </button>
                    <button type="submit" className="btn btn-primary btn-sm">
                      + Tạo bài học
                    </button>
                  </div>
                </form>
              )}

              {/* Lessons List */}
              {mod.lessons && mod.lessons.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {mod.lessons.map((lesson, lesIdx) => {
                    const isExpanded = !!expandedLessons[lesson.id];
                    const contentCount = lesson.lesson_contents?.length || 0;

                    return (
                      <div
                        key={lesson.id}
                        style={{
                          backgroundColor: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden'
                        }}
                      >
                        {/* Lesson Row */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 18px',
                            cursor: 'pointer',
                            backgroundColor: isExpanded ? 'var(--bg-subtle)' : 'transparent',
                            transition: 'background-color 0.15s ease'
                          }}
                          onClick={() => toggleExpandLesson(lesson.id)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            <div>
                              <span style={{ fontSize: '0.925rem', fontWeight: '600', color: 'var(--text-primary)' }}>
                                Bài {lesIdx + 1}: {lesson.title}
                              </span>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: '10px' }}>
                                ({contentCount} nội dung)
                              </span>
                            </div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => togglePublishLesson(lesson.id, lesson.status)}
                              title={lesson.status === 'PUBLISHED' ? 'Chuyển sang Nháp (Ẩn)' : 'Xuất bản bài học'}
                              style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                            >
                              {lesson.status === 'PUBLISHED' ? (
                                <><Eye size={12} color="var(--success-600)" /> Công khai</>
                              ) : (
                                <><EyeOff size={12} color="var(--warning-600)" /> Ẩn (Nháp)</>
                              )}
                            </button>

                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleDeleteLesson(lesson.id)}
                              style={{ padding: '6px', color: 'var(--danger-600)' }}
                              title="Xóa bài học"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>

                        {/* Expanded Lesson Content Editor */}
                        {isExpanded && (
                          <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-page)' }}>
                            <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--text-secondary)' }}>
                              NỘI DUNG BÀI HỌC (VIDEO YOUTUBE & TÀI LIỆU PDF/WORD):
                            </span>
                            <LessonContentEditor
                              classId={course.class_id}
                              lessonId={lesson.id}
                              contents={lesson.lesson_contents || []}
                              onUpdate={fetchCourseData}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px 0' }}>
                  Chương này chưa có bài học nào. Bấm "+ Thêm bài học" ở trên để bắt đầu.
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
