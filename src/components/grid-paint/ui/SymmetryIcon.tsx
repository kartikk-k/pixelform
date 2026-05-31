import type { SymmetryMode } from "../types";

export function SymmetryIcon({ mode }: { mode: SymmetryMode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      {mode === "none" && <><line x1="4" y1="4" x2="14" y2="14" opacity="0.4" /><circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" opacity="0.4" /></>}
      {mode === "horizontal" && <><line x1="9" y1="2" x2="9" y2="16" strokeDasharray="2 2" /><rect x="3" y="5" width="4" height="4" rx="1" fill="currentColor" stroke="none" /><rect x="11" y="5" width="4" height="4" rx="1" fill="currentColor" stroke="none" /></>}
      {mode === "vertical" && <><line x1="2" y1="9" x2="16" y2="9" strokeDasharray="2 2" /><rect x="5" y="3" width="4" height="4" rx="1" fill="currentColor" stroke="none" /><rect x="5" y="11" width="4" height="4" rx="1" fill="currentColor" stroke="none" /></>}
      {mode === "both" && <><line x1="9" y1="2" x2="9" y2="16" strokeDasharray="2 2" /><line x1="2" y1="9" x2="16" y2="9" strokeDasharray="2 2" /><rect x="3" y="3" width="4" height="4" rx="1" fill="currentColor" stroke="none" /><rect x="11" y="3" width="4" height="4" rx="1" fill="currentColor" stroke="none" /><rect x="3" y="11" width="4" height="4" rx="1" fill="currentColor" stroke="none" /><rect x="11" y="11" width="4" height="4" rx="1" fill="currentColor" stroke="none" /></>}
    </svg>
  );
}
