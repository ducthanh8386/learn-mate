import React, { useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { X, GraduationCap, CheckCircle2, AlertCircle } from 'lucide-react';

export const TutorApplicationModal = ({ isOpen, onClose, onSuccess }) => {
  const { profile, supabaseClient } = useAppAuth();
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [phone, setPhone] = useState(profile?.phone || '');
  const [subjects, setSubjects] = useState('');
  const [bio, setBio] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [submitted, setSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const subjectList = subjects
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);

      const { error: insertError } = await supabaseClient
        .from('tutor_applications')
        .insert({
          user_id: profile.id,
          full_name: fullName,
          phone,
          subjects: subjectList,
          bio,
          status: 'pending'
        });

      if (insertError) throw insertError;

      setSubmitted(true);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error('Error applying for tutor:', err);
      setError(err.message || 'Không thể gửi đơn ứng tuyển. Vui lòng thử lại.');
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
        maxWidth: '520px',
        width: '100%',
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

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <CheckCircle2 size={56} color="var(--success-500)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '1.25rem', fontWeight: '700', marginBottom: '8px' }}>Đã gửi đơn ứng tuyển!</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: '24px' }}>
              Ban quản trị hệ thống sẽ xét duyệt hồ sơ gia sư của bạn trong thời gian sớm nhất.
            </p>
            <button className="btn btn-primary" onClick={onClose} style={{ width: '100%' }}>
              Đã hiểu
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'var(--primary-50)',
                color: 'var(--primary-600)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <GraduationCap size={22} />
              </div>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Đăng ký làm Gia Sư</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Mở lớp dạy và chia sẻ kiến thức tới học sinh</p>
              </div>
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

            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                Họ và tên *
              </label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="VD: Nguyễn Văn A"
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
                Số điện thoại liên hệ *
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="VD: 0912345678"
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
                Môn học giảng dạy (phân cách bằng dấu phẩy) *
              </label>
              <input
                type="text"
                required
                value={subjects}
                onChange={(e) => setSubjects(e.target.value)}
                placeholder="VD: Toán 12, Luyện thi ĐGNL, Hóa 11"
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
                Giới thiệu bản thân & kinh nghiệm dạy học
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="VD: Tốt nghiệp ĐH Sư Phạm, 5 năm kinh nghiệm luyện thi đại học..."
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

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button type="button" className="btn btn-secondary" onClick={onClose} style={{ flex: 1 }}>
                Hủy
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading} style={{ flex: 1 }}>
                {loading ? 'Đang gửi...' : 'Gửi đơn ứng tuyển'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
