/**
 * MyProperties.jsx
 *
 * Lists the current user's own properties from the real API.
 * Filters by ownerId = currentUser.id via GET /api/properties?ownerId=...
 * Toggle status calls PATCH /api/properties/:id/status.
 * Delete calls DELETE /api/properties/:id.
 * Images use cover_image (from API) with fallback.
 */
import React, { useContext } from "react";
import { Link } from "react-router-dom";
import { AuthContext } from "@shared/context/AuthContext";
import { useProperties } from "@shared/hooks/useProperties";
import { apiUpdatePropertyStatus, resolveImageUrl } from "@shared/services/api";
import StatusBadge from "@shared/components/common/StatusBadge";
import EmptyState from "@shared/components/common/EmptyState";

export const MyProperties = () => {
  const { currentUser } = useContext(AuthContext);

  // Pass ownerId so the hook fetches only this user's properties (all statuses)
  const { properties, loading, error, deleteProperty, reload } = useProperties(
    currentUser?.id ? { ownerId: currentUser.id } : {}
  );

  const handleToggleStatus = async (prop) => {
    const nextStatus = prop.status === "active" ? "inactive" : "active";
    try {
      await apiUpdatePropertyStatus(prop.id, nextStatus);
      reload();
    } catch (err) {
      alert(err.message || "Failed to update status.");
    }
  };

  const handleDelete = async (propId, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await deleteProperty(propId);
    } catch (err) {
      alert(err.message || "Failed to delete property.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant gap-2">
        <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
        Loading your properties...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-error-container/20 border border-error/40 text-error p-4 rounded-xl text-sm">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-headline-md text-headline-md text-on-surface font-bold">My Properties</h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            Register and manage your rental listings
          </p>
        </div>
        <Link
          to="/user/my-properties/add"
          className="bg-primary text-on-primary font-label-md text-label-md px-5 py-2.5 rounded-lg hover:bg-surface-tint transition-all flex items-center gap-1 select-none"
        >
          <span className="material-symbols-outlined text-[20px]">add</span>
          Add Property
        </Link>
      </div>

      {properties.length === 0 ? (
        <EmptyState
          icon="home"
          title="No properties listed yet"
          description="Register your first rental unit to receive student housing applications."
          actionText="Add a Property"
          onActionClick={() => { window.location.href = "/user/my-properties/add"; }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((prop) => {
            // API returns cover_image (primary) and images[] array
            const imgSrc = prop.cover_image || prop.images?.[0] || null;
            const verified = prop.is_verified === 1 || prop.is_verified === true;

            return (
              <div
                key={prop.id}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden flex flex-col hover:shadow-sm transition-shadow"
              >
                {/* Image banner */}
                <div className="relative h-44 bg-surface-container">
                  {imgSrc ? (
                    <img
                      src={resolveImageUrl(imgSrc)}
                      alt={prop.title}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                        e.currentTarget.nextElementSibling?.classList.remove("hidden");
                      }}
                    />
                  ) : null}
                  <div className={`w-full h-full flex items-center justify-center text-outline ${imgSrc ? "hidden" : ""}`}>
                    <span className="material-symbols-outlined text-[48px]">home_work</span>
                  </div>

                  <div className="absolute top-3 left-3">
                    <StatusBadge status={prop.status} />
                  </div>

                  {verified && (
                    <div className="absolute top-3 right-3 bg-secondary-container text-on-secondary-container px-2 py-0.5 rounded-md border border-secondary font-label-sm text-label-sm font-bold flex items-center gap-0.5 uppercase tracking-wider">
                      <span className="material-symbols-outlined text-[14px] icon-fill">verified</span>
                      Verified
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="p-5 space-y-4 flex-grow flex flex-col justify-between">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold truncate">
                      {prop.title}
                    </h3>
                    <p className="text-body-md text-on-surface-variant font-medium mt-1 truncate">
                      {prop.address}, {prop.city}
                    </p>
                    <div className="flex items-center gap-4 text-xs font-semibold text-outline mt-3">
                      <span>{prop.bedrooms} Bed</span>
                      <span>{prop.bathrooms} Bath</span>
                      <span>{prop.type}</span>
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="pt-4 border-t border-outline-variant/60 flex items-center justify-between gap-2">
                    <span className="font-headline-sm text-headline-sm text-primary font-bold">
                      Rs. {Number(prop.price).toLocaleString()}<span className="text-xs text-outline font-normal">/mo</span>
                    </span>

                    <div className="flex items-center gap-1">
                      <Link
                        to={`/user/my-properties/${prop.id}`}
                        className="p-2 border border-outline text-primary rounded-lg hover:bg-surface-container-low transition-colors"
                        title="View Property"
                      >
                        <span className="material-symbols-outlined text-[20px]">visibility</span>
                      </Link>

                      <button
                        onClick={() => handleToggleStatus(prop)}
                        className={`p-2 border rounded-lg transition-colors ${
                          prop.status === "active"
                            ? "border-outline text-outline hover:bg-surface-container-high"
                            : "border-primary text-primary hover:bg-primary-container/10"
                        }`}
                        title={prop.status === "active" ? "Deactivate Listing" : "Activate Listing"}
                      >
                        <span className="material-symbols-outlined text-[20px]">
                          {prop.status === "active" ? "visibility_off" : "visibility"}
                        </span>
                      </button>

                      <Link
                        to={`/user/my-properties/${prop.id}/edit`}
                        className="p-2 border border-outline text-primary rounded-lg hover:bg-surface-container-low transition-colors"
                        title="Edit Property"
                      >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                      </Link>

                      <button
                        onClick={() => handleDelete(prop.id, prop.title)}
                        className="p-2 border border-error/40 text-error rounded-lg hover:bg-error-container/10 transition-colors"
                        title="Delete Property"
                      >
                        <span className="material-symbols-outlined text-[20px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyProperties;
