/**
 * ImageUpload.jsx — Reusable image/document upload component.
 *
 * Supports:
 *  - Single image (profile, avatar)
 *  - Multiple images (property gallery)
 *  - Document upload (verification: JPG/PNG/WEBP/PDF)
 *  - Preview before upload
 *  - Remove selected image before upload
 *  - Replace current image
 *  - Client-side MIME + size validation (UX layer; server validates for security)
 *  - Loading state with spinner
 *  - Error display using existing design system
 *
 * Props:
 *  mode            "single" | "multiple" | "document"
 *  onUpload        async fn(File | File[]) => void   called after user confirms
 *  onRemove        async fn() => void                called when removing current
 *  currentImageUrl string | null                     existing image URL to display
 *  currentImages   Array<{id, image_path, is_primary}> for multiple mode
 *  maxCount        number (default 6, multiple mode)
 *  maxSizeMB       number (default 5)
 *  label           string
 *  disabled        boolean
 *  className       string
 */
import React, { useRef, useState } from "react";
import { resolveImageUrl } from "../../utils/imageUrl";

const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ACCEPTED_DOC_TYPES   = [...ACCEPTED_IMAGE_TYPES, "application/pdf"];
const IMAGE_EXTENSIONS     = [".jpg", ".jpeg", ".png", ".webp"];
const DOC_EXTENSIONS       = [...IMAGE_EXTENSIONS, ".pdf"];

function validateFile(file, mode, maxSizeMB) {
  const allowedTypes = mode === "document" ? ACCEPTED_DOC_TYPES : ACCEPTED_IMAGE_TYPES;
  const allowedExts  = mode === "document" ? DOC_EXTENSIONS : IMAGE_EXTENSIONS;
  const ext = "." + file.name.split(".").pop().toLowerCase();

  if (!allowedTypes.includes(file.type.toLowerCase()) || !allowedExts.includes(ext)) {
    return mode === "document"
      ? "Please upload a JPG, PNG, WEBP, or PDF file."
      : "Please upload a JPG, PNG, or WEBP image.";
  }
  if (file.size > maxSizeMB * 1024 * 1024) {
    return `Image size exceeds the ${maxSizeMB} MB limit.`;
  }
  return null;
}

// ── Single image / document ────────────────────────────────────────────────

