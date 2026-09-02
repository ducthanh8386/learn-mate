import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { 
  Plus, 
  Layers, 
  FileText, 
  ArrowRight, 
  X, 
  AlertCircle,
  FolderOpen
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, FormField } from '../../components/common';

export const TeacherCourses = () => {
  const { supabaseClient, user } = useAppAuth();
  const [courses, setCourses] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  // Form state
  const [classId, setClassId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [status, setStatus] = useState('PUBLISHED');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      // 1. Fetch tutor's classes
      const { data: classList } = await supabaseClient
        .from('classes')
        .select('id, name, subject')
        .order('created_at', { ascending: false });

      setClasses(classList || []);
      if (classList && classList.length > 0 && !classId) {
        setClassId(classList[0].id);
      }

      // 2. Fetch courses with class info and module counts
      const { data: courseList, error: courseErr } = await supabaseClient
        .from('courses')
        .select(`
          *,
          classes (name, subject),
          modules (
            id,
            lessons (id)
          )
        `)
        .order('created_at', { ascending: false });

      if (courseErr) throw courseErr;
      setCourses(courseList || []);
    } catch (err) {
      console.error('Error fetching courses:', err);
      setFetchError(err.message || 'Không thể tải danh sách khóa học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [supabaseClient]);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      if (!classId) throw new Error('Vui lòng chọn lớp học áp dụng.');

      const { error: insertErr } = await supabaseClient
        .from('courses')
        .insert({
          class_id: classId,
          tutor_id: user.id,
          title,
          description,
          thumbnail_url: thumbnailUrl || null,
          status,
        });

      if (insertErr) throw insertErr;

      setIsCreateOpen(false);
      setTitle('');
      setDescription('');
      setThumbnailUrl('');
      await fetchData();
    } catch (err) {
      console.error('Error creating course:', err);
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Khóa Học & Bài Giảng 📖
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Xây dựng cây nội dung 3 cấp: Khóa học ➔ Chương học ➔ Bài giảng (YouTube / PDF).
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)} disabled={classes.length === 0}>
          <Plus size={16} /> Tạo khóa học mới
        </button>
      </div>

      {classes.length === 0 && !loading && (
        <div style={{
          backgroundColor: 'var(--warning-50)',
          color: 'var(--warning-700)',
          padding: '16px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} />
          <div>
            <strong>Bạn chưa có lớp học nào!</strong>
            <p style={{ fontSize: '0.875rem', marginTop: '2px' }}>
              Hãy qua mục <Link to="/teacher/classes" style={{ textDecoration: 'underline', fontWeight: '600' }}>Quản lý lớp học</Link> tạo lớp trước khi tạo khóa học.
            </p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang tải danh sách khóa học...
        </div>
      ) : fetchError ? (
        <ErrorState message={fetchError} onRetry={fetchData} />
      ) : courses.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <FolderOpen size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Chưa có khóa học nào</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px', marginBottom: '20px' }}>
            Tạo khóa học để bắt đầu thêm các chương học và bài giảng video cho học sinh.
          </p>
          {classes.length > 0 && (
            <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} /> Tạo khóa học đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {courses.map((course) => {
            const moduleCount = course.modules?.length || 0;
            const lessonCount = course.modules?.reduce((acc, m) => acc + (m.lessons?.length || 0), 0) || 0;

            return (
              <div key={course.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge badge-primary" style={{ marginBottom: '8px' }}>
                      {course.classes?.name || 'Lớp học'}
                    </span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {course.title}
                    </h3>
                  </div>
                  <span className={`badge ${course.status === 'PUBLISHED' ? 'badge-success' : 'badge-warning'}`}>
                    {course.status === 'PUBLISHED' ? 'Đã xuất bản' : 'Bản nháp'}
                  </span>
                </div>

                {course.description && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineClamp: 2 }}>
                    {course.description}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '16px', fontSize: '0.8125rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} />
                    <span>{moduleCount} Chương</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <FileText size={14} />
                    <span>{lessonCount} Bài giảng</span>
                  </div>
                </div>

                <Link
                  to={`/teacher/courses/${course.id}`}
                  className="btn btn-primary btn-sm"
                  style={{ width: '100%', justifyContent: 'space-between', marginTop: 'auto' }}
                >
                  <span>Chỉnh sửa giáo trình & bài giảng</span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tạo Khóa Học Mới */}
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

            <form onSubmit={handleCreateCourse} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Tạo Khóa Học Mới</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Gắn khóa học vào một trong các lớp bạn đang phụ trách</p>
              </div>

              {formError && (
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
                  <span>{formError}</span>
                </div>
              )}

              <FormField
                id="course-class-select"
                label="Chọn Lớp học"
                type="select"
                required
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                options={classes.map((cls) => ({
                  value: cls.id,
                  label: `${cls.name} (${cls.subject})`,
                }))}
              />

              <FormField
                id="course-title"
                label="Tiêu đề Khóa học"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Chuyên đề Đại số & Giải tích 12"
              />

              <FormField
                id="course-description"
                label="Mô tả khóa học"
                type="textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả nội dung, lộ trình học tập..."
              />

              <FormField
                id="course-status"
                label="Trạng thái phát hành"
                type="select"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                options={[
                  { value: 'PUBLISHED', label: 'Công khai (PUBLISHED) - Học sinh thấy ngay' },
                  { value: 'DRAFT', label: 'Bản nháp (DRAFT) - Ẩn với học sinh' },
                ]}
              />

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)} style={{ flex: 1 }}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ flex: 1 }}>
                  {formLoading ? 'Đang tạo...' : 'Tạo Khóa Học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
