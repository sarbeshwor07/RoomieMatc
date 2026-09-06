/**
 * PropertyDetails.jsx
 *
 * Loads a single property from GET /api/properties/:id (real API).
 * Apply calls POST /api/applications.
 * Message Owner: getOrCreateThread is async — awaited before navigating.
 * Favourite toggle calls apiAddFavourite / apiRemoveFavourite.
 * Owner info comes from property.owner (returned by API).
 * All field names use snake_case from API (is_verified, available_from, owner_id).
 */
import React, { useState, useEffect, useContext } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { AuthContext } from "@shared/context/AuthContext";
import { useMessages } from "@shared/hooks/useMessages";
import { formatCurrency } from "@shared/utils/currency";
import {
  apiGetProperty,
  apiSubmitApplication,
  apiAddFavourite,
  apiRemoveFavourite,
  apiGetFavouriteStatus,
  apiListReviews,
  apiSubmitReview,
  apiSubmitReport,
  resolveImageUrl,
} from "@shared/services/api";
import Avatar from "@shared/components/common/Avatar";
import Button from "@shared/components/common/Button";
import Modal from "@shared/components/common/Modal";
import Textarea from "@shared/components/common/Textarea";
import PropertyMap from "@shared/components/common/PropertyMap";
import Rating from "@shared/components/common/Rating";
import ImageLightbox from "@shared/components/common/ImageLightbox";

