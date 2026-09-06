/**
 * AdminPropertyDetails.jsx (Admin)
 *
 * - View full property details including all images
 * - Edit property fields (title, address, city, type, bedrooms, bathrooms,
 *   price, deposit, description, amenities, rules, available_from)
 * - Add / remove property images
 * - Approve / Remove listing
 * - Message the property owner via existing conversation API
 */
import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  apiGetProperty,
  apiVerifyProperty,
  apiUnverifyProperty,
  apiDeleteProperty,
  apiUpdateProperty,
  apiListReports,
  apiUploadPropertyImages,
  apiDeletePropertyImage,
  apiSetPrimaryPropertyImage,
  apiGetOrCreateConversation,
  resolveImageUrl,
} from "@shared/services/api";
import StatusBadge from "@shared/components/common/StatusBadge";
import Button from "@shared/components/common/Button";
import Avatar from "@shared/components/common/Avatar";
import Modal from "@shared/components/common/Modal";
import Textarea from "@shared/components/common/Textarea";
import Input from "@shared/components/common/Input";
import Select from "@shared/components/common/Select";
import ImageLightbox from "@shared/components/common/ImageLightbox";

const AMENITIES_LIST = [
  "Wifi",
  "Air Conditioning",
  "On-site Laundry",
  "In-unit Laundry",
  "Parking Spot",
  "Garage Parking",
  "Fully Furnished",
  "Dishwasher",
  "Private Backyard",
  "Heating",
  "Garden",
  "Near Bus Stop",
  "Security Access",
  "Large Kitchen",
  "Street Parking",
];

const MAX_IMAGES = 6;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".webp"];

