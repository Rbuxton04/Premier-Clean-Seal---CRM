/**
 * The signature brand element: the plum swoosh from the Premier Clean & Seal
 * logo, redrawn as an SVG stroke. Used under page titles and in the sidebar
 * wordmark. Animates in once on load (respects prefers-reduced-motion).
 */
export function BrandSwoosh({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 320 24"
      fill="none"
      aria-hidden="true"
      className={className}
      preserveAspectRatio="none"
    >
      <path
        d="M2 16 C 40 4, 78 4, 112 12 S 200 22, 250 14 S 305 8, 318 10"
        stroke="currentColor"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="320"
        className="animate-swoosh-in"
      />
    </svg>
  );
}
