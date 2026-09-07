import React, { useContext } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { AuthContext } from "@shared/context/AuthContext";
import Navbar from "../components/layout/Navbar";
import UserSidebar from "../components/layout/UserSidebar";

export const UserLayout = () => {
  const { currentUser, authLoading } = useContext(AuthContext);

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="flex flex-col items-center gap-3">
          <span className="material-symbols-outlined text-primary text-5xl animate-spin">progress_activity</span>
          <p className="text-on-surface-variant text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) return <Navigate to="/login" replace />;
  if (currentUser.role === "admin") return <Navigate to="/login" replace />;

  return (
    /*
      Root: exactly 100vh, no overflow — bounds the layout to the viewport.
      header: sticky top-0 (already set in Navbar via className)
      row: flex:1 now has a real bounded height to measure against
      sidebar: height:100% + overflowY:auto → independent scroll
      main: flex:1 + overflowY:auto → independent scroll
    */
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <Navbar />
      <div style={{ display: "flex", flex: 1, overflow: "hidden", minHeight: 0 }}>
        <UserSidebar />
        <main style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }} className="bg-surface p-2 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default UserLayout;
