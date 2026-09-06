/**
 * Favorites.jsx
 *
 * Lists saved properties from GET /api/favourites (real API).
 * Remove calls DELETE /api/favourites/:propertyId.
 * No localStorage, no currentUser.favorites array.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiListFavourites, apiRemoveFavourite, resolveImageUrl } from "@shared/services/api";
import { formatCurrency } from "@shared/utils/currency";
import EmptyState from "@shared/components/common/EmptyState";

export const Favorites = () => {
  const [favourites, setFavourites] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiListFavourites();
      setFavourites(data.favourites || []);
    } catch (err) {
      setError(err.message || "Failed to load favourites.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRemove = async (propertyId, e) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await apiRemoveFavourite(propertyId);
      // Optimistic remove
      setFavourites(prev => prev.filter(f => f.id !== propertyId));
    } catch (err) {
      alert(err.message || "Failed to remove favourite.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant gap-2">
        <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
        Loading your favourites...
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
      <div>
        <h1 className="font-headline-md text-headline-md text-on-surface">My Saved Listings</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Properties you have bookmarked for later
        </p>
      </div>

      {favourites.length === 0 ? (
        <EmptyState
          icon="favorite"
          title="No saved properties yet"
          description="Browse available properties near campus and tap the heart icon to save them here."
          actionText="Find Properties"
          onActionClick={() => { window.location.href = "/user/properties"; }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {favourites.map(prop => {
            // API: cover_image is the primary image URL
            const imgSrc = prop.cover_image || prop.images?.[0] || null;

            return (
              <Link
                key={prop.id}
                to={`/user/properties/${prop.id}`}
                className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden flex flex-col hover:shadow-md transition-shadow relative group"
              >
                <div className="relative h-48 w-full bg-surface-container">
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

                  <button
                    onClick={e => handleRemove(prop.id, e)}
                    className="absolute top-3 right-3 p-2 bg-surface-container-lowest/90 hover:bg-surface-container-lowest border border-outline-variant rounded-full text-error shadow-sm select-none"
                    title="Remove from favourites"
                  >
                    <span className="material-symbols-outlined text-[20px] icon-fill">favorite</span>
                  </button>
                </div>

                <div className="p-5 flex-grow flex flex-col justify-between gap-4">
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold group-hover:text-primary transition-colors truncate">
                      {prop.title}
                    </h3>
                    <p className="text-body-md text-on-surface-variant font-medium mt-1 truncate">
                      {prop.address}, {prop.city}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-on-surface-variant font-medium mt-3">
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">bed</span>
                        {prop.bedrooms} Bed
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="material-symbols-outlined text-sm">bathtub</span>
                        {prop.bathrooms} Bath
                      </span>
                      <span className="capitalize">{prop.type}</span>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-outline-variant/60 flex justify-between items-center">
                    <div>
                      <span className="font-headline-md text-headline-md text-primary font-bold">
                        {formatCurrency(prop.price)}
                      </span>
                      <span className="text-xs text-outline font-medium">/month</span>
                    </div>
                    <span className="text-xs text-primary font-bold flex items-center gap-0.5">
                      View Details
                      <span className="material-symbols-outlined text-[16px]">chevron_right</span>
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Favorites;
