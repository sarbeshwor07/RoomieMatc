import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "@shared/context/AuthContext";
import { NotificationContext } from "@shared/context/NotificationContext";
import ThemeToggle from "@shared/components/common/ThemeToggle";
import Avatar from "@shared/components/common/Avatar";

/**
 * Navbar — top bar for the Client interface and public pages.
 * No admin URLs referenced anywhere in this component.
 */
export const Navbar = () => {
  const { currentUser, logout } = useContext(AuthContext);
  const { unreadCount } = useContext(NotificationContext);
  const navigate = useNavigate();

  return (
    <header className="bg-surface border-b border-outline-variant shadow-sm w-full sticky top-0 z-50 transition-colors duration-300">
      <div className="flex justify-between items-center w-full px-3 sm:px-6 py-2.5 sm:py-4 max-w-7xl mx-auto">

        {/* Brand */}
        <Link
          to={currentUser ? "/user/dashboard" : "/"}
          className="flex items-center gap-2 select-none"
        >
          <img src="/images/logo.png" alt="RoomieMatch" className="h-8 sm:h-10 w-auto" />
          <span className="font-headline-lg text-lg sm:text-headline-lg font-bold text-primary tracking-tight">
            RoomieMatch
          </span>
        </Link>

        {/* Public nav links — only when not logged in */}
        {!currentUser && (
          <nav className="hidden md:flex items-center gap-6">
            <Link
              to="/user/roommates"
              className="text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors pb-1 border-b-2 border-transparent"
            >
              Find Roommates
            </Link>
            <Link
              to="/user/properties"
              className="text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors pb-1 border-b-2 border-transparent"
            >
              Properties
            </Link>
          </nav>
        )}

        {/* Client mode badge */}
        {currentUser && (
          <span className="hidden md:flex items-center gap-1.5 bg-secondary-container text-on-secondary-container text-xs font-bold px-3 py-1 rounded-full">
            <span className="material-symbols-outlined text-[14px]">person</span>
            Client Portal
          </span>
        )}

        {/* Right-side actions */}
        <div className="flex items-center gap-2 sm:gap-4">
          {/* Theme Toggle */}
          <ThemeToggle />

          {currentUser && (
            <div className="flex items-center gap-1.5 sm:gap-4">
              {/* Contact Admin Support */}
              <Link
                to="/user/messages?contact=admin"
                className="text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors relative"
                title="Contact Support / Administrator"
              >
                <span className="material-symbols-outlined">support_agent</span>
              </Link>

              {/* Notifications */}
              <Link
                to="/user/notifications"
                className="text-on-surface-variant hover:bg-surface-container-low p-2 rounded-full transition-colors relative"
              >
                <span className="material-symbols-outlined">notifications</span>
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-error text-on-error font-bold text-[9px] rounded-full flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </Link>

              {/* User info + logout */}
              <div className="flex items-center gap-2 sm:gap-3 border-l border-outline-variant pl-2 sm:pl-4">
                <Avatar src={currentUser.avatar} name={currentUser.name} size="sm" />
                <span className="hidden lg:inline font-label-md text-label-md text-on-surface">
                  {currentUser.name}
                </span>
                <button
                  type="button"
                  onClick={() => { logout(); navigate("/"); }}
                  className="text-outline hover:text-error transition-colors p-1 cursor-pointer"
                  title="Logout"
                >
                  <span className="material-symbols-outlined">logout</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Navbar;
