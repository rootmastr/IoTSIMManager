import { useState, useMemo, useEffect } from 'react';
import {
  FileText, Download, Printer, Calendar, Smartphone,
  Wifi, MapPin, Clock, AlertTriangle, CheckCircle, Info, Zap,
  ChevronLeft, ChevronRight,
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

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

const REPORT_TYPES = [
  { id: 'devices', label: 'Daftar Perangkat', icon: Smartphone },
  { id: 'status', label: 'Status Paket', icon: Wifi },
  { id: 'cost', label: 'Ringkasan Biaya', icon: FileText },
  { id: 'history', label: 'Riwayat Perubahan', icon: Clock },
];

const TIME_RANGES = [
  { id: 'daily', label: 'Harian', icon: Calendar },
  { id: 'monthly', label: 'Bulanan', icon: Calendar },
  { id: 'yearly', label: 'Tahunan', icon: Calendar },
  { id: 'all', label: 'Semua', icon: Clock },
];

const STATUS_LABEL = { safe: 'Aman', warning: 'Peringatan', critical: 'Kritis', expired: 'Habis', none: 'Belum Diisi' };
const STATUS_SYMBOL = { safe: '●', warning: '▲', critical: '■', expired: '■', none: '○' };

const STATUS_ORDER = { expired: 0, critical: 1, warning: 2, none: 3, safe: 4 };

function generateYearOptions() {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let y = currentYear; y >= currentYear - 5; y--) years.push(y);
  return years;
}

function getPeriodLabel(timeRange, selectedDate, selectedMonth, selectedYear) {
  const now = new Date();
  if (timeRange === 'all') return 'Semua Waktu';
  if (timeRange === 'daily') {
    const d = selectedDate || now.toISOString().slice(0, 10);
    const dateObj = new Date(d + 'T00:00:00');
    return dateObj.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  }
  if (timeRange === 'monthly') {
    const m = selectedMonth ?? now.getMonth();
    const y = selectedYear ?? now.getFullYear();
    return `${MONTH_NAMES[m]} ${y}`;
  }
  if (timeRange === 'yearly') {
    return `Tahun ${selectedYear ?? now.getFullYear()}`;
  }
  return '';
}

function filterByTimeRange(items, timeRange, dateField, selectedDate, selectedMonth, selectedYear) {
  if (timeRange === 'all') return items;
  const now = new Date();
  return items.filter(item => {
    const raw = item[dateField];
    if (!raw) return false;
    const d = new Date(raw);
    if (timeRange === 'daily') {
      const target = selectedDate || now.toISOString().slice(0, 10);
      return d.toISOString().slice(0, 10) === target;
    }
    if (timeRange === 'monthly') {
      const m = selectedMonth ?? now.getMonth();
      const y = selectedYear ?? now.getFullYear();
      return d.getMonth() === m && d.getFullYear() === y;
    }
    if (timeRange === 'yearly') {
      return d.getFullYear() === (selectedYear ?? now.getFullYear());
    }
    return true;
  });
}

function computeSummaryStats(devices) {
  const total = devices.length;
  const totalCost = devices.reduce((s, d) => s + (Number(d.package_cost) || 0), 0);
  const withCost = devices.filter(d => d.package_cost > 0);
  const avgCost = withCost.length > 0 ? totalCost / withCost.length : 0;

  const statusCounts = {};
  devices.forEach(d => {
    const st = d.package_status || 'none';
    statusCounts[st] = (statusCounts[st] || 0) + 1;
  });

  const operatorCounts = {};
  devices.forEach(d => {
    const op = d.operator || 'Tidak Diketahui';
    operatorCounts[op] = (operatorCounts[op] || 0) + 1;
  });

  const cardTypeCounts = {};
  devices.forEach(d => {
    const ct = d.card_type || 'Tidak Diketahui';
    cardTypeCounts[ct] = (cardTypeCounts[ct] || 0) + 1;
  });

  return { total, totalCost, avgCost, statusCounts, operatorCounts, cardTypeCounts };
}