export function SingleImageUpload({
  onUpload,
  onRemove,
  currentImageUrl = null,
  label = "Upload Image",
  maxSizeMB = 5,
  mode = "single",          // "single" | "document"
  disabled = false,
  className = ""
}) {
  const inputRef            = useRef(null);
  const [preview, setPreview]   = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const isPdf = (url) => url && url.toLowerCase().endsWith(".pdf");

  const handleSelect = (e) => {
    setError("");
    const file = e.target.files?.[0];
    if (!file) return;

    const err = validateFile(file, mode, maxSizeMB);
    if (err) { setError(err); e.target.value = ""; return; }

    setPendingFile(file);
    if (!isPdf(file.name)) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target.result);
      reader.readAsDataURL(file);
    } else {
      setPreview("pdf");
    }
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (!pendingFile || !onUpload) return;
    setLoading(true);
    setError("");
    try {
      await onUpload(pendingFile);
      setPreview(null);
      setPendingFile(null);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setPendingFile(null);
    setError("");
  };

  const handleRemove = async () => {
    if (!onRemove) return;
    setLoading(true);
    setError("");
    try {
      await onRemove();
    } catch (err) {
      setError(err.message || "Failed to remove image.");
    } finally {
      setLoading(false);
    }
  };

  const displayUrl = preview && preview !== "pdf" ? preview : resolveImageUrl(currentImageUrl);
  const hasPending = !!pendingFile;
  const hasCurrent = !!currentImageUrl;

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {label && (
        <span className="font-label-md text-label-md text-on-surface-variant font-bold">{label}</span>
      )}

      {/* Preview / current image */}
      {(displayUrl && displayUrl !== "pdf") || (preview === "pdf") ? (
        <div className="relative group w-fit">
          {preview === "pdf" || isPdf(currentImageUrl) ? (
            <div className="w-32 h-32 flex flex-col items-center justify-center bg-surface-container-low border border-outline-variant rounded-xl gap-2">
              <span className="material-symbols-outlined text-[40px] text-primary">picture_as_pdf</span>
              <span className="text-xs text-on-surface-variant font-semibold">PDF Document</span>
            </div>
          ) : (
            <img
              src={displayUrl}
              alt="Preview"
              className="w-32 h-32 rounded-xl object-cover border-2 border-outline-variant shadow-sm"
            />
          )}
          {hasPending && (
            <span className="absolute -top-2 -right-2 bg-primary text-on-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide">
              New
            </span>
          )}
        </div>
      ) : (
        /* Drop zone / placeholder */
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || loading}
          className="w-32 h-32 border-2 border-dashed border-outline-variant hover:border-primary/60 rounded-xl flex flex-col items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[28px] text-outline">
            {mode === "document" ? "upload_file" : "add_a_photo"}
          </span>
          <span className="text-xs text-outline font-semibold text-center px-2 leading-tight">
            {mode === "document" ? "Upload Doc" : "Add Photo"}
          </span>
        </button>
      )}

      {/* Action row */}
      <div className="flex flex-wrap gap-2">
        {!hasPending && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={disabled || loading}
            className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-surface-tint transition-colors disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-[16px]">
              {hasCurrent ? "swap_horiz" : "add"}
            </span>
            {hasCurrent ? "Change" : "Select"}
          </button>
        )}

        {hasPending && !loading && (
          <>
            <button
              type="button"
              onClick={handleUpload}
              className="flex items-center gap-1.5 text-xs font-bold text-on-primary bg-primary hover:bg-surface-tint px-3 py-1.5 rounded-lg transition-colors"
            >
              <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
              Upload
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="flex items-center gap-1.5 text-xs font-semibold text-on-surface-variant hover:text-on-surface transition-colors px-2"
            >
              <span className="material-symbols-outlined text-[14px]">close</span>
              Cancel
            </button>
          </>
        )}

        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span>
            Uploading...
          </span>
        )}

        {hasCurrent && !hasPending && !loading && onRemove && (
          <button
            type="button"
            onClick={handleRemove}
            className="flex items-center gap-1 text-xs font-semibold text-error hover:text-error/70 transition-colors"
          >
            <span className="material-symbols-outlined text-[14px]">delete</span>
            Remove
          </button>
        )}
      </div>

      {error && (
        <p className="text-xs text-error font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">warning</span>
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={mode === "document" ? ".jpg,.jpeg,.png,.webp,.pdf" : ".jpg,.jpeg,.png,.webp"}
        onChange={handleSelect}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}

// ── Multiple images (property gallery) ────────────────────────────────────

export function MultipleImageUpload({
  onUpload,
  onRemove,
  onSetPrimary,
  currentImages = [],     // [{id, image_path, is_primary}]
  maxCount = 6,
  maxSizeMB = 8,
  label = "Property Images",
  disabled = false,
  className = ""
}) {
  const inputRef              = useRef(null);
  const [pendingFiles, setPendingFiles] = useState([]);  // [{file, preview}]
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);

  const totalCount = currentImages.length + pendingFiles.length;
  const canAddMore = totalCount < maxCount;

  const handleSelect = (e) => {
    setError("");
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    if (currentImages.length + pendingFiles.length + files.length > maxCount) {
      setError(`You can upload up to ${maxCount} property images.`);
      e.target.value = "";
      return;
    }

    const newPending = [];
    for (const file of files) {
      const err = validateFile(file, "single", maxSizeMB);
      if (err) { setError(err); e.target.value = ""; return; }
      newPending.push({ file, preview: URL.createObjectURL(file) });
    }

    setPendingFiles((prev) => [...prev, ...newPending]);
    e.target.value = "";
  };

  const removePending = (idx) => {
    setPendingFiles((prev) => {
      URL.revokeObjectURL(prev[idx].preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleUpload = async () => {
    if (!pendingFiles.length || !onUpload) return;
    setLoading(true);
    setError("");
    try {
      await onUpload(pendingFiles.map((p) => p.file));
      pendingFiles.forEach((p) => URL.revokeObjectURL(p.preview));
      setPendingFiles([]);
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {label && (
        <div className="flex items-center justify-between">
          <span className="font-label-md text-label-md text-on-surface-variant font-bold">{label}</span>
          <span className="text-xs text-outline">{currentImages.length}/{maxCount} uploaded</span>
        </div>
      )}

      {/* Existing images */}
      <div className="flex flex-wrap gap-3">
        {currentImages.map((img) => (
          <div key={img.id} className="relative group">
            <img
              src={resolveImageUrl(img.image_path)}
              alt="Property"
              className={`w-24 h-20 object-cover rounded-xl border-2 transition-all ${
                img.is_primary ? "border-primary shadow-md" : "border-outline-variant"
              }`}
              onError={(e) => {
                e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800";
              }}
            />
            {img.is_primary && (
              <span className="absolute top-1 left-1 bg-primary text-on-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                Primary
              </span>
            )}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-1">
              {!img.is_primary && onSetPrimary && (
                <button
                  type="button"
                  title="Set as primary"
                  onClick={() => onSetPrimary(img.id)}
                  className="bg-primary text-on-primary rounded-full p-1"
                >
                  <span className="material-symbols-outlined text-[14px]">star</span>
                </button>
              )}
              {onRemove && (
                <button
                  type="button"
                  title="Remove image"
                  onClick={() => onRemove(img.id)}
                  className="bg-error text-on-error rounded-full p-1"
                >
                  <span className="material-symbols-outlined text-[14px]">delete</span>
                </button>
              )}
            </div>
          </div>
        ))}

        {/* Pending (not yet uploaded) previews */}
        {pendingFiles.map((p, idx) => (
          <div key={idx} className="relative group">
            <img
              src={p.preview}
              alt="Pending"
              className="w-24 h-20 object-cover rounded-xl border-2 border-dashed border-primary/60 opacity-80"
            />
            <span className="absolute top-1 left-1 bg-secondary text-on-secondary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
              New
            </span>
            <button
              type="button"
              onClick={() => removePending(idx)}
              className="absolute top-1 right-1 bg-error text-on-error rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <span className="material-symbols-outlined text-[12px]">close</span>
            </button>
          </div>
        ))}

        {/* Add more button */}
        {canAddMore && !disabled && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="w-24 h-20 border-2 border-dashed border-outline-variant hover:border-primary/60 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-[24px] text-outline">add_photo_alternate</span>
            <span className="text-[10px] text-outline font-semibold">Add Photo</span>
          </button>
        )}
      </div>

      {/* Upload pending files button */}
      {pendingFiles.length > 0 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleUpload}
            disabled={loading}
            className="flex items-center gap-1.5 text-sm font-bold text-on-primary bg-primary hover:bg-surface-tint px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? (
              <>
                <span className="material-symbols-outlined text-[16px] animate-spin">progress_activity</span>
                Uploading...
              </>
            ) : (
              <>
                <span className="material-symbols-outlined text-[16px]">cloud_upload</span>
                Upload {pendingFiles.length} image{pendingFiles.length > 1 ? "s" : ""}
              </>
            )}
          </button>
          <button
            type="button"
            onClick={() => { pendingFiles.forEach((p) => URL.revokeObjectURL(p.preview)); setPendingFiles([]); }}
            className="text-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {error && (
        <p className="text-xs text-error font-semibold flex items-center gap-1">
          <span className="material-symbols-outlined text-[14px]">warning</span>
          {error}
        </p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.webp"
        multiple
        onChange={handleSelect}
        className="hidden"
        aria-hidden="true"
      />
    </div>
  );
}

export default SingleImageUpload;
