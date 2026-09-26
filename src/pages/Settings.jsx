import { useState, useEffect } from 'react';
import { Info, Trash2, AlertTriangle, Download, Upload } from 'lucide-react';
import { api } from '../utils/api';
import { useAuth } from '../contexts/AuthContext';
import Modal from '../components/shared/Modal';
import './Settings.css';

export default function Settings() {
  const { user } = useAuth();
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [deviceCount, setDeviceCount] = useState(0);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    api.get('/devices/stats').then(s => setDeviceCount(Number(s.total_devices) || 0)).catch(() => {});
  }, []);

  async function handleReset() {
    try {
      const devices = await api.get('/devices');
      for (const d of devices) {
        await api.delete(`/devices/${d.id}`);
      }
      setShowResetConfirm(false);
      setResetDone(true);
      setDeviceCount(0);
      setTimeout(() => setResetDone(false), 3000);
    } catch (err) {
      console.error(err);
    }
  }

  async function handleImportCSV(e) {
    const file = e.target.files[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await api.upload('/devices/import', formData);
      setImportResult(result);
      setDeviceCount(prev => prev + result.imported);
    } catch (err) {
      setImportResult({ error: err.message });
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

  async function handleExportJSON() {
    try {
      await api.download('/devices/export/json', 'devices_export.json');
    } catch (err) {
      alert('Gagal export: ' + err.message);
    }
  }

  return (
    <div className="animate-fade-in">
      <div className="settings-header">
        <h2 className="settings-title">Settings</h2>
      </div>

      <div className="settings-sections">
        <div className="settings-section card">
          <div className="card-body">
            <div className="settings-info-row">
              <div className="settings-info-icon">
                <Info size={20} />
              </div>
              <div className="settings-info-content">
                <h3>Tentang Aplikasi</h3>
                <p>IoT SIM Manager adalah aplikasi untuk mendata nomor HP yang digunakan pada perangkat IoT.</p>
                <div className="settings-meta">
                  <span>Versi 3.0</span>
                  <span>&middot;</span>
                  <span>{deviceCount} perangkat terdaftar</span>
                  <span>&middot;</span>
                  <span>PostgreSQL Database</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="settings-section card">
          <div className="card-body">
            <div className="settings-info-row">
              <div className="settings-info-icon blue">
                <Download size={20} />
              </div>
              <div className="settings-info-content">
                <h3>Export Data</h3>
                <p>Ekspor semua data perangkat ke file CSV atau JSON.</p>
                <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-3)' }}>
                  <button className="btn btn-sm btn-secondary" onClick={handleExportCSV}>
                    <Download size={14} /> Export CSV
                  </button>
                  <button className="btn btn-sm btn-secondary" onClick={handleExportJSON}>
                    <Download size={14} /> Export JSON
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {user?.role !== 'viewer' && (
          <div className="settings-section card">
            <div className="card-body">
              <div className="settings-info-row">
                <div className="settings-info-icon green">
                  <Upload size={20} />
                </div>
                <div className="settings-info-content">
                  <h3>Import Data</h3>
                  <p>Impor data perangkat dari file CSV. Format: nama, phone, lokasi, tipe_kartu, operator</p>
                  <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer', marginTop: 'var(--space-3)' }}>
                    <Upload size={14} />
                    {importing ? 'Mengimport...' : 'Pilih File CSV'}
                    <input type="file" accept=".csv" onChange={handleImportCSV} style={{ display: 'none' }} disabled={importing} />
                  </label>
                  {importResult && !importResult.error && (
                    <div className="settings-toast animate-slide-down" style={{ marginTop: 'var(--space-3)' }}>
                      Import selesai: {importResult.imported} berhasil dari {importResult.total} data
                      {importResult.errors.length > 0 && ` (${importResult.errors.length} error)`}
                    </div>
                  )}
                  {importResult?.error && (
                    <div className="settings-error animate-slide-down" style={{ marginTop: 'var(--space-3)' }}>
                      {importResult.error}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {user?.role === 'admin' && (
          <div className="settings-section card">
            <div className="card-body">
              <div className="settings-info-row">
                <div className="settings-info-icon danger">
                  <Trash2 size={20} />
                </div>
                <div className="settings-info-content">
                  <h3>Reset Data</h3>
                  <p>Hapus semua data perangkat dan riwayat dari database. Tindakan ini tidak dapat dibatalkan.</p>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setShowResetConfirm(true)}
                    style={{ marginTop: 'var(--space-3)' }}
                  >
                    <Trash2 size={16} />
                    Reset Semua Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {resetDone && (
          <div className="settings-toast animate-slide-down">
            Semua data berhasil direset.
          </div>
        )}
      </div>

      <Modal
        isOpen={showResetConfirm}
        onClose={() => setShowResetConfirm(false)}
        title="Konfirmasi Reset"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowResetConfirm(false)}>Batal</button>
            <button className="btn btn-danger" onClick={handleReset}>
              <Trash2 size={16} />
              Ya, Reset
            </button>
          </>
        }
      >
        <div className="settings-reset-confirm">
          <AlertTriangle size={24} className="settings-reset-icon" />
          <p>Semua data perangkat dan riwayat akan dihapus permanen. Apakah Anda yakin?</p>
        </div>
      </Modal>
    </div>
  );
}
