import { useState, useMemo, useEffect } from 'react';
import {
  FileText, Download, Printer, Calendar, Smartphone,
  Wifi, MapPin, Clock, AlertTriangle, CheckCircle, Info, Zap,
} from 'lucide-react';
import { api } from '../utils/api';
import './Laporan.css';

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

function formatDateTime(dateString) {
  if (!dateString) return '—';
  return new Date(dateString).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const REPORT_TYPES = [
  { id: 'devices', label: 'Daftar Perangkat', icon: Smartphone },
  { id: 'status', label: 'Status Paket', icon: Wifi },
  { id: 'cost', label: 'Ringkasan Biaya', icon: FileText },
  { id: 'history', label: 'Riwayat Perubahan', icon: Clock },
];

const TIME_RANGES = [
  { id: 'all', label: 'Semua' },
  { id: 'daily', label: 'Harian' },
  { id: 'monthly', label: 'Bulanan' },
  { id: 'yearly', label: 'Tahunan' },
];

const STATUS_LABEL = { safe: 'Aman', warning: 'Peringatan', critical: 'Kritis', expired: 'Habis', none: 'Belum Diisi' };
const STATUS_SYMBOL = { safe: '●', warning: '▲', critical: '■', expired: '■', none: '○' };

function ReportHeader({ title, timeRangeLabel }) {
  const now = new Date();
  return (
    <div className="report-header">
      <div className="report-header-left">
        <div className="report-logo">ISM</div>
        <div>
          <div className="report-company">IoT SIM Manager</div>
          <div className="report-tagline">Sistem Manajemen SIM Card Perangkat IoT</div>
        </div>
      </div>
      <div className="report-header-right">
        {timeRangeLabel && <div className="report-range-badge">{timeRangeLabel}</div>}
        <div className="report-date">{now.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
        <div className="report-time">{now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })} WIB</div>
      </div>
    </div>
  );
}

function ReportTitle({ title, subtitle }) {
  return (
    <div className="report-title-section">
      <h1 className="report-main-title">{title}</h1>
      {subtitle && <p className="report-subtitle">{subtitle}</p>}
      <div className="report-title-line" />
    </div>
  );
}

function StatBox({ label, value, color }) {
  return (
    <div className={`report-stat-box ${color}`}>
      <div className="report-stat-value">{value}</div>
      <div className="report-stat-label">{label}</div>
    </div>
  );
}

function ReportFooter() {
  return (
    <div className="report-footer">
      <div className="report-footer-line" />
      <div className="report-footer-content">
        <span>Dicetak dari IoT SIM Manager</span>
        <span>Laporan ini dihasilkan secara otomatis</span>
      </div>
    </div>
  );
}

