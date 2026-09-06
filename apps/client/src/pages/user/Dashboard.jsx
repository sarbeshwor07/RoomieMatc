import React, { useContext } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthContext } from "@shared/context/AuthContext";
import { useProperties } from "@shared/hooks/useProperties";
import { useRoommates } from "@shared/hooks/useRoommates";
import { useApplications } from "@shared/hooks/useApplications";
import { useMessages } from "@shared/hooks/useMessages";
import { formatCurrency } from "@shared/utils/currency";
import Avatar from "@shared/components/common/Avatar";
import StatusBadge from "@shared/components/common/StatusBadge";
import { resolveImageUrl } from "@shared/services/api";

export const TenantDashboard = () => {
  const { currentUser } = useContext(AuthContext);
  const { properties } = useProperties();
  const { candidates, getCompatibility } = useRoommates();
  const { applications } = useApplications();
  const { getOrCreateThread } = useMessages();
  const navigate = useNavigate();

  // 1. Get Roommates compatibility
  const roommatesWithCompat = candidates.map(c => ({
    ...c,
    compat: getCompatibility(c.id)
  })).sort((a, b) => b.compat.compatibilityScore - a.compat.compatibilityScore);

  // 2. Filter user applications (API returns tenant_id, fallback for tenant_id field)
  const userApps = applications.filter(app =>
    (app.tenant_id || app.tenantId) === currentUser?.id
  );

  // 3. Recommended properties — API returns is_verified (int), legacy uses isVerified (bool)
  const recommendedProps = properties
    .filter(p => (p.is_verified || p.isVerified) && p.status === "active")
    .slice(0, 3);

  const handleChatWithRoommate = async (roommateId) => {
    const threadId = await getOrCreateThread(roommateId);
    if (threadId) navigate(`/user/messages?thread=${threadId}`);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Welcome Banner */}
      <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface">
            Welcome back, {currentUser?.name}!
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {currentUser?.university
              ? `${currentUser.university} · Active Profile`
              : "Welcome to RoomieMatch"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-label-md text-label-md text-on-surface-variant font-bold">Status:</span>
          {currentUser?.isVerified ? (
            <span className="bg-secondary-container text-on-secondary-container px-3 py-1 rounded-full font-label-sm text-label-sm border border-secondary flex items-center gap-1 font-semibold uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px] icon-fill">verified</span>
              Verified Student
            </span>
          ) : (
            <span className="bg-surface-container-highest text-on-surface-variant px-3 py-1 rounded-full font-label-sm text-label-sm border border-outline-variant flex items-center gap-1 font-semibold uppercase tracking-wider">
              <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
              Verification Pending
            </span>
          )}
        </div>
      </section>

      {/* Main Grid: Left Column (Matches & Recommendations), Right Column (Verification & Applications) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Columns (Col Span 2) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Top Roommate Matches */}
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Top Roommate Matches
              </h2>
              <Link to="/user/roommates" className="text-primary font-label-md text-label-md hover:underline font-semibold flex items-center gap-1">
                View all roommates
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {roommatesWithCompat.slice(0, 2).map((roommate) => (
                <div key={roommate.id} className="bg-surface p-4 rounded-xl border border-outline-variant flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="flex items-start gap-4">
                    <Avatar src={roommate.avatar} name={roommate.name} size="lg" />
                    <div>
                      <h3 className="font-label-md text-label-md text-on-surface font-bold">
                        {roommate.name}
                      </h3>
                      <p className="font-label-sm text-label-sm text-on-surface-variant mt-0.5">
                        {roommate.age} y/o &bull; {roommate.major}
                      </p>
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="bg-secondary-container text-on-secondary-container text-[11px] font-bold px-2 py-0.5 rounded-full">
                          {roommate.compat.compatibilityScore}% Compatible
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-4 pt-3 border-t border-outline-variant flex justify-between items-center">
                    <span className="text-xs text-outline font-medium">
                      Budget: {
                        roommate.budget_min && roommate.budget_max
                          ? `Rs. ${Number(roommate.budget_min).toLocaleString()} - Rs. ${Number(roommate.budget_max).toLocaleString()}`
                          : roommate.budget || "Not specified"
                      }
                    </span>
                    <button
                      onClick={() => handleChatWithRoommate(roommate.id)}
                      className="bg-primary text-on-primary font-label-sm text-label-sm px-3.5 py-1.5 rounded-lg hover:bg-surface-tint transition-colors flex items-center gap-1 select-none"
                    >
                      <span className="material-symbols-outlined text-sm">chat</span>
                      Chat
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Recommended Properties */}
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-headline-sm text-headline-sm text-on-surface">
                Recommended Properties
              </h2>
              <Link to="/user/properties" className="text-primary font-label-md text-label-md hover:underline font-semibold flex items-center gap-1">
                View all properties
                <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {recommendedProps.map((prop) => (
                <div key={prop.id} className="bg-surface rounded-xl border border-outline-variant overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div className="relative h-40 bg-surface-container">
                    {prop.cover_image || prop.images?.[0] ? (
                      <img
                        src={resolveImageUrl(prop.cover_image || prop.images?.[0])}
                        alt={prop.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-outline">
                        <span className="material-symbols-outlined text-[36px]">home_work</span>
                      </div>
                    )}
                    <div className="absolute top-2 right-2 bg-surface-container-lowest/90 px-2 py-0.5 rounded-md font-label-sm text-label-sm border border-outline-variant">
                      {prop.type}
                    </div>
                  </div>
                  
                  <div className="p-4 flex-grow flex flex-col justify-between gap-3">
                    <div>
                      <h3 className="font-label-md text-label-md text-on-surface font-bold truncate" title={prop.title}>
                        {prop.title}
                      </h3>
                      <p className="text-xs text-on-surface-variant truncate mt-0.5">{prop.address}</p>
                      <p className="font-headline-sm text-headline-sm text-primary mt-2 font-bold">{formatCurrency(prop.price)}<span className="text-xs text-on-surface-variant font-normal">/month</span></p>
                    </div>

                    <Link
                      to={`/user/properties/${prop.id}`}
                      className="w-full text-center border border-outline text-primary font-label-sm text-label-sm py-2 rounded-lg hover:bg-surface-container-low transition-colors block"
                    >
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

        </div>

        {/* Right Column (Col Span 1) */}
        <div className="space-y-6">
          
          {/* Student ID Verification Checklist */}
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">
              Profile Verification
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <span className="material-symbols-outlined text-secondary icon-fill mt-0.5">check_circle</span>
                <div>
                  <h4 className="font-label-md text-label-md text-on-surface font-semibold">Email Verified</h4>
                  <p className="text-xs text-on-surface-variant">Validated via school registrar email</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                {currentUser?.isVerified ? (
                  <span className="material-symbols-outlined text-secondary icon-fill mt-0.5">check_circle</span>
                ) : (
                  <span className="material-symbols-outlined text-outline mt-0.5">radio_button_unchecked</span>
                )}
                <div>
                  <h4 className="font-label-md text-label-md text-on-surface font-semibold">ID Documentation</h4>
                  <p className="text-xs text-on-surface-variant">Upload student ID or lease documentation</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                {currentUser?.preferences ? (
                  <span className="material-symbols-outlined text-secondary icon-fill mt-0.5">check_circle</span>
                ) : (
                  <span className="material-symbols-outlined text-outline mt-0.5">radio_button_unchecked</span>
                )}
                <div>
                  <h4 className="font-label-md text-label-md text-on-surface font-semibold">Lifestyle Quiz Complete</h4>
                  <p className="text-xs text-on-surface-variant">Answer roommate preferences</p>
                </div>
              </div>

              {!currentUser?.isVerified && (
                <Link
                  to="/user/verification"
                  className="w-full text-center bg-primary text-on-primary font-label-md text-label-md py-3 rounded-lg hover:bg-surface-tint transition-all block mt-6"
                >
                  Verify Your Account
                </Link>
              )}
            </div>
          </section>

          {/* Active Applications Status */}
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">
              Recent Applications
            </h2>
            <div className="space-y-4">
              {userApps.length === 0 ? (
                <p className="text-body-md text-on-surface-variant">You have no active rental applications.</p>
              ) : (
                userApps.slice(0, 3).map((app) => {
                  const property = properties.find(p => p.id === (app.property_id || app.propertyId));
                  const appStatus = app.status;
                  const appDate   = app.applied_at || app.appliedAt;
                  return (
                    <div key={app.id} className="border-b border-outline-variant/60 pb-3 last:border-b-0 last:pb-0">
                      <div className="flex justify-between items-start gap-2">
                        <Link to={`/user/properties/${property?.id || app.property_id || app.propertyId}`} className="font-label-md text-label-md text-on-surface hover:text-primary font-bold truncate">
                          {property?.title || app.property_title || "Property"}
                        </Link>
                        <StatusBadge status={appStatus} />
                      </div>
                      <p className="text-xs text-outline mt-1">
                        Applied on: {new Date(appDate).toLocaleDateString()}
                      </p>
                      <Link to="/user/applications" className="text-xs text-primary hover:underline font-semibold mt-2 block">
                        View Application History &rarr;
                      </Link>
                    </div>
                  );
                })
              )}
            </div>
          </section>

        </div>

      </div>
    </div>
  );
};

export default TenantDashboard;
