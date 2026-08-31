import React, { useEffect, useState } from 'react';
import { useAppAuth } from '../../context/AuthContext';
import { 
  Users, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  ShieldCheck, 
  GraduationCap, 
  BookOpen, 
  X, 
  AlertCircle, 
  Check, 
  RefreshCw,
  UserCheck,
  UserX
} from 'lucide-react';

export const AdminUsers = () => {
  const { supabaseClient, user } = useAppAuth();

  const [usersList, setUsersList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL'); // 'ALL' | 'admin' | 'tutor' | 'student'

  // Create / Edit User Modal
  const [modalMode, setModalMode] = useState(null); // 'create' | 'edit' | null
  const [selectedUser, setSelectedUser] = useState(null);

  const [idInput, setIdInput] = useState('');
  const [fullNameInput, setFullNameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [roleInput, setRoleInput] = useState('student');
  const [isActiveInput, setIsActiveInput] = useState(true);

  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsersList(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [supabaseClient]);

  const openCreateModal = () => {
    setModalMode('create');
    setSelectedUser(null);
    setIdInput(`user_${Math.random().toString(36).substring(2, 12)}`);
    setFullNameInput('');
    setPhoneInput('');
    setRoleInput('student');
    setIsActiveInput(true);
    setFormError(null);
  };

  const openEditModal = (targetUser) => {
    setModalMode('edit');
    setSelectedUser(targetUser);
    setIdInput(targetUser.id);
    setFullNameInput(targetUser.full_name);
    setPhoneInput(targetUser.phone || '');
    setRoleInput(targetUser.role || 'student');
    setIsActiveInput(targetUser.is_active ?? true);
    setFormError(null);
  };

  const handleSaveUser = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      if (!fullNameInput.trim()) throw new Error('Vui lòng nhập họ và tên.');

      if (modalMode === 'create') {
        const { error: insErr } = await supabaseClient
          .from('profiles')
          .insert({
            id: idInput.trim(),
            full_name: fullNameInput.trim(),
            phone: phoneInput.trim() || null,
            role: roleInput,
            is_active: isActiveInput,
          });

        if (insErr) throw insErr;
      } else {
        const { error: updErr } = await supabaseClient
          .from('profiles')
          .update({
            full_name: fullNameInput.trim(),
            phone: phoneInput.trim() || null,
            role: roleInput,
            is_active: isActiveInput,
          })
          .eq('id', selectedUser.id);

        if (updErr) throw updErr;
      }

      setModalMode(null);
      await fetchUsers();
    } catch (err) {
      console.error('Error saving user:', err);
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (targetUser) => {
    if (targetUser.id === user.id) {
      alert('Bạn không thể xóa chính tài khoản Admin đang đăng nhập!');
      return;
    }

    if (!window.confirm(`Bạn có chắc muốn xóa vĩnh viễn người dùng "${targetUser.full_name}"? Mọi dữ liệu liên quan sẽ bị xóa theo.`)) {
      return;
    }

    try {
      const { error: delErr } = await supabaseClient
        .from('profiles')
        .delete()
        .eq('id', targetUser.id);

      if (delErr) throw delErr;
      await fetchUsers();
    } catch (err) {
      alert('Không thể xóa: ' + err.message);
    }
  };

  const handleQuickRoleChange = async (targetUserId, nextRole) => {
    try {
      const { error } = await supabaseClient
        .from('profiles')
        .update({ role: nextRole })
        .eq('id', targetUserId);

      if (error) throw error;
      await fetchUsers();
    } catch (err) {
      alert('Không thể đổi quyền: ' + err.message);
    }
  };

  const filteredUsers = usersList.filter((u) => {
    const matchesSearch = 
      u.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.id?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.phone?.includes(searchQuery);

    const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;

    return matchesSearch && matchesRole;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            Quản Lý Người Dùng 👥
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.925rem', marginTop: '4px' }}>
            Danh sách toàn bộ tài khoản trong hệ thống: Thêm mới, chỉnh sửa thông tin, phân quyền và xóa tài khoản.
          </p>
        </div>

        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} /> Thêm người dùng mới
        </button>
      </div>

      {/* Filter & Search Bar */}
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
        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
          <Search size={18} color="var(--text-muted)" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên, số điện thoại, ID..."
            style={{
              border: 'none',
              outline: 'none',
              backgroundColor: 'transparent',
              width: '100%',
              fontSize: '0.875rem',
              color: 'var(--text-primary)'
            }}
          />
        </div>

        {/* Role Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className={`btn btn-sm ${roleFilter === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRoleFilter('ALL')}
          >
            Tất cả ({usersList.length})
          </button>
          <button
            className={`btn btn-sm ${roleFilter === 'admin' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRoleFilter('admin')}
          >
            Admin ({usersList.filter((u) => u.role === 'admin').length})
          </button>
          <button
            className={`btn btn-sm ${roleFilter === 'tutor' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRoleFilter('tutor')}
          >
            Gia sư ({usersList.filter((u) => u.role === 'tutor').length})
          </button>
          <button
            className={`btn btn-sm ${roleFilter === 'student' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setRoleFilter('student')}
          >
            Học sinh ({usersList.filter((u) => u.role === 'student').length})
          </button>
        </div>
      </div>

      {/* Users Table */}
      {loading ? (
        <div className="glass-card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
          Đang tải danh sách người dùng...
        </div>
      ) : filteredUsers.length === 0 ? (
        <div className="glass-card" style={{ padding: '48px', textAlign: 'center' }}>
          <Users size={48} color="var(--primary-400)" style={{ margin: '0 auto 12px' }} />
          <h3 style={{ fontSize: '1.125rem', fontWeight: '700' }}>Không tìm thấy người dùng nào</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '4px' }}>
            Hãy thử tìm kiếm với từ khóa khác hoặc bấm Thêm người dùng mới.
          </p>
        </div>
      ) : (
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-subtle)', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                <th style={{ padding: '12px 16px' }}>Họ và tên</th>
                <th style={{ padding: '12px 16px' }}>Vai trò</th>
                <th style={{ padding: '12px 16px' }}>Số điện thoại</th>
                <th style={{ padding: '12px 16px' }}>Trạng thái</th>
                <th style={{ padding: '12px 16px' }}>Ngày tạo</th>
                <th style={{ padding: '12px 16px', textAlign: 'right' }}>Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr
                  key={u.id}
                  style={{
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background-color 0.15s ease',
                    fontSize: '0.875rem'
                  }}
                >
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '32px',
                        height: '32px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--primary-100)',
                        color: 'var(--primary-700)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        fontSize: '0.875rem'
                      }}>
                        {u.full_name?.charAt(0)?.toUpperCase() || 'U'}
                      </div>
                      <div>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)', display: 'block' }}>
                          {u.full_name}
                        </span>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          ID: {u.id}
                        </span>
                      </div>
                    </div>
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <select
                      value={u.role}
                      onChange={(e) => handleQuickRoleChange(u.id, e.target.value)}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.8125rem',
                        fontWeight: '600',
                        border: '1px solid var(--border-subtle)',
                        backgroundColor: u.role === 'admin' ? 'var(--danger-50)' : u.role === 'tutor' ? 'var(--primary-50)' : 'var(--success-50)',
                        color: u.role === 'admin' ? 'var(--danger-700)' : u.role === 'tutor' ? 'var(--primary-700)' : 'var(--success-700)'
                      }}
                    >
                      <option value="student">Học sinh</option>
                      <option value="tutor">Gia sư</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-secondary)' }}>
                    {u.phone || '—'}
                  </td>

                  <td style={{ padding: '14px 16px' }}>
                    <span className={`badge ${u.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {u.is_active ? 'Hoạt động' : 'Tạm khóa'}
                    </span>
                  </td>

                  <td style={{ padding: '14px 16px', color: 'var(--text-muted)', fontSize: '0.8125rem' }}>
                    {new Date(u.created_at).toLocaleDateString('vi-VN')}
                  </td>

                  <td style={{ padding: '14px 16px', textAlign: 'right' }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px' }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => openEditModal(u)}
                        title="Chỉnh sửa thông tin"
                        style={{ padding: '6px' }}
                      >
                        <Edit3 size={14} />
                      </button>

                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDeleteUser(u)}
                        title="Xóa người dùng"
                        style={{ padding: '6px', color: 'var(--danger-600)' }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Thêm / Sửa Người Dùng */}
      {modalMode && (
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
              onClick={() => setModalMode(null)}
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

            <form onSubmit={handleSaveUser} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <h2 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
                  {modalMode === 'create' ? 'Thêm Người Dùng Mới' : 'Chỉnh Sửa Người Dùng'}
                </h2>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Quản lý thông tin hồ sơ và phân quyền tài khoản
                </p>
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

              {modalMode === 'create' && (
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                    User ID (Clerk ID hoặc ID định danh) *
                  </label>
                  <input
                    type="text"
                    required
                    value={idInput}
                    onChange={(e) => setIdInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-page)',
                      color: 'var(--text-primary)',
                      fontFamily: 'monospace'
                    }}
                  />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                  Họ và tên *
                </label>
                <input
                  type="text"
                  required
                  value={fullNameInput}
                  onChange={(e) => setFullNameInput(e.target.value)}
                  placeholder="VD: Nguyễn Văn B"
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
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={phoneInput}
                  onChange={(e) => setPhoneInput(e.target.value)}
                  placeholder="VD: 0987654321"
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                    Vai trò (Role) *
                  </label>
                  <select
                    value={roleInput}
                    onChange={(e) => setRoleInput(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-page)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="student">Học sinh (Student)</option>
                    <option value="tutor">Gia sư (Tutor)</option>
                    <option value="admin">Quản trị viên (Admin)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '600', marginBottom: '6px' }}>
                    Trạng thái tài khoản
                  </label>
                  <select
                    value={isActiveInput ? 'true' : 'false'}
                    onChange={(e) => setIsActiveInput(e.target.value === 'true')}
                    style={{
                      width: '100%',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--border-subtle)',
                      backgroundColor: 'var(--bg-page)',
                      color: 'var(--text-primary)'
                    }}
                  >
                    <option value="true">Đang hoạt động</option>
                    <option value="false">Tạm khóa tài khoản</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setModalMode(null)} style={{ flex: 1 }}>
                  Hủy
                </button>
                <button type="submit" className="btn btn-primary" disabled={formLoading} style={{ flex: 1 }}>
                  {formLoading ? 'Đang lưu...' : 'Lưu người dùng'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
