import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { 
  CreditCard, 
  Plus, 
  Search, 
  X, 
  Receipt
} from 'lucide-react';
import { formatCurrency, formatDate } from '../../lib/formatters';
import { ErrorState, FormField } from '../../components/common';

export const TeacherTuition = () => {
  const { supabaseClient } = useAppAuth();

  const [classes, setClasses] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Create Invoice Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [period, setPeriod] = useState(`Tháng ${(new Date().getMonth() + 1).toString().padStart(2, '0')}/${new Date().getFullYear()}`);
  const [amountDue, setAmountDue] = useState(500000);
  const [dueDate, setDueDate] = useState('');
  const [generateMode, setGenerateMode] = useState('all'); // 'all' | 'single'
  const [singleStudentId, setSingleStudentId] = useState('');
  const [classStudents, setClassStudents] = useState([]);
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState(null);

  // Payment Recording Modal
  const [activeInvoiceForPayment, setActiveInvoiceForPayment] = useState(null);
  const [paidAmountInput, setPaidAmountInput] = useState('');
  const [paymentNote, setPaymentNote] = useState('');
  const [payLoading, setPayLoading] = useState(false);

  const fetchClassesAndInvoices = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const { data: classList } = await supabaseClient
        .from('classes')
        .select('id, name, subject')
        .order('created_at', { ascending: false });

      setClasses(classList || []);
      const targetClassId = selectedClassId || classList?.[0]?.id;
      if (targetClassId) {
        if (!selectedClassId) setSelectedClassId(targetClassId);

        // Fetch students of this class
        const { data: members } = await supabaseClient
          .from('class_members')
          .select('student_id, profiles:student_id (id, full_name, phone)')
          .eq('class_id', targetClassId);

        const students = (members || []).map((m) => m.profiles).filter(Boolean);
        setClassStudents(students);
        if (students.length > 0 && !singleStudentId) setSingleStudentId(students[0].id);

        // Fetch invoices
        const { data: invList, error: invErr } = await supabaseClient
          .from('tuition_invoices')
          .select(`
            *,
            profiles:student_id (full_name, phone)
          `)
          .eq('class_id', targetClassId)
          .order('created_at', { ascending: false });

        if (invErr) throw invErr;
        setInvoices(invList || []);
      }
    } catch (err) {
      console.error('Error fetching tuition data:', err);
      setFetchError(err.message || 'Không thể tải dữ liệu học phí.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClassesAndInvoices();
  }, [selectedClassId, supabaseClient]);

  const handleCreateInvoices = async (e) => {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);

    try {
      if (!period.trim() || !amountDue) throw new Error('Vui lòng nhập kì học phí và số tiền.');

      const targetStudents = generateMode === 'all' 
        ? classStudents 
        : classStudents.filter((s) => s.id === singleStudentId);

      if (targetStudents.length === 0) throw new Error('Lớp chưa có học sinh để sinh hóa đơn.');

      const invoiceRows = targetStudents.map((st) => ({
        class_id: selectedClassId,
        student_id: st.id,
        period: period.trim(),
        amount_due: Number(amountDue),
        amount_paid: 0,
        status: 'unpaid',
        due_date: dueDate ? new Date(dueDate).toISOString().split('T')[0] : null,
      }));

      const { error: insErr } = await supabaseClient
        .from('tuition_invoices')
        .insert(invoiceRows);

      if (insErr) throw insErr;

      setIsCreateOpen(false);
      await fetchClassesAndInvoices();
    } catch (err) {
      console.error('Error generating invoices:', err);
      setCreateError(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const openPaymentModal = (invoice) => {
    setActiveInvoiceForPayment(invoice);
    setPaidAmountInput(invoice.amount_due - (invoice.amount_paid || 0));
    setPaymentNote('');
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    setPayLoading(true);

    try {
      const paying = Number(paidAmountInput);
      const totalPaid = (Number(activeInvoiceForPayment.amount_paid) || 0) + paying;
      const isFull = totalPaid >= activeInvoiceForPayment.amount_due;

      const { error } = await supabaseClient
        .from('tuition_invoices')
        .update({
          amount_paid: totalPaid,
          status: isFull ? 'paid' : 'partial',
          paid_at: isFull ? new Date().toISOString() : activeInvoiceForPayment.paid_at,
          note: paymentNote.trim() || activeInvoiceForPayment.note,
        })
        .eq('id', activeInvoiceForPayment.id);

      if (error) throw error;

      setActiveInvoiceForPayment(null);
      await fetchClassesAndInvoices();
    } catch (err) {
      alert('Lỗi ghi nhận đóng tiền: ' + err.message);
    } finally {
      setPayLoading(false);
    }
  };

  // Metrics calculation
  const totalCollected = invoices.reduce((sum, inv) => sum + (Number(inv.amount_paid) || 0), 0);
  const totalPending = invoices.reduce((sum, inv) => sum + Math.max(0, Number(inv.amount_due) - (Number(inv.amount_paid) || 0)), 0);
  const overdueCount = invoices.filter((inv) => inv.status === 'overdue' || (inv.due_date && new Date(inv.due_date) < new Date() && inv.status !== 'paid')).length;

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = 
      inv.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.period?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'ALL' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Quản Lý Học Phí 💰
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Theo dõi hóa đơn học phí, ghi nhận thanh toán và gửi nhắc nhở cho học sinh/phụ huynh.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => setIsCreateOpen(true)}
          disabled={!selectedClassId}
        >
          <Plus size={16} /> + Tạo Hóa Đơn Học Phí
        </button>
      </div>

      {/* Metrics Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--success-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success-600)' }}>
            <TrendingUp size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>ĐÃ THU ĐƯỢC</span>
            <h3 style={{ fontSize: '1.375rem', fontWeight: '800', color: 'var(--success-600)' }}>
              {formatCurrency(totalCollected)}
            </h3>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--primary-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-600)' }}>
            <Receipt size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>CHƯA THU / CÒN NỢ</span>
            <h3 style={{ fontSize: '1.375rem', fontWeight: '800', color: 'var(--primary-600)' }}>
              {formatCurrency(totalPending)}
            </h3>
          </div>
        </div>

        <div className="glass-card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', backgroundColor: 'var(--danger-50)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--danger-600)' }}>
            <AlertCircle size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: '600' }}>HÓA ĐƠN QUÁ HẠN</span>
            <h3 style={{ fontSize: '1.375rem', fontWeight: '800', color: 'var(--danger-600)' }}>
              {overdueCount} hóa đơn
            </h3>
          </div>
        </div>
      </div>

      {/* Class Selector & Search */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        backgroundColor: 'var(--bg-surface)',
        padding: '14px 20px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)'
      }}>
        {classes.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="tuition-class-select" style={{ fontSize: '0.875rem', fontWeight: '600', color: 'var(--text-secondary)' }}>Lớp:</label>
            <select
              id="tuition-class-select"
              value={selectedClassId}
              onChange={(e) => setSelectedClassId(e.target.value)}
              style={{
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-page)',
                color: 'var(--text-primary)',
                fontSize: '0.875rem',
                fontWeight: '600'
              }}
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.subject})
                </option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px', flex: 1, maxWidth: '480px', justifyContent: 'flex-end' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              type="text"
              aria-label="Tìm kiếm học sinh hoặc kỳ học phí"
              placeholder="Tìm theo tên học sinh, kỳ học phí..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                backgroundColor: 'var(--bg-page)',
                fontSize: '0.875rem'
              }}
            />
          </div>

          <select
            aria-label="Lọc theo trạng thái thanh toán"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-page)',
              fontSize: '0.875rem'
            }}
          >
            <option value="ALL">Tất cả trạng thái</option>
            <option value="UNPAID">Chưa thu</option>
            <option value="PAID">Đã thu đủ</option>
            <option value="OVERDUE">Quá hạn</option>
          </select>
        </div>
      </div>

      {/* Invoices Table */}
      {loading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang tải danh sách học phí...
        </div>
      ) : fetchError ? (
        <ErrorState message={fetchError} onRetry={fetchClassesAndInvoices} />
      ) : filteredInvoices.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <CreditCard size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Chưa có hóa đơn học phí nào</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '6px', marginBottom: '20px' }}>
            Sinh hóa đơn học phí cho học sinh trong lớp để theo dõi tình trạng thu chi.
          </p>
          {selectedClassId && (
            <button className="btn btn-primary" onClick={() => setIsCreateOpen(true)}>
              <Plus size={16} /> Tạo hóa đơn đầu tiên
            </button>
          )}
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Học sinh</th>
                <th style={{ padding: '12px 16px' }}>Kì thu</th>
                <th style={{ padding: '12px 16px' }}>Số tiền phải nộp</th>
                <th style={{ padding: '12px 16px' }}>Đã đóng</th>
                <th style={{ padding: '12px 16px' }}>Trạng thái</th>
                <th style={{ padding: '12px 16px' }}>Hạn nộp</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.map((inv) => {
                const isPaid = inv.status === 'paid';
                const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && !isPaid;

                return (
                  <tr
                    key={inv.id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      fontSize: '0.875rem'
                    }}
                  >
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {inv.profiles?.full_name || 'Học sinh'}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                      {inv.period}
                    </td>
                    <td style={{ padding: '14px 16px', fontWeight: '700', color: 'var(--text-primary)' }}>
                      {formatCurrency(inv.amount_due)}
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--success-600)', fontWeight: '600' }}>
                      {formatCurrency(inv.amount_paid || 0)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <span className={`badge ${
                        isPaid ? 'badge-success' : isOverdue ? 'badge-danger' : 'badge-warning'
                      }`}>
                        {isPaid ? 'Đã thu đủ' : isOverdue ? 'Quá hạn' : 'Chưa thu'}
                      </span>
                    </td>
                    <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                      {formatDate(inv.due_date)}
                    </td>
                    <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                      {!isPaid && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => openPaymentModal(inv)}
                          style={{ fontSize: '0.75rem', padding: '4px 10px' }}
                        >
                          Ghi nhận thu
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Tạo Hóa Đơn */}
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

            <form onSubmit={handleCreateInvoices} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '700' }}>Tạo Hóa Đơn Học Phí</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Sinh thông báo học phí cho học sinh trong lớp</p>
              </div>

              {createError && (
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
                  <span>{createError}</span>
                </div>
              )}

              <div>
                <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px', color: 'var(--text-primary)' }}>
                  Áp dụng cho
                </span>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.875rem' }}>
                    <input
                      type="radio"
                      name="gen_mode"
                      value="all"
                      checked={generateMode === 'all'}
                      onChange={() => setGenerateMode('all')}
                      style={{ accentColor: 'var(--primary-500)' }}
                    />
                    <span>Toàn bộ học sinh trong lớp ({classStudents.length} bạn)</span>
                  </label>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <FormField
                  id="tuition-period"
                  label="Kì thu học phí"
                  required
                  value={period}
                  onChange={(e) => setPeriod(e.target.value)}
                  placeholder="VD: Tháng 09/2026"
                />

                <FormField
                  id="tuition-amount"
                  label="Số tiền (VNĐ)"
                  type="number"
                  required
                  step="10000"
                  value={amountDue}
                  onChange={(e) => setAmountDue(e.target.value)}
                />
              </div>

              <FormField
                id="tuition-due-date"
                label="Hạn nộp học phí"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCreateOpen(false)} style={{ flex: 1 }}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={createLoading} style={{ flex: 1 }}>
                  {createLoading ? 'Đang tạo...' : 'Sinh hóa đơn ngay'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Ghi Nhận Thanh Toán */}
      {activeInvoiceForPayment && (
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
            maxWidth: '460px',
            width: '100%',
            backgroundColor: 'var(--bg-surface)',
            padding: '32px',
            position: 'relative'
          }}>
            <button
              onClick={() => setActiveInvoiceForPayment(null)}
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

            <form onSubmit={handleRecordPayment} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>Ghi Nhận Thu Học Phí</h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Học sinh: <strong>{activeInvoiceForPayment.profiles?.full_name}</strong> • {activeInvoiceForPayment.period}
                </p>
              </div>

              <FormField
                id="payment-paid-amount"
                label="Số tiền thu lần này (VNĐ)"
                type="number"
                required
                step="10000"
                value={paidAmountInput}
                onChange={(e) => setPaidAmountInput(e.target.value)}
                inputStyle={{
                  fontSize: '1.125rem',
                  fontWeight: '700',
                  color: 'var(--success-600)',
                }}
              />

              <FormField
                id="payment-note"
                label="Ghi chú (Tiền mặt, chuyển khoản...)"
                placeholder="VD: Chuyển khoản Techcombank 10/09"
                value={paymentNote}
                onChange={(e) => setPaymentNote(e.target.value)}
              />

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setActiveInvoiceForPayment(null)} style={{ flex: 1 }}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={payLoading} style={{ flex: 1 }}>
                  {payLoading ? 'Đang lưu...' : 'Xác nhận thu tiền'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
