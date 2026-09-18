import { useState, useEffect } from 'react';
import { Users, Shield, Eye, Edit3, Trash2, Plus, Save, X } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/shared/Modal';
import './UserManagement.css';

const ROLES = [
  { value: 'admin', label: 'Admin', desc: 'Akses penuh ke semua fitur' },
  { value: 'operator', label: 'Operator', desc: 'Bisa mengelola data perangkat' },
  { value: 'viewer', label: 'Viewer', desc: 'Hanya melihat data' },
];

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editUser, setEditUser] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', full_name: '', role: 'operator' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function fetchUsers() {
    try {
      const data = await api.get('/auth/users');
      setUsers(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchUsers(); }, []);

  function startCreate() {
    setForm({ username: '', password: '', full_name: '', role: 'operator' });
    setEditUser(null);
    setShowForm(true);
    setError('');
  }

  function startEdit(u) {
    setForm({ username: u.username, password: '', full_name: u.full_name || '', role: u.role });
    setEditUser(u);
    setShowForm(true);
    setError('');
  }

  async function handleSave() {
    setError('');
    try {
      if (editUser) {
        const body = { full_name: form.full_name, role: form.role };
        if (form.password) body.password = form.password;
        await api.put(`/auth/users/${editUser.id}`, body);
        setSuccess('User berhasil diperbarui');
      } else {
        await api.post('/auth/register', form);
        setSuccess('User berhasil dibuat');
      }
      setShowForm(false);
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/auth/users/${deleteTarget.id}`);
      setDeleteTarget(null);
      setSuccess('User berhasil dihapus');
      fetchUsers();
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message);
    }
  }

  function formatDate(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  if (loading) return <div className="animate-fade-in">Memuat...</div>;

  return (
    <div className="animate-fade-in">
      <div className="user-mgmt-header">
        <h2 className="user-mgmt-title">
          <Users size={24} />
          Manajemen User
        </h2>
        <button className="btn btn-primary" onClick={startCreate}>
          <Plus size={18} />
          Tambah User
        </button>
      </div>

      {success && (
        <div className="user-mgmt-toast animate-slide-down">{success}</div>
      )}
      {error && (
        <div className="user-mgmt-error animate-slide-down">{error}</div>
      )}

      <div className="user-mgmt-list">
        {users.map(u => (
          <div key={u.id} className="user-mgmt-card card">
            <div className="card-body">
              <div className="user-mgmt-row">
                <div className="user-mgmt-avatar">
                  <Shield size={20} />
                </div>
                <div className="user-mgmt-info">
                  <div className="user-mgmt-name">
                    {u.full_name || u.username}
                    {u.id === currentUser?.id && (
                      <span className="user-mgmt-you">Anda</span>
                    )}
                  </div>
                  <div className="user-mgmt-meta">
                    @{u.username}
                    <span className={`user-mgmt-role-badge ${u.role}`}>{u.role}</span>
                    {!u.is_active && <span className="user-mgmt-inactive">Nonaktif</span>}
                  </div>
                  <div className="user-mgmt-dates">
                    Dibuat: {formatDate(u.created_at)}
                    {u.last_login && <span> | Login terakhir: {formatDate(u.last_login)}</span>}
                  </div>
                </div>
                <div className="user-mgmt-actions">
                  <button className="data-table-action-btn" onClick={() => startEdit(u)} title="Edit">
                    <Edit3 size={16} />
                  </button>
                  {u.id !== currentUser?.id && (
                    <button className="data-table-action-btn danger" onClick={() => setDeleteTarget(u)} title="Hapus">
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <Modal
          isOpen={showForm}
          onClose={() => setShowForm(false)}
          title={editUser ? 'Edit User' : 'Tambah User Baru'}
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>
                <X size={16} /> Batal
              </button>
              <button className="btn btn-primary" onClick={handleSave}>
                <Save size={16} /> Simpan
              </button>
            </>
          }
        >
          <div className="user-mgmt-form">
            {!editUser && (
              <div className="form-group">
                <label className="form-label">Username</label>
                <input
                  className="form-input"
                  value={form.username}
                  onChange={e => setForm(p => ({ ...p, username: e.target.value }))}
                  placeholder="minimal 3 karakter"
                />
              </div>
            )}
            <div className="form-group">
              <label className="form-label">Nama Lengkap</label>
              <input
                className="form-input"
                value={form.full_name}
                onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                placeholder="Nama lengkap"
              />
            </div>
            <div className="form-group">
              <label className="form-label">
                Password {editUser && '(kosongkan jika tidak diubah)'}
              </label>
              <input
                className="form-input"
                type="password"
                value={form.password}
                onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder={editUser ? '••••••' : 'minimal 6 karakter'}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Role</label>
              <div className="user-mgmt-roles">
                {ROLES.map(r => (
                  <label key={r.value} className={`user-mgmt-role-option ${form.role === r.value ? 'active' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      value={r.value}
                      checked={form.role === r.value}
                      onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
                    />
                    <div>
                      <div className="role-label">{r.label}</div>
                      <div className="role-desc">{r.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus User"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Batal</button>
            <button className="btn btn-danger" onClick={handleDelete}>Hapus</button>
          </>
        }
      >
        <p style={{ color: 'var(--gray-600)' }}>
          Yakin ingin menghapus user <strong>{deleteTarget?.username}</strong>? Tindakan ini tidak dapat dibatalkan.
        </p>
      </Modal>
    </div>
  );
}
