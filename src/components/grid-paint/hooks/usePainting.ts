import { useRef, useCallback } from "react";
import type { Cell, SymmetryMode, GridType } from "../types";
import { cellKey } from "../types";
import { GRID_ADAPTERS } from "../grids";

export function usePainting(
  panRef: React.RefObject<{ x: number; y: number }>,
  zoomRef: React.RefObject<number>,
  gridSizeRef: React.RefObject<number>,
  brushColorRef: React.RefObject<"black" | "white">,
  symmetryRef: React.RefObject<SymmetryMode>,
  gridTypeRef: React.RefObject<GridType>,
  activeCellsRef: React.RefObject<Set<string>>,
  setActiveCells: React.Dispatch<React.SetStateAction<Set<string>>>,
  setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>,
  pushUndo: (snapshot: Set<string>) => void,
  isPaintingRef: React.MutableRefObject<boolean>,
) {
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const paintedThisStroke = useRef<Set<string>>(new Set());
  const lastPaintPos = useRef<{ x: number; y: number } | null>(null);
  const strokeOrigin = useRef<{ x: number; y: number } | null>(null);
  const strokeSnapshot = useRef<Set<string> | null>(null);

  const screenToGrid = useCallback((screenX: number, screenY: number): Cell => {
    const worldX = (screenX - panRef.current.x) / zoomRef.current;
    const worldY = (screenY - panRef.current.y) / zoomRef.current;
    return GRID_ADAPTERS[gridTypeRef.current].screenToCell(worldX, worldY, gridSizeRef.current);
  }, [panRef, zoomRef, gridSizeRef, gridTypeRef]);

  const paintCell = useCallback((screenX: number, screenY: number) => {
    const cell = screenToGrid(screenX, screenY);
    const sym = symmetryRef.current;
    const cells: Cell[] = [cell];
    if (sym === "horizontal" || sym === "both") cells.push({ x: -cell.x, y: cell.y });
    if (sym === "vertical" || sym === "both") cells.push({ x: cell.x, y: -cell.y });
    if (sym === "both") cells.push({ x: -cell.x, y: -cell.y });

    let changed = false;
    for (const c of cells) {
      const key = cellKey(c.x, c.y);
      if (!paintedThisStroke.current.has(key)) {
        paintedThisStroke.current.add(key);
        changed = true;
      }
    }
    if (!changed) return;

    setActiveCells((prev) => {
      const next = new Set(prev);
      for (const c of cells) {
        const key = cellKey(c.x, c.y);
        if (brushColorRef.current === "black") next.add(key); else next.delete(key);
      }
      return next;
    });
  }, [screenToGrid, symmetryRef, brushColorRef, setActiveCells]);

  const paintLine = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const gs = gridSizeRef.current;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / (gs * 0.5)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      paintCell(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    }
  }, [paintCell, gridSizeRef]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    isPaintingRef.current = true;
    paintedThisStroke.current = new Set();
    lastPaintPos.current = { x: e.clientX, y: e.clientY };
    strokeOrigin.current = { x: e.clientX, y: e.clientY };
    pushUndo(activeCellsRef.current);
    strokeSnapshot.current = new Set(activeCellsRef.current);
    paintCell(e.clientX, e.clientY);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [paintCell, pushUndo, activeCellsRef, isPaintingRef]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastPanPos.current.x, dy = e.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      return;
    }
    if (!isPaintingRef.current) return;

    let targetX = e.clientX, targetY = e.clientY;

    // Shift constrains to straight line from stroke origin
    if (e.shiftKey && strokeOrigin.current) {
      const dx = e.clientX - strokeOrigin.current.x;
      const dy = e.clientY - strokeOrigin.current.y;
      const absDx = Math.abs(dx), absDy = Math.abs(dy);
      if (absDx > absDy * 2) {
        // Horizontal
        targetY = strokeOrigin.current.y;
      } else if (absDy > absDx * 2) {
        // Vertical
        targetX = strokeOrigin.current.x;
      } else {
        // Diagonal (45 degrees)
        const dist = Math.max(absDx, absDy);
        targetX = strokeOrigin.current.x + dist * Math.sign(dx);
        targetY = strokeOrigin.current.y + dist * Math.sign(dy);
      }
      // Restore to stroke start state, then repaint the constrained line
      if (strokeSnapshot.current) setActiveCells(new Set(strokeSnapshot.current));
      paintedThisStroke.current = new Set();
      paintLine(strokeOrigin.current.x, strokeOrigin.current.y, targetX, targetY);
      lastPaintPos.current = { x: targetX, y: targetY };
      return;
    }

    const prev = lastPaintPos.current;
    if (prev) paintLine(prev.x, prev.y, targetX, targetY);
    lastPaintPos.current = { x: targetX, y: targetY };
  }, [paintLine, setPan, isPaintingRef]);

  const handlePointerUp = useCallback(() => {
    isPaintingRef.current = false;
    isPanning.current = false;
    lastPaintPos.current = null;
    strokeOrigin.current = null;
    strokeSnapshot.current = null;
  }, [isPaintingRef]);

  return { handlePointerDown, handlePointerMove, handlePointerUp };
}
