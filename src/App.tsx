import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ToastProvider } from './components/ui/Toast';
import { ProtectedRoute } from './components/ProtectedRoute';
import { RoleGate } from './components/RoleGate';
import { AppLayout } from './components/layout/AppLayout';

import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import AdminDashboard from './pages/admin/Dashboard';
import CreateOpportunity from './pages/admin/CreateOpportunity';
import AdminOpportunityDetail from './pages/admin/OpportunityDetail';
import VendorManagement from './pages/admin/VendorManagement';
import VendorDashboard from './pages/vendor/Dashboard';
import VendorOpportunityDetail from './pages/vendor/OpportunityDetail';

function RootRedirect() {
  const { profile, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-gray-50"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div></div>;
  if (!profile) return <Navigate to="/login" replace />;
  return <Navigate to={profile.role === 'admin' ? '/admin' : '/vendor'} replace />;
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Root redirect */}
            <Route path="/" element={<ProtectedRoute><RootRedirect /></ProtectedRoute>} />

            {/* Admin routes */}
            <Route element={<ProtectedRoute><RoleGate allowedRole="admin"><AppLayout /></RoleGate></ProtectedRoute>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/opportunities/new" element={<CreateOpportunity />} />
              <Route path="/admin/opportunities/:id" element={<AdminOpportunityDetail />} />
              <Route path="/admin/opportunities/:id/edit" element={<CreateOpportunity />} />
              <Route path="/admin/vendors" element={<VendorManagement />} />
            </Route>

            {/* Vendor routes */}
            <Route element={<ProtectedRoute><RoleGate allowedRole="vendor"><AppLayout /></RoleGate></ProtectedRoute>}>
              <Route path="/vendor" element={<VendorDashboard />} />
              <Route path="/vendor/opportunities/:id" element={<VendorOpportunityDetail />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