export const PropertyDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useContext(AuthContext);
  const { getOrCreateThread } = useMessages();

  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");

  const [isFavourited, setIsFavourited] = useState(false);
  const [favLoading, setFavLoading] = useState(false);

  const [applyOpen, setApplyOpen] = useState(false);
  const [appMessage, setAppMessage] = useState("");
  const [appLoading, setAppLoading] = useState(false);
  const [appError, setAppError] = useState("");

  // Lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const openLightbox = (index = 0) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // Reviews state
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Report state
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportSuccess, setReportSuccess] = useState(false);

  // Load property
  useEffect(() => {
    setLoading(true);
    apiGetProperty(id)
      .then((data) => setProperty(data.property))
      .catch((err) => setPageError(err.message || "Property not found."))
      .finally(() => setLoading(false));
  }, [id]);

  // Load favourite status
  useEffect(() => {
    if (!currentUser || !id) return;
    apiGetFavouriteStatus(id)
      .then((data) => setIsFavourited(!!data.isFavourited))
      .catch(() => {});
  }, [id, currentUser]);

  // ── Favourite toggle ────────────────────────────────────────────────────
  const handleFavouriteToggle = async () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    setFavLoading(true);
    try {
      if (isFavourited) {
        await apiRemoveFavourite(id);
        setIsFavourited(false);
      } else {
        await apiAddFavourite(id);
        setIsFavourited(true);
      }
    } catch (err) {
      alert(err.message || "Failed to update favourite.");
    } finally {
      setFavLoading(false);
    }
  };

  // ── Message owner ───────────────────────────────────────────────────────
  const handleMessageOwner = async () => {
    if (!currentUser) {
      navigate("/login");
      return;
    }
    if (!property?.owner_id) return;
    const threadId = await getOrCreateThread(property.owner_id, property.id);
    if (threadId) navigate(`/user/messages?thread=${threadId}`);
  };

  // Load reviews for this property
  useEffect(() => {
    if (!id) return;
    setReviewsLoading(true);
    apiListReviews({ targetProperty: id })
      .then((data) => setReviews(data.reviews || []))
      .catch(() => {})
      .finally(() => setReviewsLoading(false));
  }, [id]);

  // ── Submit review ────────────────────────────────────────────────────────
  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    if (!reviewComment.trim()) {
      setReviewError("Please write a comment.");
      return;
    }
    setReviewLoading(true);
    setReviewError("");
    try {
      await apiSubmitReview({
        rating: reviewRating,
        comment: reviewComment,
        target_property: id,
      });
      const data = await apiListReviews({ targetProperty: id });
      setReviews(data.reviews || []);
      setReviewOpen(false);
      setReviewComment("");
      setReviewRating(5);
    } catch (err) {
      setReviewError(err.message || "Failed to submit review.");
    } finally {
      setReviewLoading(false);
    }
  };

  // ── Submit report ─────────────────────────────────────────────────────────
  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) {
      setReportError("Please describe the issue.");
      return;
    }
    setReportLoading(true);
    setReportError("");
    try {
      await apiSubmitReport({
        title: "Inappropriate Property Listing",
        reason: reportReason,
        reported_property_id: id,
      });
      setReportSuccess(true);
      setReportReason("");
    } catch (err) {
      setReportError(err.message || "Failed to submit report.");
    } finally {
      setReportLoading(false);
    }
  };

  // ── Apply ───────────────────────────────────────────────────────────────
  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!currentUser) return;
    setAppLoading(true);
    setAppError("");
    try {
      await apiSubmitApplication(property.id, appMessage);
      setApplyOpen(false);
      setAppMessage("");
      navigate("/user/applications");
    } catch (err) {
      setAppError(err.message || "Failed to submit application.");
    } finally {
      setAppLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-on-surface-variant gap-2">
        <span className="material-symbols-outlined text-[20px] animate-spin">
          progress_activity
        </span>
        Loading property...
      </div>
    );
  }

  if (pageError || !property) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <div className="bg-error-container/20 border border-error/20 p-6 rounded-xl text-center">
          <span className="material-symbols-outlined text-[48px] text-error">
            warning
          </span>
          <h3 className="font-headline-sm text-headline-sm text-on-surface mt-2 font-bold">
            Property Not Found
          </h3>
          <p className="text-body-md text-on-surface-variant mt-2">
            {pageError || "This listing does not exist or has been removed."}
          </p>
          <Link
            to="/user/properties"
            className="mt-4 inline-block text-primary font-bold hover:underline"
          >
            Back to search
          </Link>
        </div>
      </div>
    );
  }

  const verified = property.is_verified === 1 || property.is_verified === true;
  const isOwnProperty = currentUser?.id === property.owner_id;
  const coverImage = property.cover_image || property.images?.[0] || null;
  const availFrom = property.available_from
    ? new Date(property.available_from).toLocaleDateString()
    : "Available Now";
  const avgRating = reviews.length
    ? (
        reviews.reduce((s, r) => s + parseFloat(r.rating), 0) / reviews.length
      ).toFixed(1)
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12">
      {/* Back */}
      <Link
        to="/user/properties"
        className="text-on-surface-variant font-label-md text-label-md hover:text-primary transition-colors flex items-center gap-1 w-fit"
      >
        <span className="material-symbols-outlined text-[18px]">
          arrow_back
        </span>
        Back to Listings
      </Link>

      {/* Header */}
      <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm flex flex-col md:flex-row justify-between items-start gap-4">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-surface-container-high px-2.5 py-0.5 rounded-full font-label-sm text-label-sm uppercase font-semibold text-on-surface-variant border border-outline-variant">
              {property.type}
            </span>
            {verified && (
              <span className="bg-secondary-container text-on-secondary-container px-2.5 py-0.5 rounded-full font-label-sm text-label-sm border border-secondary flex items-center gap-0.5 font-bold uppercase tracking-wider">
                <span className="material-symbols-outlined text-sm icon-fill">
                  verified
                </span>
                Verified
              </span>
            )}
          </div>
          <h1 className="font-headline-md text-headline-md text-on-surface font-bold">
            {property.title}
          </h1>
          <p className="text-body-lg text-on-surface-variant font-medium flex items-center gap-1">
            <span className="material-symbols-outlined text-outline text-[18px]">
              location_on
            </span>
            {property.address}, {property.city}
          </p>
        </div>

        <div className="flex flex-row md:flex-col items-end gap-3 justify-between w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
          <div className="text-right">
            <p className="font-headline-lg text-headline-lg text-primary font-bold">
              {formatCurrency(property.price)}
            </p>
            <p className="text-xs text-outline font-semibold">
              /month + {formatCurrency(property.deposit)} deposit
            </p>
          </div>
          <button
            onClick={handleFavouriteToggle}
            disabled={favLoading}
            className="flex items-center gap-1 px-4 py-2 border border-outline-variant rounded-lg text-on-surface hover:text-error hover:bg-surface-container transition-colors shadow-sm select-none disabled:opacity-50"
          >
            <span
              className={`material-symbols-outlined text-[20px] ${isFavourited ? "text-error icon-fill" : ""}`}
            >
              favorite
            </span>
            <span>{isFavourited ? "Saved" : "Save"}</span>
          </button>
          {currentUser && !isOwnProperty && (
            <button
              onClick={() => {
                setReportOpen(true);
                setReportError("");
                setReportSuccess(false);
              }}
              className="flex items-center gap-1 px-4 py-2 border border-outline-variant rounded-lg text-on-surface hover:text-error hover:bg-surface-container transition-colors shadow-sm select-none text-sm"
              title="Report this listing"
            >
              <span className="material-symbols-outlined text-[18px]">
                flag
              </span>
              <span>Report</span>
            </button>
          )}
        </div>
      </section>

      {/* Cover image */}
      <section className="rounded-xl overflow-hidden shadow-sm border border-outline-variant bg-surface-container">
        {coverImage ? (
          <img
            src={resolveImageUrl(coverImage)}
            alt={property.title}
            onClick={() => openLightbox(0)}
            className="w-full object-contain max-h-[480px] cursor-pointer hover:opacity-95 transition-opacity"
            title="Click to view full size"
            onError={(e) => {
              e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800";
            }}
          />
        ) : (
          <div className="w-full h-64 flex items-center justify-center text-outline">
            <span className="material-symbols-outlined text-[64px]">
              home_work
            </span>
          </div>
        )}
      </section>

      {/* Image gallery (if multiple) */}
      {property.images && property.images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {property.images.map((img, i) => (
            <img
              key={i}
              src={resolveImageUrl(img)}
              alt={`${property.title} ${i + 1}`}
              onClick={() => openLightbox(i)}
              className="w-28 h-20 object-cover rounded-lg border-2 border-outline-variant shrink-0 cursor-pointer hover:border-primary hover:opacity-90 transition-all"
              title="Click to view full size"
              onError={(e) => {
                e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800";
              }}
            />
          ))}
        </div>
      )}

      {/* Details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Description, amenities, rules */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">
              Description
            </h2>
            <p className="text-body-md text-on-surface-variant leading-relaxed whitespace-pre-line">
              {property.description || "No description provided."}
            </p>
          </section>

          {property.amenities && property.amenities.length > 0 && (
            <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">
                Amenities
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {property.amenities.map((amenity) => (
                  <div
                    key={amenity}
                    className="flex items-center gap-2 text-body-md text-on-surface-variant font-medium"
                  >
                    <span className="material-symbols-outlined text-secondary icon-fill">
                      check_circle
                    </span>
                    <span>{amenity}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {property.rules && property.rules.length > 0 && (
            <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
              <h2 className="font-headline-sm text-headline-sm text-on-surface mb-4">
                House Rules
              </h2>
              <ul className="space-y-3">
                {property.rules.map((rule, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-body-md text-on-surface-variant"
                  >
                    <span className="material-symbols-outlined text-outline text-[18px] mt-0.5">
                      info
                    </span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Map */}
          {property.latitude && property.longitude && (
            <section className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-sm overflow-hidden">
              <div className="px-6 pt-5 pb-3">
                <h2 className="font-headline-sm text-headline-sm text-on-surface flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">
                    location_on
                  </span>
                  Location
                </h2>
                <p className="text-body-md text-on-surface-variant mt-1">
                  {property.address}, {property.city}
                </p>
              </div>
              <PropertyMap
                lat={property.latitude}
                lng={property.longitude}
                title={property.title}
                address={`${property.address}, ${property.city}`}
                height="280px"
              />
            </section>
          )}

          {/* Reviews & Ratings */}
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <h2 className="font-headline-sm text-headline-sm text-on-surface">
                  Reviews & Ratings
                </h2>
                {avgRating && (
                  <div className="flex items-center gap-1.5">
                    <Rating value={parseFloat(avgRating)} />
                    <span className="font-bold text-label-md text-on-surface">
                      {avgRating} ({reviews.length})
                    </span>
                  </div>
                )}
              </div>
              {currentUser && !isOwnProperty && (
                <button
                  onClick={() => {
                    setReviewOpen(true);
                    setReviewError("");
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-on-primary rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[17px]">
                    rate_review
                  </span>
                  Write Review
                </button>
              )}
            </div>

            {reviewsLoading ? (
              <div className="flex items-center gap-2 text-on-surface-variant text-sm">
                <span className="material-symbols-outlined text-[16px] animate-spin">
                  progress_activity
                </span>
                Loading reviews...
              </div>
            ) : reviews.length === 0 ? (
              <p className="text-body-md text-on-surface-variant">
                No reviews yet.{" "}
                {currentUser && !isOwnProperty
                  ? "Be the first to leave one!"
                  : ""}
              </p>
            ) : (
              <div className="space-y-4">
                {reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="border-b border-outline-variant/60 pb-4 last:border-b-0 last:pb-0"
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="font-label-md text-label-md text-on-surface font-bold">
                          {rev.reviewer_name}
                        </span>
                      </div>
                      <Rating value={parseFloat(rev.rating)} />
                    </div>
                    <p className="text-body-md text-on-surface-variant mt-2">
                      {rev.comment}
                    </p>
                    <span className="text-[10px] text-outline block mt-1 text-right">
                      {rev.created_at
                        ? new Date(rev.created_at).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Right: Owner card + details */}
        <div className="space-y-6">
          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm text-center">
            <h3 className="font-label-md text-label-md text-outline uppercase tracking-wider font-semibold mb-4">
              Property Owner
            </h3>
            <div className="flex flex-col items-center gap-3 mb-6">
              <Avatar
                src={property.owner?.profile_image || null}
                name={property.owner?.name || property.owner_name || "Owner"}
                size="xl"
              />
              <div>
                <h4 className="font-headline-sm text-headline-sm text-on-surface font-bold">
                  {property.owner?.name || property.owner_name || "Owner"}
                </h4>
                <div className="flex items-center justify-center gap-1 mt-0.5">
                  {property.owner?.is_verified || property.owner?.isVerified ? (
                    <span className="text-xs text-secondary font-bold flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[12px] icon-fill">
                        verified
                      </span>
                      Verified Member
                    </span>
                  ) : (
                    <span className="text-xs text-outline font-semibold">
                      Member
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {!isOwnProperty && (
                <>
                  <button
                    onClick={handleMessageOwner}
                    className="w-full border border-outline text-primary font-label-md text-label-md py-3 rounded-lg hover:bg-surface-container-low transition-colors flex items-center justify-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[20px]">
                      chat
                    </span>
                    Message Owner
                  </button>
                  <Button
                    variant="primary"
                    onClick={() => {
                      setApplyOpen(true);
                      setAppError("");
                    }}
                    className="w-full py-3"
                  >
                    Apply Now
                  </Button>
                </>
              )}
              {isOwnProperty && (
                <Link
                  to={`/user/my-properties/${property.id}/edit`}
                  className="w-full border border-primary text-primary font-label-md text-label-md py-3 rounded-lg hover:bg-primary-container/10 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[20px]">
                    edit
                  </span>
                  Edit Listing
                </Link>
              )}
            </div>
          </section>

          <section className="bg-surface-container-lowest p-6 rounded-xl border border-outline-variant shadow-sm">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">
              Details
            </h3>
            <div className="space-y-3 font-body-md text-body-md text-on-surface-variant">
              <div className="flex justify-between border-b border-outline-variant/60 pb-2">
                <span>Available From</span>
                <span className="font-bold text-on-surface">{availFrom}</span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/60 pb-2">
                <span>Bedrooms</span>
                <span className="font-bold text-on-surface">
                  {property.bedrooms} Bed
                </span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/60 pb-2">
                <span>Bathrooms</span>
                <span className="font-bold text-on-surface">
                  {property.bathrooms} Bath
                </span>
              </div>
              <div className="flex justify-between border-b border-outline-variant/60 pb-2">
                <span>Type</span>
                <span className="font-bold text-on-surface">
                  {property.type}
                </span>
              </div>
              <div className="flex justify-between pb-1">
                <span>Status</span>
                <span className="font-bold text-on-surface capitalize">
                  {property.status}
                </span>
              </div>
            </div>
          </section>
        </div>
      </div>

      {/* Review Modal */}
      <Modal
        isOpen={reviewOpen}
        onClose={() => setReviewOpen(false)}
        title="Write a Review"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setReviewOpen(false)}
              disabled={reviewLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleReviewSubmit}
              disabled={reviewLoading || !reviewComment.trim()}
            >
              {reviewLoading ? "Posting..." : "Post Review"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {reviewError && (
            <div className="bg-error-container/20 border border-error/40 text-error p-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">warning</span>
              {reviewError}
            </div>
          )}
          <div className="space-y-1">
            <label className="block font-label-md text-label-md text-on-surface-variant">
              Star Rating
            </label>
            <div className="flex items-center gap-2">
              <Rating
                value={reviewRating}
                size="lg"
                onChange={setReviewRating}
              />
              <span className="font-bold text-label-md text-on-surface">
                {reviewRating} Stars
              </span>
            </div>
          </div>
          <Textarea
            label="Your Review"
            placeholder="Share your experience with this property..."
            value={reviewComment}
            onChange={(e) => setReviewComment(e.target.value)}
            rows={4}
            required
          />
        </div>
      </Modal>

      {/* Report Modal */}
      <Modal
        isOpen={reportOpen}
        onClose={() => {
          setReportOpen(false);
          setReportSuccess(false);
          setReportReason("");
          setReportError("");
        }}
        title="Report This Listing"
        footer={
          reportSuccess ? (
            <Button
              variant="primary"
              onClick={() => {
                setReportOpen(false);
                setReportSuccess(false);
              }}
            >
              Close
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setReportOpen(false)}
                disabled={reportLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleReportSubmit}
                disabled={reportLoading || !reportReason.trim()}
              >
                {reportLoading ? "Submitting..." : "Submit Report"}
              </Button>
            </>
          )
        }
      >
        {reportSuccess ? (
          <div className="text-center py-4 space-y-3">
            <span className="material-symbols-outlined text-[48px] text-secondary icon-fill">
              check_circle
            </span>
            <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold">
              Report Submitted
            </h3>
            <p className="text-body-md text-on-surface-variant">
              Thank you. Our team will review this listing and take appropriate
              action.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {reportError && (
              <div className="bg-error-container/20 border border-error/40 text-error p-3 rounded-lg text-sm font-semibold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">
                  warning
                </span>
                {reportError}
              </div>
            )}
            <p className="text-body-md text-on-surface-variant">
              Reporting: <strong>{property.title}</strong>
            </p>
            <Textarea
              label="Reason for Reporting"
              placeholder="Describe the issue — e.g. fake listing, misleading photos, incorrect pricing..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              rows={4}
              required
            />
          </div>
        )}
      </Modal>

      {/* Apply Modal */}
      <Modal
        isOpen={applyOpen}
        onClose={() => setApplyOpen(false)}
        title="Submit Housing Application"
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => setApplyOpen(false)}
              disabled={appLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleApplySubmit}
              disabled={appLoading || !appMessage.trim()}
            >
              {appLoading ? "Submitting..." : "Send Application"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {appError && (
            <div className="bg-error-container/20 border border-error/40 text-error p-3 rounded-lg text-sm font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">warning</span>
              {appError}
            </div>
          )}
          <p className="text-body-md text-on-surface-variant">
            Applying for <strong>{property.title}</strong> at{" "}
            <strong>{formatCurrency(property.price)}/month</strong>.
          </p>
          <Textarea
            label="Introduce Yourself"
            placeholder="Write a brief note introducing yourself — your major, year, and why you're interested in this rental..."
            value={appMessage}
            onChange={(e) => setAppMessage(e.target.value)}
            rows={5}
            required
          />
        </div>
      </Modal>

      {/* Full-scale image lightbox */}
      {lightboxOpen && (
        <ImageLightbox
          images={
            property.images && property.images.length > 0
              ? property.images
              : coverImage
                ? [coverImage]
                : []
          }
          startIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};

export default PropertyDetails;
