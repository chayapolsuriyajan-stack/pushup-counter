export default function WorkoutIcon({ size = 56, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        d="M4 12h2m0-3.5v7M6 12h4m4 0h4m0-3.5v7M18 12h2M10 8.5v7m4-7v7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
