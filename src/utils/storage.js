const DEVICES_KEY = 'iot_devices';
const HISTORY_KEY = 'iot_device_history';

export const CARD_TYPES = ['Prabayar', 'Pascabayar', 'IoT'];
export const OPERATORS = ['Telkomsel', 'Byu', 'Indosat', 'Tri', 'XL', 'Axis'];

function generateId() {
  return crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2);
}

export function getDevices() {
  try {
    const raw = localStorage.getItem(DEVICES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveDevices(devices) {
  localStorage.setItem(DEVICES_KEY, JSON.stringify(devices));
}

export function addDevice({ name, phone, location, cardType, operator, packageAmountMB, packageStartDate, packageDurationDays, packageCost }) {
  const devices = getDevices();
  const now = new Date().toISOString();
  const device = {
    id: generateId(),
    name,
    phone,
    location,
    cardType: cardType || '',
    operator: operator || '',
    packageAmountMB: Number(packageAmountMB) || 0,
    packageStartDate: packageStartDate || null,
    packageDurationDays: Number(packageDurationDays) || 0,
    packageCost: Number(packageCost) || 0,
    createdAt: now,
    updatedAt: now,
  };
  devices.unshift(device);
  saveDevices(devices);
  addHistory({ deviceId: device.id, action: 'add', deviceName: name, phone, location });
  return device;
}

export function updateDevice(id, { name, phone, location, cardType, operator, packageAmountMB, packageStartDate, packageDurationDays, packageCost }) {
  const devices = getDevices();
  const idx = devices.findIndex(d => d.id === id);
  if (idx === -1) return null;
  devices[idx] = {
    ...devices[idx],
    name,
    phone,
    location,
    cardType: cardType || '',
    operator: operator || '',
    packageAmountMB: Number(packageAmountMB) || 0,
    packageStartDate: packageStartDate || null,
    packageDurationDays: Number(packageDurationDays) || 0,
    packageCost: Number(packageCost) || 0,
    updatedAt: new Date().toISOString(),
  };
  saveDevices(devices);
  addHistory({ deviceId: id, action: 'update', deviceName: name, phone, location });
  return devices[idx];
}

export function updateDevicePackage(id, { packageAmountMB, packageStartDate, packageDurationDays, packageCost }) {
  const devices = getDevices();
  const idx = devices.findIndex(d => d.id === id);
  if (idx === -1) return null;
  devices[idx] = {
    ...devices[idx],
    packageAmountMB: Number(packageAmountMB) || 0,
    packageStartDate: packageStartDate || null,
    packageDurationDays: Number(packageDurationDays) || 0,
    packageCost: Number(packageCost) || 0,
    updatedAt: new Date().toISOString(),
  };
  saveDevices(devices);
  addHistory({ deviceId: id, action: 'package_update', deviceName: devices[idx].name, phone: devices[idx].phone, location: devices[idx].location });
  return devices[idx];
}

export function deleteDevice(id) {
  const devices = getDevices();
  const device = devices.find(d => d.id === id);
  if (device) {
    addHistory({ deviceId: id, action: 'delete', deviceName: device.name, phone: device.phone, location: device.location });
  }
  const filtered = devices.filter(d => d.id !== id);
  saveDevices(filtered);
}

export function getDeviceById(id) {
  return getDevices().find(d => d.id === id) || null;
}

export function clearAllDevices() {
  localStorage.removeItem(DEVICES_KEY);
  localStorage.removeItem(HISTORY_KEY);
}

function addHistory(entry) {
  const history = getHistory();
  history.unshift({
    id: generateId(),
    ...entry,
    timestamp: new Date().toISOString(),
  });
  if (history.length > 100) history.length = 100;
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function getHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function getDaysRemaining(device) {
  if (!device.packageStartDate || !device.packageDurationDays) return null;
  const start = new Date(device.packageStartDate);
  const now = new Date();
  const elapsed = Math.floor((now - start) / (1000 * 60 * 60 * 24));
  return device.packageDurationDays - elapsed;
}

export function getPackageStatus(device) {
  const days = getDaysRemaining(device);
  if (days === null) return 'none';
  if (days < 0) return 'expired';
  if (days <= 2) return 'critical';
  if (days <= 6) return 'warning';
  return 'safe';
}

export function getPackageRecommendation(device) {
  const status = getPackageStatus(device);
  const days = getDaysRemaining(device);
  const mb = device.packageAmountMB || 0;

  if (status === 'none') {
    return { type: 'info', text: 'Belum ada data paket. Silakan isi informasi paket data.' };
  }

  if (status === 'expired') {
    return { type: 'danger', text: `Paket telah habis ${Math.abs(days)} hari yang lalu. Segera lakukan pengisian ulang.` };
  }

  if (status === 'critical') {
    return { type: 'danger', text: `Paket tinggal ${days} hari. Segera siapkan pengisian ulang untuk menghindari putus layanan.` };
  }

  if (status === 'warning') {
    return { type: 'warning', text: `Paket tinggal ${days} hari. Mulai persiapkan pengisian ulang.` };
  }

  if (mb >= 10000) {
    return { type: 'info', text: `Paket masih aman (${days} hari). Kuota ${formatMB(mb)} tergolong besar, pastikan terpakai dengan optimal.` };
  }

  return { type: 'success', text: `Paket masih aman dengan sisa ${days} hari. Tidak perlu tindakan saat ini.` };
}

export function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function formatDateTime(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function timeAgo(dateString) {
  if (!dateString) return '';
  const now = new Date();
  const d = new Date(dateString);
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  return formatDate(dateString);
}

export function formatMB(mb) {
  if (!mb) return '0 MB';
  if (mb >= 1024) return `${(mb / 1024).toFixed(mb % 1024 === 0 ? 0 : 1)} GB`;
  return `${mb} MB`;
}

export function formatRupiah(amount) {
  if (!amount && amount !== 0) return 'Rp 0';
  return `Rp ${Number(amount).toLocaleString('id-ID')}`;
}

export function getEstimasiKadaluarsa(device) {
  if (!device.packageStartDate || !device.packageDurationDays) return null;
  const start = new Date(device.packageStartDate);
  const expiry = new Date(start);
  expiry.setDate(expiry.getDate() + device.packageDurationDays);
  return expiry.toISOString();
}

export function getTotalCost() {
  return getDevices().reduce((sum, d) => sum + (Number(d.packageCost) || 0), 0);
}

export function isIoTMonthly(device) {
  return device.cardType === 'IoT';
}
