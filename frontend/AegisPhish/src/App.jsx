import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import Register from "./pages/Register";
import Layout from "./components/Layout";
import AdminLayout from "./components/AdminLayout";  // ← Add this import
import Dashboard from "./pages/Dashboard";
import ScanURL from "./pages/ScanURL";
import Reports from "./pages/Reports";
import ScanDetails from "./pages/ScanDetails";
import Profile from "./pages/Profile";
import VerifyEmail from "./pages/VerifyEmail";

// Admin Pages
import AdminDashboard from "./pages/AdminDashboard";
import AdminScans from "./pages/AdminScans";
import AdminReports from "./pages/AdminReports";

import "./index.css";

function PrivateRoute({ children }) {
  return localStorage.getItem("token") ? children : <Navigate to="/" replace />;
}

function AdminRoute({ children }) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");
  
  if (!token) return <Navigate to="/" replace />;
  if (role !== "admin") return <Navigate to="/dashboard" replace />;
  
  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Login />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/register" element={<Register />} />

        {/* User Protected routes with User Layout */}
        <Route
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scan" element={<ScanURL />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/scan/:scanId" element={<ScanDetails />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
        </Route>

        {/* Admin Protected routes with Admin Layout */}
        <Route
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/scans" element={<AdminScans />} />
          <Route path="/admin/reports" element={<AdminReports />} />
        </Route>

        {/* Catch all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;