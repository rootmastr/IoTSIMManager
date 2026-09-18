import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Smartphone, MapPin, Wifi } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import DataTable from '../components/shared/DataTable';
import Modal from '../components/shared/Modal';
import './DeviceList.css';

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

const STATUS_STYLE = {
  safe: { color: 'green', label: 'Aman' },
  warning: { color: 'amber', label: 'Peringatan' },
  critical: { color: 'red', label: 'Kritis' },
  expired: { color: 'red', label: 'Habis' },
  none: { color: 'gray', label: 'Belum Diisi' },
};

const COLUMNS = [
  { key: 'name', label: 'Nama Perangkat', sortable: true },
  { key: 'phone', label: 'Nomor HP', sortable: false },
  { key: 'operator', label: 'Operator', sortable: true },
  { key: 'card_type', label: 'Tipe Kartu', sortable: true },
  { key: 'location', label: 'Lokasi', sortable: false },
  { key: 'packageStatus', label: 'Status Paket', sortable: false, width: '140px' },
  { key: 'packageCost', label: 'Biaya', sortable: true, width: '120px' },
  { key: 'package_start_date', label: 'Tanggal Pengisian', sortable: true },
  { key: 'actions', label: '', sortable: false, width: '100px' },
];

export default function DeviceList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);

  async function refresh() {
    try {
      const [d, s] = await Promise.all([api.get('/devices'), api.get('/devices/stats')]);
      setDevices(d);
      setStats(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await api.delete(`/devices/${deleteTarget.id}`);
      setDeleteTarget(null);
      refresh();
    } catch (err) {
      console.error(err);
    }
  }

  function getEstimasiKadaluarsa(d) {
    if (!d.package_start_date || !d.package_duration_days) return null;
    const exp = new Date(d.package_start_date);
    exp.setDate(exp.getDate() + d.package_duration_days);
    return exp.toISOString();
  }

  if (loading) return <div className="animate-fade-in">Memuat data...</div>;

  return (
    <div className="animate-fade-in">
      <div className="device-list-stats">
        <div className="device-stat-card card">
          <div className="card-body">
            <div className="device-stat-row">
              <div className="device-stat-icon blue">
                <Wifi size={20} />
              </div>
              <div className="device-stat-content">
                <div className="device-stat-label">Total Perangkat</div>
                <div className="device-stat-value">{stats?.total_devices || devices.length}</div>
              </div>
            </div>
          </div>
        </div>
        <div className="device-stat-card card">
          <div className="card-body">
            <div className="device-stat-row">
              <div className="device-stat-icon green">
                <span style={{ fontWeight: 800, fontSize: '1rem' }}>Rp</span>
              </div>
              <div className="device-stat-content">
                <div className="device-stat-label">Total Pengeluaran</div>
                <div className="device-stat-value">{formatRupiah(stats?.total_cost || 0)}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="device-list-header">
        <h2 className="device-list-title">Daftar Perangkat IoT</h2>
        {user?.role !== 'viewer' && (
          <button className="btn btn-primary" onClick={() => navigate('/input')}>
            <Plus size={18} />
            Tambah Perangkat
          </button>
        )}
      </div>

      <DataTable
        data={devices}
        columns={COLUMNS}
        searchPlaceholder="Cari nama, nomor HP, lokasi..."
        searchKeys={['name', 'phone', 'location']}
        emptyTitle="Belum ada perangkat"
        emptyDesc="Tambahkan perangkat IoT pertama Anda"
        renderRow={(device) => {
          const status = device.package_status || 'none';
          const days = device.days_remaining;
          const style = STATUS_STYLE[status] || STATUS_STYLE.none;

          return (
            <tr key={device.id}>
              <td>
                <div className="device-name-cell">
                  <span className="device-name-main">{device.name}</span>
                </div>
              </td>
              <td>
                <div className="device-phone-cell">
                  <Smartphone size={14} className="device-phone-icon" />
                  <span>{device.phone}</span>
                </div>
              </td>
              <td>
                {device.operator ? (
                  <span className="device-tag operator">{device.operator}</span>
                ) : (
                  <span style={{ color: 'var(--gray-400)', fontSize: 'var(--font-sm)' }}>—</span>
                )}
              </td>
              <td>
                {device.card_type ? (
                  <span className={`device-tag cardtype ${device.card_type.toLowerCase()}`}>{device.card_type}</span>
                ) : (
                  <span style={{ color: 'var(--gray-400)', fontSize: 'var(--font-sm)' }}>—</span>
                )}
              </td>
              <td>
                <div className="device-location-cell">
                  <MapPin size={14} className="device-location-icon" />
                  <span>{device.location}</span>
                </div>
              </td>
              <td>
                <div className="device-package-cell">
                  <span className={`device-package-badge ${style.color}`}>
                    {style.label}
                  </span>
                  {days !== null && (
                    <span className={`device-package-days ${style.color}`}>
                      {days < 0 ? `Habis ${Math.abs(days)}h lalu` : `${days}h lagi`}
                    </span>
                  )}
                  {device.package_amount_mb > 0 && (
                    <span className="device-package-mb">
                      <Wifi size={12} />
                      {formatMB(device.package_amount_mb)}
                    </span>
                  )}
                </div>
              </td>
              <td>
                <span className="device-cost">{device.package_cost > 0 ? formatRupiah(device.package_cost) : '—'}</span>
              </td>
              <td>
                <span className="device-date">{formatDate(device.package_start_date || device.created_at)}</span>
              </td>
              <td>
                <div className="data-table-actions">
                  {user?.role !== 'viewer' && (
                    <button
                      className="data-table-action-btn"
                      title="Edit"
                      onClick={() => navigate(`/edit/${device.id}`)}
                    >
                      <Pencil size={16} />
                    </button>
                  )}
                  {user?.role === 'admin' && (
                    <button
                      className="data-table-action-btn danger"
                      title="Hapus"
                      onClick={() => setDeleteTarget(device)}
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        }}
      />

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Hapus Perangkat"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Batal</button>
            <button className="btn btn-danger" onClick={handleDelete}>Hapus</button>
          </>
        }
      >
        {deleteTarget && (
          <p style={{ color: 'var(--gray-600)' }}>
            Yakin ingin menghapus perangkat <strong>{deleteTarget.name}</strong> ({deleteTarget.phone})? Tindakan ini tidak dapat dibatalkan.
          </p>
        )}
      </Modal>
    </div>
  );
}
