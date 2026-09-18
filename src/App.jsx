import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import DeviceList from './pages/DeviceList';
import DeviceForm from './pages/DeviceForm';
import PaketData from './pages/PaketData';
import Notifikasi from './pages/Notifikasi';
import Laporan from './pages/Laporan';
import Settings from './pages/Settings';
import UserManagement from './pages/UserManagement';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <Navigate to="/" replace /> : children;
}

function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<PublicRoute><Login /></PublicRoute>} />
          <Route element={<PrivateRoute><AppLayout /></PrivateRoute>}>
            <Route path="/" element={<DeviceList />} />
            <Route path="/input" element={<DeviceForm />} />
            <Route path="/edit/:id" element={<DeviceForm />} />
            <Route path="/paket-data" element={<PaketData />} />
            <Route path="/notifikasi" element={<Notifikasi />} />
            <Route path="/laporan" element={<Laporan />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}
