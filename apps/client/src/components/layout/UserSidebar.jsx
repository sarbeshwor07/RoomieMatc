import React, { useContext } from "react";
import { Link, useLocation } from "react-router-dom";
import { AuthContext } from "@shared/context/AuthContext";
import Avatar from "@shared/components/common/Avatar";

export const UserSidebar = () => {
  const { currentUser } = useContext(AuthContext);
  const location = useLocation();

  if (!currentUser) return null;

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  const linkClass = (path) => {
    const base = "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200";
    return isActive(path)
      ? `${base} bg-primary-container text-on-primary-container font-bold`
      : `${base} text-on-surface-variant hover:bg-surface-variant`;
  };

  const SectionLabel = ({ children }) => (
    <p style={{ margin: "12px 0 4px 0", padding: "0 12px", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", opacity: 0.5 }}
       className="text-on-surface-variant select-none">
      {children}
    </p>
  );

  return (
    /*
      Use inline style for the sidebar container.
      height: 100% fills the parent flex row (which is overflow:hidden).
      overflow-y: auto triggers scroll when content exceeds height.
      This is the only reliable cross-browser way to get sidebar-only scroll.
    */
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
      className="hidden md:block bg-surface-container-low border-r border-outline-variant"
    >
      <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>

        {/* Profile card */}
        <Link
          to="/user/profile"
          className="flex items-center gap-3 rounded-lg border border-outline-variant hover:bg-surface-variant transition-all group"
          style={{ padding: "10px 12px", marginBottom: 4 }}
        >
          <Avatar src={currentUser.avatar} name={currentUser.name} size="md" />
          <div className="flex flex-col overflow-hidden flex-1 min-w-0">
            <span className="text-sm font-bold text-on-surface truncate group-hover:text-primary transition-colors">
              {currentUser.name}
            </span>
            <span className="text-xs flex items-center gap-0.5 mt-0.5">
              {currentUser.isVerified ? (
                <span className="text-primary flex items-center gap-0.5 font-semibold">
                  <span className="material-symbols-outlined icon-fill" style={{ fontSize: 12 }}>verified</span>
                  Verified Member
                </span>
              ) : (
                <span className="text-on-surface-variant">Unverified Account</span>
              )}
            </span>
          </div>
          <span className="material-symbols-outlined text-on-surface-variant group-hover:text-primary" style={{ fontSize: 16 }}>
            chevron_right
          </span>
        </Link>

        {/* View Full Profile button */}
        <Link
          to="/user/profile"
          className="flex items-center justify-center gap-2 rounded-lg text-white text-sm font-semibold shadow hover:opacity-90 transition-opacity"
          style={{
            padding: "8px 16px",
            marginBottom: 8,
            background: "linear-gradient(to right, #667eea, #764ba2)",
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 17 }}>person</span>
          View Full Profile
        </Link>

        {/* Dashboard */}
        <Link to="/user/dashboard" className={linkClass("/user/dashboard")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>dashboard</span>
          Dashboard
        </Link>

        {/* Discover */}
        <SectionLabel>Discover</SectionLabel>
        <Link to="/user/roommates" className={linkClass("/user/roommates")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>group</span>
          Find Roommates
        </Link>
        <Link to="/user/properties" className={linkClass("/user/properties")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>home_work</span>
          Search Properties
        </Link>
        <Link to="/user/favorites" className={linkClass("/user/favorites")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>favorite</span>
          Favorites
        </Link>

        {/* Renting */}
        <SectionLabel>Renting</SectionLabel>
        <Link to="/user/applications" className={linkClass("/user/applications")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>description</span>
          My Applications
        </Link>
        <Link to="/user/reviews" className={linkClass("/user/reviews")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>rate_review</span>
          My Reviews
        </Link>

        {/* Listing */}
        <SectionLabel>Listing</SectionLabel>
        <Link to="/user/my-properties" className={linkClass("/user/my-properties")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>home_work</span>
          My Properties
        </Link>
        <Link to="/user/my-properties/add" className={linkClass("/user/my-properties/add")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>add_box</span>
          Add Property
        </Link>
        <Link to="/user/my-properties/applications" className={linkClass("/user/my-properties/applications")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>folder_shared</span>
          Received Applications
        </Link>
        <Link to="/user/my-properties/reviews" className={linkClass("/user/my-properties/reviews")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>reviews</span>
          Property Reviews
        </Link>

        {/* Account */}
        <SectionLabel>Account</SectionLabel>
        <Link to="/user/messages" className={linkClass("/user/messages")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>chat</span>
          Messages
        </Link>
        <Link to="/user/messages?contact=admin" className={linkClass("/user/messages?contact=admin")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>support_agent</span>
          Contact Admin
        </Link>
        <Link to="/user/preferences" className={linkClass("/user/preferences")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>tune</span>
          Lifestyle Quiz
        </Link>
        <Link to="/user/verification" className={linkClass("/user/verification")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>verified_user</span>
          Verification
        </Link>
        <Link to="/user/profile" className={linkClass("/user/profile")}>
          <span className="material-symbols-outlined" style={{ fontSize: 20 }}>person</span>
          My Profile
        </Link>

        {/* Bottom breathing room */}
        <div style={{ height: 24 }} />
      </div>
    </aside>
  );
};

export default UserSidebar;
