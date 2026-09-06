import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "@shared/context/AuthContext";
import { SocketContext } from "@shared/context/SocketContext";
import Avatar from "@shared/components/common/Avatar";

export const Sidebar = () => {
  const { currentUser } = useContext(AuthContext);
  const socketCtx = useContext(SocketContext);
  const unreadMessagesCount = (socketCtx?.conversations || []).reduce(
    (sum, c) => sum + (c.unread_count || 0),
    0
  );
  const location = useLocation();

  if (!currentUser || currentUser.role !== "admin") return null;

  const isActive = (path) => location.pathname === path;

  const linkClass = (path) => {
    const base = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200";
    return isActive(path)
      ? `${base} bg-primary-container text-on-primary-container font-bold`
      : `${base} text-on-surface-variant hover:bg-surface-variant`;
  };

  return (
    <aside
      style={{
        width: 255,
        minWidth: 255,
        height: "100%",
        minHeight: 0,
        overflowY: "auto",
        overflowX: "hidden",
        flexShrink: 0,
      }}
      className="hidden md:block admin-sidebar bg-surface-container-low border-r border-outline-variant"
    >
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>

        {/* Profile card */}
        <div
          className="flex items-center gap-3 rounded-lg border border-outline-variant"
          style={{ padding: "10px 12px", marginBottom: 8 }}
        >
          <Avatar src={currentUser.avatar} name={currentUser.name} size="md" />
          <div className="flex flex-col overflow-hidden">
            <span className="text-sm font-bold text-on-surface truncate">
              {currentUser.name}
            </span>
            <span className="text-primary flex items-center gap-0.5 text-xs font-semibold mt-0.5">
              <span className="material-symbols-outlined icon-fill" style={{ fontSize: 13 }}>
                admin_panel_settings
              </span>
              Administrator
            </span>
          </div>
        </div>

        {/* Nav links */}
        <Link to="/admin/dashboard" className={linkClass("/admin/dashboard")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>dashboard</span>
          Dashboard Overview
        </Link>
        <Link to="/admin/messages" className={linkClass("/admin/messages")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chat</span>
          <span className="flex-1">Messages</span>
          {unreadMessagesCount > 0 && (
            <span className="bg-primary text-on-primary text-[10px] font-bold px-2 py-0.5 rounded-full ml-auto">
              {unreadMessagesCount}
            </span>
          )}
        </Link>
        <Link to="/admin/users" className={linkClass("/admin/users")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>group</span>
          User Management
        </Link>
        <Link to="/admin/properties" className={linkClass("/admin/properties")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>home_work</span>
          Property Registry
        </Link>
        <Link to="/admin/verifications" className={linkClass("/admin/verifications")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>verified_user</span>
          Verifications Queue
        </Link>
        <Link to="/admin/reports" className={linkClass("/admin/reports")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>flag</span>
          Reports Panel
        </Link>
        <Link to="/admin/analytics" className={linkClass("/admin/analytics")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>analytics</span>
          Analytics Reports
        </Link>
        <Link to="/admin/notifications" className={linkClass("/admin/notifications")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>notifications</span>
          Notifications Board
        </Link>

        <div style={{ height: 24 }} />
      </div>
    </aside>
  );
};

export default Sidebar;
