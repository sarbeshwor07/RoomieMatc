/**
 * ApplicationDetails.jsx (Tenant view)
 *
 * Loads full application detail from GET /api/applications/:id.
 * Owner info comes from application.owner_name (returned by API).
 * All field names use snake_case from API.
 * getOrCreateThread is awaited (it's async).
 */
import React, { useState, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMessages } from "@shared/hooks/useMessages";
import { apiGetApplication, apiCancelApplication, resolveImageUrl } from "@shared/services/api";
import { formatCurrency } from "@shared/utils/currency";
import StatusBadge from "@shared/components/common/StatusBadge";
import Button from "@shared/components/common/Button";
import Avatar from "@shared/components/common/Avatar";

export const ApplicationDetails = () => {
  const { id }     = useParams();
  const navigate   = useNavigate();
  const { getOrCreateThread } = useMessages();

  const [application, setApplication] = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [pageError,   setPageError]   = useState("");

  useEffect(() => {
    apiGetApplication(id)
      .then(data => setApplication(data.application))
      .catch(err => setPageError(err.message || "Application not found."))
      .finally(() => setLoading(false));
  }, [id]);

  const handleWithdraw = async () => {
    if (!window.confirm("Are you sure you want to withdraw this application?")) return;
    try {
      await apiCancelApplication(application.id);
      navigate("/user/applications");
    } catch (err) {
      alert(err.message || "Failed to withdraw application.");
    }
  };

  const handleMessageManager = async () => {
    const threadId = await getOrCreateThread(
      application.owner_id,
      application.property_id
    );
    if (threadId) navigate(`/user/messages?thread=${threadId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 text-on-surface-variant gap-2">
        <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
        Loading application...
      </div>
    );
  }

  if (pageError || !application) {
    return (
      <div className="max-w-xl mx-auto py-12 text-center bg-surface-container-lowest border rounded-xl p-8">
        <span className="material-symbols-outlined text-[48px] text-error">warning</span>
        <h3 className="font-headline-sm text-headline-sm text-on-surface font-bold mt-2">
          Application Not Found
        </h3>
        <Link to="/user/applications" className="mt-4 inline-block text-primary font-bold hover:underline">
          Back to Applications
        </Link>
      </div>
    );
  }

  // All field names are snake_case from API
  const propTitle   = application.property_title   || "Property";
  const propAddress = application.property_address || "";
  const propCity    = application.property?.city   || "";
  const propPrice   = application.property_price   || application.property?.price || 0;
  const appliedDate = application.applied_at;
  const rawCoverImage = application.property?.cover_image || application.property?.images?.[0] || null;
  const coverImage  = rawCoverImage ? resolveImageUrl(rawCoverImage) : null;

  const timelineSteps = [
    {
      key: "submitted",
      icon: "check",
      active: true,
      title: "Application Submitted",
      description: `You successfully applied on ${new Date(appliedDate).toLocaleDateString()}.`
    },
    {
      key: "review",
      icon: "hourglass_empty",
      active: application.status === "pending",
      title: "Under Review",
      description: "The property manager is currently reviewing your details."
    },
    {
      key: "decision",
      icon: "task_alt",
      active: ["approved", "rejected", "cancelled"].includes(application.status),
      title: "Decision Reached",
      description:
        application.status === "approved"   ? "Your application was approved. Congratulations!"
        : application.status === "rejected"  ? "Your application was not approved this time."
        : application.status === "cancelled" ? "You withdrew this application."
        : "Pending approval or request for more information."
    }
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 max-w-7xl mx-auto">
      <div className="lg:col-span-8 flex flex-col gap-6">
        <Link
          to="/user/applications"
          className="text-on-surface-variant hover:text-primary flex items-center gap-1 font-label-md text-label-md w-fit"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          Back to Applications
        </Link>

        <h1 className="font-headline-lg text-headline-lg text-on-surface">Application Status</h1>

        {/* Property card */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant overflow-hidden">
          <div className="flex flex-col md:flex-row">
            <div className="w-full md:w-1/3 h-48 md:h-auto relative bg-surface-container">
              {coverImage ? (
                <img
                  alt={propTitle}
                  className="absolute inset-0 w-full h-full object-cover"
                  src={coverImage}
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-outline">
                  <span className="material-symbols-outlined text-[48px]">home_work</span>
                </div>
              )}
            </div>
            <div className="p-6 flex flex-col justify-between w-full md:w-2/3">
              <div>
                <div className="flex justify-between items-start mb-2 gap-3">
                  <h2 className="font-headline-md text-headline-md text-on-surface">{propTitle}</h2>
                  <StatusBadge status={application.status} />
                </div>
                <p className="text-on-surface-variant font-body-md text-body-md mb-4 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">location_on</span>
                  {propAddress}{propCity ? `, ${propCity}` : ""}
                </p>
                <div className="flex gap-4 mb-4">
                  <div className="bg-surface-container-low px-3 py-2 rounded-lg text-center">
                    <span className="block font-headline-sm text-headline-sm text-primary">{formatCurrency(propPrice)}</span>
                    <span className="block font-label-sm text-label-sm text-on-surface-variant">/ month</span>
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <Link
                  to={`/user/properties/${application.property_id}`}
                  className="flex-1 bg-surface-container-high hover:bg-surface-variant text-primary font-label-md text-label-md py-2 rounded-lg transition-colors border border-outline-variant text-center"
                >
                  View Listing
                </Link>
                {application.status === "pending" && (
                  <button
                    onClick={handleWithdraw}
                    className="flex-1 bg-surface-container-high hover:bg-surface-variant text-error font-label-md text-label-md py-2 rounded-lg transition-colors border border-outline-variant"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Timeline */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-6">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-6">Application Timeline</h3>
          <div className="relative pl-4 space-y-8 before:absolute before:inset-0 before:ml-[1.35rem] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-outline-variant">
            {timelineSteps.map((step) => (
              <div key={step.key} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 border-surface-container-lowest shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 shadow z-10 ${
                  step.active
                    ? step.key === "submitted" ? "bg-secondary" : "bg-primary"
                    : "bg-surface-container-highest border-outline-variant"
                }`}>
                  <span className={`material-symbols-outlined text-[16px] ${
                    step.active ? (step.key === "submitted" ? "text-on-secondary" : "text-on-primary") : "text-outline"
                  }`}>
                    {step.icon}
                  </span>
                </div>
                <div className={`w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] pl-4 md:pl-0 md:text-right md:group-odd:text-left md:group-even:pr-4 md:group-odd:pl-4 ${!step.active ? "opacity-50" : ""}`}>
                  <h4 className={`font-label-md text-label-md ${step.key === "review" && step.active ? "text-primary font-bold" : "text-on-surface"}`}>
                    {step.title}
                  </h4>
                  <p className="font-body-md text-body-md text-on-surface-variant mt-1">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Right col */}
      <div className="lg:col-span-4 flex flex-col gap-6">

        {/* Owner card */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-6">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Property Manager</h3>
          <div className="flex items-center gap-4 mb-6">
            <Avatar name={application.owner_name || "Owner"} size="lg" />
            <div>
              <p className="font-label-md text-label-md text-on-surface">{application.owner_name || "Owner"}</p>
              <p className="font-body-md text-body-md text-on-surface-variant">Property Owner</p>
            </div>
          </div>
          <Button onClick={handleMessageManager} className="w-full flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[20px]">chat</span>
            Message Manager
          </Button>
        </section>

        {/* Message */}
        <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-6">
          <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Your Message</h3>
          <p className="font-body-md text-body-md text-on-surface-variant italic bg-surface-container-low p-4 rounded-lg border border-outline-variant">
            "{application.message}"
          </p>
        </section>

        {/* History from DB */}
        {application.history?.length > 0 && (
          <section className="bg-surface-container-lowest rounded-xl shadow-sm border border-outline-variant p-6">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-4">Activity Log</h3>
            <div className="relative border-l-2 border-outline-variant ml-3 pl-5 space-y-4">
              {application.history.map((h, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-[27px] top-1 w-3 h-3 rounded-full bg-primary border-2 border-surface-container-lowest" />
                  <span className="font-label-md text-label-md text-on-surface font-bold uppercase block">{h.status}</span>
                  <span className="text-xs text-outline block mt-0.5">
                    {h.changed_at ? new Date(h.changed_at).toLocaleString() : ""}
                  </span>
                  <p className="text-body-md text-on-surface-variant mt-1">{h.label}</p>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

export default ApplicationDetails;