export const AdminPropertyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [property, setProperty] = useState(null);
  const [propertyReports, setPropertyReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [moderatorNotes, setModeratorNotes] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Edit property modal
  const [editModal, setEditModal] = useState(false);
  const [editFields, setEditFields] = useState({});
  const [editError, setEditError] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  // Image management
  const [imgError, setImgError] = useState("");
  const [imgLoading, setImgLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Message modal
  const [msgLoading, setMsgLoading] = useState(false);
  const [msgSuccess, setMsgSuccess] = useState("");
  const [msgError, setMsgError] = useState("");

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const openLightbox = (index = 0) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [propData, reportsData] = await Promise.all([
          apiGetProperty(id),
          apiListReports({ limit: 50 }).catch(() => ({ reports: [] })),
        ]);
        setProperty(propData.property);
        const related = (reportsData.reports || []).filter(
          (r) => r.reported_property_id === id,
        );
        setPropertyReports(related);
      } catch (err) {
        setPageError(err.message || "Property not found.");
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await apiVerifyProperty(id);
      setProperty((prev) => ({ ...prev, is_verified: 1 }));
    } catch (err) {
      alert(err.message || "Failed to approve listing.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Unverify (revoke) ────────────────────────────────────────────────────
  const handleUnverify = async () => {
    setActionLoading(true);
    try {
      await apiUnverifyProperty(id);
      setProperty((prev) => ({ ...prev, is_verified: 0 }));
    } catch (err) {
      alert(err.message || "Failed to unverify listing.");
    } finally {
      setActionLoading(false);
    }
  };
  const handleDelete = async () => {
    if (!window.confirm(`Delete "${property?.title}"? This cannot be undone.`))
      return;
    setActionLoading(true);
    try {
      await apiDeleteProperty(id);
      navigate("/admin/properties");
    } catch (err) {
      alert(err.message || "Failed to delete listing.");
    } finally {
      setActionLoading(false);
    }
  };

  // ── Open edit modal ───────────────────────────────────────────────────────
  const openEdit = () => {
    setEditFields({
      title: property.title || "",
      address: property.address || "",
      city: property.city || "",
      type: property.type || "Apartment",
      bedrooms: String(property.bedrooms || 1),
      bathrooms: String(property.bathrooms || 1),
      price: String(property.price || ""),
      deposit: String(property.deposit || ""),
      description: property.description || "",
      available_from: property.available_from
        ? property.available_from.substring(0, 10)
        : "",
      amenities: [...(property.amenities || [])],
      rules: (property.rules || []).join(", "),
    });
    setEditError("");
    setEditModal(true);
  };

  const toggleAmenity = (a) => {
    setEditFields((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(a)
        ? prev.amenities.filter((x) => x !== a)
        : [...prev.amenities, a],
    }));
  };

  // ── Save edits ────────────────────────────────────────────────────────────
  const handleEditSave = async () => {
    if (
      !editFields.title?.trim() ||
      !editFields.address?.trim() ||
      !editFields.price
    ) {
      setEditError("Title, address, and price are required.");
      return;
    }
    if (isNaN(Number(editFields.price)) || Number(editFields.price) <= 0) {
      setEditError("Price must be a valid positive number.");
      return;
    }
    setEditLoading(true);
    setEditError("");
    try {
      const rules = editFields.rules
        ? editFields.rules
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean)
        : [];
      const data = await apiUpdateProperty(id, {
        title: editFields.title.trim(),
        address: editFields.address.trim(),
        city: editFields.city.trim() || "Metro City",
        type: editFields.type,
        bedrooms: Number(editFields.bedrooms),
        bathrooms: Number(editFields.bathrooms),
        price: Number(editFields.price),
        deposit: Number(editFields.deposit) || Number(editFields.price),
        description: editFields.description.trim(),
        available_from: editFields.available_from || null,
        amenities: editFields.amenities,
        rules,
      });
      setProperty(data.property);
      setEditModal(false);
    } catch (err) {
      setEditError(err.message || "Failed to save changes.");
    } finally {
      setEditLoading(false);
    }
  };

  // ── Image upload ──────────────────────────────────────────────────────────
  const handleImageUpload = async (e) => {
    setImgError("");
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const currentCount = (property.imageData || property.images || []).length;
    if (currentCount + files.length > MAX_IMAGES) {
      setImgError(
        `You can upload up to ${MAX_IMAGES} images. Currently have ${currentCount}.`,
      );
      e.target.value = "";
      return;
    }
    for (const f of files) {
      const ext = "." + f.name.split(".").pop().toLowerCase();
      if (
        !ALLOWED_TYPES.includes(f.type.toLowerCase()) ||
        !ALLOWED_EXTS.includes(ext)
      ) {
        setImgError("Only JPG, PNG, WEBP images are allowed.");
        e.target.value = "";
        return;
      }
    }

    setImgLoading(true);
    try {
      await apiUploadPropertyImages(id, files);
      // Re-fetch property to get updated images
      const updated = await apiGetProperty(id);
      setProperty(updated.property);
    } catch (err) {
      setImgError(err.message || "Failed to upload images.");
    } finally {
      setImgLoading(false);
      e.target.value = "";
    }
  };

  // ── Delete image ──────────────────────────────────────────────────────────
  const handleDeleteImage = async (imageId) => {
    if (!window.confirm("Remove this image?")) return;
    try {
      await apiDeletePropertyImage(imageId);
      const updated = await apiGetProperty(id);
      setProperty(updated.property);
    } catch (err) {
      alert(err.message || "Failed to delete image.");
    }
  };

  // ── Set primary image ─────────────────────────────────────────────────────
  const handleSetPrimary = async (imageId) => {
    try {
      await apiSetPrimaryPropertyImage(imageId);
      const updated = await apiGetProperty(id);
      setProperty(updated.property);
    } catch (err) {
      alert(err.message || "Failed to set primary image.");
    }
  };

  // ── Message owner ─────────────────────────────────────────────────────────
  const handleMessageOwner = async () => {
    if (!property?.owner_id) return;
    setMsgLoading(true);
    setMsgError("");
    setMsgSuccess("");
    try {
      const data = await apiGetOrCreateConversation(
        property.owner_id,
        property.id,
      );
      const convId = data.conversation.id;
      navigate(`/admin/messages?thread=${convId}`);
    } catch (err) {
      setMsgError(err.message || "Failed to start conversation.");
    } finally {
      setMsgLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant gap-2">
        <span className="material-symbols-outlined text-[20px] animate-spin">
          progress_activity
        </span>
        Loading property...
      </div>
    );
  }

  if (pageError || !property) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center bg-surface-container-lowest border rounded-xl p-8">
        <span className="material-symbols-outlined text-[48px] text-error">
          warning
        </span>
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mt-2">
          Property Not Found
        </h3>
        <p className="text-body-md text-on-surface-variant mt-2">{pageError}</p>
        <Link
          to="/admin/properties"
          className="mt-4 inline-block text-primary font-bold hover:underline"
        >
          Back to Property Queue
        </Link>
      </div>
    );
  }

  const coverImage = property.cover_image || property.images?.[0] || null;
  const verified = property.is_verified === 1 || property.is_verified === true;
  const owner = property.owner || {};
  // imageData has full objects {id, image_path, is_primary}; images is flat URL array
  const imageData = property.imageData || [];

  const typeOptions = [
    { value: "Apartment", label: "Apartment" },
    { value: "Townhouse", label: "Townhouse" },
    { value: "Studio", label: "Studio" },
    { value: "House", label: "Single House" },
  ];
  const countOptions = ["1", "2", "3", "4+"].map((v) => ({
    value: v,
    label: v,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <Link
            to="/admin/properties"
            className="text-on-surface-variant hover:text-primary flex items-center gap-1 font-label-md text-label-md mb-2 w-fit"
          >
            <span className="material-symbols-outlined text-sm">
              arrow_back
            </span>
            Back to Property Queue
          </Link>
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <StatusBadge status={verified ? "verified" : "unverified"} />
            <StatusBadge status={property.status} />
          </div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            {property.title}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant flex items-center gap-1 mt-1">
            <span className="material-symbols-outlined text-sm">
              location_on
            </span>
            {property.address}, {property.city}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {propertyReports.length > 0 && (
            <span className="flex items-center gap-2 px-4 py-2 border border-error/40 text-error rounded-lg font-label-md text-label-md bg-error-container/10">
              <span className="material-symbols-outlined text-sm">flag</span>
              {propertyReports.length} Report
              {propertyReports.length > 1 ? "s" : ""}
            </span>
          )}
          <Button
            variant="outline"
            onClick={openEdit}
            className="px-4 py-2 text-sm"
          >
            <span className="material-symbols-outlined text-[16px] mr-1">
              edit
            </span>
            Edit Property
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left */}
        <div className="lg:col-span-8 space-y-6">
          {/* Image gallery with management */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
            {coverImage ? (
              <>
                <div className="grid grid-cols-4 grid-rows-2 gap-1 h-80">
                  <div className="col-span-4 md:col-span-3 row-span-2 overflow-hidden">
                    <img
                      src={resolveImageUrl(coverImage)}
                      alt={property.title}
                      onClick={() => openLightbox(0)}
                      className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                      title="Click to view full size"
                      onError={(e) => {
                        e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800";
                      }}
                    />
                  </div>
                  {(property.images || []).slice(1, 3).map((img, i) => (
                    <div
                      key={i}
                      className="hidden md:block col-span-1 row-span-1 overflow-hidden"
                    >
                      <img
                        src={resolveImageUrl(img)}
                        alt={`${property.title} ${i + 2}`}
                        onClick={() => openLightbox(i + 1)}
                        className="w-full h-full object-cover cursor-pointer hover:opacity-95 transition-opacity"
                        title="Click to view full size"
                        onError={(e) => {
                          e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800";
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Image management strip */}
                <div className="p-4 border-t border-outline-variant/60 bg-surface-container-low space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-outline font-semibold uppercase tracking-wider">
                      Images ({(property.images || []).length} / {MAX_IMAGES})
                    </p>
                    {(property.images || []).length < MAX_IMAGES && (
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={imgLoading}
                        className="flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold hover:opacity-90 transition-opacity disabled:opacity-50"
                      >
                        <span className="material-symbols-outlined text-[15px]">
                          add_photo_alternate
                        </span>
                        {imgLoading ? "Uploading..." : "Add Images"}
                      </button>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      multiple
                      onChange={handleImageUpload}
                      className="hidden"
                    />
                  </div>
                  {imgError && (
                    <p className="text-xs text-error font-semibold flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px]">
                        warning
                      </span>
                      {imgError}
                    </p>
                  )}
                  <div className="flex gap-2 overflow-x-auto pb-1">
                    {imageData.length > 0
                      ? imageData.map((img, idx) => (
                          <div key={img.id} className="relative group shrink-0">
                            <img
                              src={resolveImageUrl(img.image_path)}
                              alt=""
                              onClick={() => openLightbox(idx)}
                              className={`w-24 h-16 object-cover rounded-lg border-2 transition-all cursor-pointer hover:opacity-90 ${
                                img.is_primary
                                  ? "border-primary shadow-md"
                                  : "border-outline-variant"
                              }`}
                              title="Click to view full size"
                              onError={(e) => {
                                e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800";
                              }}
                            />
                            {img.is_primary && (
                              <span className="absolute top-1 left-1 bg-primary text-on-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                Cover
                              </span>
                            )}
                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1">
                              {!img.is_primary && (
                                <button
                                  onClick={() => handleSetPrimary(img.id)}
                                  title="Set as cover"
                                  className="bg-primary text-on-primary rounded-full p-1"
                                >
                                  <span className="material-symbols-outlined text-[13px]">
                                    star
                                  </span>
                                </button>
                              )}
                              <button
                                onClick={() => handleDeleteImage(img.id)}
                                title="Delete image"
                                className="bg-error text-on-error rounded-full p-1"
                              >
                                <span className="material-symbols-outlined text-[13px]">
                                  delete
                                </span>
                              </button>
                            </div>
                          </div>
                        ))
                      : (property.images || []).map((img, i) => (
                          <a
                            key={i}
                            href={img}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <img
                              src={img}
                              alt=""
                              className="w-24 h-16 object-cover rounded-lg border-2 border-outline-variant hover:border-primary transition-colors shrink-0 cursor-pointer"
                            />
                          </a>
                        ))}
                  </div>
                  <p className="text-[10px] text-outline">
                    Hover over an image to set as cover or remove.
                  </p>
                </div>
              </>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center text-outline bg-surface-container gap-3">
                <span className="material-symbols-outlined text-[64px]">
                  home_work
                </span>
                <p className="text-sm font-semibold">No images uploaded</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={imgLoading}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-xs font-bold hover:opacity-90"
                >
                  <span className="material-symbols-outlined text-[15px]">
                    add_photo_alternate
                  </span>
                  Upload Images
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>
            )}
          </div>

          {/* Description */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-6">
            <div className="flex justify-between items-start mb-6 border-b border-outline-variant/60 pb-4">
              <div>
                <h2 className="font-headline-md text-headline-md text-on-surface mb-2">
                  Property Description
                </h2>
                <div className="flex gap-4 text-body-md text-on-surface-variant font-medium">
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">
                      bed
                    </span>
                    {property.bedrooms} Bed
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">
                      bathtub
                    </span>
                    {property.bathrooms} Bath
                  </span>
                  <span>{property.type}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="font-headline-lg text-headline-lg text-primary">
                  Rs. {Number(property.price).toLocaleString()}
                  <span className="font-body-md text-body-md text-on-surface-variant font-normal">
                    /mo
                  </span>
                </div>
                {property.available_from && (
                  <div className="text-xs text-outline mt-1">
                    Available:{" "}
                    {new Date(property.available_from).toLocaleDateString()}
                  </div>
                )}
              </div>
            </div>
            <p className="text-body-md text-on-surface-variant leading-relaxed">
              {property.description || "No description provided."}
            </p>
            {property.amenities?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-outline-variant/60">
                <h3 className="font-label-md text-label-md text-outline uppercase tracking-wider mb-2">
                  Amenities
                </h3>
                <div className="flex flex-wrap gap-2">
                  {property.amenities.map((a) => (
                    <span
                      key={a}
                      className="bg-surface-container px-3 py-1 rounded-full text-xs font-semibold text-on-surface border border-outline-variant/60"
                    >
                      {a}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {property.rules?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-outline-variant/60">
                <h3 className="font-label-md text-label-md text-outline uppercase tracking-wider mb-2">
                  House Rules
                </h3>
                <ul className="space-y-1">
                  {property.rules.map((r, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 text-xs text-on-surface-variant"
                    >
                      <span className="material-symbols-outlined text-[14px] text-outline mt-0.5">
                        info
                      </span>
                      {r}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Reports */}
          {propertyReports.length > 0 && (
            <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-error/40 p-6">
              <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4 flex items-center justify-between">
                User Reports
                <span className="bg-error-container text-on-error-container text-xs px-2 py-1 rounded-full font-bold">
                  {propertyReports.length}
                </span>
              </h3>
              <div className="space-y-3">
                {propertyReports.map((rep) => (
                  <div
                    key={rep.id}
                    className="p-3 bg-error-container/10 border border-error-container/40 rounded-lg"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-label-md text-label-md text-on-surface font-bold">
                        {rep.title}
                      </span>
                      <StatusBadge status={rep.status} />
                    </div>
                    <p className="text-body-md text-on-surface-variant text-sm">
                      {rep.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right */}
        <div className="lg:col-span-4 space-y-4">
          {/* Moderation */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-primary p-6 sticky top-24">
            <h2 className="font-headline-md text-headline-md text-on-surface mb-4 flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">
                admin_panel_settings
              </span>
              Moderation
            </h2>
            <div className="flex flex-col gap-3">
              {!verified && (
                <Button
                  variant="secondary"
                  onClick={handleApprove}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">
                    check_circle
                  </span>
                  {actionLoading ? "Processing..." : "Approve Listing"}
                </Button>
              )}
              {verified && (
                <Button
                  variant="outline"
                  onClick={handleUnverify}
                  disabled={actionLoading}
                  className="w-full flex items-center justify-center gap-2 border-error text-error"
                >
                  <span className="material-symbols-outlined text-sm">
                    cancel
                  </span>
                  Unverify Listing
                </Button>
              )}
              <Button
                variant="danger"
                onClick={handleDelete}
                disabled={actionLoading}
                className="w-full flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">
                  delete
                </span>
                {actionLoading ? "Processing..." : "Remove Listing"}
              </Button>
            </div>
            <div className="mt-4">
              <label className="block font-label-md text-label-md text-on-surface mb-1">
                Internal Notes
              </label>
              <Textarea
                placeholder="Add notes about your decision..."
                rows={3}
                value={moderatorNotes}
                onChange={(e) => setModeratorNotes(e.target.value)}
              />
            </div>
          </div>

          {/* Owner card */}
          <div className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-6">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4 border-b border-outline-variant/60 pb-2">
              Owner Details
            </h3>
            <div className="flex items-center gap-3 mb-4">
              <Avatar src={owner.profile_image} name={owner.name} size="md" />
              <div>
                <p className="font-label-md text-label-md text-on-surface font-bold">
                  {owner.name || "Unknown"}
                </p>
                <p className="text-xs text-on-surface-variant">
                  {owner.email || ""}
                </p>
              </div>
            </div>
            <div className="space-y-2 text-body-md text-sm mb-4">
              <div className="flex justify-between py-1.5 border-b border-outline-variant/60">
                <span className="text-on-surface-variant">Verified</span>
                <StatusBadge
                  status={owner.is_verified ? "verified" : "unverified"}
                />
              </div>
            </div>

            {/* Message Owner button */}
            {property.owner_id && (
              <div className="space-y-2">
                <button
                  onClick={handleMessageOwner}
                  disabled={msgLoading}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-primary text-primary rounded-lg text-sm font-bold hover:bg-primary-container/10 transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    chat
                  </span>
                  {msgLoading ? "Opening..." : "Message Owner"}
                </button>
                {msgSuccess && (
                  <p className="text-xs text-secondary font-semibold text-center">
                    {msgSuccess}
                  </p>
                )}
                {msgError && (
                  <p className="text-xs text-error font-semibold text-center">
                    {msgError}
                  </p>
                )}
                <Link
                  to={`/admin/users/${property.owner_id}`}
                  className="block text-center text-primary font-label-md text-label-md hover:underline text-sm"
                >
                  View Owner Profile
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Edit Property Modal ───────────────────────────────────────────── */}
      <Modal
        isOpen={editModal}
        onClose={() => setEditModal(false)}
        title={`Edit Property — ${property.title}`}
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
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
          {editError && (
            <div className="bg-error-container/20 border border-error/40 text-error p-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">warning</span>
              {editError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Property Title *"
              value={editFields.title || ""}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, title: e.target.value }))
              }
              containerClassName="md:col-span-2"
            />
            <Input
              label="Address *"
              value={editFields.address || ""}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, address: e.target.value }))
              }
              containerClassName="md:col-span-2"
            />
            <Input
              label="City"
              value={editFields.city || ""}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, city: e.target.value }))
              }
            />
            <Select
              label="Type"
              value={editFields.type || "Apartment"}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, type: e.target.value }))
              }
              options={typeOptions}
            />
            <Select
              label="Bedrooms"
              value={editFields.bedrooms || "1"}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, bedrooms: e.target.value }))
              }
              options={countOptions}
            />
            <Select
              label="Bathrooms"
              value={editFields.bathrooms || "1"}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, bathrooms: e.target.value }))
              }
              options={countOptions}
            />
            <Input
              label="Rent (Rs./month) *"
              type="number"
              min="1"
              value={editFields.price || ""}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, price: e.target.value }))
              }
            />
            <Input
              label="Deposit (Rs.)"
              type="number"
              min="0"
              value={editFields.deposit || ""}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, deposit: e.target.value }))
              }
            />
            <Input
              label="Available From"
              type="date"
              value={editFields.available_from || ""}
              onChange={(e) =>
                setEditFields((p) => ({ ...p, available_from: e.target.value }))
              }
              containerClassName="md:col-span-2"
            />
          </div>

          <Textarea
            label="Description"
            value={editFields.description || ""}
            onChange={(e) =>
              setEditFields((p) => ({ ...p, description: e.target.value }))
            }
            rows={4}
          />
          <Input
            label="House Rules (comma-separated)"
            value={editFields.rules || ""}
            onChange={(e) =>
              setEditFields((p) => ({ ...p, rules: e.target.value }))
            }
            placeholder="No smoking, No pets..."
          />

          {/* Amenities */}
          <div>
            <label className="block font-label-md text-label-md text-on-surface mb-2">
              Amenities
            </label>
            <div className="grid grid-cols-2 gap-2">
              {AMENITIES_LIST.map((a) => {
                const checked = (editFields.amenities || []).includes(a);
                return (
                  <label
                    key={a}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm transition-colors ${
                      checked
                        ? "bg-primary-container/10 border-primary text-primary"
                        : "border-outline-variant text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAmenity(a)}
                      className="rounded text-primary h-3.5 w-3.5"
                    />
                    {a}
                  </label>
                );
              })}
            </div>
          </div>
        </div>
      </Modal>

      {/* Full-scale image lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          images={(
            imageData.length > 0
              ? imageData.map((i) => i.image_path)
              : (property.images || []).length > 0
                ? property.images
                : coverImage
                  ? [coverImage]
                  : []
          ).map(resolveImageUrl)}
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};

export default AdminPropertyDetails;