/* ========== PERIOD SELECTOR ========== */
function PeriodSelector({ timeRange, selectedDate, setSelectedDate, selectedMonth, setSelectedMonth, selectedYear, setSelectedYear }) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const years = useMemo(() => generateYearOptions(), []);

  const handleDateChange = (direction) => {
    const current = new Date(selectedDate || now.toISOString().slice(0, 10));
    current.setDate(current.getDate() + direction);
    setSelectedDate(current.toISOString().slice(0, 10));
  };

  const handleMonthChange = (direction) => {
    let m = selectedMonth ?? currentMonth;
    let y = selectedYear ?? currentYear;
    m += direction;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setSelectedMonth(m);
    setSelectedYear(y);
  };

  const handleYearChange = (direction) => {
    const y = (selectedYear ?? currentYear) + direction;
    setSelectedYear(y);
  };

  if (timeRange === 'daily') {
    return (
      <div className="period-selector">
        <button className="period-nav-btn" onClick={() => handleDateChange(-1)} title="Hari sebelumnya">
          <ChevronLeft size={16} />
        </button>
        <input
          type="date"
          className="period-date-input"
          value={selectedDate || now.toISOString().slice(0, 10)}
          onChange={(e) => setSelectedDate(e.target.value)}
        />
        <button className="period-nav-btn" onClick={() => handleDateChange(1)} title="Hari berikutnya">
          <ChevronRight size={16} />
        </button>
        <button className="period-today-btn" onClick={() => setSelectedDate(now.toISOString().slice(0, 10))}>
          Hari Ini
        </button>
      </div>
    );
  }

  if (timeRange === 'monthly') {
    return (
      <div className="period-selector">
        <button className="period-nav-btn" onClick={() => handleMonthChange(-1)} title="Bulan sebelumnya">
          <ChevronLeft size={16} />
        </button>
        <select
          className="period-select"
          value={selectedMonth ?? currentMonth}
          onChange={(e) => setSelectedMonth(Number(e.target.value))}
        >
          {MONTH_NAMES.map((name, i) => (
            <option key={i} value={i}>{name}</option>
          ))}
        </select>
        <select
          className="period-select period-year-select"
          value={selectedYear ?? currentYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="period-nav-btn" onClick={() => handleMonthChange(1)} title="Bulan berikutnya">
          <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  if (timeRange === 'yearly') {
    return (
      <div className="period-selector">
        <button className="period-nav-btn" onClick={() => handleYearChange(-1)} title="Tahun sebelumnya">
          <ChevronLeft size={16} />
        </button>
        <select
          className="period-select period-year-select"
          value={selectedYear ?? currentYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
        >
          {years.map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <button className="period-nav-btn" onClick={() => handleYearChange(1)} title="Tahun berikutnya">
          <ChevronRight size={16} />
        </button>
      </div>
    );
  }

  return null;
}

/* ========== SUMMARY PANEL ========== */
function SummaryPanel({ stats, timeRange, periodLabel }) {
  if (!stats || stats.total === 0) return null;
  return (
    <div className="report-summary-panel">
      <div className="summary-header">
        <Zap size={16} />
        <span>Ringkasan Periode: <strong>{periodLabel}</strong></span>
      </div>
      <div className="summary-grid">
        <div className="summary-card">
          <div className="summary-card-icon blue"><Smartphone size={18} /></div>
          <div className="summary-card-info">
            <div className="summary-card-value">{stats.total}</div>
            <div className="summary-card-label">Total Perangkat</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon green"><FileText size={18} /></div>
          <div className="summary-card-info">
            <div className="summary-card-value">{formatRupiah(stats.totalCost)}</div>
            <div className="summary-card-label">Total Biaya</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon amber"><Info size={18} /></div>
          <div className="summary-card-info">
            <div className="summary-card-value">{formatRupiah(stats.avgCost)}</div>
            <div className="summary-card-label">Rata-rata Biaya</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-card-icon red"><AlertTriangle size={18} /></div>
          <div className="summary-card-info">
            <div className="summary-card-value">{(stats.statusCounts.warning || 0) + (stats.statusCounts.critical || 0) + (stats.statusCounts.expired || 0)}</div>
            <div className="summary-card-label">Perlu Perhatian</div>
          </div>
        </div>
      </div>

      <div className="summary-breakdowns">
        <div className="breakdown-section">
          <h4 className="breakdown-title">Status Paket</h4>
          <div className="breakdown-list">
            {Object.entries(stats.statusCounts).sort(([a], [b]) => (STATUS_ORDER[a] ?? 5) - (STATUS_ORDER[b] ?? 5)).map(([status, count]) => (
              <div key={status} className="breakdown-item">
                <span className={`report-status status-${status}`}>{STATUS_SYMBOL[status]} {STATUS_LABEL[status]}</span>
                <span className="breakdown-count">{count}</span>
                <div className="breakdown-bar">
                  <div className="breakdown-bar-fill" style={{ width: `${(count / stats.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="breakdown-section">
          <h4 className="breakdown-title">Operator</h4>
          <div className="breakdown-list">
            {Object.entries(stats.operatorCounts).sort(([, a], [, b]) => b - a).map(([operator, count]) => (
              <div key={operator} className="breakdown-item">
                <span className="breakdown-label">{operator}</span>
                <span className="breakdown-count">{count}</span>
                <div className="breakdown-bar">
                  <div className="breakdown-bar-fill operator-bar" style={{ width: `${(count / stats.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="breakdown-section">
          <h4 className="breakdown-title">Tipe Kartu</h4>
          <div className="breakdown-list">
            {Object.entries(stats.cardTypeCounts).sort(([, a], [, b]) => b - a).map(([type, count]) => (
              <div key={type} className="breakdown-item">
                <span className="breakdown-label">{type}</span>
                <span className="breakdown-count">{count}</span>
                <div className="breakdown-bar">
                  <div className="breakdown-bar-fill cardtype-bar" style={{ width: `${(count / stats.total) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========== REPORT HEADER ========== */
function ReportHeader({ timeRangeLabel, periodLabel }) {
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
        <div className="report-period-badge">
          <Calendar size={12} />
          <span>{periodLabel}</span>
        </div>
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

/* ========== REPORT TABLES ========== */
function DeviceReport({ devices }) {
  const totalCost = devices.reduce((s, d) => s + (Number(d.package_cost) || 0), 0);
  return (
    <>
      <ReportTitle title="Daftar Perangkat IoT" subtitle="Lengkap dengan informasi nomor HP dan status paket data" />
      {devices.length === 0 ? (
        <div className="report-empty-note"><Info size={14} /><span>Tidak ada data perangkat untuk periode ini.</span></div>
      ) : (
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
      )}
    </>
  );
}

function StatusReport({ devices }) {
  const sorted = [...devices].sort((a, b) => (STATUS_ORDER[a.package_status] ?? 5) - (STATUS_ORDER[b.package_status] ?? 5));
  return (
    <>
      <ReportTitle title="Laporan Status Paket Data" subtitle="Analisis status paket data seluruh perangkat IoT" />
      {devices.length === 0 ? (
        <div className="report-empty-note"><Info size={14} /><span>Tidak ada data status untuk periode ini.</span></div>
      ) : (
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
      )}
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
        <StatBox label="Perangkat Aktif" value={withCost.length} color="gray" />
      </div>
      {sorted.length === 0 ? (
        <div className="report-empty-note"><Info size={14} /><span>Tidak ada data biaya untuk periode ini.</span></div>
      ) : (
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
      )}
    </>
  );
}

function HistoryReport({ history }) {
  const actionLabels = { add: 'Ditambahkan', update: 'Diperbarui', package_update: 'Paket Diperbarui', delete: 'Dihapus' };
  const actionColors = { add: 'green', update: 'blue', package_update: 'amber', delete: 'red' };
  return (
    <>
      <ReportTitle title="Laporan Riwayat Perubahan" subtitle="Log semua aktivitas perubahan data perangkat IoT" />
      {history.length === 0 ? (
        <div className="report-empty-note"><Info size={14} /><span>Belum ada riwayat perubahan untuk periode ini.</span></div>
      ) : (
        <div className="report-table-wrapper">
          <table className="report-table">
            <thead><tr><th className="th-num">No.</th><th>Waktu</th><th>Nama Perangkat</th><th>Nomor HP</th><th>Aksi</th><th>User</th></tr></thead>
            <tbody>
              {history.map((h, i) => (
                <tr key={h.id}>
                  <td className="td-num">{i + 1}</td><td>{formatDateTime(h.timestamp)}</td><td className="td-bold">{h.device_name}</td><td>{h.phone}</td>
                  <td><span className={`action-badge action-${actionColors[h.action] || 'gray'}`}>{actionLabels[h.action] || h.action}</span></td>
                  <td>{h.username || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

/* ========== MAIN COMPONENT ========== */
export default function Laporan() {
  const [reportType, setReportType] = useState('devices');
  const [timeRange, setTimeRange] = useState('all');
  const [devices, setDevices] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());

  useEffect(() => {
    Promise.all([api.get('/devices'), api.get('/history?limit=500')])
      .then(([d, h]) => { setDevices(d); setHistory(h.data || []); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filteredDevices = useMemo(
    () => filterByTimeRange(devices, timeRange, 'package_start_date', selectedDate, selectedMonth, selectedYear),
    [devices, timeRange, selectedDate, selectedMonth, selectedYear]
  );

  const filteredHistory = useMemo(
    () => filterByTimeRange(history, timeRange, 'timestamp', selectedDate, selectedMonth, selectedYear),
    [history, timeRange, selectedDate, selectedMonth, selectedYear]
  );

  const periodLabel = useMemo(
    () => getPeriodLabel(timeRange, selectedDate, selectedMonth, selectedYear),
    [timeRange, selectedDate, selectedMonth, selectedYear]
  );

  const summaryStats = useMemo(
    () => computeSummaryStats(filteredDevices),
    [filteredDevices]
  );

  const handleTimeRangeChange = (range) => {
    const now = new Date();
    setTimeRange(range);
    if (range === 'daily') setSelectedDate(now.toISOString().slice(0, 10));
    if (range === 'monthly') { setSelectedMonth(now.getMonth()); setSelectedYear(now.getFullYear()); }
    if (range === 'yearly') setSelectedYear(now.getFullYear());
  };

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
            {TIME_RANGES.map(tr => {
              const Icon = tr.icon;
              return (
                <button key={tr.id} className={`laporan-time-btn ${timeRange === tr.id ? 'active' : ''}`} onClick={() => handleTimeRangeChange(tr.id)}>
                  <Icon size={14} />{tr.label}
                </button>
              );
            })}
          </div>
          <PeriodSelector
            timeRange={timeRange}
            selectedDate={selectedDate} setSelectedDate={setSelectedDate}
            selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth}
            selectedYear={selectedYear} setSelectedYear={setSelectedYear}
          />
          <div className="laporan-actions">
            <button className="btn btn-secondary" onClick={() => window.print()}>
              <Printer size={16} />Cetak / PDF
            </button>
          </div>
        </div>
      </div>

      <div className="report-paper" id="report-content">
        <ReportHeader timeRangeLabel={timeRange} periodLabel={periodLabel} />
        <SummaryPanel stats={summaryStats} timeRange={timeRange} periodLabel={periodLabel} />
        {reportType === 'devices' && <DeviceReport devices={filteredDevices} />}
        {reportType === 'status' && <StatusReport devices={filteredDevices} />}
        {reportType === 'cost' && <CostReport devices={filteredDevices} />}
        {reportType === 'history' && <HistoryReport history={filteredHistory} />}
        <ReportFooter />
      </div>
    </div>
  );
}
