import { useState, useEffect } from 'react';
import { Bell, Inbox, MapPin } from 'lucide-react';
import { api } from '../utils/api';
import './Notifikasi.css';

function timeAgo(dateString) {
  if (!dateString) return '';
  const diff = Math.floor((Date.now() - new Date(dateString)) / 1000);
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} menit lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} hari lalu`;
  return new Date(dateString).toLocaleDateString('id-ID');
}

export default function Notifikasi() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get('/devices');
        const notifs = data.map(d => ({
          id: d.id,
          message: `Perangkat "${d.name}" terdaftar dengan nomor ${d.phone}`,
          detail: d.location,
          time: d.created_at,
        }));
        notifs.sort((a, b) => new Date(b.time) - new Date(a.time));
        setNotifications(notifs);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return <div className="animate-fade-in">Memuat...</div>;

  return (
    <div className="animate-fade-in">
      <div className="notifikasi-header">
        <h2 className="notifikasi-title">Notifikasi</h2>
        <span className="notifikasi-count">{notifications.length} notifikasi</span>
      </div>

      {notifications.length === 0 ? (
        <div className="notifikasi-empty card">
          <div className="card-body">
            <div className="empty-state-inline">
              <Bell size={32} />
              <p>Belum ada notifikasi</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="notifikasi-list">
          {notifications.map((n) => (
            <div key={n.id} className="notifikasi-item card">
              <div className="card-body">
                <div className="notifikasi-item-row">
                  <div className="notifikasi-item-icon info">
                    <Bell size={16} />
                  </div>
                  <div className="notifikasi-item-content">
                    <div className="notifikasi-item-message">{n.message}</div>
                    <div className="notifikasi-item-meta">
                      <MapPin size={12} /> {n.detail}
                    </div>
                    <div className="notifikasi-item-time">{timeAgo(n.time)}</div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
