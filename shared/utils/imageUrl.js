/**
 * imageUrl.js — Universal image URL resolver.
 *
 * Resolves relative uploaded image URLs (e.g. `/api/uploads/properties/...`)
 * to full absolute URLs pointing to the Express backend API server.
 *
 * Handles:
 *  - External full URLs (http://, https://, data:, blob:) -> untouched
 *  - Relative upload paths -> prepends backend origin (e.g. Render in production or localhost:4000 in dev)
 *  - Safe fallback for null/undefined/empty input
 */

export function resolveImageUrl(src) {
  if (!src || typeof src !== "string") return "";
  const trimmed = src.trim();
  if (!trimmed) return "";

  // Already an absolute URL or inline data/blob
  if (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("data:") ||
    trimmed.startsWith("blob:")
  ) {
    return trimmed;
  }

  // Derive the backend origin from VITE_API_URL
  let apiBase = (import.meta.env?.VITE_API_URL || "").replace(/\/api\/?$/, "");

  if (!apiBase) {
    if (typeof window !== "undefined") {
      const hostname = window.location.hostname;
      if (hostname === "localhost" || hostname === "127.0.0.1") {
        apiBase = "http://localhost:4000";
      } else {
        // Fallback in cloud production if VITE_API_URL was omitted at build time
        apiBase = "https://roomiematch-backend-fh6x.onrender.com";
      }
    } else {
      apiBase = "http://localhost:4000";
    }
  }

  if (trimmed.startsWith("/")) {
    return `${apiBase}${trimmed}`;
  }
  return `${apiBase}/${trimmed}`;
}

export default resolveImageUrl;

