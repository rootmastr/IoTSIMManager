import { NavLink, useLocation } from 'react-router-dom';
import {
  Cpu,
  Wifi,
  Bell,
  BarChart3,
  Settings,
  Users,
  LogOut,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import './Sidebar.css';

const navItems = [
  { to: '/', icon: Cpu, label: 'Device' },
  { to: '/paket-data', icon: Wifi, label: 'Paket Data' },
  { to: '/notifikasi', icon: Bell, label: 'Notifikasi' },
  { to: '/laporan', icon: BarChart3, label: 'Laporan' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

const adminItems = [
  { to: '/users', icon: Users, label: 'Manajemen User' },
];

export default function Sidebar({ isOpen, onClose }) {
  const location = useLocation();
  const { user, logout } = useAuth();

  const userInitials = user?.full_name
    ? user.full_name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
    : user?.username?.slice(0, 2).toUpperCase() || '??';

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Wifi size={20} />
          </div>
          <div className="sidebar-brand-text">
            <span className="sidebar-brand-title">IoT SIM Manager</span>
            <span className="sidebar-brand-subtitle">v2.0</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <span className="sidebar-section-label">Menu Utama</span>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.to);

            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`sidebar-link ${isActive ? 'active' : ''}`}
                onClick={onClose}
              >
                <Icon className="sidebar-link-icon" size={20} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          {user?.role === 'admin' && (
            <>
              <span className="sidebar-section-label" style={{ marginTop: 'var(--space-4)' }}>Admin</span>
              {adminItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname.startsWith(item.to);
                return (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={`sidebar-link ${isActive ? 'active' : ''}`}
                    onClick={onClose}
                  >
                    <Icon className="sidebar-link-icon" size={20} />
                    <span>{item.label}</span>
                  </NavLink>
                );
              })}
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="sidebar-user-avatar">{userInitials}</div>
            <div className="sidebar-user-info">
              <span className="sidebar-user-name">{user?.full_name || user?.username}</span>
              <span className="sidebar-user-role">{user?.role}</span>
            </div>
            <button className="sidebar-logout-btn" onClick={logout} title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
