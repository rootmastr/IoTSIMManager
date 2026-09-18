import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import './Login.css';

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [isRegister, setIsRegister] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({
    username: '',
    password: '',
    full_name: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await register({
          username: form.username,
          password: form.password,
          full_name: form.full_name,
          role: 'admin',
        });
      } else {
        await login(form.username, form.password);
      }
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  return (
    <div className="login-page">
      <div className="login-card card">
        <div className="card-body">
          <div className="login-header">
            <div className="login-logo">ISM</div>
            <h1>IoT SIM Manager</h1>
            <p>Sistem Manajemen SIM Card Perangkat IoT</p>
          </div>

          <div className="login-tabs">
            <button
              className={`login-tab ${!isRegister ? 'active' : ''}`}
              onClick={() => { setIsRegister(false); setError(''); }}
            >
              <LogIn size={16} />
              Masuk
            </button>
            <button
              className={`login-tab ${isRegister ? 'active' : ''}`}
              onClick={() => { setIsRegister(true); setError(''); }}
            >
              <UserPlus size={16} />
              Daftar Akun Baru
            </button>
          </div>

          {error && (
            <div className="login-error animate-slide-down">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="login-form">
            {isRegister && (
              <div className="form-group">
                <label className="form-label">Nama Lengkap</label>
                <input
                  className="form-input"
                  type="text"
                  placeholder="Administrator"
                  value={form.full_name}
                  onChange={e => handleChange('full_name', e.target.value)}
                />
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Username</label>
              <input
                className="form-input"
                type="text"
                placeholder="Masukkan username"
                value={form.username}
                onChange={e => handleChange('username', e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="login-password-wrapper">
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Masukkan password"
                  value={form.password}
                  onChange={e => handleChange('password', e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn btn-primary login-submit"
              disabled={loading}
            >
              {loading ? 'Memproses...' : isRegister ? 'Daftar Sekarang' : 'Masuk'}
            </button>
          </form>

          {isRegister && (
            <p className="login-note">
              Akun pertama yang dibuat akan menjadi admin.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
