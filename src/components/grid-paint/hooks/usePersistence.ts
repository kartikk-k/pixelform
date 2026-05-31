import { useRef, useEffect } from "react";
import type { PatternType, SymmetryMode } from "../types";
import { ZOOM_MAX } from "../types";
import { decodeState } from "../utils/url-encoding";
import { getBoundsForPattern } from "../patterns";

const FIRST_VISIT_CELLS = [
  "-8,0", "-7,0", "-6,0", "-5,-2", "-5,0", "-5,2", "-4,-4", "-4,-1", "-4,0", "-4,1", "-4,4",
  "-3,-4", "-3,-3", "-3,0", "-3,3", "-3,4", "-2,-6", "-2,-5", "-2,-4", "-2,-3", "-2,-2",
  "-2,2", "-2,3", "-2,4", "-2,5", "-2,6", "-1,-4", "-1,-3", "-1,0", "-1,3", "-1,4",
  "0,-4", "0,-1", "0,0", "0,1", "0,4", "1,-2", "1,0", "1,2", "2,0", "3,0", "4,0",
];

export function usePersistence(
  activeCells: Set<string>,
  pattern: PatternType,
  symmetry: SymmetryMode,
  setActiveCells: React.Dispatch<React.SetStateAction<Set<string>>>,
  setPattern: React.Dispatch<React.SetStateAction<PatternType>>,
  setSymmetry: React.Dispatch<React.SetStateAction<SymmetryMode>>,
  setZoom: React.Dispatch<React.SetStateAction<number>>,
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
  triggerAnimatedTransform: () => void,
  activeCellsRef: React.RefObject<Set<string>>,
  gridSizeRef: React.RefObject<number>,
  dimensions: { width: number; height: number },
) {
  const isInitialized = useRef(false);
  const needsFitOnMount = useRef(false);

  // Save to localStorage
  useEffect(() => {
    if (!isInitialized.current) return;
    try {
      const data = {
        c: Array.from(activeCells).map((k) => k.replace(",", ".")),
        p: pattern,
        s: symmetry,
      };
      localStorage.setItem("gridpaint-state", JSON.stringify(data));
    } catch { /* ignore */ }
  }, [activeCells, pattern, symmetry]);

  // Load on mount: URL hash > localStorage > first-visit
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      const state = decodeState(hash);
      if (state && state.cells.size > 0) {
        setActiveCells(state.cells);
        setPattern(state.pattern);
        setSymmetry(state.symmetry);
        isInitialized.current = true;
        needsFitOnMount.current = true;
        return;
      }
    }
    try {
      const saved = localStorage.getItem("gridpaint-state");
      if (saved) {
        const data = JSON.parse(saved);
        const cells = new Set<string>((data.c || []).map((k: string) => k.replace(".", ",")));
        if (cells.size > 0) {
          setActiveCells(cells);
          if (data.p) setPattern(data.p);
          if (data.s) setSymmetry(data.s);
          isInitialized.current = true;
          needsFitOnMount.current = true;
          return;
        }
      }
    } catch { /* ignore */ }
    setPattern("blob");
    setActiveCells(new Set(FIRST_VISIT_CELLS));
    isInitialized.current = true;
    needsFitOnMount.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto fit-to-content after mount load
  useEffect(() => {
    if (needsFitOnMount.current && activeCells.size > 0 && dimensions.width > 0) {
      needsFitOnMount.current = false;
      requestAnimationFrame(() => {
        const cells = activeCellsRef.current;
        if (cells.size === 0) return;
        const bounds = getBoundsForPattern(cells, gridSizeRef.current, pattern);
        if (!bounds) return;
        const padding = gridSizeRef.current * 2;
        const bw = bounds.width + padding * 2, bh = bounds.height + padding * 2;
        const scaleX = window.innerWidth / bw, scaleY = window.innerHeight / bh;
        const newZoom = Math.min(scaleX, scaleY, ZOOM_MAX);
        const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
        triggerAnimatedTransform();
        setZoom(newZoom);
        setPan({ x: window.innerWidth / 2 - cx * newZoom, y: window.innerHeight / 2 - cy * newZoom });
      });
    }
  }, [activeCells, dimensions]); // eslint-disable-line react-hooks/exhaustive-deps
}
