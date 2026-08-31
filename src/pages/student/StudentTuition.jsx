import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { 
  CreditCard, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Receipt,
  DollarSign
} from 'lucide-react';

export const StudentTuition = () => {
  const { supabaseClient, user } = useAppAuth();

  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchTuition = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('tuition_invoices')
        .select(`
          *,
          classes (name, subject)
        `)
        .eq('student_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setInvoices(data || []);
    } catch (err) {
      console.error('Error fetching student tuition:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchTuition();
    }
  }, [user?.id, supabaseClient]);

  const totalPaid = invoices.reduce((sum, inv) => sum + (Number(inv.amount_paid) || 0), 0);
  const totalPending = invoices.reduce((sum, inv) => sum + Math.max(0, Number(inv.amount_due) - (Number(inv.amount_paid) || 0)), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
          Học Phí Của Tôi 💳
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
          Theo dõi các khoản học phí và lịch sử thanh toán theo từng lớp học.
        </p>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--success-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success-600)' }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>TỔNG ĐÃ THANH TOÁN</span>
            <h3 style={{ fontSize: '1.375rem', fontWeight: '800', color: 'var(--success-600)' }}>
              {totalPaid.toLocaleString('vi-VN')} đ
            </h3>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
            <Receipt size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>CẦN THANH TOÁN</span>
            <h3 style={{ fontSize: '1.375rem', fontWeight: '800', color: totalPending > 0 ? 'var(--primary-600)' : 'var(--text-muted)' }}>
              {totalPending.toLocaleString('vi-VN')} đ
            </h3>
          </div>
        </div>
      </div>

      {/* Invoices List */}
      {loading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang tải thông tin học phí...
        </div>
      ) : invoices.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <CreditCard size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Bạn không có hóa đơn học phí nào</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px' }}>
            Thông báo học phí sẽ hiển thị tại đây khi gia sư phát hành hóa đơn mới.
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '20px' }}>
          {invoices.map((inv) => {
            const isPaid = inv.status === 'paid';
            const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && !isPaid;

            return (
              <div key={inv.id} className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span className="badge badge-primary" style={{ marginBottom: '6px' }}>
                      {inv.classes?.name}
                    </span>
                    <h3 style={{ fontSize: '1.125rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                      Học phí {inv.period}
                    </h3>
                  </div>

                  <span className={`badge ${
                    isPaid ? 'badge-success' : isOverdue ? 'badge-danger' : 'badge-warning'
                  }`}>
                    {isPaid ? 'Đã thanh toán' : isOverdue ? 'Quá hạn' : 'Chưa thanh toán'}
                  </span>
                </div>

                <div style={{
                  padding: '12px 16px',
                  backgroundColor: 'var(--bg-subtle)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Số tiền:</span>
                  <span style={{ fontSize: '1.125rem', fontWeight: '800', color: 'var(--text-primary)' }}>
                    {Number(inv.amount_due).toLocaleString('vi-VN')} đ
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  <Clock size={14} />
                  <span>Hạn đóng: {inv.due_date ? new Date(inv.due_date).toLocaleDateString('vi-VN') : 'Không hạn'}</span>
                </div>

                {inv.note && (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-page)', padding: '8px 10px', borderRadius: 'var(--radius-sm)' }}>
                    <strong>Ghi chú:</strong> {inv.note}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
