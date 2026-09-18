import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Save, Wifi } from 'lucide-react';
import { api } from '../utils/api';
import './DeviceForm.css';

const CARD_TYPES = ['Prabayar', 'Pascabayar', 'IoT'];
const OPERATORS = ['Telkomsel', 'Byu', 'Indosat', 'Tri', 'XL', 'Axis'];

export default function DeviceForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);

  const [form, setForm] = useState({
    name: '', phone: '', location: '', card_type: '', operator: '',
    package_amount_mb: '', package_start_date: '', package_duration_days: '', package_cost: '',
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(isEdit);

  useEffect(() => {
    if (isEdit) {
      api.get(`/devices/${id}`)
        .then(device => {
          setForm({
            name: device.name,
            phone: device.phone,
            location: device.location,
            card_type: device.card_type || '',
            operator: device.operator || '',
            package_amount_mb: device.package_amount_mb || '',
            package_start_date: device.package_start_date ? device.package_start_date.slice(0, 10) : '',
            package_duration_days: device.package_duration_days || '',
            package_cost: device.package_cost || '',
          });
        })
        .catch(() => navigate('/'))
        .finally(() => setFetching(false));
    }
  }, [id, isEdit, navigate]);

  function validate() {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Nama perangkat wajib diisi';
    if (!form.phone.trim()) errs.phone = 'Nomor HP wajib diisi';
    if (!form.location.trim()) errs.location = 'Lokasi wajib diisi';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);

    try {
      const data = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
        card_type: form.card_type,
        operator: form.operator,
        package_amount_mb: form.package_amount_mb ? Number(form.package_amount_mb) : 0,
        package_start_date: form.package_start_date || null,
        package_duration_days: form.package_duration_days ? Number(form.package_duration_days) : 0,
        package_cost: form.package_cost ? Number(form.package_cost) : 0,
      };

      if (isEdit) {
        await api.put(`/devices/${id}`, data);
      } else {
        await api.post('/devices', data);
      }
      navigate('/');
    } catch (err) {
      setErrors({ submit: err.message });
    } finally {
      setLoading(false);
    }
  }

  function handleChange(field, value) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  if (fetching) return <div className="animate-fade-in">Memuat data...</div>;

  return (
    <div className="animate-fade-in device-form-page">
      <button className="btn btn-ghost back-btn" onClick={() => navigate('/')}>
        <ArrowLeft size={18} />
        Kembali
      </button>

      <div className="device-form-card card">
        <div className="card-header">
          <h2>{isEdit ? 'Edit Perangkat' : 'Tambah Perangkat Baru'}</h2>
        </div>
        <div className="card-body">
          {errors.submit && (
            <div className="login-error animate-slide-down" style={{ marginBottom: 'var(--space-4)' }}>
              {errors.submit}
            </div>
          )}
          <form onSubmit={handleSubmit} className="device-form">
            <div className="form-section-label">Informasi Perangkat</div>

            <div className="form-group">
              <label className="form-label">Nama Perangkat</label>
              <input
                className={`form-input ${errors.name ? 'error' : ''}`}
                placeholder="contoh: CCTV Gudang A"
                value={form.name}
                onChange={e => handleChange('name', e.target.value)}
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Nomor HP</label>
              <input
                className={`form-input ${errors.phone ? 'error' : ''}`}
                placeholder="0896-xxxx-xxxx"
                value={form.phone}
                onChange={e => handleChange('phone', e.target.value)}
              />
              {errors.phone && <span className="form-error">{errors.phone}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Lokasi</label>
              <input
                className={`form-input ${errors.location ? 'error' : ''}`}
                placeholder="contoh: Gudang Utama, Cibitung"
                value={form.location}
                onChange={e => handleChange('location', e.target.value)}
              />
              {errors.location && <span className="form-error">{errors.location}</span>}
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Tipe Kartu</label>
                <select
                  className="form-select"
                  value={form.card_type}
                  onChange={e => handleChange('card_type', e.target.value)}
                >
                  <option value="">— Pilih Tipe —</option>
                  {CARD_TYPES.map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Operator</label>
                <select
                  className="form-select"
                  value={form.operator}
                  onChange={e => handleChange('operator', e.target.value)}
                >
                  <option value="">— Pilih Operator —</option>
                  {OPERATORS.map(op => (
                    <option key={op} value={op}>{op}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-section-divider" />

            <div className="form-section-label">
              <Wifi size={16} />
              Informasi Paket Data
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Jumlah Paket (MB)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="contoh: 10240"
                  min="0"
                  value={form.package_amount_mb}
                  onChange={e => handleChange('package_amount_mb', e.target.value)}
                />
                <span className="form-hint">1024 MB = 1 GB</span>
              </div>

              <div className="form-group">
                <label className="form-label">Tanggal Pengisian</label>
                <input
                  className="form-input"
                  type="date"
                  value={form.package_start_date}
                  onChange={e => handleChange('package_start_date', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Durasi (hari)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="contoh: 30"
                  min="0"
                  value={form.package_duration_days}
                  onChange={e => handleChange('package_duration_days', e.target.value)}
                />
              </div>
            </div>

            <div className="form-row-3">
              <div className="form-group">
                <label className="form-label">Biaya (Rp)</label>
                <input
                  className="form-input"
                  type="number"
                  placeholder="contoh: 50000"
                  min="0"
                  value={form.package_cost}
                  onChange={e => handleChange('package_cost', e.target.value)}
                />
                <span className="form-hint">Biaya perpanjangan paket</span>
              </div>
            </div>

            <div className="device-form-actions">
              <button type="button" className="btn btn-secondary" onClick={() => navigate('/')}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary" disabled={loading}>
                <Save size={18} />
                {loading ? 'Menyimpan...' : isEdit ? 'Simpan Perubahan' : 'Tambah Perangkat'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
