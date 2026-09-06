import React, { useState, useContext, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useProperties } from "@shared/hooks/useProperties";
import { AuthContext } from "@shared/context/AuthContext";
import {
  apiAddFavourite,
  apiRemoveFavourite,
  apiGetFavouriteStatus,
  resolveImageUrl,
} from "@shared/services/api";
import { formatCurrency } from "@shared/utils/currency";
import Input from "@shared/components/common/Input";
import Select from "@shared/components/common/Select";
import EmptyState from "@shared/components/common/EmptyState";
import PropertyMap from "@shared/components/common/PropertyMap";
import ImageLightbox from "@shared/components/common/ImageLightbox";

export const PropertySearch = () => {
  const { properties } = useProperties();
  const { currentUser, updateProfile } = useContext(AuthContext);
  const [searchParams] = useSearchParams();

  // Search & Filters state
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [maxPrice, setMaxPrice] = useState("");
  const [city, setCity] = useState(searchParams.get("city") || "");
  const [type, setType] = useState("");
  const [bedrooms, setBedrooms] = useState("");
  const [selectedAmenities, setSelectedAmenities] = useState([]);

  // Check URL query parameters on load
  useEffect(() => {
    const urlQuery = searchParams.get("search");
    if (urlQuery) {
      setSearch(urlQuery);
    }
  }, [searchParams]);

  const toggleAmenity = (amenity) => {
    if (selectedAmenities.includes(amenity)) {
      setSelectedAmenities((prev) => prev.filter((a) => a !== amenity));
    } else {
      setSelectedAmenities((prev) => [...prev, amenity]);
    }
  };

  // Favourites state — loaded from real API
  const [favouriteIds, setFavouriteIds] = useState(new Set());

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState([]);
  const openLightbox = (images, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (images && images.length > 0) {
      setLightboxImages(images);
      setLightboxOpen(true);
    }
  };

  const handleFavoriteToggle = async (propId, e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!currentUser) return;
    try {
      if (favouriteIds.has(propId)) {
        await apiRemoveFavourite(propId);
        setFavouriteIds((prev) => {
          const s = new Set(prev);
          s.delete(propId);
          return s;
        });
      } else {
        await apiAddFavourite(propId);
        setFavouriteIds((prev) => new Set([...prev, propId]));
      }
    } catch (err) {
      console.warn("Favourite toggle failed:", err.message);
    }
  };
  // Filter logic
  const filteredProperties = properties.filter((p) => {
    if (p.status !== "active") return false;

    // Text search (Title, address, description, city)
    if (search) {
      const q = search.toLowerCase();
      const matchText =
        p.title.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q);
      if (!matchText) return false;
    }

    // City filter (exact match, case-insensitive)
    if (city && !p.city.toLowerCase().includes(city.toLowerCase())) {
      return false;
    }

    // Max price
    if (maxPrice && p.price > Number(maxPrice)) {
      return false;
    }

    // Property type
    if (type && p.type !== type) {
      return false;
    }

    // Bedrooms
    if (bedrooms) {
      if (bedrooms === "3+") {
        if (p.bedrooms < 3) return false;
      } else if (p.bedrooms !== Number(bedrooms)) {
        if (!(bedrooms === "1" && p.type.toLowerCase() === "studio")) {
          return false;
        }
      }
    }

    // Amenities
    if (selectedAmenities.length > 0) {
      const hasAll = selectedAmenities.every((a) => p.amenities.includes(a));
      if (!hasAll) return false;
    }

    return true;
  });

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

  const typeOptions = [
    { value: "", label: "All Types" },
    { value: "Apartment", label: "Apartment" },
    { value: "Townhouse", label: "Townhouse" },
    { value: "Studio", label: "Studio" },
  ];

  const bedroomOptions = [
    { value: "", label: "Any Bedrooms" },
    { value: "1", label: "1 Bedroom / Studio" },
    { value: "2", label: "2 Bedrooms" },
    { value: "3+", label: "3+ Bedrooms" },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-headline-md text-headline-md text-on-surface">
          Search Verified Properties
        </h1>
        <p className="font-body-md text-body-md text-on-surface-variant mt-1">
          Browse rental rooms and whole units verified by university guidelines
        </p>
      </div>

      {/* Filters Section */}
      <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <Input
            placeholder="Search address, city, university..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon="search"
          />
          <Input
            placeholder="Filter by City"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            icon="location_city"
          />
          <Input
            placeholder="Max Budget (Rs. / month)"
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            icon="payments"
          />
          <Select
            options={typeOptions}
            value={type}
            onChange={(e) => setType(e.target.value)}
          />
          <Select
            options={bedroomOptions}
            value={bedrooms}
            onChange={(e) => setBedrooms(e.target.value)}
          />
        </div>

        {/* Amenities Toggles */}
        <div className="pt-2">
          <span className="font-label-md text-label-md text-on-surface-variant font-bold block mb-2">
            Amenities Filter
          </span>
          <div className="flex flex-wrap gap-2">
            {amenitiesList.map((amenity) => {
              const isSel = selectedAmenities.includes(amenity);
              return (
                <button
                  key={amenity}
                  onClick={() => toggleAmenity(amenity)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    isSel
                      ? "bg-primary-container text-on-primary-container border-primary"
                      : "bg-surface text-on-surface-variant border-outline-variant hover:bg-surface-container-high"
                  }`}
                >
                  {amenity}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Properties Display */}
      {filteredProperties.length === 0 ? (
        <EmptyState
          icon="home"
          title="No rentals match your filters"
          description="Try broadening your search criteria or resetting filters to see available units."
          actionText="Reset All Filters"
          onActionClick={() => {
            setSearch("");
            setMaxPrice("");
            setCity("");
            setType("");
            setBedrooms("");
            setSelectedAmenities([]);
          }}
        />
      ) : (
        <>
          {/* Map view of all results */}
          {filteredProperties.some((p) => p.latitude && p.longitude) && (
            <section className="rounded-xl overflow-hidden border border-outline-variant shadow-sm">
              <PropertyMap
                properties={filteredProperties}
                height="320px"
                zoom={13}
              />
            </section>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {filteredProperties.map((prop) => {
              const imgSrc = prop.cover_image || prop.images?.[0] || null;
              const isFaved = favouriteIds.has(prop.id);
              const verified =
                prop.is_verified === 1 || prop.is_verified === true;
              const availFrom = prop.available_from
                ? new Date(prop.available_from).toLocaleDateString()
                : "Now";
              return (
                <Link
                  key={prop.id}
                  to={`/user/properties/${prop.id}`}
                  className="bg-surface-container-lowest rounded-xl border border-outline-variant overflow-hidden flex flex-col justify-between hover:shadow-md transition-shadow relative group"
                >
                  {/* Card Image */}
                  <div className="relative h-48 w-full bg-surface-container">
                    {imgSrc ? (
                      <img
                        src={resolveImageUrl(imgSrc)}
                        alt={prop.title}
                        onClick={(e) =>
                          openLightbox(
                            prop.images && prop.images.length > 0
                              ? prop.images
                              : [imgSrc],
                            e,
                          )
                        }
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        title="Click to view full size"
                        onError={(e) => {
                          e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800";
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-outline">
                        <span className="material-symbols-outlined text-[48px]">
                          home_work
                        </span>
                      </div>
                    )}

                    {/* Verification Badge */}
                    {verified && (
                      <div className="absolute top-3 left-3 bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full font-label-sm text-label-sm border border-secondary flex items-center gap-0.5 font-bold shadow-sm">
                        <span className="material-symbols-outlined text-sm icon-fill">
                          verified
                        </span>
                        VERIFIED
                      </div>
                    )}

                    {/* Favourite Toggle */}
                    {currentUser && (
                      <button
                        onClick={(e) => handleFavoriteToggle(prop.id, e)}
                        className="absolute top-3 right-3 p-2 bg-surface-container-lowest/90 hover:bg-surface-container-lowest border border-outline-variant rounded-full transition-transform flex items-center justify-center shadow-sm select-none"
                        title={
                          isFaved ? "Remove from Favourites" : "Save Property"
                        }
                      >
                        <span
                          className={`material-symbols-outlined text-[20px] ${isFaved ? "text-error icon-fill" : "text-outline"}`}
                        >
                          favorite
                        </span>
                      </button>
                    )}
                  </div>

                  {/* Card Body */}
                  <div className="p-5 flex-grow flex flex-col justify-between gap-4">
                    <div>
                      <div className="flex justify-between items-center text-xs text-outline font-semibold mb-1">
                        <span>{prop.type?.toUpperCase()}</span>
                        <span>AVAILABLE {availFrom}</span>
                      </div>
                      <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold group-hover:text-primary transition-colors truncate">
                        {prop.title}
                      </h3>
                      <p className="text-body-md text-on-surface-variant font-medium mt-1 truncate">
                        {prop.address}, {prop.city}
                      </p>
                      <div className="flex items-center gap-4 text-xs text-on-surface-variant font-medium mt-3">
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">
                            bed
                          </span>
                          {prop.bedrooms} Bed
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="material-symbols-outlined text-sm">
                            bathtub
                          </span>
                          {prop.bathrooms} Bath
                        </span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center border-t border-outline-variant/60 pt-3">
                      <span className="font-headline-sm text-headline-sm text-primary font-bold">
                        {formatCurrency(prop.price)}
                        <span className="text-xs text-outline font-normal">
                          /mo
                        </span>
                      </span>
                      <span className="text-xs text-primary font-bold flex items-center gap-0.5">
                        View Details
                        <span className="material-symbols-outlined text-[16px]">
                          chevron_right
                        </span>
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}

      {/* Full-scale image lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          images={lightboxImages}
          startIndex={0}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};

export default PropertySearch;
