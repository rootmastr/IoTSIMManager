import { useState, useEffect } from 'react';
import {
  Wifi, Calendar, Clock, Save, ChevronDown, ChevronUp,
  AlertTriangle, CheckCircle, Info, Zap, Inbox, Edit3,
  Upload, Download,
} from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import './PaketData.css';

function formatMB(mb) {
  if (!mb) return '0 MB';
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${mb} MB`;
}

function formatRupiah(amount) {
  if (!amount && amount !== 0) return 'Rp 0';
  return `Rp ${Number(amount).toLocaleString('id-ID')}`;
}

function formatDate(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

const STATUS_CONFIG = {
  safe: { color: 'green', label: 'Aman', icon: CheckCircle },
  warning: { color: 'amber', label: 'Peringatan', icon: AlertTriangle },
  critical: { color: 'red', label: 'Kritis', icon: AlertTriangle },
  expired: { color: 'red', label: 'Habis', icon: Zap },
  none: { color: 'gray', label: 'Belum Diisi', icon: Info },
};

function getRecommendation(status, days, mb) {
  if (status === 'none') return { type: 'info', text: 'Belum ada data paket. Silakan isi informasi paket data.' };
  if (status === 'expired') return { type: 'danger', text: `Paket telah habis ${Math.abs(days)} hari yang lalu. Segera lakukan pengisian ulang.` };
  if (status === 'critical') return { type: 'danger', text: `Paket tinggal ${days} hari. Segera siapkan pengisian ulang untuk menghindari putus layanan.` };
  if (status === 'warning') return { type: 'warning', text: `Paket tinggal ${days} hari. Mulai persiapkan pengisian ulang.` };
  if (mb >= 10000) return { type: 'info', text: `Paket masih aman (${days} hari). Kuota ${formatMB(mb)} tergolong besar, pastikan terpakai dengan optimal.` };
  return { type: 'success', text: `Paket masih aman dengan sisa ${days} hari. Tidak perlu tindakan saat ini.` };
}

export default function PaketData() {
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [savedId, setSavedId] = useState(null);
  const [importing, setImporting] = useState(false);

  async function refresh() {
    try {
      const data = await api.get('/devices');
      setDevices(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  function startEdit(device) {
    setEditingId(device.id);
    setEditForm({
      package_amount_mb: device.package_amount_mb || '',
      package_start_date: device.package_start_date ? device.package_start_date.slice(0, 10) : '',
      package_duration_days: device.package_duration_days || '',
      package_cost: device.package_cost || '',
    });
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
  }

  async function handleSave(deviceId) {
    try {
      await api.put(`/devices/${deviceId}/package`, {
        package_amount_mb: editForm.package_amount_mb ? Number(editForm.package_amount_mb) : 0,
        package_start_date: editForm.package_start_date || null,
        package_duration_days: editForm.package_duration_days ? Number(editForm.package_duration_days) : 0,
        package_cost: editForm.package_cost ? Number(editForm.package_cost) : 0,
      });
      setEditingId(null);
      setEditForm({});
      setSavedId(deviceId);
      refresh();
      setTimeout(() => setSavedId(null), 2000);
    } catch (err) {
      console.error(err);
    }
  }

  function toggleExpand(id) {
    setExpandedId(prev => prev === id ? null : id);
  }

  async function handleImportCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.upload('/devices/import', formData);
      alert(`Import selesai: ${result.imported} berhasil dari ${result.total} data${result.errors.length > 0 ? ` (${result.errors.length} error)` : ''}`);
      refresh();
    } catch (err) {
      alert('Gagal import: ' + err.message);
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  }

  async function handleExportCSV() {
    try {
      await api.download('/devices/export/csv', 'devices_export.csv');
    } catch (err) {
      alert('Gagal export: ' + err.message);
    }
  }

  const sorted = [...devices].sort((a, b) => {
    const order = { expired: 0, critical: 1, warning: 2, none: 3, safe: 4 };
    const sa = order[a.package_status] ?? 5;
    const sb = order[b.package_status] ?? 5;
    return sa - sb;
  });

  if (loading) return <div className="animate-fade-in">Memuat data...</div>;

  return (
    <div className="animate-fade-in">
      <div className="paket-data-header">
        <h2 className="paket-data-title">Isi Paket Data</h2>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <span className="paket-data-count">{devices.length} perangkat</span>
          {user?.role !== 'viewer' && (
            <>
              <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer' }}>
                <Upload size={14} />
                {importing ? 'Import...' : 'Import CSV'}
                <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} disabled={importing} />
              </label>
              <button className="btn btn-sm btn-secondary" onClick={handleExportCSV}>
                <Download size={14} />
                Export CSV
              </button>
            </>
          )}
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="paket-data-empty card">
          <div className="card-body">
            <div className="empty-state-inline">
              <Inbox size={32} />
              <p>Belum ada perangkat. Tambahkan perangkat terlebih dahulu.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="paket-device-list">
          {sorted.map((device) => {
            const status = device.package_status || 'none';
            const days = device.days_remaining;
            const rec = getRecommendation(status, days, device.package_amount_mb);
            const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.none;
            const StatusIcon = cfg.icon;
            const isEditing = editingId === device.id;
            const isExpanded = expandedId === device.id;
            const justSaved = savedId === device.id;

            return (
              <div key={device.id} className={`paket-device-card card ${justSaved ? 'saved' : ''}`}>
                <div className="card-body">
                  <div className="paket-device-top">
                    <div className="paket-device-info">
                      <div className="paket-device-name">{device.name}</div>
                      <div className="paket-device-phone">{device.phone}</div>
                      <div className="paket-device-tags">
                        {device.operator && <span className="paket-tag operator">{device.operator}</span>}
                        {device.card_type && <span className="paket-tag cardtype">{device.card_type}</span>}
                      </div>
                    </div>

                    <div className="paket-device-status-area">
                      <div className={`paket-device-badge ${cfg.color}`}>
                        <StatusIcon size={14} />
                        <span>{cfg.label}</span>
                      </div>
                      {days !== null && (
                        <div className={`paket-device-days ${cfg.color}`}>
                          {days < 0 ? `Habis ${Math.abs(days)} hari lalu` : `${days} hari lagi`}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="paket-device-summary">
                    <div className="paket-device-stat">
                      <Wifi size={14} />
                      <span>{formatMB(device.package_amount_mb)}</span>
                    </div>
                    <div className="paket-device-stat">
                      <Calendar size={14} />
                      <span>{device.package_start_date ? formatDate(device.package_start_date) : 'Belum diisi'}</span>
                    </div>
                    <div className="paket-device-stat">
                      <Clock size={14} />
                      <span>{device.package_duration_days ? `${device.package_duration_days} hari` : '—'}</span>
                    </div>
                    {device.card_type === 'IoT' && (
                      <div className="paket-device-stat iot-monthly">
                        <Zap size={14} />
                        <span>Tagihan Bulanan</span>
                      </div>
                    )}
                    {device.package_cost > 0 && (
                      <div className="paket-device-stat cost">
                        <span>{formatRupiah(device.package_cost)}</span>
                      </div>
                    )}
                  </div>

                  <div className={`paket-device-recommendation ${rec.type}`}>
                    {rec.type === 'danger' && <AlertTriangle size={14} />}
                    {rec.type === 'warning' && <AlertTriangle size={14} />}
                    {rec.type === 'success' && <CheckCircle size={14} />}
                    {rec.type === 'info' && <Info size={14} />}
                    <span>{rec.text}</span>
                  </div>

                  <div className="paket-device-actions">
                    {!isEditing && user?.role !== 'viewer' ? (
                      <button className="btn btn-sm btn-secondary" onClick={() => startEdit(device)}>
                        <Edit3 size={14} />
                        Edit Paket
                      </button>
                    ) : isEditing ? (
                      <div className="paket-device-actions-row">
                        <button className="btn btn-sm btn-ghost" onClick={cancelEdit}>Batal</button>
                        <button className="btn btn-sm btn-primary" onClick={() => handleSave(device.id)}>
                          <Save size={14} />
                          Simpan
                        </button>
                      </div>
                    ) : null}
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => toggleExpand(device.id)}
                    >
                      Detail
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>

                  {isEditing && (
                    <div className="paket-device-edit-form animate-slide-down">
                      <div className="form-row-3">
                        <div className="form-group">
                          <label className="form-label">Jumlah Paket (MB)</label>
                          <input
                            className="form-input"
                            type="number"
                            placeholder="10240"
                            min="0"
                            value={editForm.package_amount_mb}
                            onChange={e => setEditForm(prev => ({ ...prev, package_amount_mb: e.target.value }))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Tanggal Pengisian</label>
                          <input
                            className="form-input"
                            type="date"
                            value={editForm.package_start_date}
                            onChange={e => setEditForm(prev => ({ ...prev, package_start_date: e.target.value }))}
                          />
                        </div>
                        <div className="form-group">
                          <label className="form-label">Durasi (hari)</label>
                          <input
                            className="form-input"
                            type="number"
                            placeholder="30"
                            min="0"
                            value={editForm.package_duration_days}
                            onChange={e => setEditForm(prev => ({ ...prev, package_duration_days: e.target.value }))}
                          />
                        </div>
                      </div>
                      <div className="form-row-3" style={{ marginTop: 'var(--space-3)' }}>
                        <div className="form-group">
                          <label className="form-label">Biaya (Rp)</label>
                          <input
                            className="form-input"
                            type="number"
                            placeholder="50000"
                            min="0"
                            value={editForm.package_cost}
                            onChange={e => setEditForm(prev => ({ ...prev, package_cost: e.target.value }))}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {isExpanded && (
                    <div className="paket-device-detail animate-slide-down">
                      <div className="paket-detail-row">
                        <span className="paket-detail-label">Lokasi</span>
                        <span className="paket-detail-value">{device.location}</span>
                      </div>
                      {device.package_start_date && (
                        <div className="paket-detail-row">
                          <span className="paket-detail-label">Tanggal Pengisian</span>
                          <span className="paket-detail-value">{formatDate(device.package_start_date)}</span>
                        </div>
                      )}
                      <div className="paket-detail-row">
                        <span className="paket-detail-label">Terakhir Diubah</span>
                        <span className="paket-detail-value">{formatDate(device.updated_at)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
