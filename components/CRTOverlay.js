'use client';

/**
 * CRT Overlay Component
 * Provides a classic CRT television static/noise effect overlay
 * with scanlines for an authentic retro computing experience
 */
export default function CRTOverlay() {
  return (
    <>
      {/* Static/Noise Effect */}
      <div className="crt-overlay" aria-hidden="true" />

      {/* Scanlines Effect */}
      <div className="crt-scanlines" aria-hidden="true" />

      {/* Subtle vignette for screen curvature illusion */}
      <div className="crt-vignette" aria-hidden="true" />
    </>
  );
}
