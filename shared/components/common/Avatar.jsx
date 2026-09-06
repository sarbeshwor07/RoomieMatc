import React from "react";

export const Avatar = ({ src, name = "", size = "md", className = "", ...props }) => {
  const getInitials = (fullName) => {
    if (!fullName) return "?";
    return fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .substring(0, 2)
      .toUpperCase();
  };

  const sizes = {
    xs: "w-6 h-6 text-[10px]",
    sm: "w-8 h-8 text-[12px]",
    md: "w-10 h-10 text-[14px]",
    lg: "w-12 h-12 text-[16px]",
    xl: "w-16 h-16 text-[20px]",
    xxl: "w-24 h-24 text-[28px]"
  };

  // Show image if src is any non-empty string (http URLs, /api/uploads/... paths, or data URIs)
  const isImage = !!src && src.trim().length > 0;

  const resolvedSrc = React.useMemo(() => {
    if (!src) return null;
    const trimmed = src.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
      return trimmed;
    }
    const apiBase = (import.meta.env?.VITE_API_URL || "/api").replace(/\/api\/?$/, "");
    if (trimmed.startsWith("/")) return `${apiBase}${trimmed}`;
    return `${apiBase}/${trimmed}`;
  }, [src]);

  return (
    <div
      className={`rounded-full shrink-0 flex items-center justify-center font-bold text-on-primary-fixed-variant bg-primary-fixed border border-outline-variant overflow-hidden select-none ${
        sizes[size] || sizes.md
      } ${className}`}
      {...props}
    >
      {isImage ? (
        <img
          src={resolvedSrc}
          alt={name}
          className="w-full h-full object-cover"
          onError={(e) => {
            e.target.style.display = "none";
          }}
        />
      ) : (
        <span>{getInitials(name)}</span>
      )}
    </div>
  );
};

export default Avatar;
