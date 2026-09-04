import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { 
  Users, 
  Plus, 
  Copy, 
  Check, 
  RefreshCw, 
  BookOpen, 
  Calendar, 
  MoreVertical,
  X,
  AlertCircle
} from 'lucide-react';
import { ErrorState, FormField } from '../../components/common';

export const TeacherClasses = () => {
  const { supabaseClient, user } = useAppAuth();
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(null);

  // Form states
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [maxStudents, setMaxStudents] = useState(30);
  const [scheduleText, setScheduleText] = useState('');
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchClasses = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const { data, error } = await supabaseClient
        .from('classes')
        .select(`
          *,
          class_members (count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setClasses(data || []);
    } catch (err) {
      console.error('Error fetching classes:', err);
      setFetchError(err.message || 'Không thể tải danh sách lớp học.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClasses();
  }, [supabaseClient]);

  const generateClassCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const array = new Uint8Array(6);
    crypto.getRandomValues(array);
    let code = '';
    for (let i = 0; i < 6; i++) {
      code += chars[array[i] % chars.length];
    }
    return `CLASS-${code}`;
  };

  const handleCreateClass = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const code = generateClassCode();
      const { error } = await supabaseClient
        .from('classes')
        .insert({
          tutor_id: user.id,
          name,
          subject,
          description,
          class_code: code,
          max_students: Number(maxStudents),
          schedule_text: scheduleText,
          status: 'active'
        });

      if (error) throw error;

      setIsCreateOpen(false);
      setName('');
      setSubject('');
      setDescription('');
      setScheduleText('');
      await fetchClasses();
    } catch (err) {
      console.error('Error creating class:', err);
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleRegenerateCode = async (classId) => {
    if (!window.confirm('Bạn có chắc muốn cấp lại mã mới? Mã lớp cũ sẽ không thể dùng để tham gia nữa.')) return;
    try {
      const newCode = generateClassCode();
      const { error } = await supabaseClient
        .from('classes')
        .update({ class_code: newCode })
        .eq('id', classId);

      if (error) throw error;
      await fetchClasses();
    } catch (err) {
      alert('Không thể đổi mã: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Quản Lý Lớp Học
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Tạo lớp, cung cấp mã lớp cho học sinh và quản lý thành viên từng lớp.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
          <Plus size={16} /> Tạo lớp học mới
        </button>
      </div>

      {loading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang tải danh sách lớp học...
        </div>
      ) : fetchError ? (
        <ErrorState message={fetchError} onRetry={fetchClasses} />
      ) : classes.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <Users size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Bạn chưa có lớp học nào</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px', marginBottom: '20px' }}>
            Hãy bắt đầu bằng việc tạo lớp học đầu tiên để chia sẻ mã lớp cho học sinh.
          </p>
          <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
            <Plus size={16} /> Tạo lớp ngay
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '20px'
        }}>
          {classes.map((c) => {
            const memberCount = c.class_members?.[0]?.count || 0;
            return (
              <div key={c.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge badge-primary" style={{ marginBottom: '8px' }}>
                      {c.subject}
                    </span>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {c.name}
                    </h3>
                  </div>
                  <span className={`badge ${c.status === 'active' ? 'badge-success' : 'badge-warning'}`}>
                    {c.status === 'active' ? 'Đang hoạt động' : 'Đã lưu trữ'}
                  </span>
                </div>

                {c.description && (
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineClamp: 2 }}>
                    {c.description}
                  </p>
                )}

                {/* Class Code Box */}
                <div style={{
                  backgroundColor: 'var(--bg-subtle)',
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', display: 'block', fontWeight: '600' }}>
                      MÃ THAM GIA LỚP:
                    </span>
                    <span style={{ fontSize: '1rem', fontWeight: '700', letterSpacing: '0.05em', color: 'var(--primary-600)' }}>
                      {c.class_code}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleCopyCode(c.class_code)}
                      title="Sao chép mã lớp"
                      style={{ padding: '6px 10px' }}
                    >
                      {copiedCode === c.class_code ? <Check size={14} color="var(--success-500)" /> : <Copy size={14} />}
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRegenerateCode(c.id)}
                      title="Đổi mã mới"
                      style={{ padding: '6px 10px' }}
                    >
                      <RefreshCw size={14} />
                    </button>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Users size={14} />
                    <span>{memberCount} / {c.max_students} học sinh</span>
                  </div>
                  {c.schedule_text && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={14} />
                      <span>{c.schedule_text}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal Tạo Lớp Học */}
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

            <form onSubmit={handleCreateClass} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Tạo Lớp Học Mới</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Mã tham gia sẽ được tự động tạo ngẫu nhiên</p>
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
                id="create-class-name"
                label="Tên lớp học"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="VD: Lớp Toán 12 - Luyện Đề VIP"
              />

              <FormField
                id="create-class-subject"
                label="Môn học"
                required
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="VD: Toán học / Hóa học / Tiếng Anh"
              />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <FormField
                  id="create-class-max-students"
                  label="Sĩ số tối đa"
                  type="number"
                  min="1"
                  max="500"
                  value={maxStudents}
                  onChange={(e) => setMaxStudents(e.target.value)}
                />

                <FormField
                  id="create-class-schedule"
                  label="Lịch học dự kiến"
                  value={scheduleText}
                  onChange={(e) => setScheduleText(e.target.value)}
                  placeholder="VD: T3 - T5 (19h30)"
                />
              </div>

              <FormField
                id="create-class-description"
                label="Mô tả lớp học"
                type="textarea"
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả mục tiêu, đối tượng học sinh của lớp..."
              />

              <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)} style={{ flex: 1 }}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ flex: 1 }}>
                  {formLoading ? 'Đang tạo...' : 'Tạo lớp học'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
