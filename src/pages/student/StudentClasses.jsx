import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { 
  GraduationCap, 
  Plus, 
  Users, 
  Calendar, 
  BookOpen, 
  ArrowRight,
  X,
  AlertCircle,
  CheckCircle2,
  Layers,
  Play
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const StudentClasses = () => {
  const { supabaseClient, user } = useAppAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isJoinOpen, setIsJoinOpen] = useState(false);
  const [classCode, setClassCode] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [joinError, setJoinError] = useState(null);
  const [joinSuccess, setJoinSuccess] = useState(false);

  const fetchEnrolledClasses = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('class_members')
        .select(`
          joined_at,
          classes (
            id,
            name,
            subject,
            description,
            schedule_text,
            tutor_id,
            profiles:tutor_id (full_name),
            courses (
              id,
              title,
              status,
              modules (id, lessons (id, status))
            )
          )
        `)
        .order('joined_at', { ascending: false });

      if (error) throw error;
      setClasses(data?.map((m) => m.classes).filter(Boolean) || []);
    } catch (err) {
      console.error('Error fetching student classes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEnrolledClasses();
  }, [supabaseClient]);

  const handleJoinClass = async (e) => {
    e.preventDefault();
    setJoinLoading(true);
    setJoinError(null);
    setJoinSuccess(false);

    try {
      const formattedCode = classCode.trim().toUpperCase();
      const { data, error } = await supabaseClient.rpc('join_class_by_code', {
        p_code: formattedCode
      });

      if (error) throw error;

      setJoinSuccess(true);
      setTimeout(async () => {
        setIsJoinOpen(false);
        setClassCode('');
        setJoinSuccess(false);
        await fetchEnrolledClasses();
      }, 1200);
    } catch (err) {
      console.error('Failed to join class:', err);
      setJoinError(err.message || 'Mã lớp không hợp lệ hoặc bạn đã tham gia lớp này.');
    } finally {
      setJoinLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Lớp Học Của Tôi 🎓
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Danh sách các lớp học và khóa bài giảng bạn đang tham gia.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsJoinOpen(true)}>
          <Plus size={16} /> Nhập mã vào lớp
        </button>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang tải danh sách lớp học...
        </div>
      ) : classes.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <GraduationCap size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Bạn chưa tham gia lớp học nào</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px', marginBottom: '20px' }}>
            Hãy xin mã tham gia (Class Code) từ thầy/cô để vào lớp học bài nhé.
          </p>
          <button className="btn btn-primary" onClick={() => setIsJoinOpen(true)}>
            <Plus size={16} /> Nhập mã vào lớp ngay
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {classes.map((cls) => {
            const publishedCourses = (cls.courses || []).filter((c) => c.status === 'PUBLISHED');

            return (
              <div key={cls.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <span className="badge badge-primary" style={{ marginBottom: '6px' }}>
                      {cls.subject}
                    </span>
                    <h2 style={{ fontSize: '1.375rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                      {cls.name}
                    </h2>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Gia sư: <strong>{cls.profiles?.full_name || 'Thầy/Cô'}</strong>
                    </p>
                  </div>

                  {cls.schedule_text && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-subtle)', padding: '8px 14px', borderRadius: 'var(--radius-md)' }}>
                      <Calendar size={16} color="var(--primary-500)" />
                      <span>{cls.schedule_text}</span>
                    </div>
                  )}
                </div>

                {cls.description && (
                  <p style={{ fontSize: '0.925rem', color: 'var(--text-secondary)' }}>
                    {cls.description}
                  </p>
                )}

                {/* Published Courses Section */}
                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '12px' }}>
                    KHÓA HỌC & BÀI GIẢNG TRONG LỚP ({publishedCourses.length})
                  </span>

                  {publishedCourses.length === 0 ? (
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Thầy/cô chưa xuất bản khóa học nào cho lớp này.
                    </p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                      {publishedCourses.map((course) => {
                        const moduleCount = course.modules?.length || 0;
                        const lessonCount = course.modules?.reduce(
                          (acc, m) => acc + (m.lessons?.filter((l) => l.status === 'PUBLISHED').length || 0),
                          0
                        ) || 0;

                        return (
                          <div
                            key={course.id}
                            style={{
                              padding: '16px',
                              backgroundColor: 'var(--bg-page)',
                              borderRadius: 'var(--radius-md)',
                              border: '1px solid var(--border-subtle)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '12px'
                            }}
                          >
                            <div>
                              <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {course.title}
                              </h3>
                              <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                                <span>{moduleCount} Chương</span>
                                <span>•</span>
                                <span>{lessonCount} Bài giảng</span>
                              </div>
                            </div>

                            <Link
                              to={`/student/courses/${course.id}`}
                              className="btn btn-primary btn-sm"
                              style={{ width: '100%', justifyContent: 'space-between', marginTop: 'auto' }}
                            >
                              <span>Vào học ngay</span>
                              <Play size={14} />
                            </Link>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Nhập Mã Vào Lớp */}
      {isJoinOpen && (
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
            maxWidth: '440px',
            width: '100%',
            backgroundColor: 'var(--bg-surface)',
            padding: '32px',
            position: 'relative'
          }}>
            <button
              onClick={() => setIsJoinOpen(false)}
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

            {joinSuccess ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircle2 size={48} color="var(--success-500)" style={{ margin: '0 auto 12px' }} />
                <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Gia nhập lớp thành công!</h3>
                <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                  Đang tải danh sách bài học của lớp...
                </p>
              </div>
            ) : (
              <form onSubmit={handleJoinClass} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Tham Gia Lớp Học</h2>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                    Nhập mã lớp (Class Code) do gia sư cung cấp
                  </p>
                </div>

                {joinError && (
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
                    <span>{joinError}</span>
                  </div>
                )}

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                    Mã lớp (Class Code) *
                  </label>
                  <input
                    type="text"
                    required
                    value={classCode}
                    onChange={(e) => setClassCode(e.target.value.toUpperCase())}
                    placeholder="VD: CLASS-ABC123"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-page)',
                      color: 'var(--text-primary)',
                      fontSize: '1rem',
                      fontWeight: '700',
                      letterSpacing: '0.05em',
                      textTransform: 'uppercase'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                  <button type="button" className="btn btn-secondary" onClick={() => setIsJoinOpen(false)} style={{ flex: 1 }}>
                    Hủy
                  </button>
                  <button type="submit" className="btn btn-primary" disabled={joinLoading || !classCode.trim()} style={{ flex: 1 }}>
                    {joinLoading ? 'Đang kiểm tra...' : 'Vào lớp ngay'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
