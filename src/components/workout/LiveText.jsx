import { forwardRef } from "react";

/**
 * A text node written to directly from a 60fps loop (rep count, countdown),
 * bypassing React state entirely. Rendering with NO children in JSX is what
 * makes this safe: React only diffs children it created, so a re-render
 * here is `null -> null` — a no-op that can never clobber the imperative
 * text. The initial value and every reset (e.g. a new set starting) are
 * the imperative owner's responsibility, not this component's.
 */
const LiveText = forwardRef(function LiveText({ className }, ref) {
  return <div ref={ref} className={className} />;
});

export default LiveText;
