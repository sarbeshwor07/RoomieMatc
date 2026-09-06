/**
 * UserDetails.jsx (Admin)
 *
 * - View user profile and verification document
 * - Verify / Unverify toggle switch (instant, no modal)
 * - Edit user info inline via Edit modal
 * - Block / Unblock / Delete
 */
import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import {
  apiGetUser,
  apiApproveVerification,
  apiUnverifyUser,
  apiRejectVerification,
  apiUpdateUser,
  apiDeleteUser,
  apiBlockUser,
  apiUnblockUser,
  apiVerificationDocUrl,
  apiGetOrCreateConversation,
} from "@shared/services/api";
import Avatar from "@shared/components/common/Avatar";
import Button from "@shared/components/common/Button";
import StatusBadge from "@shared/components/common/StatusBadge";
import Modal from "@shared/components/common/Modal";
import Textarea from "@shared/components/common/Textarea";
import Input from "@shared/components/common/Input";
import Select from "@shared/components/common/Select";

export const UserDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [docModalOpen, setDocModalOpen] = useState(false);

  // Reject modal (for PENDING docs)
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  // Edit user modal
  const [editModal, setEditModal] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Message user state
  const [msgLoading, setMsgLoading] = useState(false);
  const handleMessageUser = async () => {
    if (!user?.id) return;
    setMsgLoading(true);
    try {
      const data = await apiGetOrCreateConversation(user.id);
      const convId = data.conversation.id;
      navigate(`/admin/messages?thread=${convId}`);
    } catch (err) {
      alert(err.message || "Failed to start conversation with user.");
    } finally {
      setMsgLoading(false);
    }
  };

  useEffect(() => {
    apiGetUser(id)
      .then((data) => setUser(data.user))
      .catch((err) => setPageError(err.message || "User not found."))
      .finally(() => setLoading(false));
  }, [id]);

  // ── Verify toggle ─────────────────────────────────────────────────────────
  const getVerifyBlockReasons = (u) => {
    if (!u) return [];
    const reasons = [];
    if (!u.age || Number(u.age) < 18) {
      reasons.push(
        u.age
          ? `Age is ${u.age} — must be 18 or older`
          : "Age not provided (must be 18+)",
      );
    }
    if (!u.profile_image && !u.avatar) reasons.push("Profile photo missing");
    if (!u.name?.trim()) reasons.push("Name not set");
    const docStatus = u.verificationDoc?.status;
    if (docStatus !== "PENDING" && docStatus !== "APPROVED") {
      reasons.push("No verification document submitted");
    }
    return reasons;
  };

  const handleVerifyToggle = async () => {
    if (actionLoading) return;
    const isNowVerified = user.is_verified === 1 || user.is_verified === true;

    if (!isNowVerified) {
      const blockReasons = getVerifyBlockReasons(user);
      if (blockReasons.length > 0) {
        alert(
          "Cannot verify this user. Requirements not met:\n\n• " +
            blockReasons.join("\n• "),
        );
        return;
      }
    }

    setActionLoading(true);
    try {
      if (isNowVerified) {
        // Turn OFF — unverify immediately, no modal
        await apiUnverifyUser(id, "Verification toggled off by administrator.");
        setUser((prev) => ({ ...prev, is_verified: 0 }));
      } else {
        // Turn ON — approve immediately
        await apiApproveVerification(id);
        setUser((prev) => ({ ...prev, is_verified: 1 }));
      }
    } catch (err) {
      alert(err.message || "Failed to update verification.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Reject docs ───────────────────────────────────────────────────────────
  const handleReject = async () => {
    setActionLoading(true);
    try {
      await apiRejectVerification(
        id,
        rejectReason.trim() || "Document could not be verified.",
      );
      setRejectModal(false);
      setUser((prev) => ({ ...prev, is_verified: 0 }));
    } catch (err) {
      alert(err.message || "Failed to reject.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Open edit modal ───────────────────────────────────────────────────────
  const openEdit = () => {
    setEditFields({
      name: user.name || "",
      phone: user.phone || "",
      university: user.university || "",
      major: user.major || "",
      city: user.city || "",
      age: user.age || "",
      gender: user.gender || "",
      bio: user.bio || "",
    });
    setEditError("");
    setEditModal(true);
  };

  // ── Save edits ────────────────────────────────────────────────────────────
  const handleEditSave = async () => {
    if (!editFields.name?.trim()) {
      setEditError("Name is required.");
      return;
    }
    if (editFields.phone?.trim()) {
      const digits = editFields.phone
        .trim()
        .replace(/\D/g, "")
        .replace(/^(977|0)/, "");
      if (!/^\+?[\d\s\-().]{7,20}$/.test(editFields.phone.trim())) {
        setEditError("Phone contains invalid characters.");
        return;
      }
      if (digits.length !== 10) {
        setEditError("Local phone number must be exactly 10 digits.");
        return;
      }
    }
    setEditLoading(true);
    setEditError("");
    try {
      const data = await apiUpdateUser(id, {
        name: editFields.name.trim(),
        phone: editFields.phone.trim() || null,
        university: editFields.university.trim() || null,
        major: editFields.major.trim() || null,
        city: editFields.city.trim() || null,
        age: editFields.age ? Number(editFields.age) : null,
        gender: editFields.gender || null,
        bio: editFields.bio.trim() || null,
      });
      setUser(data.user);
      setEditModal(false);
    } catch (err) {
      setEditError(err.message || "Failed to save changes.");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Block / Unblock / Delete ──────────────────────────────────────────────
  const handleBlock = async () => {
    if (!window.confirm(`Block ${user?.name}?`)) return;
    try {
      await apiBlockUser(id);
      setUser((prev) => ({ ...prev, is_blocked: 1 }));
    } catch (err) {
      alert(err.message || "Failed to block.");
    }
  };
  const handleUnblock = async () => {
    try {
      await apiUnblockUser(id);
      setUser((prev) => ({ ...prev, is_blocked: 0 }));
    } catch (err) {
      alert(err.message || "Failed to unblock.");
    }
  };
  const handleDelete = async () => {
    if (
      !window.confirm(
        `Permanently delete ${user?.name}? All data will be removed.`,
      )
    )
      return;
    try {
      await apiDeleteUser(id);
      navigate("/admin/users");
    } catch (err) {
      alert(err.message || "Failed to delete.");
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant gap-2">
        <span className="material-symbols-outlined text-[20px] animate-spin">
          progress_activity
        </span>
        Loading user...
      </div>
    );
  }

  if (pageError || !user) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center bg-surface-container-lowest border rounded-xl p-8">
        <span className="material-symbols-outlined text-[48px] text-error">
          warning
        </span>
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mt-2">
          User Not Found
        </h3>
        <p className="text-body-md text-on-surface-variant mt-2">{pageError}</p>
        <Link
          to="/admin/users"
          className="mt-4 inline-block text-primary font-bold hover:underline"
        >
          Back to User Registry
        </Link>
      </div>
    );
  }

  const verified = user.is_verified === 1 || user.is_verified === true;
  const verifDoc = user.verificationDoc || {};
  const budgetDisplay =
    user.budget_min && user.budget_max
      ? `Rs. ${Number(user.budget_min).toLocaleString()} – Rs. ${Number(user.budget_max).toLocaleString()}/mo`
      : "Not specified";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        to="/admin/users"
        className="text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors flex items-center gap-1 w-fit"
      >
        <span className="material-symbols-outlined text-[18px]">
          arrow_back
        </span>
        Back to User Registry
      </Link>

      {/* ── Profile Header ─────────────────────────────────────────────── */}
      <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col md:flex-row items-center md:items-start gap-6">
        <Avatar
          src={user.profile_image || user.avatar}
          name={user.name}
          size="xxl"
        />

        <div className="flex-1 text-center md:text-left space-y-2">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
                <h1 className="font-headline-md text-headline-md text-on-surface font-bold">
                  {user.name}
                </h1>
                {verified && (
                  <span className="text-secondary" title="Verified">
                    <span className="material-symbols-outlined text-[20px] icon-fill">
                      verified
                    </span>
                  </span>
                )}
              </div>
              <p className="font-body-md text-body-md text-on-surface-variant">
                {user.email} &bull; Role:{" "}
                <span className="capitalize font-semibold text-on-surface">
                  {user.role}
                </span>
              </p>
              <p className="text-xs text-outline mt-1">ID: {user.id}</p>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 flex-wrap justify-center">
              <Button
                variant="outline"
                onClick={openEdit}
                className="px-4 py-2 text-sm"
              >
                <span className="material-symbols-outlined text-[16px] mr-1">
                  edit
                </span>
                Edit User
              </Button>
              {user.role !== "admin" && (
                <Button
                  variant="outline"
                  onClick={handleMessageUser}
                  disabled={msgLoading}
                  className="px-4 py-2 text-sm border-primary text-primary hover:bg-primary-container/20"
                >
                  <span className="material-symbols-outlined text-[16px] mr-1">
                    chat
                  </span>
                  {msgLoading ? "Opening..." : "Message User"}
                </Button>
              )}
              {user.role !== "admin" && (
                <>
                  {user.is_blocked ? (
                    <Button
                      variant="outline"
                      onClick={handleUnblock}
                      className="px-4 py-2 text-sm border-secondary text-secondary"
                    >
                      <span className="material-symbols-outlined text-[16px] mr-1">
                        lock_open
                      </span>
                      Unblock
                    </Button>
                  ) : (
                    <Button
                      variant="danger"
                      onClick={handleBlock}
                      className="px-4 py-2 text-sm"
                    >
                      <span className="material-symbols-outlined text-[16px] mr-1">
                        block
                      </span>
                      Block
                    </Button>
                  )}
                  <Button
                    variant="danger"
                    onClick={handleDelete}
                    className="px-4 py-2 text-sm"
                  >
                    Delete
                  </Button>
                </>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 justify-center md:justify-start text-label-md text-on-surface-variant font-semibold">
            {user.university && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  school
                </span>
                <span>{user.university}</span>
              </div>
            )}
            {user.major && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  menu_book
                </span>
                <span>{user.major}</span>
              </div>
            )}
            {user.city && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  location_on
                </span>
                <span>{user.city}</span>
              </div>
            )}
            {user.phone && (
              <div className="flex items-center gap-1">
                <span className="material-symbols-outlined text-primary text-[18px]">
                  phone
                </span>
                <span>{user.phone}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* ── Profile Details ─────────────────────────────────────────── */}
        <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm space-y-4">
          <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold border-b border-outline-variant/60 pb-3">
            Profile Details
          </h2>
          <div className="space-y-3 text-body-md">
            {[
              { label: "Age", value: user.age ? `${user.age} years old` : "—" },
              { label: "Gender", value: user.gender || "—" },
              { label: "Budget", value: budgetDisplay },
              {
                label: "Email Status",
                value: user.email_verified
                  ? "✅ Confirmed"
                  : "❌ Not Confirmed",
              },
              {
                label: "Account Status",
                value: user.is_blocked ? "⛔ Blocked" : "✅ Active",
              },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex justify-between py-1.5 border-b border-outline-variant/40 last:border-0"
              >
                <span className="text-on-surface-variant font-semibold">
                  {label}
                </span>
                <span className="text-on-surface font-bold">{value}</span>
              </div>
            ))}
          </div>
          {user.bio && (
            <div className="mt-3 pt-3 border-t border-outline-variant/40">
              <p className="text-xs text-outline font-semibold uppercase tracking-wider mb-1">
                Bio
              </p>
              <p className="text-body-md text-on-surface-variant leading-relaxed">
                {user.bio}
              </p>
            </div>
          )}
          {user.hobbies?.length > 0 && (
            <div className="mt-3 pt-3 border-t border-outline-variant/40">
              <p className="text-xs text-outline font-semibold uppercase tracking-wider mb-2">
                Hobbies
              </p>
              <div className="flex flex-wrap gap-1.5">
                {user.hobbies.map((h) => (
                  <span
                    key={h}
                    className="text-xs bg-surface-container px-2.5 py-1 rounded-full text-on-surface border border-outline-variant/60"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Verification Document ───────────────────────────────────── */}
        <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm space-y-4">
          <div className="flex justify-between items-center pb-3 border-b border-outline-variant/60">
            <h2 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              Verification
            </h2>

            {/* ── VERIFY / UNVERIFY TOGGLE SWITCH ── */}
            {(() => {
              const blockReasons = getVerifyBlockReasons(user);
              const canVerify = verified || blockReasons.length === 0;
              return (
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-on-surface-variant font-semibold">
                      {verified ? "Verified" : "Unverified"}
                    </span>
                    <button
                      onClick={handleVerifyToggle}
                      disabled={actionLoading || (!verified && !canVerify)}
                      title={
                        verified
                          ? "Click to unverify"
                          : blockReasons.length > 0
                            ? "Requirements not met — see below"
                            : "Click to verify"
                      }
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none disabled:opacity-50 ${
                        verified ? "bg-secondary" : "bg-outline-variant"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${
                          verified ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                  </div>
                  {/* Show what's blocking verification */}
                  {!verified && blockReasons.length > 0 && (
                    <div className="p-2 bg-error-container/10 border border-error/20 rounded-lg">
                      <p className="text-[10px] text-error font-bold uppercase tracking-wider mb-1">
                        Cannot verify — requirements missing:
                      </p>
                      <ul className="space-y-0.5">
                        {blockReasons.map((r, i) => (
                          <li
                            key={i}
                            className="text-[11px] text-error flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-[12px]">
                              cancel
                            </span>
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {verifDoc.status && verifDoc.status !== "NOT_SUBMITTED" ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-outline font-semibold uppercase">
                    Document Type
                  </p>
                  <p className="text-on-surface font-bold mt-1">
                    {verifDoc.document_type || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-outline font-semibold uppercase">
                    Status
                  </p>
                  <div className="mt-1">
                    <StatusBadge
                      status={
                        verified
                          ? "verified"
                          : verifDoc.status === "PENDING"
                            ? "pending"
                            : "rejected"
                      }
                    />
                  </div>
                </div>
                <div>
                  <p className="text-xs text-outline font-semibold uppercase">
                    Submitted
                  </p>
                  <p className="text-on-surface font-bold mt-1">
                    {verifDoc.submitted_at
                      ? new Date(verifDoc.submitted_at).toLocaleDateString()
                      : "—"}
                  </p>
                </div>
              </div>

              {/* View document button */}
              <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant text-center">
                <span className="material-symbols-outlined text-[32px] text-primary mb-2 block">
                  description
                </span>
                <p className="text-xs text-outline font-semibold mb-2">
                  Submitted Document
                </p>
                <button
                  onClick={() => setDocModalOpen(true)}
                  className="inline-flex items-center gap-2 bg-primary text-on-primary px-4 py-2 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    open_in_new
                  </span>
                  View Document
                </button>
                <p className="text-[10px] text-outline mt-2">
                  Admin session required
                </p>
              </div>

              {verifDoc.rejection_reason && (
                <div className="p-3 bg-error-container/10 border border-error/30 rounded-lg">
                  <p className="text-xs text-error font-bold uppercase tracking-wider mb-1">
                    Rejection Reason
                  </p>
                  <p className="text-body-md text-on-surface-variant">
                    {verifDoc.rejection_reason}
                  </p>
                </div>
              )}

              {/* Reject button only for PENDING */}
              {verifDoc.status === "PENDING" && !verified && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setRejectReason("");
                    setRejectModal(true);
                  }}
                  className="w-full text-sm"
                >
                  Reject Document
                </Button>
              )}
            </div>
          ) : (
            <div className="text-center py-8">
              <span className="material-symbols-outlined text-[40px] text-outline mb-3 block">
                upload_file
              </span>
              <p className="text-body-md text-on-surface-variant">
                No document submitted yet.
              </p>
              <p className="text-xs text-outline mt-1">
                Use the toggle above to manually verify if needed.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* ── Reject Modal ──────────────────────────────────────────────── */}
      <Modal
        isOpen={rejectModal}
        onClose={() => setRejectModal(false)}
        title="Reject Document"
        footer={
          <>
            <Button variant="outline" onClick={() => setRejectModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleReject}
              disabled={actionLoading}
            >
              {actionLoading ? "Rejecting..." : "Confirm Rejection"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-body-md text-on-surface-variant">
            Rejecting document for <strong>{user.name}</strong>.
          </p>
          <Textarea
            label="Rejection Reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Document is blurry. Please resubmit a clear photo."
            rows={3}
          />
        </div>
      </Modal>

      {/* ── Document Viewer Modal ─────────────────────────────────────── */}
      <Modal
        isOpen={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        title={`Document — ${user.name}`}
        footer={
          <Button variant="primary" onClick={() => setDocModalOpen(false)}>
            Close
          </Button>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-on-surface-variant">
            Document type: <strong>{verifDoc.document_type || "—"}</strong>
          </p>
          <div className="border border-outline-variant rounded-xl overflow-hidden bg-surface-container-low">
            <img
              src={`${apiVerificationDocUrl(id)}?token=${localStorage.getItem("roomiematch_jwt")}`}
              alt="Verification document"
              className="w-full max-h-[500px] object-contain"
              onError={(e) => {
                e.target.style.display = "none";
                e.target.nextSibling.style.display = "block";
              }}
            />
            <iframe
              src={`${apiVerificationDocUrl(id)}?token=${localStorage.getItem("roomiematch_jwt")}`}
              title="Verification Document"
              className="w-full h-[500px]"
              style={{ display: "none" }}
            />
          </div>
        </div>
      </Modal>

      {/* ── Edit User Modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title={`Edit User — ${user.name}`}
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setEditModal(false)}
              disabled={editLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleEditSave}
              disabled={editLoading}
            >
              {editLoading ? "Saving..." : "Save Changes"}
            </Button>
          </>
        }
      >
        <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
          {editError && (
            <div className="bg-error-container/20 border border-error/40 text-error p-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">warning</span>
              {editError}
            </div>
          )}
          <Input
            label="Full Name *"
            value={editFields.name || ""}
            onChange={(e) =>
              setEditFields((p) => ({ ...p, name: e.target.value }))
            }
            required
          />
          <Input
            label="Phone Number"
            value={editFields.phone || ""}
            onChange={(e) =>
              setEditFields((p) => ({ ...p, phone: e.target.value }))
            }
            placeholder="e.g. 9812345678"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              value={editFields.city || ""}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, city: e.target.value }))
              }
            />
            <Input
              label="Age"
              type="number"
              value={editFields.age || ""}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, age: e.target.value }))
              }
              min="16"
              max="100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="University"
              value={editFields.university || ""}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, university: e.target.value }))
              }
            />
            <Input
              label="Major"
              value={editFields.major || ""}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, major: e.target.value }))
              }
            />
          </div>
          <Select
            label="Gender"
            value={editFields.gender || ""}
            onChange={(e) =>
              setEditFields((p) => ({ ...p, gender: e.target.value }))
            }
            options={[
              { value: "", label: "Not specified" },
              { value: "Male", label: "Male" },
              { value: "Female", label: "Female" },
              { value: "Non-binary", label: "Non-binary" },
              { value: "Other", label: "Other" },
            ]}
          />
          <Textarea
            label="Bio"
            value={editFields.bio || ""}
            onChange={(e) =>
              setEditFields((p) => ({ ...p, bio: e.target.value }))
            }
            rows={3}
            placeholder="User biography..."
          />
        </div>
      </Modal>
    </div>
  );
};

export default UserDetails;
