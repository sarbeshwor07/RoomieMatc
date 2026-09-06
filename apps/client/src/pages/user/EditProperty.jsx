/**
 * EditProperty.jsx — Edit property with full image management.
 * Owners can view existing images, add new ones, remove, and change primary.
 */
import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProperties } from "@shared/hooks/useProperties";
import Button from "@shared/components/common/Button";
import Input from "@shared/components/common/Input";
import Select from "@shared/components/common/Select";
import Textarea from "@shared/components/common/Textarea";
import {
  apiGetPropertyImages,
  apiUploadPropertyImages,
  apiDeletePropertyImage,
  apiSetPrimaryPropertyImage,
  resolveImageUrl,
} from "@shared/services/api";

const MAX_IMAGES = 6;
const MAX_SIZE_MB = 8;
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const ALLOWED_EXTS = [".jpg", ".jpeg", ".png", ".webp"];

export const EditProperty = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { properties, editProperty } = useProperties();
  const fileInputRef = useRef(null);
  const property = properties.find((p) => p.id === id);

  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("Metro City");
  const [type, setType] = useState("Apartment");
  const [bedrooms, setBedrooms] = useState("2");
  const [bathrooms, setBathrooms] = useState("2");
  const [price, setPrice] = useState("");
  const [deposit, setDeposit] = useState("");
  const [description, setDescription] = useState("");
  const [rulesStr, setRulesStr] = useState("");
  const [amenities, setAmenities] = useState([]);

  // Existing images from backend
  const [serverImages, setServerImages] = useState([]);
  // New local files pending upload
  const [pendingFiles, setPendingFiles] = useState([]); // {file, preview}
  const [imageError, setImageError] = useState("");
  const [imgLoading, setImgLoading] = useState(false);

  useEffect(() => {
    if (property) {
      setTitle(property.title);
      setAddress(property.address);
      setCity(property.city);
      setType(property.type);
      setBedrooms(String(property.bedrooms));
      setBathrooms(String(property.bathrooms));
      setPrice(String(property.price));
      setDeposit(String(property.deposit));
      setDescription(property.description);
      setRulesStr(property.rules?.join(", ") || "");
      setAmenities(property.amenities || []);
    }
  }, [property]);

  // Load server images
  useEffect(() => {
    if (!id) return;
    apiGetPropertyImages(id)
      .then((data) => setServerImages(data.images || []))
      .catch(() => {
        // Backend offline — show property.images from localStorage as fallback
        if (property?.images) {
          setServerImages(
            property.images.map((url, i) => ({
              id: `local_${i}`,
              image_path: url,
              is_primary: i === 0,
            })),
          );
        }
      });
  }, [id]);

  if (!property)
    return (
      <div className="max-w-xl mx-auto py-12 text-center bg-surface-container-lowest border rounded-xl">
        <span className="material-symbols-outlined text-[48px] text-error">
          warning
        </span>
        <h3 className="font-headline-sm text-on-surface font-bold mt-2">
          Listing Not Found
        </h3>
        <Button
          onClick={() => navigate("/user/my-properties")}
          className="mt-4 mx-auto"
        >
          Back to Listings
        </Button>
      </div>
    );

  const totalImages = serverImages.length + pendingFiles.length;
  const toggleAmenity = (a) =>
    setAmenities((prev) =>
      prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a],
    );

  // ── Image handlers ───────────────────────────────────────────────────────
  const handleImageSelect = (e) => {
    setImageError("");
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (totalImages + files.length > MAX_IMAGES) {
      setImageError(`You can upload up to ${MAX_IMAGES} property images.`);
      e.target.value = "";
      return;
    }
    const newPending = [];
    for (const file of files) {
      const ext = "." + file.name.split(".").pop().toLowerCase();
      if (
        !ALLOWED_TYPES.includes(file.type.toLowerCase()) ||
        !ALLOWED_EXTS.includes(ext)
      ) {
        setImageError("Please upload JPG, PNG, or WEBP images only.");
        e.target.value = "";
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setImageError(`Image size exceeds ${MAX_SIZE_MB} MB.`);
        e.target.value = "";
        return;
      }
      newPending.push({ file, preview: URL.createObjectURL(file) });
    }
    setPendingFiles((prev) => [...prev, ...newPending]);
    e.target.value = "";
  };

  const uploadPending = async () => {
    if (!pendingFiles.length) return;
    setImgLoading(true);
    setImageError("");
    try {
      const data = await apiUploadPropertyImages(
        id,
        pendingFiles.map((p) => p.file),
      );
      setServerImages((prev) => [...prev, ...(data.images || [])]);
      pendingFiles.forEach((p) => URL.revokeObjectURL(p.preview));
      setPendingFiles([]);
    } catch (err) {
      setImageError(err.message || "Failed to upload images.");
    } finally {
      setImgLoading(false);
    }
  };

  const handleDeleteServerImage = async (imgId) => {
    if (imgId.startsWith("local_")) {
      setServerImages((prev) => prev.filter((img) => img.id !== imgId));
      return;
    }
    setImgLoading(true);
    try {
      await apiDeletePropertyImage(imgId);
      setServerImages((prev) => prev.filter((img) => img.id !== imgId));
    } catch (err) {
      setImageError(err.message || "Failed to delete image.");
    } finally {
      setImgLoading(false);
    }
  };

  const handleSetPrimary = async (imgId) => {
    if (imgId.startsWith("local_")) {
      setServerImages((prev) =>
        prev.map((img) => ({ ...img, is_primary: img.id === imgId ? 1 : 0 })),
      );
      return;
    }
    setImgLoading(true);
    try {
      await apiSetPrimaryPropertyImage(imgId);
      setServerImages((prev) =>
        prev.map((img) => ({ ...img, is_primary: img.id === imgId ? 1 : 0 })),
      );
    } catch (err) {
      setImageError(err.message || "Failed to update primary image.");
    } finally {
      setImgLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Upload any pending images first
    if (pendingFiles.length) {
      await uploadPending();
    }

    const rules = rulesStr
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean);
    editProperty(property.id, {
      title,
      address,
      city,
      type,
      bedrooms: Number(bedrooms),
      bathrooms: Number(bathrooms),
      price: Number(price),
      deposit: Number(deposit) || Number(price),
      description,
      rules,
      amenities,
      images: serverImages.map((img) => img.image_path),
    });

    alert("Property listing updated successfully!");
    navigate("/user/my-properties");
  };

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
  const amenitiesList = [
    "Wifi",
    "Air Conditioning",
    "On-site Laundry",
    "In-unit Laundry",
    "Parking Spot",
    "Garage Parking",
    "Fully Furnished",
    "Dishwasher",
    "Private Backyard",
  ];

  return (
    <div className="max-w-3xl mx-auto bg-surface-container-lowest p-8 rounded-xl border border-outline-variant shadow-sm">
      <div className="mb-6">
        <h1 className="font-headline-sm text-headline-sm text-on-surface">
          Edit Property Listing
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-0.5">
          Modify details, pricing, rules, and photos
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Property Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Select
            label="Property Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            options={typeOptions}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            label="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            required
            containerClassName="md:col-span-2"
          />
          <Input
            label="City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Select
            label="Bedrooms"
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
            options={countOptions}
          />
          <Select
            label="Bathrooms"
            value={bathrooms}
            onChange={(e) => setBathrooms(e.target.value)}
            options={countOptions}
          />
          <Input
            label="Rent (Rs./month)"
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            required
          />
          <Input
            label="Deposit (Rs.)"
            type="number"
            value={deposit}
            onChange={(e) => setDeposit(e.target.value)}
          />
        </div>

        <Textarea
          label="Detailed Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          required
        />
        <Input
          label="House Rules (comma-separated)"
          value={rulesStr}
          onChange={(e) => setRulesStr(e.target.value)}
        />

        {/* Amenities */}
        <div className="space-y-2">
          <span className="font-label-md text-label-md text-on-surface-variant font-bold block">
            Select Amenities
          </span>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {amenitiesList.map((a) => {
              const checked = amenities.includes(a);
              return (
                <label
                  key={a}
                  className={`flex items-center gap-2 px-4 py-3 rounded-lg border cursor-pointer select-none transition-colors ${checked ? "bg-primary-container/10 border-primary text-primary" : "bg-surface border-outline-variant hover:bg-surface-container-high text-on-surface-variant"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleAmenity(a)}
                    className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                  />
                  <span className="font-body-md text-body-md font-semibold">
                    {a}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Property Images */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="font-label-md text-label-md text-on-surface-variant font-bold">
              Property Photos
            </span>
            <span className="text-xs text-outline">
              {totalImages}/{MAX_IMAGES}
            </span>
          </div>

          <div className="flex flex-wrap gap-3">
            {/* Existing server images */}
            {serverImages.map((img) => (
              <div key={img.id} className="relative group">
                <img
                  src={resolveImageUrl(img.image_path)}
                  alt=""
                  className={`w-24 h-20 object-cover rounded-xl border-2 transition-all ${img.is_primary ? "border-primary shadow-md" : "border-outline-variant"}`}
                  onError={(e) => {
                    e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800";
                  }}
                />
                {img.is_primary === 1 && (
                  <span className="absolute top-1 left-1 bg-primary text-on-primary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                    Primary
                  </span>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center gap-1">
                  {!img.is_primary && (
                    <button
                      type="button"
                      onClick={() => handleSetPrimary(img.id)}
                      className="bg-primary text-on-primary rounded-full p-1"
                    >
                      <span className="material-symbols-outlined text-[14px]">
                        star
                      </span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteServerImage(img.id)}
                    className="bg-error text-on-error rounded-full p-1"
                  >
                    <span className="material-symbols-outlined text-[14px]">
                      delete
                    </span>
                  </button>
                </div>
              </div>
            ))}

            {/* Pending (local preview) */}
            {pendingFiles.map((p, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={p.preview}
                  alt=""
                  className="w-24 h-20 object-cover rounded-xl border-2 border-dashed border-primary/60 opacity-80"
                />
                <span className="absolute top-1 left-1 bg-secondary text-on-secondary text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                  New
                </span>
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(p.preview);
                    setPendingFiles((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  className="absolute top-1 right-1 bg-error text-on-error rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[12px]">
                    close
                  </span>
                </button>
              </div>
            ))}

            {totalImages < MAX_IMAGES && (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-24 h-20 border-2 border-dashed border-outline-variant hover:border-primary/60 rounded-xl flex flex-col items-center justify-center gap-1 transition-colors"
              >
                <span className="material-symbols-outlined text-[24px] text-outline">
                  add_photo_alternate
                </span>
                <span className="text-[10px] text-outline font-semibold">
                  Add Photo
                </span>
              </button>
            )}
          </div>

          {imgLoading && (
            <p className="text-xs text-on-surface-variant flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px] animate-spin">
                progress_activity
              </span>
              Processing images...
            </p>
          )}
          {imageError && (
            <p className="text-xs text-error font-semibold flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">
                warning
              </span>
              {imageError}
            </p>
          )}
          <p className="text-xs text-outline">
            JPG, PNG, WEBP · Max {MAX_SIZE_MB} MB · Hover to set primary or
            delete
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            multiple
            onChange={handleImageSelect}
            className="hidden"
          />
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-outline-variant/60">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/user/my-properties")}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={imgLoading}>
            {imgLoading ? (
              <span className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditProperty;
