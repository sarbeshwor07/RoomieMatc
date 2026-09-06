/**
 * VerificationManagement.jsx (Admin)
 *
 * Shows ALL user identity verifications (PENDING, APPROVED, REJECTED).
 * Admin can:
 *   - View the submitted document in an embedded modal
 *   - Approve PENDING submissions
 *   - Reject PENDING submissions (with reason)
 *   - Unverify APPROVED users (revoke, with reason)
 * Also shows unverified property listings for approval.
 */
import React, { useState, useEffect, useCallback } from "react";
import {
  apiListAllVerifications,
  apiApproveVerification,
  apiRejectVerification,
  apiUnverifyUser,
  apiVerificationDocUrl,
  apiListProperties,
  apiVerifyProperty,
  apiDeleteProperty,
  resolveImageUrl,
} from "@shared/services/api";
import StatusBadge from "@shared/components/common/StatusBadge";
import Button from "@shared/components/common/Button";
import Avatar from "@shared/components/common/Avatar";
import Modal from "@shared/components/common/Modal";
import Textarea from "@shared/components/common/Textarea";
import Select from "@shared/components/common/Select";

export const VerificationManagement = () => {
  const [verifications,  setVerifications]  = useState([]);
  const [verifLoading,   setVerifLoading]   = useState(true);
  const [verifError,     setVerifError]     = useState("");
  const [statusFilter,   setStatusFilter]   = useState("PENDING");

  const [pendingProps,   setPendingProps]   = useState([]);
  const [propsLoading,   setPropsLoading]   = useState(true);

  // Action modals
  const [actionModal,    setActionModal]    = useState(null); // { type: 'reject'|'unverify', userId, name }
  const [reason,         setReason]         = useState("");
  const [actionLoading,  setActionLoading]  = useState(false);

  // Document viewer modal
  const [docModal,       setDocModal]       = useState(null); // { userId, name, docType }

  // ── Load verifications ────────────────────────────────────────────────
  const loadVerifications = useCallback(async () => {
    setVerifLoading(true);
    setVerifError("");
    try {
      const data = await apiListAllVerifications(statusFilter || null);
      setVerifications(data.verifications || []);
    } catch (err) {
      setVerifError(err.message || "Failed to load verifications.");
    } finally {
      setVerifLoading(false);
    }
  }, [statusFilter]);

  // ── Load unverified properties ─────────────────────────────────────────
  const loadPendingProps = useCallback(async () => {
    setPropsLoading(true);
    try {
      const data = await apiListProperties({ verified: "false", limit: 50 });
      setPendingProps(data.properties || []);
    } catch {
      setPendingProps([]);
    } finally {
      setPropsLoading(false);
    }
  }, []);

  useEffect(() => { loadVerifications(); }, [loadVerifications]);
  useEffect(() => { loadPendingProps(); }, [loadPendingProps]);

  // ── Approve ───────────────────────────────────────────────────────────
  const handleApprove = async (userId) => {
    setActionLoading(true);
    try {
      await apiApproveVerification(userId);
      await loadVerifications();
    } catch (err) { alert(err.message || "Failed to approve."); }
    finally { setActionLoading(false); }
  };

  // ── Open reject or unverify modal ─────────────────────────────────────
  const openActionModal = (type, userId, name) => {
    setActionModal({ type, userId, name });
    setReason("");
  };

  // ── Confirm action ────────────────────────────────────────────────────
  const handleConfirmAction = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      if (actionModal.type === "reject") {
        await apiRejectVerification(
          actionModal.userId,
          reason.trim() || "Document could not be verified. Please resubmit."
        );
      } else if (actionModal.type === "unverify") {
        await apiUnverifyUser(
          actionModal.userId,
          reason.trim() || "Verification revoked by administrator."
        );
      }
      setActionModal(null);
      await loadVerifications();
    } catch (err) { alert(err.message || "Action failed."); }
    finally { setActionLoading(false); }
  };

  // ── Property actions ──────────────────────────────────────────────────
  const handleVerifyProp = async (propId) => {
    try { await apiVerifyProperty(propId); setPendingProps(p => p.filter(x => x.id !== propId)); }
    catch (err) { alert(err.message || "Failed to verify."); }
  };

  const handleDeleteProp = async (propId, title) => {
    if (!window.confirm(`Remove "${title}"? This cannot be undone.`)) return;
    try { await apiDeleteProperty(propId); setPendingProps(p => p.filter(x => x.id !== propId)); }
    catch (err) { alert(err.message || "Failed to delete."); }
  };

  const statusOptions = [
    { value: "",         label: "All Statuses" },
    { value: "PENDING",  label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
  ];

  const statusBadge = (s) => s === "APPROVED" ? "verified" : s === "PENDING" ? "pending" : "rejected";

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <div>
        <h1 className="font-headline-md text-headline-md text-on-surface font-bold">Verifications Queue</h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Review identity documents and property listings
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── User Identity Verifications ───────────────────────────── */}
        <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/60">
            <h2 className="font-headline-sm text-headline-sm text-on-surface">
              Identity Verifications ({verifications.length})
            </h2>
            <div className="w-40">
              <Select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                options={statusOptions}
              />
            </div>
          </div>

          {verifLoading && (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant py-4">
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              Loading...
            </div>
          )}
          {verifError && <p className="text-xs text-error font-semibold">{verifError}</p>}

          {!verifLoading && verifications.length === 0 && (
            <p className="text-body-md text-on-surface-variant py-8 text-center">No verifications found.</p>
          )}

          <div className="space-y-4">
            {verifications.map((v) => (
              <div key={v.id} className="bg-surface p-4 rounded-xl border border-outline-variant space-y-3">
                {/* User info */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar name={v.name} size="sm" />
                    <div>
                      <h3 className="font-label-md text-label-md text-on-surface font-bold">{v.name}</h3>
                      <p className="text-xs text-on-surface-variant">{v.email}</p>
                    </div>
                  </div>
                  <StatusBadge status={statusBadge(v.status)} />
                </div>

                {/* Doc details + view button */}
                <div className="p-3 bg-surface-container-low rounded-lg text-xs space-y-2 font-medium text-on-surface-variant">
                  <div className="flex justify-between">
                    <span>
                      <span className="text-outline font-semibold uppercase block">Document Type</span>
                      <span className="text-on-surface font-bold">{v.document_type || "—"}</span>
                    </span>
                    <span>
                      <span className="text-outline font-semibold uppercase block">Submitted</span>
                      <span className="text-on-surface font-bold">
                        {v.submitted_at ? new Date(v.submitted_at).toLocaleDateString() : "—"}
                      </span>
                    </span>
                  </div>

                  {/* View Document button */}
                  <button
                    onClick={() => setDocModal({ userId: v.user_id, name: v.name, docType: v.document_type })}
                    className="w-full flex items-center justify-center gap-2 py-2 bg-primary/10 text-primary border border-primary/30 rounded-lg text-xs font-bold hover:bg-primary/20 transition-colors"
                  >
                    <span className="material-symbols-outlined text-[16px]">description</span>
                    View Submitted Document
                  </button>

                  {v.rejection_reason && (
                    <div className="p-2 bg-error-container/10 border border-error/20 rounded text-error text-[11px]">
                      <strong>Rejection reason:</strong> {v.rejection_reason}
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="flex justify-end gap-2">
                  {v.status === "PENDING" && (
                    <>
                      <Button variant="outline" onClick={() => openActionModal("reject", v.user_id, v.name)} disabled={actionLoading} className="px-3 py-1.5 text-xs">
                        Reject
                      </Button>
                      <Button variant="primary" onClick={() => handleApprove(v.user_id)} disabled={actionLoading} className="px-3 py-1.5 text-xs">
                        {actionLoading ? "..." : "Approve"}
                      </Button>
                    </>
                  )}
                  {v.status === "APPROVED" && (
                    <Button variant="danger" onClick={() => openActionModal("unverify", v.user_id, v.name)} disabled={actionLoading} className="px-3 py-1.5 text-xs">
                      Revoke Verification
                    </Button>
                  )}
                  {v.status === "REJECTED" && (
                    <Button variant="primary" onClick={() => handleApprove(v.user_id)} disabled={actionLoading} className="px-3 py-1.5 text-xs">
                      Re-Approve
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Property Verifications ─────────────────────────────────── */}
        <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm space-y-4">
          <h2 className="font-headline-sm text-headline-sm text-on-surface border-b border-outline-variant/60 pb-3">
            Property Verifications ({pendingProps.length})
          </h2>

          {propsLoading && (
            <div className="flex items-center gap-2 text-sm text-on-surface-variant py-4">
              <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
              Loading...
            </div>
          )}

          {!propsLoading && pendingProps.length === 0 && (
            <p className="text-body-md text-on-surface-variant py-8 text-center">No properties pending verification.</p>
          )}

          <div className="space-y-4">
            {pendingProps.map((prop) => (
              <div key={prop.id} className="bg-surface p-4 rounded-xl border border-outline-variant space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-16 h-12 bg-surface-container-high rounded-lg border border-outline-variant/60 overflow-hidden shrink-0">
                    {prop.cover_image || prop.images?.[0] ? (
                      <img
                        src={resolveImageUrl(prop.cover_image || prop.images[0])}
                        alt={prop.title}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-outline">
                        <span className="material-symbols-outlined text-[18px]">home</span>
                      </div>
                    )}
                  </div>
                  <div>
                    <h3 className="font-label-md text-label-md text-on-surface font-bold truncate max-w-xs">{prop.title}</h3>
                    <p className="text-xs text-on-surface-variant font-semibold">
                      {prop.owner_name} · Rs. {Number(prop.price).toLocaleString()}/mo
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-surface-container-low rounded-lg text-xs space-y-1 font-medium text-on-surface-variant">
                  <div>
                    <span className="text-outline font-semibold uppercase block">Address</span>
                    <span className="text-on-surface font-bold">{prop.address}, {prop.city}</span>
                  </div>
                  <div>
                    <span className="text-outline font-semibold uppercase block">Specs</span>
                    <span className="text-on-surface font-bold">{prop.bedrooms} Bed · {prop.bathrooms} Bath · {prop.type}</span>
                  </div>
                </div>

                {/* Images strip */}
                {prop.images && prop.images.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {prop.images.map((img, i) => (
                      <img
                        key={i}
                        src={resolveImageUrl(img)}
                        alt=""
                        className="w-20 h-14 object-cover rounded-lg border border-outline-variant shrink-0"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="outline" onClick={() => handleDeleteProp(prop.id, prop.title)} className="px-3 py-1.5 text-xs">
                    Reject Listing
                  </Button>
                  <Button variant="primary" onClick={() => handleVerifyProp(prop.id)} className="px-3 py-1.5 text-xs">
                    Verify Listing
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Document Viewer Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={!!docModal}
        onClose={() => setDocModal(null)}
        title={`Document — ${docModal?.name}`}
        footer={<Button variant="primary" onClick={() => setDocModal(null)}>Close</Button>}
      >
        {docModal && (
          <div className="space-y-3">
            <p className="text-sm text-on-surface-variant">
              Document type: <strong>{docModal.docType}</strong>
            </p>
            <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-low">
              {/* Try to render as image first; fallback to iframe for PDFs */}
              <img
                src={`${apiVerificationDocUrl(docModal.userId)}?token=${localStorage.getItem("roomiematch_jwt")}`}
                alt="Verification document"
                className="w-full max-h-[500px] object-contain"
                onError={(e) => {
                  // If image fails (PDF), show iframe
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "block";
                }}
              />
              <iframe
                src={`${apiVerificationDocUrl(docModal.userId)}?token=${localStorage.getItem("roomiematch_jwt")}`}
                title="Verification Document"
                className="w-full h-[500px]"
                style={{ display: "none" }}
              />
            </div>
            <p className="text-[10px] text-outline text-center">
              This document is served through a secured, admin-only endpoint.
            </p>
          </div>
        )}
      </Modal>

      {/* ── Action Modal (Reject / Unverify) ─────────────────────────── */}
      <Modal
        isOpen={!!actionModal}
        onClose={() => setActionModal(null)}
        title={actionModal?.type === "unverify" ? "Revoke Verification" : "Reject Verification"}
        footer={
          <>
            <Button variant="outline" onClick={() => setActionModal(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleConfirmAction} disabled={actionLoading}>
              {actionLoading ? "Processing..." : actionModal?.type === "unverify" ? "Revoke" : "Confirm Rejection"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-body-md text-on-surface-variant">
            {actionModal?.type === "unverify"
              ? <>Revoking verification for <strong>{actionModal?.name}</strong>. They will need to resubmit their document.</>
              : <>Rejecting verification for <strong>{actionModal?.name}</strong>. Provide a reason so they know what to fix.</>
            }
          </p>
          <Textarea
            label="Reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={actionModal?.type === "unverify"
              ? "e.g. Document appears fraudulent. Please resubmit authentic documentation."
              : "e.g. Document is blurry. Please upload a clear photo of your ID."}
            rows={3}
          />
        </div>
      </Modal>
    </div>
  );
};

export default VerificationManagement;
