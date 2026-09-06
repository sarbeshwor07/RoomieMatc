/**
 * api.js — Thin fetch wrapper for all RoomieMatch API calls.
 *
 * - Reads the JWT from localStorage (set by AuthContext on login).
 * - All requests go to the Express server at http://localhost:4000.
 * - Never exposes secrets or tokens in URLs.
 */

const BASE_URL = import.meta.env?.VITE_API_URL || "/api";

function getToken() {
  return localStorage.getItem("roomiematch_jwt") || null;
}

function authHeaders(extra = {}) {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function handleResponse(res) {
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { message: text };
  }
  if (!res.ok)
    throw new Error(data.error || data.message || `HTTP ${res.status}`);
  return data;
}

// ─────────────────────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────────────────────

export async function apiRegister(name, email, password, phone) {
  const res = await fetch(`${BASE_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password, phone }),
  });
  return handleResponse(res);
}

export async function apiLogin(email, password) {
  const res = await fetch(`${BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return handleResponse(res);
}

export async function apiGetMe() {
  const res = await fetch(`${BASE_URL}/auth/me`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

/** Send Google ID token to backend for server-side validation + OTP dispatch. */
export async function apiGoogleAuth(credential) {
  const res = await fetch(`${BASE_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });
  return handleResponse(res);
}

/** Submit 6-digit OTP after Google sign-in. */
export async function apiVerifyOtp(pendingId, otp) {
  const res = await fetch(`${BASE_URL}/auth/otp/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingId, otp }),
  });
  return handleResponse(res);
}

/** Resend OTP (60-second cooldown enforced server-side). */
export async function apiResendOtp(pendingId) {
  const res = await fetch(`${BASE_URL}/auth/otp/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ pendingId }),
  });
  return handleResponse(res);
}

/** Request password-reset email. Always returns 200 (enumeration-safe). */
export async function apiForgotPassword(email) {
  const res = await fetch(`${BASE_URL}/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  return handleResponse(res);
}

/** Complete the reset with the token from the email link. */
export async function apiResetPassword(token, email, newPassword) {
  const res = await fetch(`${BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, email, newPassword }),
  });
  return handleResponse(res);
}

/** Change password while authenticated (requires current password). */
export async function apiChangePassword(currentPassword, newPassword) {
  const res = await fetch(`${BASE_URL}/auth/change-password`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// USERS
// ─────────────────────────────────────────────────────────────────────────────

/** Admin: list users with optional search/role/page filters. */
export async function apiListUsers(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/users${qs ? "?" + qs : ""}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiGetUser(userId) {
  const res = await fetch(`${BASE_URL}/users/${userId}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

/** Update own profile (or admin updating any user). */
export async function apiUpdateUser(userId, fields) {
  const res = await fetch(`${BASE_URL}/users/${userId}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(fields),
  });
  return handleResponse(res);
}

/** Admin: delete a user account. */
export async function apiDeleteUser(userId) {
  const res = await fetch(`${BASE_URL}/users/${userId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

/** Admin: block a user account. */
export async function apiBlockUser(userId) {
  const res = await fetch(`${BASE_URL}/users/${userId}/block`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
  return handleResponse(res);
}

/** Admin: unblock a user account. */
export async function apiUnblockUser(userId) {
  const res = await fetch(`${BASE_URL}/users/${userId}/unblock`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE IMAGE
// ─────────────────────────────────────────────────────────────────────────────

export async function apiUploadProfileImage(file) {
  const form = new FormData();
  form.append("image", file);
  const res = await fetch(`${BASE_URL}/profile`, {
    method: "POST",
    headers: authHeaders(), // no Content-Type — browser sets multipart boundary
    body: form,
  });
  return handleResponse(res);
}

export async function apiDeleteProfileImage() {
  const res = await fetch(`${BASE_URL}/profile`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// VERIFICATION DOCUMENTS
// ─────────────────────────────────────────────────────────────────────────────

export async function apiUploadVerificationDoc(file, documentType) {
  const form = new FormData();
  form.append("document", file);
  form.append("document_type", documentType);
  const res = await fetch(`${BASE_URL}/verification`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return handleResponse(res);
}

export async function apiGetVerificationStatus() {
  const res = await fetch(`${BASE_URL}/verification/status`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

/** Returns the URL for securely viewing a user's verification document (auth required). */
export function apiVerificationDocUrl(userId) {
  return `${BASE_URL}/verification/doc/${userId}`;
}

export async function apiListPendingVerifications() {
  const res = await fetch(`${BASE_URL}/verification/pending`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiListAllVerifications(status) {
  const qs = status ? `?status=${status}` : "";
  const res = await fetch(`${BASE_URL}/verification/all${qs}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiUnverifyUser(userId, reason) {
  const res = await fetch(`${BASE_URL}/verification/${userId}/unverify`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ reason: reason || "" }),
  });
  return handleResponse(res);
}

export async function apiApproveVerification(userId) {
  const res = await fetch(`${BASE_URL}/verification/${userId}/approve`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
  return handleResponse(res);
}

export async function apiRejectVerification(userId, reason) {
  const res = await fetch(`${BASE_URL}/verification/${userId}/reject`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ reason }),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPERTIES
// ─────────────────────────────────────────────────────────────────────────────

/** Public/authenticated property search. params: { search, city, type, minPrice, maxPrice, bedrooms, page, limit, ownerId, status, verified } */
export async function apiListProperties(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/properties${qs ? "?" + qs : ""}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiGetProperty(propertyId) {
  const res = await fetch(`${BASE_URL}/properties/${propertyId}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiCreateProperty(data) {
  const res = await fetch(`${BASE_URL}/properties`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function apiUpdateProperty(propertyId, data) {
  const res = await fetch(`${BASE_URL}/properties/${propertyId}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

export async function apiDeleteProperty(propertyId) {
  const res = await fetch(`${BASE_URL}/properties/${propertyId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiVerifyProperty(propertyId) {
  const res = await fetch(`${BASE_URL}/properties/${propertyId}/verify`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
  return handleResponse(res);
}

export async function apiUnverifyProperty(propertyId) {
  const res = await fetch(`${BASE_URL}/properties/${propertyId}/unverify`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
  return handleResponse(res);
}

export async function apiUpdatePropertyStatus(propertyId, status) {
  const res = await fetch(`${BASE_URL}/properties/${propertyId}/status`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// PROPERTY IMAGES
// ─────────────────────────────────────────────────────────────────────────────

export async function apiUploadPropertyImages(propertyId, files) {
  const form = new FormData();
  Array.from(files).forEach((f) => form.append("images", f));
  const res = await fetch(`${BASE_URL}/properties/${propertyId}/images`, {
    method: "POST",
    headers: authHeaders(),
    body: form,
  });
  return handleResponse(res);
}

export async function apiGetPropertyImages(propertyId) {
  const res = await fetch(`${BASE_URL}/properties/${propertyId}/images`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiDeletePropertyImage(imageId) {
  const res = await fetch(`${BASE_URL}/properties/images/${imageId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiSetPrimaryPropertyImage(imageId) {
  const res = await fetch(`${BASE_URL}/properties/images/${imageId}/primary`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// APPLICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** params: { status, propertyId, page, limit } */
export async function apiListApplications(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/applications${qs ? "?" + qs : ""}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiGetApplication(applicationId) {
  const res = await fetch(`${BASE_URL}/applications/${applicationId}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiSubmitApplication(propertyId, message) {
  const res = await fetch(`${BASE_URL}/applications`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ property_id: propertyId, message }),
  });
  return handleResponse(res);
}

export async function apiUpdateApplicationStatus(applicationId, status) {
  const res = await fetch(`${BASE_URL}/applications/${applicationId}/status`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ status }),
  });
  return handleResponse(res);
}

export async function apiCancelApplication(applicationId) {
  const res = await fetch(`${BASE_URL}/applications/${applicationId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// NOTIFICATIONS
// ─────────────────────────────────────────────────────────────────────────────

/** params: { unread, page, limit } */
export async function apiListNotifications(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/notifications${qs ? "?" + qs : ""}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiMarkNotificationRead(notificationId) {
  const res = await fetch(`${BASE_URL}/notifications/${notificationId}/read`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiMarkAllNotificationsRead() {
  const res = await fetch(`${BASE_URL}/notifications/read-all`, {
    method: "PATCH",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiDeleteNotification(notificationId) {
  const res = await fetch(`${BASE_URL}/notifications/${notificationId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// FAVOURITES
// ─────────────────────────────────────────────────────────────────────────────

export async function apiListFavourites() {
  const res = await fetch(`${BASE_URL}/favourites`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiAddFavourite(propertyId) {
  const res = await fetch(`${BASE_URL}/favourites`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ property_id: propertyId }),
  });
  return handleResponse(res);
}

export async function apiRemoveFavourite(propertyId) {
  const res = await fetch(`${BASE_URL}/favourites/${propertyId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiGetFavouriteStatus(propertyId) {
  const res = await fetch(`${BASE_URL}/favourites/${propertyId}/status`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────────────────────────────────────

export async function apiSubmitReport(data) {
  const res = await fetch(`${BASE_URL}/reports`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

/** Admin: params { status, page, limit } */
export async function apiListReports(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/reports${qs ? "?" + qs : ""}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiGetReport(reportId) {
  const res = await fetch(`${BASE_URL}/reports/${reportId}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiUpdateReport(reportId, status, resolution) {
  const res = await fetch(`${BASE_URL}/reports/${reportId}`, {
    method: "PATCH",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ status, resolution }),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────

export async function apiGetAdminStats() {
  const res = await fetch(`${BASE_URL}/admin/stats`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

export async function apiGetAdminActivity(limit = 10) {
  const res = await fetch(`${BASE_URL}/admin/activity?limit=${limit}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// MESSAGING
// ─────────────────────────────────────────────────────────────────────────────

/** List all conversations for the current user (includes last message + unread count). */
export async function apiListConversations() {
  const res = await fetch(`${BASE_URL}/messages/conversations`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

/**
 * Get an existing conversation or create a new one.
 * @param {string} otherUserId
 * @param {string|null} propertyId  — optional, links conversation to a property
 */
export async function apiGetOrCreateConversation(
  otherUserId,
  propertyId = null,
) {
  const res = await fetch(`${BASE_URL}/messages/conversations`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      other_user_id: otherUserId,
      property_id: propertyId,
    }),
  });
  return handleResponse(res);
}

/** Get a single conversation with metadata (no messages). */
export async function apiGetConversation(conversationId) {
  const res = await fetch(
    `${BASE_URL}/messages/conversations/${conversationId}`,
    {
      headers: authHeaders(),
    },
  );
  return handleResponse(res);
}

/** Get paginated messages inside a conversation. Also marks incoming messages as read. */
export async function apiGetMessages(conversationId, page = 1, limit = 50) {
  const res = await fetch(
    `${BASE_URL}/messages/conversations/${conversationId}/messages?page=${page}&limit=${limit}`,
    { headers: authHeaders() },
  );
  return handleResponse(res);
}

/** Send a message to a conversation. */
export async function apiSendMessage(conversationId, body) {
  const res = await fetch(
    `${BASE_URL}/messages/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({ body }),
    },
  );
  return handleResponse(res);
}

/** Mark all messages in a conversation as read for the current user. */
export async function apiMarkConversationRead(conversationId) {
  const res = await fetch(
    `${BASE_URL}/messages/conversations/${conversationId}/read`,
    {
      method: "PATCH",
      headers: authHeaders(),
    },
  );
  return handleResponse(res);
}

/** Get total unread message count across all conversations. */
export async function apiGetUnreadMessageCount() {
  const res = await fetch(`${BASE_URL}/messages/unread-count`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWS
// ─────────────────────────────────────────────────────────────────────────────

/** params: { targetProperty, targetUser, reviewerId } */
export async function apiListReviews(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${BASE_URL}/reviews${qs ? "?" + qs : ""}`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

/** Submit a review. data: { rating, comment, target_property?, target_user? } */
export async function apiSubmitReview(data) {
  const res = await fetch(`${BASE_URL}/reviews`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(data),
  });
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// EMAIL VERIFICATION
// ─────────────────────────────────────────────────────────────────────────────

/** Send verification email to the current user's address (requires JWT). */
export async function apiSendVerificationEmail() {
  const res = await fetch(`${BASE_URL}/auth/send-verification`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({}),
  });
  return handleResponse(res);
}

/** Confirm the email verification link (token + email from URL params). */
export async function apiVerifyEmail(token, email) {
  const res = await fetch(
    `${BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`,
    { headers: authHeaders() },
  );
  return handleResponse(res);
}

// ─────────────────────────────────────────────────────────────────────────────
// COMPATIBILITY SCORES
// ─────────────────────────────────────────────────────────────────────────────

/** Save computed compatibility scores for the current user. */
export async function apiSaveCompatibilityScores(scores) {
  const res = await fetch(`${BASE_URL}/compatibility/save`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({ scores }),
  });
  return handleResponse(res);
}

/** Retrieve stored compatibility scores for the current user. */
export async function apiGetCompatibilityScores() {
  const res = await fetch(`${BASE_URL}/compatibility`, {
    headers: authHeaders(),
  });
  return handleResponse(res);
}

// ── Support / Contact Admin ──────────────────────────────────────────────────
/** Connect or get conversation with the system administrator. */
export async function apiContactAdmin() {
  const res = await fetch(`${BASE_URL}/messages/support`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
  });
  return handleResponse(res);
}

// ── Admin Broadcast ──────────────────────────────────────────────────────────
/** Admin: Send broadcast announcement to all or filtered users. */
export async function apiSendBroadcast({
  title,
  message,
  target = "all",
  sendNotification = true,
  sendChatMessage = true,
}) {
  const res = await fetch(`${BASE_URL}/admin/broadcast`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      title,
      message,
      target,
      sendNotification,
      sendChatMessage,
    }),
  });
  return handleResponse(res);
}

// Re-export image URL resolver
export { resolveImageUrl } from "../utils/imageUrl";

