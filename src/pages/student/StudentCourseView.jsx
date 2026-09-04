import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAppAuth } from '../../context/AuthContext';
import { YoutubeEmbed } from '../../components/course/YoutubeEmbed';
import { getSignedDownloadUrl } from '../../lib/storage';
import { 
  ArrowLeft, 
  Play, 
  FileText, 
  Download, 
  CheckCircle2, 
  Circle, 
  BookOpen, 
  Layers,
  AlertCircle
} from 'lucide-react';

export const StudentCourseView = () => {
  const { courseId } = useParams();
  const { supabaseClient, user } = useAppAuth();

  const [course, setCourse] = useState(null);
  const [modules, setModules] = useState([]);
  const [activeLesson, setActiveLesson] = useState(null);
  const [videoProgressMap, setVideoProgressMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloading, setDownloading] = useState(null);

  const fetchCourseData = async () => {
    try {
      setLoading(true);
      setError(null);

      // 1. Fetch course details
      const { data: courseData, error: cErr } = await supabaseClient
        .from('courses')
        .select(`
          *,
          classes (id, name, subject, tutor_id)
        `)
        .eq('id', courseId)
        .single();

      if (cErr) throw cErr;
      setCourse(courseData);

      // 2. Fetch modules & published lessons
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

      // Filter only PUBLISHED lessons and sort
      const filteredModules = (moduleData || []).map((m) => ({
        ...m,
        lessons: (m.lessons || [])
          .filter((l) => l.status === 'PUBLISHED')
          .sort((a, b) => a.order_index - b.order_index),
      }));

      setModules(filteredModules);

      // Set default active lesson
      if (!activeLesson && filteredModules.length > 0) {
        const firstLesson = filteredModules.find((m) => m.lessons.length > 0)?.lessons[0];
        if (firstLesson) setActiveLesson(firstLesson);
      }

      // 3. Fetch student's video progress
      const { data: progData } = await supabaseClient
        .from('video_progress')
        .select('content_id, watched_seconds, total_seconds, is_completed, last_watched_at')
        .eq('student_id', user.id);

      if (progData) {
        const pMap = {};
        progData.forEach((p) => {
          pMap[p.content_id] = p;
        });
        setVideoProgressMap(pMap);
      }
    } catch (err) {
      console.error('Error fetching course for student:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCourseData();
  }, [courseId, supabaseClient]);

  const handleDownloadDoc = async (content) => {
    try {
      setDownloading(content.id);
      const storagePath = content.content_data?.storage_path;
      if (!storagePath) throw new Error('Không tìm thấy đường dẫn tài liệu.');

      const signedUrl = await getSignedDownloadUrl(supabaseClient, 'materials', storagePath);
      window.open(signedUrl, '_blank');
    } catch (err) {
      alert('Không thể tải tài liệu: ' + err.message);
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Đang mở phòng học...
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
        <h3>Không thể tải bài học</h3>
        <p style={{ fontSize: '0.875rem', marginTop: '4px' }}>{error || 'Khóa học chưa được công khai hoặc bạn chưa là thành viên lớp.'}</p>
        <Link to="/student/classes" className="btn btn-secondary btn-sm" style={{ marginTop: '16px' }}>
          Quay lại danh sách lớp học
        </Link>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <Link to="/student/classes" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          <ArrowLeft size={16} /> Quay lại danh sách lớp
        </Link>
        <span className="badge badge-primary">{course.classes?.name}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 340px', gap: '24px', alignItems: 'start' }}>
        {/* Main Content Area: Lesson Viewer */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {activeLesson ? (
            <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <span className="badge badge-success" style={{ marginBottom: '8px' }}>Bài học đang xem</span>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {activeLesson.title}
                </h2>
                {activeLesson.description && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '6px' }}>
                    {activeLesson.description}
                  </p>
                )}
              </div>

              {/* Lesson Contents (Videos & Documents) */}
              {activeLesson.lesson_contents && activeLesson.lesson_contents.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  {activeLesson.lesson_contents.map((content) => {
                    if (content.type === 'video') {
                      const prog = videoProgressMap[content.id];
                      return (
                        <div key={content.id} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                            🎬 {content.title}
                          </h3>
                          <YoutubeEmbed
                            contentId={content.id}
                            youtubeUrl={content.content_data?.youtube_url}
                            initialProgress={prog?.percentage || 0}
                          />
                        </div>
                      );
                    }

                    if (content.type === 'document') {
                      return (
                        <div
                          key={content.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 18px',
                            backgroundColor: 'var(--bg-subtle)',
                            borderRadius: 'var(--radius-md)',
                            border: '1px solid var(--border-subtle)'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '8px',
                              backgroundColor: 'var(--primary-50)',
                              color: 'var(--primary-600)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <FileText size={20} />
                            </div>
                            <div>
                              <h4 style={{ fontSize: '0.925rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                                {content.title}
                              </h4>
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {content.content_data?.file_name || 'Tài liệu đính kèm'}
                              </span>
                            </div>
                          </div>

                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleDownloadDoc(content)}
                            disabled={downloading === content.id}
                          >
                            <Download size={14} />
                            {downloading === content.id ? 'Đang mở...' : 'Tải / Đọc tài liệu'}
                          </button>
                        </div>
                      );
                    }

                    return null;
                  })}
                </div>
              ) : (
                <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Bài học này chưa có nội dung video hoặc tài liệu.
                </div>
              )}
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Chọn một bài học từ danh sách bên phải để bắt đầu học.
            </div>
          )}
        </div>

        {/* Sidebar: Modules & Lessons Playlist */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={18} color="var(--primary-500)" />
            <h3 style={{ fontSize: '1rem', fontWeight: '700' }}>Mục lục khóa học</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '75vh', overflowY: 'auto' }}>
            {modules.map((mod, modIdx) => (
              <div key={mod.id} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Chương {modIdx + 1}: {mod.title}
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {mod.lessons.map((les, lesIdx) => {
                    const isActive = activeLesson?.id === les.id;
                    const videoContent = les.lesson_contents?.find((c) => c.type === 'video');
                    const isDone = videoContent ? videoProgressMap[videoContent.id]?.completed : false;

                    return (
                      <button
                        key={les.id}
                        onClick={() => setActiveLesson(les)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 12px',
                          borderRadius: 'var(--radius-md)',
                          border: '1px solid',
                          borderColor: isActive ? 'var(--primary-500)' : 'transparent',
                          backgroundColor: isActive ? 'var(--primary-50)' : 'var(--bg-page)',
                          color: isActive ? 'var(--primary-700)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Play size={14} color={isActive ? 'var(--primary-600)' : 'var(--text-muted)'} />
                          <span style={{ fontSize: '0.875rem', fontWeight: isActive ? '700' : '500' }}>
                            {lesIdx + 1}. {les.title}
                          </span>
                        </div>

                        {isDone ? (
                          <CheckCircle2 size={16} color="var(--success-500)" />
                        ) : (
                          <Circle size={14} color="var(--border-strong)" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
