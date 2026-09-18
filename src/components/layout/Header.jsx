import { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell, Menu, ChevronDown, LogOut } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../utils/api';
import './Header.css';

const pageTitles = {
  '/': 'Device',
  '/input': 'Tambah Perangkat',
  '/paket-data': 'Paket Data',
  '/notifikasi': 'Notifikasi',
  '/laporan': 'Laporan',
  '/settings': 'Settings',
  '/users': 'Manajemen User',
};

export default function Header({ onMenuClick }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const [showNotif, setShowNotif] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const dropdownRef = useRef(null);
  const userMenuRef = useRef(null);

  const title = pageTitles[location.pathname] || 'IoT SIM Manager';
  const unreadCount = notifications.length;

  const userInitials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.username?.slice(0, 2).toUpperCase() || '??';

  useEffect(() => {
    async function loadNotifications() {
      try {
        const devices = await api.get('/devices');
        setNotifications(devices.slice(0, 10).map(d => ({
          id: d.id,
          message: `${d.name} — ${d.phone}`,
          time: d.created_at,
        })));
      } catch {
        // ignore
      }
    }
    loadNotifications();
  }, [location.pathname]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowNotif(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="header">
      <div className="header-left">
        <button className="header-menu-btn" onClick={onMenuClick} aria-label="Menu">
          <Menu size={22} />
        </button>
        <h1 className="header-title">{title}</h1>
      </div>

      <div className="header-right">
        <div className="notification-dropdown-wrapper" ref={dropdownRef}>
          <button
            className="header-icon-btn"
            onClick={() => setShowNotif(!showNotif)}
            aria-label={`Notifikasi: ${unreadCount}`}
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="header-badge">{unreadCount}</span>
            )}
          </button>

          {showNotif && (
            <div className="notification-dropdown animate-slide-down">
              <div className="notification-dropdown-header">
                <span className="notification-dropdown-title">
                  Notifikasi ({unreadCount})
                </span>
              </div>
              <div className="notification-dropdown-list">
                {notifications.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--gray-400)' }}>
                    Tidak ada notifikasi
                  </div>
                ) : (
                  notifications.map(notif => (
                    <div key={notif.id} className="notification-item unread">
                      <div className="notification-item-icon info">●</div>
                      <div className="notification-item-content">
                        <div className="notification-item-message">{notif.message}</div>
                        <div className="notification-item-time">
                          {new Date(notif.time).toLocaleDateString('id-ID')}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
              <div className="notification-dropdown-footer">
                <Link to="/notifikasi" onClick={() => setShowNotif(false)}>
                  Lihat Semua Notifikasi
                </Link>
              </div>
            </div>
          )}
        </div>

        <div className="header-user-wrapper" ref={userMenuRef}>
          <button
            className="header-user-btn"
            onClick={() => setShowUserMenu(!showUserMenu)}
          >
            <div className="header-user-avatar">{userInitials}</div>
            <span className="header-user-name">{user?.full_name || user?.username}</span>
            <ChevronDown size={14} style={{ color: 'var(--gray-400)' }} />
          </button>

          {showUserMenu && (
            <div className="user-dropdown animate-slide-down">
              <div className="user-dropdown-info">
                <div className="user-dropdown-name">{user?.full_name || user?.username}</div>
                <div className="user-dropdown-role">{user?.role}</div>
              </div>
              <div className="user-dropdown-divider" />
              <button className="user-dropdown-item danger" onClick={logout}>
                <LogOut size={16} />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
