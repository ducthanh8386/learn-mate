import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { ShieldCheck, Check, X, Clock, AlertCircle, RefreshCw } from 'lucide-react';

export const AdminApplications = () => {
  const { supabaseClient, user } = useAppAuth();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState(null);

  const fetchApplications = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchErr } = await supabaseClient
        .from('tutor_applications')
        .select('*')
        .order('submitted_at', { ascending: false });

      if (fetchErr) throw fetchErr;
      setApplications(data || []);
    } catch (err) {
      console.error('Error fetching applications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApplications();
  }, [supabaseClient]);

  const handleReview = async (appId, applicantUserId, status) => {
    try {
      setActionLoading(appId);
      // 1. Update application status
      const { error: appErr } = await supabaseClient
        .from('tutor_applications')
        .update({
          status,
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', appId);

      if (appErr) throw appErr;

      // 2. If approved, update user's profile role to 'tutor'
      if (status === 'approved') {
        const { error: roleErr } = await supabaseClient
          .from('profiles')
          .update({ role: 'tutor' })
          .eq('id', applicantUserId);

        if (roleErr) throw roleErr;
      }

      await fetchApplications();
    } catch (err) {
      console.error(`Failed to set application to ${status}:`, err);
      alert('Thao tác thất bại: ' + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Xét Duyệt Đơn Đăng Ký Gia Sư
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Danh sách người dùng đăng ký nâng cấp tài khoản lên Gia Sư.
          </p>
        </div>
        <button className="btn btn-secondary btn-sm" onClick={fetchApplications} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'spin' : ''} /> Làm mới
        </button>
      </div>

      {error && (
        <div style={{
          backgroundColor: 'var(--danger-50)',
          color: 'var(--danger-600)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-md)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang tải danh sách đơn đăng ký...
        </div>
      ) : applications.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <ShieldCheck size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Hiện không có đơn đăng ký nào</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
            Các đơn xin làm gia sư của học sinh sẽ hiển thị tại đây khi được gửi lên.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {applications.map((app) => (
            <div key={app.id} className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {app.full_name}
                    </h3>
                    <span className={`badge ${
                      app.status === 'approved' ? 'badge-success' : app.status === 'rejected' ? 'badge-danger' : 'badge-warning'
                    }`}>
                      {app.status === 'approved' ? 'Đã duyệt' : app.status === 'rejected' ? 'Đã từ chối' : 'Chờ duyệt'}
                    </span>
                  </div>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                    SĐT: <strong>{app.phone || 'Chưa cung cấp'}</strong> • Gửi lúc: {new Date(app.submitted_at).toLocaleString('vi-VN')}
                  </p>
                </div>

                {app.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleReview(app.id, app.user_id, 'rejected')}
                      disabled={actionLoading === app.id}
                      style={{ color: 'var(--danger-600)' }}
                    >
                      <X size={14} /> Từ chối
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => handleReview(app.id, app.user_id, 'approved')}
                      disabled={actionLoading === app.id}
                    >
                      <Check size={14} /> Duyệt làm Gia Sư
                    </button>
                  </div>
                )}
              </div>

              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-muted)' }}>MÔN GIẢNG DẠY:</span>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '4px' }}>
                    {app.subjects && app.subjects.length > 0 ? (
                      app.subjects.map((sub, i) => (
                        <span key={i} className="badge badge-primary">{sub}</span>
                      ))
                    ) : (
                      <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>Chưa có</span>
                    )}
                  </div>
                </div>

                {app.bio && (
                  <div style={{ marginTop: '12px' }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: '600', color: 'var(--text-muted)' }}>GIỚI THIỆU:</span>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                      {app.bio}
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
