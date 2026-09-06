/**
 * ImageLightbox.jsx — Full-screen image viewer with keyboard navigation.
 *
 * Usage:
 *   <ImageLightbox
 *     images={["url1", "url2"]}   // array of image URLs
 *     startIndex={0}              // which image to show first
 *     onClose={() => setOpen(false)}
 *   />
 *
 * - Preserves aspect ratio (object-contain)
 * - Keyboard: ArrowLeft / ArrowRight to navigate, Escape to close
 * - Click outside image to close
 */
import React, { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { resolveImageUrl } from "../../utils/imageUrl";

export function ImageLightbox({ images = [], startIndex = 0, onClose }) {
  const [current, setCurrent] = useState(startIndex);

  const prev = useCallback(() => setCurrent(i => (i - 1 + images.length) % images.length), [images.length]);
  const next = useCallback(() => setCurrent(i => (i + 1) % images.length), [images.length]);

  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === "Escape")      onClose();
      if (e.key === "ArrowLeft")   prev();
      if (e.key === "ArrowRight")  next();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, prev, next]);

  if (!images.length) return null;

  const currentSrc = resolveImageUrl(images[current]);

  const content = (
    <div
      className="fixed inset-0 z-[99999] bg-black/90 flex items-center justify-center"
      style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, width: "100vw", height: "100vh" }}
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2 z-10 transition-colors"
        aria-label="Close"
      >
        <span className="material-symbols-outlined text-[28px]">close</span>
      </button>

      {/* Counter */}
      {images.length > 1 && (
        <span className="absolute top-4 left-1/2 -translate-x-1/2 text-white/70 text-sm font-semibold">
          {current + 1} / {images.length}
        </span>
      )}

      {/* Prev button */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2 z-10 transition-colors"
          aria-label="Previous image"
        >
          <span className="material-symbols-outlined text-[28px]">chevron_left</span>
        </button>
      )}

      {/* Image — object-contain preserves aspect ratio, no cropping */}
      <img
        src={currentSrc}
        alt={`Image ${current + 1}`}
        className="max-w-[90vw] max-h-[85vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        draggable={false}
        onError={(e) => {
          e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800";
        }}
      />

      {/* Next button */}
      {images.length > 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-4 text-white/80 hover:text-white bg-black/40 rounded-full p-2 z-10 transition-colors"
          aria-label="Next image"
        >
          <span className="material-symbols-outlined text-[28px]">chevron_right</span>
        </button>
      )}

      {/* Thumbnail strip for multiple images */}
      {images.length > 1 && (
        <div
          className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 overflow-x-auto max-w-[90vw] px-2"
          onClick={(e) => e.stopPropagation()}
        >
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`shrink-0 w-14 h-10 rounded overflow-hidden border-2 transition-all ${
                i === current ? "border-white" : "border-white/30 opacity-60 hover:opacity-80"
              }`}
              aria-label={`View image ${i + 1}`}
            >
              <img
                src={resolveImageUrl(img)}
                alt=""
                className="w-full h-full object-cover"
                draggable={false}
                onError={(e) => {
                  e.target.src = "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800";
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return content;
}

export default ImageLightbox;

