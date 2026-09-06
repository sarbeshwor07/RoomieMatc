/**
 * PropertyManagement.jsx (Admin)
 *
 * Reads all properties from GET /api/properties (admin view — all statuses).
 * Verify via PATCH /api/properties/:id/verify.
 * Delete via DELETE /api/properties/:id.
 * No mock data or localStorage.
 */
import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { apiListProperties, apiVerifyProperty, apiDeleteProperty, resolveImageUrl } from "@shared/services/api";
import Input from "@shared/components/common/Input";
import Select from "@shared/components/common/Select";
import StatusBadge from "@shared/components/common/StatusBadge";

export const PropertyManagement = () => {
  const [properties, setProperties] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");

  const [search, setSearch]         = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState("");
  const [page, setPage]             = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { page, limit: 20 };
      if (search)         params.search   = search;
      if (statusFilter)   params.status   = statusFilter;
      if (verifiedFilter) params.verified = verifiedFilter;
      const data = await apiListProperties(params);
      setProperties(data.properties || []);
      setPagination(data.pagination || null);
    } catch (err) {
      setError(err.message || "Failed to load properties.");
    } finally {
      setLoading(false);
    }
  }, [search, statusFilter, verifiedFilter, page]);

  useEffect(() => {
    const t = setTimeout(() => { setPage(1); load(); }, 400);
    return () => clearTimeout(t);
  }, [search, statusFilter, verifiedFilter]);

  useEffect(() => { load(); }, [page]);

  const handleVerify = async (propId, title) => {
    try {
      await apiVerifyProperty(propId);
      setProperties(prev =>
        prev.map(p => p.id === propId ? { ...p, is_verified: 1 } : p)
      );
    } catch (err) {
      alert(err.message || "Failed to verify property.");
    }
  };

  const handleDelete = async (propId, title) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await apiDeleteProperty(propId);
      setProperties(prev => prev.filter(p => p.id !== propId));
    } catch (err) {
      alert(err.message || "Failed to delete property.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-headline-md text-headline-md text-on-surface font-bold">Property Registry</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Review, approve, and audit property listings submitted by landlords
        </p>
      </div>

      {/* Filters */}
      <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col md:flex-row gap-4">
        <Input
          placeholder="Search title, address, city..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          icon="search"
          containerClassName="flex-1"
        />
        <div className="w-44 shrink-0">
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
            options={[
              { value: "",         label: "All Statuses" },
              { value: "active",   label: "Active" },
              { value: "rented",   label: "Rented" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        </div>
        <div className="w-44 shrink-0">
          <Select
            value={verifiedFilter}
            onChange={(e) => { setVerifiedFilter(e.target.value); setPage(1); }}
            options={[
              { value: "",      label: "All Listings" },
              { value: "false", label: "Unverified Only" },
              { value: "true",  label: "Verified Only" },
            ]}
          />
        </div>
      </section>

      {error && (
        <div className="bg-error-container/20 border border-error/40 text-error p-3 rounded-xl text-sm flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">warning</span>{error}
        </div>
      )}

      {/* Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-outline-variant/60">
            <thead className="bg-surface-container-low text-label-md font-label-md text-on-surface-variant uppercase tracking-wider text-left">
              <tr>
                <th className="px-6 py-4">Listing Details</th>
                <th className="px-6 py-4">Address</th>
                <th className="px-6 py-4">Rent</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Verified</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/60 bg-surface-container-lowest font-body-md text-body-md text-on-surface">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-on-surface-variant">
                    <span className="flex items-center justify-center gap-2">
                      <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                      Loading properties...
                    </span>
                  </td>
                </tr>
              ) : properties.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-8 text-center text-on-surface-variant">
                    No properties registered in system.
                  </td>
                </tr>
              ) : (
                properties.map((p) => (
                  <tr key={p.id} className="hover:bg-surface-container/20">
                    <td className="px-6 py-4">
                      <Link to={`/admin/properties/${p.id}`} className="flex items-center gap-3 hover:opacity-80">
                        <div className="w-14 h-12 bg-surface-container-high rounded border border-outline-variant/60 overflow-hidden shrink-0 relative">
                          {p.cover_image || (p.images && p.images[0]) ? (
                            <img
                              src={resolveImageUrl(p.cover_image || (p.images && p.images[0]))}
                              alt={p.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800";
                              }}
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-outline">
                              <span className="material-symbols-outlined text-[18px]">home</span>
                            </div>
                          )}
                          {p.images && p.images.length > 0 && (
                            <span className="absolute bottom-0 right-0 bg-black/60 text-white text-[9px] font-bold px-1 rounded-tl">
                              {p.images.length}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="font-bold block truncate max-w-xs">{p.title}</span>
                          <span className="text-xs text-outline font-semibold">
                            Owner: {p.owner_name || p.owner_id}
                          </span>
                        </div>
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-on-surface-variant truncate max-w-xs">
                      {p.address}, {p.city}
                    </td>
                    <td className="px-6 py-4 font-bold text-primary">Rs. {Number(p.price).toLocaleString()}/mo</td>
                    <td className="px-6 py-4"><StatusBadge status={p.status} /></td>
                    <td className="px-6 py-4">
                      <StatusBadge status={p.is_verified ? "verified" : "unverified"} />
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      {!p.is_verified && (
                        <button
                          onClick={() => handleVerify(p.id, p.title)}
                          className="px-3 py-1.5 border border-primary text-primary rounded-lg text-xs font-bold hover:bg-primary-container/10 transition-all"
                        >
                          Approve Listing
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(p.id, p.title)}
                        className="px-3 py-1.5 border border-error/40 text-error rounded-lg text-xs font-bold hover:bg-error-container/10 transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination && pagination.pages > 1 && (
          <div className="px-6 py-4 border-t border-outline-variant/60 flex items-center justify-between text-sm text-on-surface-variant">
            <span>{pagination.total} properties total</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-surface-container-low transition-colors"
              >
                Previous
              </button>
              <span className="font-semibold text-on-surface">Page {page} / {pagination.pages}</span>
              <button
                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                disabled={page >= pagination.pages}
                className="px-3 py-1.5 border border-outline-variant rounded-lg text-xs font-bold disabled:opacity-40 hover:bg-surface-container-low transition-colors"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PropertyManagement;
