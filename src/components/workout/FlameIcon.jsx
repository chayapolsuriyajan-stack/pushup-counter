import { forwardRef } from "react";
import s from "./FlameIcon.module.css";

/**
 * Decorative flame above the live rep count. Escalates (grows/brightens)
 * as the set progresses and flashes on every counted rep.
 *
 * Like `LiveText`, this is written to imperatively from the same
 * ref-driven path (`--flame-t` custom property + `data-burst` attribute),
 * never through props or state — it lives in the same rAF-loop-adjacent
 * code as `repRef`/`dotRef`. Unlike `LiveText`, it needs a real SVG shape
 * rather than a bare text node, so it gets React-diff safety a different
 * way: the JSX below never depends on props/state, so every re-render of
 * this subtree is a no-op diff against the same static tree.
 */
const FlameIcon = forwardRef(function FlameIcon(_props, ref) {
  return (
    <div ref={ref} className={s.flame} aria-hidden="true" style={{ "--flame-t": 0 }}>
      <svg className={s.svg} viewBox="0 0 48 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          className={s.base}
          d="M24 2C24 2 10 16 10 32C10 45.2548 16.268 54 24 54C31.732 54 38 45.2548 38 32C38 24 33 18 33 18C33 24 29 27 29 27C30 18 24 2 24 2Z"
        />
        <path
          className={s.hot}
          d="M24 22C24 22 18 30 18 38C18 44.6274 20.6863 49 24 49C27.3137 49 30 44.6274 30 38C30 33 27 29 27 29C27.5 33 24.5 34.5 24.5 34.5C25 29 24 22 24 22Z"
        />
      </svg>
    </div>
  );
});

export default FlameIcon;
