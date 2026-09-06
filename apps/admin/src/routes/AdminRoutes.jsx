import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

// Layout wrappers
import AdminLayout from "../layouts/AdminLayout";

// Auth pages (admin needs to log in too)
import LoginPage from "../pages/auth/LoginPage";
import OtpVerificationPage from "../pages/auth/OtpVerificationPage";

// ── Admin pages ────────────────────────────────────────────────────────────────
import AdminDashboard from "../pages/admin/AdminDashboard";
import UserManagement from "../pages/admin/UserManagement";
import UserDetails from "../pages/admin/UserDetails";
import PropertyManagement from "../pages/admin/PropertyManagement";
import AdminPropertyDetails from "../pages/admin/AdminPropertyDetails";
import VerificationManagement from "../pages/admin/VerificationManagement";
import ReportsManagement from "../pages/admin/ReportsManagement";
import ReportsDetails from "../pages/admin/ReportsDetails";
import Analytics from "../pages/admin/Analytics";
import AdminNotifications from "../pages/admin/AdminNotifications";
import AdminMessages from "../pages/admin/AdminMessages";

export const AdminRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>

        {/* Login — admins must authenticate before accessing the panel */}
        <Route path="/login"      element={<LoginPage />} />
        <Route path="/verify-otp" element={<OtpVerificationPage />} />

        {/* ── Admin Panel ──────────────────────────────────────────── */}
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/messages" element={<AdminMessages />} />
          <Route path="/admin/users" element={<UserManagement />} />
          <Route path="/admin/users/:id" element={<UserDetails />} />
          <Route path="/admin/properties" element={<PropertyManagement />} />
          <Route path="/admin/properties/:id" element={<AdminPropertyDetails />} />
          <Route path="/admin/verifications" element={<VerificationManagement />} />
          <Route path="/admin/reports" element={<ReportsManagement />} />
          <Route path="/admin/reports/:id" element={<ReportsDetails />} />
          <Route path="/admin/analytics" element={<Analytics />} />
          <Route path="/admin/notifications" element={<AdminNotifications />} />
        </Route>

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />

      </Routes>
    </BrowserRouter>
  );
};

export default AdminRoutes;