function DeviceReport({ devices }) {
  const totalCost = devices.reduce((s, d) => s + (Number(d.package_cost) || 0), 0);
  return (
    <>
      <ReportTitle title="Daftar Perangkat IoT" subtitle="Lengkap dengan informasi nomor HP dan status paket data" />
      <div className="report-table-wrapper">
        <table className="report-table">
          <thead>
            <tr>
              <th className="th-num">No.</th><th>Nama Perangkat</th><th>Nomor HP</th><th>Operator</th><th>Tipe Kartu</th><th>Lokasi</th><th>Tgl Pengisian</th><th>Status</th><th className="th-right">Biaya</th>
            </tr>
          </thead>
          <tbody>
            {devices.map((d, i) => (
              <tr key={d.id}>
                <td className="td-num">{i + 1}</td>
                <td className="td-bold">{d.name}</td><td>{d.phone}</td><td>{d.operator || '—'}</td><td>{d.card_type || '—'}</td><td>{d.location}</td>
                <td>{d.package_start_date ? formatDate(d.package_start_date) : '—'}</td>
                <td><span className={`report-status status-${d.package_status || 'none'}`}>{STATUS_SYMBOL[d.package_status] || '○'} {STATUS_LABEL[d.package_status] || 'Belum Diisi'}</span></td>
                <td className="td-right">{d.package_cost > 0 ? formatRupiah(d.package_cost) : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={8} className="td-bold">Total Pengeluaran</td><td className="td-right td-bold">{formatRupiah(totalCost)}</td></tr></tfoot>
        </table>
      </div>
    </>
  );
}

function StatusReport({ devices }) {
  const sorted = [...devices].sort((a, b) => {
    const order = { expired: 0, critical: 1, warning: 2, none: 3, safe: 4 };
    return (order[a.package_status] ?? 5) - (order[b.package_status] ?? 5);
  });
  return (
    <>
      <ReportTitle title="Laporan Status Paket Data" subtitle="Analisis status paket data seluruh perangkat IoT" />
      <div className="report-table-wrapper">
        <table className="report-table">
          <thead>
            <tr><th className="th-num">No.</th><th>Nama Perangkat</th><th>Nomor HP</th><th>Operator</th><th>Lokasi</th><th>Sisa Hari</th><th>Status</th></tr>
          </thead>
          <tbody>
            {sorted.map((d, i) => (
              <tr key={d.id}>
                <td className="td-num">{i + 1}</td><td className="td-bold">{d.name}</td><td>{d.phone}</td><td>{d.operator || '—'}</td><td>{d.location}</td>
                <td>{d.days_remaining !== null ? (d.days_remaining < 0 ? `${Math.abs(d.days_remaining)}h lalu` : `${d.days_remaining} hari`) : '—'}</td>
                <td><span className={`report-status status-${d.package_status || 'none'}`}>{STATUS_SYMBOL[d.package_status] || '○'} {STATUS_LABEL[d.package_status] || 'Belum Diisi'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function CostReport({ devices }) {
  const withCost = devices.filter(d => d.package_cost > 0);
  const totalCost = withCost.reduce((s, d) => s + (Number(d.package_cost) || 0), 0);
  const sorted = [...withCost].sort((a, b) => (Number(b.package_cost) || 0) - (Number(a.package_cost) || 0));
  return (
    <>
      <ReportTitle title="Laporan Ringkasan Biaya" subtitle="Rekapitulasi pengeluaran paket data perangkat IoT" />
      <div className="report-stats-row">
        <StatBox label="Total Pengeluaran" value={formatRupiah(totalCost)} color="blue" />
        <StatBox label="Rata-rata / Perangkat" value={withCost.length > 0 ? formatRupiah(totalCost / withCost.length) : 'Rp 0'} color="green" />
      </div>
      <div className="report-table-wrapper">
        <table className="report-table">
          <thead><tr><th className="th-num">No.</th><th>Nama Perangkat</th><th>Nomor HP</th><th>Operator</th><th>Lokasi</th><th>Keterangan</th><th className="th-right">Biaya</th></tr></thead>
          <tbody>
            {sorted.map((d, i) => (
              <tr key={d.id}>
                <td className="td-num">{i + 1}</td><td className="td-bold">{d.name}</td><td>{d.phone}</td><td>{d.operator || '—'}</td><td>{d.location}</td>
                <td>{d.card_type === 'IoT' ? <span className="cost-iot-badge">Tagihan Bulanan</span> : <span className="cost-standard-badge">Paket Standar</span>}</td>
                <td className="td-right td-bold">{formatRupiah(d.package_cost)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr><td colSpan={6} className="td-bold">Total</td><td className="td-right td-bold">{formatRupiah(totalCost)}</td></tr></tfoot>
        </table>
      </div>
    </>
  );
}

function HistoryReport({ history }) {
  const actionLabels = { add: 'Ditambahkan', update: 'Diperbarui', package_update: 'Paket Diperbarui', delete: 'Dihapus' };
  return (
    <>
      <ReportTitle title="Laporan Riwayat Perubahan" subtitle="Log semua aktivitas perubahan data perangkat IoT" />
      <table className="report-table">
        <thead><tr><th className="th-num">No.</th><th>Waktu</th><th>Nama Perangkat</th><th>Nomor HP</th><th>Aksi</th><th>User</th></tr></thead>
        <tbody>
          {history.map((h, i) => (
            <tr key={h.id}>
              <td className="td-num">{i + 1}</td><td>{formatDateTime(h.timestamp)}</td><td className="td-bold">{h.device_name}</td><td>{h.phone}</td>
              <td>{actionLabels[h.action] || h.action}</td><td>{h.username || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {history.length === 0 && <div className="report-empty-note"><Info size={14} /><span>Belum ada riwayat perubahan.</span></div>}
    </>
  );
}

function filterByTimeRange(items, timeRange, dateField) {
  if (timeRange === 'all') return items;
  const now = new Date();
  return items.filter(item => {
    const raw = item[dateField];
    if (!raw) return false;
    const d = new Date(raw);
    if (timeRange === 'daily') return d.toDateString() === now.toDateString();
    if (timeRange === 'monthly') return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    if (timeRange === 'yearly') return d.getFullYear() === now.getFullYear();
    return true;
  });
}

export default function Laporan() {
  const [reportType, setReportType] = useState('devices');
  const [timeRange, setTimeRange] = useState('all');
  const [devices, setDevices] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.get('/devices'), api.get('/history?limit=200')])
      .then(([d, h]) => { setDevices(d); setHistory(h.data || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredDevices = useMemo(() => filterByTimeRange(devices, timeRange, 'package_start_date'), [devices, timeRange]);
  const filteredHistory = useMemo(() => filterByTimeRange(history, timeRange, 'timestamp'), [history, timeRange]);
  const rangeLabels = { all: 'Semua Waktu', daily: 'Hari Ini', monthly: 'Bulan Ini', yearly: 'Tahun Ini' };

  if (loading) return <div className="animate-fade-in">Memuat laporan...</div>;

  return (
    <div className="laporan-page animate-fade-in">
      <div className="laporan-controls no-print">
        <div className="laporan-controls-left">
          <h2 className="laporan-page-title">Laporan</h2>
        </div>
        <div className="laporan-controls-right">
          <div className="laporan-type-selector">
            {REPORT_TYPES.map(rt => {
              const Icon = rt.icon;
              return (
                <button key={rt.id} className={`laporan-type-btn ${reportType === rt.id ? 'active' : ''}`} onClick={() => setReportType(rt.id)}>
                  <Icon size={16} />{rt.label}
                </button>
              );
            })}
          </div>
          <div className="laporan-time-selector">
            {TIME_RANGES.map(tr => (
              <button key={tr.id} className={`laporan-time-btn ${timeRange === tr.id ? 'active' : ''}`} onClick={() => setTimeRange(tr.id)}>
                {tr.label}
              </button>
            ))}
          </div>
          <div className="laporan-actions">
            <button className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={16} />Cetak / PDF
            </button>
          </div>
        </div>
      </div>

      <div className="report-paper" id="report-content">
        <ReportHeader title={reportType} timeRangeLabel={rangeLabels[timeRange]} />
        {reportType === 'devices' && <DeviceReport devices={filteredDevices} />}
        {reportType === 'status' && <StatusReport devices={filteredDevices} />}
        {reportType === 'cost' && <CostReport devices={filteredDevices} />}
        {reportType === 'history' && <HistoryReport history={filteredHistory} />}
        <ReportFooter />
      </div>
    </div>
  );
}
