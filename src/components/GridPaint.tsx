"use client";

import { useRef, useState, useCallback, useEffect } from "react";

const GRID_SIZE_STEPS = 25;
const GRID_SIZE_MIN = GRID_SIZE_STEPS * 2;
const GRID_SIZE_MAX = GRID_SIZE_STEPS * 6;
const GRID_SIZE_DEFAULT = 75;
const ZOOM_MIN = 0.1;
const ZOOM_MAX = 5;
const MAX_UNDO = 100;

type Cell = { x: number; y: number };
type PatternType = "rounded" | "square" | "blob" | "leaf" | "chamfer";
type SymmetryMode = "none" | "horizontal" | "vertical" | "both";

const PATTERNS: { id: PatternType; label: string }[] = [
  { id: "rounded", label: "Rounded" },
  { id: "square", label: "Square" },
  { id: "blob", label: "Blob" },
  { id: "leaf", label: "Leaf" },
  { id: "chamfer", label: "Chamfer" },
];

function cellKey(x: number, y: number) {
  return `${x},${y}`;
}

// --- URL state encoding/decoding ---

function encodeState(cells: Set<string>, pattern: PatternType, symmetry: SymmetryMode): string {
  if (cells.size === 0) return "";
  const cellArr = Array.from(cells).map((k) => k.replace(",", "."));
  const data = { c: cellArr, p: pattern, s: symmetry };
  try {
    return btoa(JSON.stringify(data));
  } catch {
    return "";
  }
}

function decodeState(hash: string): { cells: Set<string>; pattern: PatternType; symmetry: SymmetryMode } | null {
  if (!hash) return null;
  try {
    const data = JSON.parse(atob(hash));
    const cells = new Set<string>((data.c || []).map((k: string) => k.replace(".", ",")));
    return { cells, pattern: data.p || "rounded", symmetry: data.s || "none" };
  } catch {
    return null;
  }
}

// --- Quadrant-based path generators per pattern ---

type Neighbours = boolean[][];

function quadrantSquare(cx: number, cy: number, dx: number, dy: number, half: number) {
  return `M${cx},${cy}L${cx + dx * half},${cy}L${cx + dx * half},${cy + dy * half}L${cx},${cy + dy * half}Z`;
}

function quadrantRounded(cx: number, cy: number, dx: number, dy: number, half: number, m: number) {
  return `M${cx},${cy}L${cx + dx * half},${cy}C${cx + dx * half},${cy + dy * half * m},${cx + dx * half * m},${cy + dy * half},${cx},${cy + dy * half}Z`;
}

function filletConcave(cx: number, cy: number, dx: number, dy: number, half: number, m: number) {
  return `M${cx + dx * half},${cy}C${cx + dx * half},${cy + dy * half * m},${cx + dx * half * m},${cy + dy * half},${cx},${cy + dy * half}L${cx + dx * half},${cy + dy * half}Z`;
}

const QUADRANTS: [number, number][] = [[1, 1], [-1, 1], [-1, -1], [1, -1]];

function getQuadrantNeighbours(n: Neighbours, q: number): [boolean, boolean, boolean] {
  switch (q) {
    case 0: return [n[2][1], n[2][2], n[1][2]];
    case 1: return [n[0][1], n[0][2], n[1][2]];
    case 2: return [n[0][1], n[0][0], n[1][0]];
    case 3: return [n[1][0], n[2][0], n[2][1]];
    default: return [false, false, false];
  }
}

function getFilletNeighbours(n: Neighbours, q: number): [boolean, boolean] {
  switch (q) {
    case 0: return [n[2][1], n[1][2]];
    case 1: return [n[1][2], n[0][1]];
    case 2: return [n[0][1], n[1][0]];
    case 3: return [n[1][0], n[2][1]];
    default: return [false, false];
  }
}

function generatePathsRounded(cx: number, cy: number, half: number, m: number, on: boolean, n: Neighbours, paths: string[]) {
  if (on) {
    for (let q = 0; q < 4; q++) {
      const [dx, dy] = QUADRANTS[q];
      const [a, b, c] = getQuadrantNeighbours(n, q);
      paths.push((a || b || c) ? quadrantSquare(cx, cy, dx, dy, half) : quadrantRounded(cx, cy, dx, dy, half, m));
    }
  } else {
    for (let q = 0; q < 4; q++) {
      const [dx, dy] = QUADRANTS[q];
      const [a, b] = getFilletNeighbours(n, q);
      if (a && b) paths.push(filletConcave(cx, cy, dx, dy, half, m));
    }
  }
}

function generatePathsSquare(cx: number, cy: number, half: number, on: boolean, paths: string[]) {
  if (on) paths.push(`M${cx - half},${cy - half}L${cx + half},${cy - half}L${cx + half},${cy + half}L${cx - half},${cy + half}Z`);
}

function generatePathsBlob(cx: number, cy: number, half: number, on: boolean, n: Neighbours, paths: string[]) {
  generatePathsRounded(cx, cy, half, 0.85, on, n, paths);
}

function generatePathsLeaf(cx: number, cy: number, half: number, on: boolean, n: Neighbours, paths: string[]) {
  if (on) {
    for (let q = 0; q < 4; q++) {
      const [dx, dy] = QUADRANTS[q];
      const [a, b, c] = getQuadrantNeighbours(n, q);
      if (a || b || c) { paths.push(quadrantSquare(cx, cy, dx, dy, half)); }
      else if (q === 0 || q === 2) { paths.push(quadrantRounded(cx, cy, dx, dy, half, 0.553)); }
      else { paths.push(quadrantSquare(cx, cy, dx, dy, half)); }
    }
  } else {
    for (let q = 0; q < 4; q++) {
      const [dx, dy] = QUADRANTS[q];
      const [a, b] = getFilletNeighbours(n, q);
      if (a && b && (q === 0 || q === 2)) paths.push(filletConcave(cx, cy, dx, dy, half, 0.553));
    }
  }
}

function generateChamferPaths(activeCells: Set<string>, gridSize: number): string[] {
  if (activeCells.size === 0) return [];
  const paths: string[] = [];
  const half = gridSize / 2;
  const cut = half;
  function isOn(cx: number, cy: number) { return activeCells.has(cellKey(cx, cy)); }
  const cellsToProcess = new Set<string>();
  activeCells.forEach((key) => {
    const [cx, cy] = key.split(",").map(Number);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) cellsToProcess.add(cellKey(cx + dx, cy + dy));
  });
  cellsToProcess.forEach((key) => {
    const [col, row] = key.split(",").map(Number);
    const cx = col * gridSize, cy = row * gridSize;
    const on = isOn(col, row);
    const right = isOn(col + 1, row), left = isOn(col - 1, row);
    const top = isOn(col, row - 1), bottom = isOn(col, row + 1);
    const tr = isOn(col + 1, row - 1), tl = isOn(col - 1, row - 1);
    const br = isOn(col + 1, row + 1), bl = isOn(col - 1, row + 1);
    if (on) {
      const tlC = (top || left || tl) ? 0 : cut, trC = (top || right || tr) ? 0 : cut;
      const blC = (bottom || left || bl) ? 0 : cut, brC = (bottom || right || br) ? 0 : cut;
      paths.push(`M${cx - half + tlC},${cy - half}L${cx + half - trC},${cy - half}L${cx + half},${cy - half + trC}L${cx + half},${cy + half - brC}L${cx + half - brC},${cy + half}L${cx - half + blC},${cy + half}L${cx - half},${cy + half - blC}L${cx - half},${cy - half + tlC}Z`);
    } else {
      if (right && bottom) paths.push(`M${cx + half - cut},${cy + half}L${cx + half},${cy + half - cut}L${cx + half},${cy + half}Z`);
      if (left && bottom) paths.push(`M${cx - half + cut},${cy + half}L${cx - half},${cy + half - cut}L${cx - half},${cy + half}Z`);
      if (left && top) paths.push(`M${cx - half + cut},${cy - half}L${cx - half},${cy - half + cut}L${cx - half},${cy - half}Z`);
      if (right && top) paths.push(`M${cx + half - cut},${cy - half}L${cx + half},${cy - half + cut}L${cx + half},${cy - half}Z`);
    }
  });
  return paths;
}

function generatePaths(activeCells: Set<string>, gridSize: number, panX: number, panY: number, viewWidth: number, viewHeight: number, pattern: PatternType = "rounded"): string[] {
  if (pattern === "chamfer") return generateChamferPaths(activeCells, gridSize);
  const minVisibleCol = Math.floor((-panX - gridSize) / gridSize) - 1;
  const maxVisibleCol = Math.ceil((-panX + viewWidth + gridSize) / gridSize) + 1;
  const minVisibleRow = Math.floor((-panY - gridSize) / gridSize) - 1;
  const maxVisibleRow = Math.ceil((-panY + viewHeight + gridSize) / gridSize) + 1;
  let minCol = minVisibleCol, maxCol = maxVisibleCol, minRow = minVisibleRow, maxRow = maxVisibleRow;
  activeCells.forEach((key) => {
    const [cx, cy] = key.split(",").map(Number);
    minCol = Math.min(minCol, cx - 1); maxCol = Math.max(maxCol, cx + 1);
    minRow = Math.min(minRow, cy - 1); maxRow = Math.max(maxRow, cy + 1);
  });
  const paths: string[] = [];
  const half = gridSize / 2;
  function isOn(cx: number, cy: number) { return activeCells.has(cellKey(cx, cy)); }
  for (let col = minCol; col <= maxCol; col++) {
    for (let row = minRow; row <= maxRow; row++) {
      const centerX = col * gridSize, centerY = row * gridSize;
      const on = isOn(col, row);
      const n = [
        [isOn(col - 1, row - 1), isOn(col - 1, row), isOn(col - 1, row + 1)],
        [isOn(col, row - 1), on, isOn(col, row + 1)],
        [isOn(col + 1, row - 1), isOn(col + 1, row), isOn(col + 1, row + 1)],
      ];
      switch (pattern) {
        case "rounded": generatePathsRounded(centerX, centerY, half, 0.553, on, n, paths); break;
        case "square": generatePathsSquare(centerX, centerY, half, on, paths); break;
        case "blob": generatePathsBlob(centerX, centerY, half, on, n, paths); break;
        case "leaf": generatePathsLeaf(centerX, centerY, half, on, n, paths); break;
      }
    }
  }
  return paths;
}

function getBoundsOfCells(activeCells: Set<string>, gridSize: number) {
  if (activeCells.size === 0) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  activeCells.forEach((key) => {
    const [cx, cy] = key.split(",").map(Number);
    minX = Math.min(minX, cx * gridSize); minY = Math.min(minY, cy * gridSize);
    maxX = Math.max(maxX, cx * gridSize); maxY = Math.max(maxY, cy * gridSize);
  });
  const half = gridSize / 2;
  return { x: minX - half, y: minY - half, width: maxX - minX + gridSize, height: maxY - minY + gridSize };
}

// --- Styling constants ---

const controlToolbar = "rounded-full p-1 items-center flex gap-0.5 backdrop-blur-[10px]";

const controlToolbarStyle: React.CSSProperties = {
  background: "rgba(0,0,0,0.56)",
  backgroundImage: "linear-gradient(180deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 100%)",
  boxShadow: [
    "0px 40px 24px 0px rgba(0,0,0,0.06)", "0px 23px 14px 0px rgba(0,0,0,0.08)",
    "0px 10px 10px 0px rgba(0,0,0,0.12)", "0px 3px 6px 0px rgba(0,0,0,0.19)",
    "0px 0px 0px 0.75px rgba(0,0,0,0.56)",
    "inset 0px -12px 16px 0px rgba(255,255,255,0.06)", "inset 0px 4px 16px 0px rgba(255,255,255,0.16)",
    "inset 0px 0.75px 0.25px 0px rgba(255,255,255,0.12)", "inset 0px 0.25px 0.25px 0px rgba(255,255,255,0.32)",
  ].join(", "),
};

const controlBtn = "size-8 hover:bg-white/10 flex items-center text-white duration-200 active:scale-95 justify-center cursor-pointer rounded-full";

function PatternIcon({ pattern, size }: { pattern: PatternType; size: number }) {
  const s = size, h = s / 2, q = s / 4;
  switch (pattern) {
    case "rounded": return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><rect x={1} y={1} width={s - 2} height={s - 2} rx={q} ry={q} fill="currentColor" /></svg>;
    case "square": return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><rect x={1} y={1} width={s - 2} height={s - 2} fill="currentColor" /></svg>;
    case "blob": return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><rect x={1} y={1} width={s - 2} height={s - 2} rx={h - 1} ry={h - 1} fill="currentColor" /></svg>;
    case "leaf": return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><path d={`M${h},1L${s - 1},1L${s - 1},${h}Q${s - 1},${s - 1},${h},${s - 1}L1,${s - 1}L1,${h}Q1,1,${h},1Z`} fill="currentColor" /></svg>;
    case "chamfer": return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><polygon points={`${h},1 ${s - 1},${h} ${h},${s - 1} 1,${h}`} fill="currentColor" /></svg>;
  }
}

// --- Symmetry icon ---
function SymmetryIcon({ mode }: { mode: SymmetryMode }) {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      {mode === "none" && <><line x1="4" y1="4" x2="14" y2="14" opacity="0.4" /><circle cx="9" cy="9" r="1.5" fill="currentColor" stroke="none" opacity="0.4" /></>}
      {mode === "horizontal" && <><line x1="9" y1="2" x2="9" y2="16" strokeDasharray="2 2" /><rect x="3" y="5" width="4" height="4" rx="1" fill="currentColor" stroke="none" /><rect x="11" y="5" width="4" height="4" rx="1" fill="currentColor" stroke="none" /></>}
      {mode === "vertical" && <><line x1="2" y1="9" x2="16" y2="9" strokeDasharray="2 2" /><rect x="5" y="3" width="4" height="4" rx="1" fill="currentColor" stroke="none" /><rect x="5" y="11" width="4" height="4" rx="1" fill="currentColor" stroke="none" /></>}
      {mode === "both" && <><line x1="9" y1="2" x2="9" y2="16" strokeDasharray="2 2" /><line x1="2" y1="9" x2="16" y2="9" strokeDasharray="2 2" /><rect x="3" y="3" width="4" height="4" rx="1" fill="currentColor" stroke="none" /><rect x="11" y="3" width="4" height="4" rx="1" fill="currentColor" stroke="none" /><rect x="3" y="11" width="4" height="4" rx="1" fill="currentColor" stroke="none" /><rect x="11" y="11" width="4" height="4" rx="1" fill="currentColor" stroke="none" /></>}
    </svg>
  );
}

// ============================================================
export default function GridPaint() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeCells, setActiveCells] = useState<Set<string>>(() => new Set());
  const [gridSize, setGridSize] = useState(GRID_SIZE_DEFAULT);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [brushColor, setBrushColor] = useState<"black" | "white">("black");
  const [pattern, setPattern] = useState<PatternType>("rounded");
  const [symmetry, setSymmetry] = useState<SymmetryMode>("none");
  const [showPatternPicker, setShowPatternPicker] = useState(false);
  const [patternTransition, setPatternTransition] = useState(false);
  const [prevPaths, setPrevPaths] = useState("");
  const [showTilePreview, setShowTilePreview] = useState(false);

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [animateTransform, setAnimateTransform] = useState(false);
  const animateTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo/redo
  const undoStack = useRef<Set<string>[]>([]);
  const redoStack = useRef<Set<string>[]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const [redoCount, setRedoCount] = useState(0);

  const pushUndo = useCallback((snapshot: Set<string>) => {
    undoStack.current.push(new Set(snapshot));
    if (undoStack.current.length > MAX_UNDO) undoStack.current.shift();
    redoStack.current = [];
    setUndoCount(undoStack.current.length);
    setRedoCount(0);
  }, []);

  const undo = useCallback(() => {
    if (undoStack.current.length === 0) return;
    redoStack.current.push(new Set(activeCellsRef.current));
    setActiveCells(undoStack.current.pop()!);
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
  }, []);

  const redo = useCallback(() => {
    if (redoStack.current.length === 0) return;
    undoStack.current.push(new Set(activeCellsRef.current));
    setActiveCells(redoStack.current.pop()!);
    setUndoCount(undoStack.current.length);
    setRedoCount(redoStack.current.length);
  }, []);

  // Refs
  const isPainting = useRef(false);
  const isPanning = useRef(false);
  const lastPanPos = useRef({ x: 0, y: 0 });
  const paintedThisStroke = useRef<Set<string>>(new Set());
  const activeCellsRef = useRef(activeCells);
  const panRef = useRef(pan);
  const zoomRef = useRef(zoom);
  const gridSizeRef = useRef(gridSize);
  const brushColorRef = useRef(brushColor);
  const patternRef = useRef(pattern);
  const symmetryRef = useRef(symmetry);

  activeCellsRef.current = activeCells;
  panRef.current = pan;
  zoomRef.current = zoom;
  gridSizeRef.current = gridSize;
  brushColorRef.current = brushColor;
  patternRef.current = pattern;
  symmetryRef.current = symmetry;

  // --- Persist to localStorage on changes ---
  const isInitialized = useRef(false);
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

  // --- Load state on mount: URL hash > localStorage > first-visit random ---
  // Then auto fit-to-content so it's centered.
  const needsFitOnMount = useRef(false);
  useEffect(() => {
    // 1. Try URL hash
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
    // 2. Try localStorage
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
    // 3. First visit: generate random blob
    setPattern("blob");
    const size = 3 + Math.floor(Math.random() * 4);
    const density = 0.3 + Math.random() * 0.4;
    const symType = (["horizontal", "vertical", "both"] as const)[Math.floor(Math.random() * 3)];
    const half = Math.floor(size / 2);
    const next = new Set<string>();
    const genW = symType === "horizontal" || symType === "both" ? half + 1 : size;
    const genH = symType === "vertical" || symType === "both" ? half + 1 : size;
    for (let x = 0; x < genW; x++) {
      for (let y = 0; y < genH; y++) {
        if (Math.random() < density) {
          const cx = x - half, cy = y - half;
          next.add(cellKey(cx, cy));
          if (symType === "horizontal" || symType === "both") next.add(cellKey(-cx, cy));
          if (symType === "vertical" || symType === "both") next.add(cellKey(cx, -cy));
          if (symType === "both") next.add(cellKey(-cx, -cy));
        }
      }
    }
    setActiveCells(next);
    isInitialized.current = true;
    needsFitOnMount.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // --- Auto fit-to-content after mount load ---
  useEffect(() => {
    if (needsFitOnMount.current && activeCells.size > 0 && dimensions.width > 0) {
      needsFitOnMount.current = false;
      // Schedule after paint so refs are up-to-date
      requestAnimationFrame(() => {
        const cells = activeCellsRef.current;
        if (cells.size === 0) return;
        const bounds = getBoundsOfCells(cells, gridSizeRef.current);
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
  }, [activeCells, dimensions]);

  // --- Resize ---
  useEffect(() => {
    function updateSize() { setDimensions({ width: window.innerWidth, height: window.innerHeight }); }
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);


  // --- Gestures / wheel ---
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const preventGesture = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("gestureend", preventGesture, { passive: false });

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      if (e.ctrlKey) {
        const zoomDelta = -e.deltaY * 0.01;
        setZoom((prev) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev * (1 + zoomDelta))));
        setPan((prev) => {
          const factor = 1 + zoomDelta;
          return { x: e.clientX - (e.clientX - prev.x) * factor, y: e.clientY - (e.clientY - prev.y) * factor };
        });
        return;
      }
      setPan((prev) => ({ x: prev.x - e.deltaX, y: prev.y - e.deltaY }));
    };
    container.addEventListener("wheel", handleWheel, { passive: false });

    const blockOverscroll = (e: WheelEvent) => { if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault(); };
    document.addEventListener("wheel", blockOverscroll, { passive: false });

    return () => {
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("gestureend", preventGesture);
      container.removeEventListener("wheel", handleWheel);
      document.removeEventListener("wheel", blockOverscroll);
    };
  }, []);

  const triggerAnimatedTransform = useCallback(() => {
    setAnimateTransform(true);
    if (animateTimeout.current) clearTimeout(animateTimeout.current);
    animateTimeout.current = setTimeout(() => setAnimateTransform(false), 200);
  }, []);

  // --- Invert ---
  const invertCells = useCallback(() => {
    const cells = activeCellsRef.current;
    if (cells.size === 0) return;
    pushUndo(cells);
    const bounds = getBoundsOfCells(cells, gridSizeRef.current);
    if (!bounds) return;
    const gs = gridSizeRef.current;
    const half = gs / 2;
    const minCol = Math.round((bounds.x + half) / gs) - 1;
    const maxCol = Math.round((bounds.x + bounds.width - half) / gs) + 1;
    const minRow = Math.round((bounds.y + half) / gs) - 1;
    const maxRow = Math.round((bounds.y + bounds.height - half) / gs) + 1;
    const next = new Set<string>();
    for (let col = minCol; col <= maxCol; col++) {
      for (let row = minRow; row <= maxRow; row++) {
        const key = cellKey(col, row);
        if (!cells.has(key)) next.add(key);
      }
    }
    setActiveCells(next);
  }, [pushUndo]);

  // --- Random generate ---
  const generateRandom = useCallback(() => {
    pushUndo(activeCellsRef.current);
    const size = 3 + Math.floor(Math.random() * 4); // 3 to 6
    const density = 0.3 + Math.random() * 0.4; // 30-70%
    const useSymmetry = Math.random() > 0.3; // 70% chance of symmetry
    const symType = useSymmetry
      ? (["horizontal", "vertical", "both"] as const)[Math.floor(Math.random() * 3)]
      : null;

    const half = Math.floor(size / 2);
    const next = new Set<string>();

    // Generate one quadrant/half then mirror
    const genW = symType === "horizontal" || symType === "both" ? half + 1 : size;
    const genH = symType === "vertical" || symType === "both" ? half + 1 : size;

    for (let x = 0; x < genW; x++) {
      for (let y = 0; y < genH; y++) {
        if (Math.random() < density) {
          const cx = x - half, cy = y - half;
          next.add(cellKey(cx, cy));
          if (symType === "horizontal" || symType === "both") next.add(cellKey(-cx, cy));
          if (symType === "vertical" || symType === "both") next.add(cellKey(cx, -cy));
          if (symType === "both") next.add(cellKey(-cx, -cy));
        }
      }
    }

    setActiveCells(next);
    setPan({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setZoom(1);
  }, [pushUndo]);

  // --- Fit to content ---
  const fitToContent = useCallback(() => {
    const cells = activeCellsRef.current;
    if (cells.size === 0) return;
    const bounds = getBoundsOfCells(cells, gridSizeRef.current);
    if (!bounds) return;
    const padding = gridSizeRef.current * 2;
    const bw = bounds.width + padding * 2;
    const bh = bounds.height + padding * 2;
    const scaleX = window.innerWidth / bw;
    const scaleY = window.innerHeight / bh;
    const newZoom = Math.min(scaleX, scaleY, ZOOM_MAX);
    const cx = bounds.x + bounds.width / 2;
    const cy = bounds.y + bounds.height / 2;
    triggerAnimatedTransform();
    setZoom(newZoom);
    setPan({ x: window.innerWidth / 2 - cx * newZoom, y: window.innerHeight / 2 - cy * newZoom });
  }, [triggerAnimatedTransform]);

  // --- Share URL ---
  const shareURL = useCallback(() => {
    const hash = encodeState(activeCellsRef.current, patternRef.current, symmetryRef.current);
    window.location.hash = hash;
    navigator.clipboard.writeText(window.location.href);
  }, []);

  // --- Copy SVG to clipboard ---
  const copySVGToClipboard = useCallback(() => {
    const cells = activeCellsRef.current;
    if (cells.size === 0) return;
    const gs = gridSizeRef.current;
    const bounds = getBoundsOfCells(cells, gs);
    if (!bounds) return;
    const padding = gs;
    const vx = bounds.x - padding, vy = bounds.y - padding;
    const vw = bounds.width + padding * 2, vh = bounds.height + padding * 2;
    const paths = generatePaths(cells, gs, 0, 0, 99999, 99999, patternRef.current);
    const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}"><path d="${paths.join("")}" fill="black"/></svg>`;
    navigator.clipboard.writeText(svgContent);
  }, []);


  // --- Keyboard shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      // Don't intercept when typing in an input
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      else if (mod && e.key === "y") { e.preventDefault(); redo(); }
      else if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); triggerAnimatedTransform(); setZoom((prev) => Math.min(ZOOM_MAX, prev * 1.2)); }
      else if (mod && e.key === "-") { e.preventDefault(); triggerAnimatedTransform(); setZoom((prev) => Math.max(ZOOM_MIN, prev / 1.2)); }
      else if (mod && e.key === "c" && !e.shiftKey && activeCellsRef.current.size > 0) { e.preventDefault(); copySVGToClipboard(); }
      else if (!mod && !e.shiftKey) {
        switch (e.key) {
          case "1": setPattern("rounded"); break;
          case "2": setPattern("square"); break;
          case "3": setPattern("blob"); break;
          case "4": setPattern("leaf"); break;
          case "5": setPattern("chamfer"); break;
          case "x": case "X": setBrushColor((p) => p === "black" ? "white" : "black"); break;
          case "i": case "I": invertCells(); break;
          case "h": case "H": setSymmetry((s) => s === "horizontal" ? "none" : "horizontal"); break;
          case "v": case "V": setSymmetry((s) => s === "vertical" ? "none" : "vertical"); break;
          case "b": case "B": setSymmetry((s) => s === "both" ? "none" : "both"); break;
          case "0": fitToContent(); break;

          case "t": case "T": setShowTilePreview((p) => !p); break;
          case "r": case "R": generateRandom(); break;
          case "Delete": case "Backspace":
            pushUndo(activeCellsRef.current);
            setActiveCells(new Set());
            break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo, triggerAnimatedTransform, invertCells, fitToContent, copySVGToClipboard, generateRandom, pushUndo]);

  // --- Touch handling ---
  const touchStateRef = useRef<{ lastCenter: { x: number; y: number } | null; lastDist: number | null }>({ lastCenter: null, lastDist: null });
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    function getTouchDist(e: TouchEvent) { return Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); }
    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault(); isPainting.current = false;
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        touchStateRef.current = { lastCenter: { x: cx, y: cy }, lastDist: getTouchDist(e) };
      }
    };
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
        const cx = (e.touches[0].clientX + e.touches[1].clientX) / 2, cy = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const dist = getTouchDist(e);
        const { lastCenter, lastDist } = touchStateRef.current;
        if (lastCenter) setPan((prev) => ({ x: prev.x + cx - lastCenter.x, y: prev.y + cy - lastCenter.y }));
        if (lastDist && lastDist > 0) {
          const scale = dist / lastDist;
          setZoom((prev) => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, prev * scale)));
          setPan((prev) => ({ x: cx - (cx - prev.x) * scale, y: cy - (cy - prev.y) * scale }));
        }
        touchStateRef.current = { lastCenter: { x: cx, y: cy }, lastDist: dist };
      }
    };
    const handleTouchEnd = (e: TouchEvent) => { if (e.touches.length < 2) touchStateRef.current = { lastCenter: null, lastDist: null }; };
    container.addEventListener("touchstart", handleTouchStart, { passive: false });
    container.addEventListener("touchmove", handleTouchMove, { passive: false });
    container.addEventListener("touchend", handleTouchEnd);
    return () => { container.removeEventListener("touchstart", handleTouchStart); container.removeEventListener("touchmove", handleTouchMove); container.removeEventListener("touchend", handleTouchEnd); };
  }, []);

  // --- Painting with symmetry ---
  const screenToGrid = useCallback((screenX: number, screenY: number): Cell => {
    const worldX = (screenX - panRef.current.x) / zoomRef.current;
    const worldY = (screenY - panRef.current.y) / zoomRef.current;
    return { x: Math.round(worldX / gridSizeRef.current), y: Math.round(worldY / gridSizeRef.current) };
  }, []);

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
  }, [screenToGrid]);

  const paintLine = useCallback((x1: number, y1: number, x2: number, y2: number) => {
    const gs = gridSizeRef.current;
    const dist = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(dist / (gs * 0.5)));
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      paintCell(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
    }
  }, [paintCell]);

  const lastPaintPos = useRef<{ x: number; y: number } | null>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      isPanning.current = true;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (e.button !== 0) return;
    isPainting.current = true;
    paintedThisStroke.current = new Set();
    lastPaintPos.current = { x: e.clientX, y: e.clientY };
    pushUndo(activeCellsRef.current);
    paintCell(e.clientX, e.clientY);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [paintCell, pushUndo]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (isPanning.current) {
      const dx = e.clientX - lastPanPos.current.x, dy = e.clientY - lastPanPos.current.y;
      lastPanPos.current = { x: e.clientX, y: e.clientY };
      setPan((prev) => ({ x: prev.x + dx, y: prev.y + dy }));
      return;
    }
    if (!isPainting.current) return;
    const prev = lastPaintPos.current;
    if (prev) paintLine(prev.x, prev.y, e.clientX, e.clientY);
    lastPaintPos.current = { x: e.clientX, y: e.clientY };
  }, [paintLine]);

  const handlePointerUp = useCallback(() => { isPainting.current = false; isPanning.current = false; lastPaintPos.current = null; }, []);

  const handleReset = useCallback(() => {
    pushUndo(activeCellsRef.current);
    setActiveCells(new Set());
    setBrushColor("black");
  }, [pushUndo]);

  const handleDownloadSVG = useCallback(() => {
    const cells = activeCellsRef.current;
    if (cells.size === 0) return;
    const gs = gridSizeRef.current;
    const bounds = getBoundsOfCells(cells, gs);
    if (!bounds) return;
    const padding = gs;
    const vx = bounds.x - padding, vy = bounds.y - padding;
    const vw = bounds.width + padding * 2, vh = bounds.height + padding * 2;
    const paths = generatePaths(cells, gs, 0, 0, 99999, 99999, patternRef.current);
    const svgContent = `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">\n  <path d="${paths.join("")}" fill="black"/>\n</svg>`;
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const now = new Date();
    a.download = `gridpaint_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}.svg`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const toggleColor = useCallback(() => { setBrushColor((prev) => (prev === "black" ? "white" : "black")); }, []);

  const cycleSymmetry = useCallback(() => {
    setSymmetry((s) => {
      const modes: SymmetryMode[] = ["none", "horizontal", "vertical", "both"];
      return modes[(modes.indexOf(s) + 1) % modes.length];
    });
  }, []);

  // --- Pattern morph transition ---
  const prevPatternRef = useRef(pattern);
  useEffect(() => {
    if (prevPatternRef.current !== pattern && activeCells.size > 0) {
      // Capture old paths before pattern change renders
      const oldPaths = generatePaths(activeCells, gridSize, pan.x, pan.y, dimensions.width, dimensions.height, prevPatternRef.current);
      setPrevPaths(oldPaths.join(""));
      setPatternTransition(true);
      const timer = setTimeout(() => {
        setPatternTransition(false);
        setPrevPaths("");
      }, 250);
      prevPatternRef.current = pattern;
      return () => clearTimeout(timer);
    }
    prevPatternRef.current = pattern;
  }, [pattern, activeCells, gridSize, pan.x, pan.y, dimensions.width, dimensions.height]);

  // --- Import image as grid cells ---
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importImage = useCallback(() => { fileInputRef.current?.click(); }, []);

  const handleImageFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        pushUndo(activeCellsRef.current);
        const gs = gridSizeRef.current;
        // Determine grid dimensions from image aspect ratio
        // Target ~20 cells on the longest side
        const targetCells = 20;
        const aspect = img.width / img.height;
        let cols: number, rows: number;
        if (aspect >= 1) { cols = targetCells; rows = Math.round(targetCells / aspect); }
        else { rows = targetCells; cols = Math.round(targetCells * aspect); }

        // Draw image to offscreen canvas at grid resolution
        const canvas = document.createElement("canvas");
        canvas.width = cols;
        canvas.height = rows;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, cols, rows);
        const imageData = ctx.getImageData(0, 0, cols, rows);

        const next = new Set<string>();
        const halfCols = Math.floor(cols / 2);
        const halfRows = Math.floor(rows / 2);
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            const i = (y * cols + x) * 4;
            const r = imageData.data[i], g = imageData.data[i + 1], b = imageData.data[i + 2], a = imageData.data[i + 3];
            // Calculate brightness (0-255), threshold at 128
            const brightness = (r * 0.299 + g * 0.587 + b * 0.114) * (a / 255);
            if (brightness < 128) {
              next.add(cellKey(x - halfCols, y - halfRows));
            }
          }
        }
        setActiveCells(next);
        // Center and fit
        setPan({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        requestAnimationFrame(() => {
          const bounds = getBoundsOfCells(next, gs);
          if (!bounds) return;
          const padding = gs * 2;
          const bw = bounds.width + padding * 2, bh = bounds.height + padding * 2;
          const scaleX = window.innerWidth / bw, scaleY = window.innerHeight / bh;
          const newZoom = Math.min(scaleX, scaleY, ZOOM_MAX);
          const cx = bounds.x + bounds.width / 2, cy = bounds.y + bounds.height / 2;
          triggerAnimatedTransform();
          setZoom(newZoom);
          setPan({ x: window.innerWidth / 2 - cx * newZoom, y: window.innerHeight / 2 - cy * newZoom });
        });
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be re-imported
    e.target.value = "";
  }, [pushUndo, triggerAnimatedTransform]);

  // --- Generate paths ---
  const paths = generatePaths(activeCells, gridSize, pan.x, pan.y, dimensions.width, dimensions.height, pattern);

  // --- Grid dots ---
  const gridLines: React.JSX.Element[] = [];
  if (dimensions.width > 0) {
    const scaledGrid = gridSize * zoom;
    if (scaledGrid > 8) {
      const startCol = Math.floor(-pan.x / scaledGrid) - 1;
      const endCol = Math.ceil((-pan.x + dimensions.width) / scaledGrid) + 1;
      const startRow = Math.floor(-pan.y / scaledGrid) - 1;
      const endRow = Math.ceil((-pan.y + dimensions.height) / scaledGrid) + 1;
      for (let col = startCol; col <= endCol; col++) {
        for (let row = startRow; row <= endRow; row++) {
          gridLines.push(<circle key={`${col},${row}`} cx={col * scaledGrid + pan.x} cy={row * scaledGrid + pan.y} r={1} fill="#ccc" />);
        }
      }
    }
  }

  // --- Symmetry guides ---
  const symmetryGuides: React.JSX.Element[] = [];
  if (symmetry !== "none") {
    const originX = pan.x, originY = pan.y;
    if (symmetry === "horizontal" || symmetry === "both") {
      symmetryGuides.push(<line key="sym-h" x1={originX} y1={0} x2={originX} y2={dimensions.height} stroke="rgba(255,0,0,0.3)" strokeWidth={1} strokeDasharray="4 4" />);
    }
    if (symmetry === "vertical" || symmetry === "both") {
      symmetryGuides.push(<line key="sym-v" x1={0} y1={originY} x2={dimensions.width} y2={originY} stroke="rgba(255,0,0,0.3)" strokeWidth={1} strokeDasharray="4 4" />);
    }
  }

  // --- Tile preview ---
  const tileRepeatPaths = paths.join("");
  const tileBounds = getBoundsOfCells(activeCells, gridSize);

  return (
    <div ref={containerRef} className="fixed playground inset-0 cursor-crosshair" style={{ touchAction: "none" }}>
      <svg
        ref={svgRef}
        width={dimensions.width} height={dimensions.height}
        viewBox={`0 0 ${dimensions.width} ${dimensions.height}`}
        onPointerDown={handlePointerDown} onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp} onPointerCancel={handlePointerUp}
        className="block"
      >
        <rect width={dimensions.width} height={dimensions.height} fill="white" />
        <g>{gridLines}</g>
        {symmetryGuides}

        {/* Tile preview: repeat the shape in a grid */}
        {showTilePreview && tileBounds && tileRepeatPaths && (
          <g opacity={0.12}>
            {(() => {
              const tw = tileBounds.width, th = tileBounds.height;
              if (tw <= 0 || th <= 0) return null;
              const tiles: React.JSX.Element[] = [];
              for (let tx = -3; tx <= 3; tx++) {
                for (let ty = -3; ty <= 3; ty++) {
                  if (tx === 0 && ty === 0) continue;
                  tiles.push(
                    <g key={`tile-${tx}-${ty}`} transform={`translate(${pan.x + tw * tx * zoom}, ${pan.y + th * ty * zoom}) scale(${zoom})`}>
                      <path d={tileRepeatPaths} fill="black" />
                    </g>
                  );
                }
              }
              return tiles;
            })()}
          </g>
        )}

        <g
          transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}
          style={animateTransform ? { transition: "transform 150ms ease-out" } : undefined}
        >
          {/* Crossfade: old pattern fading out */}
          {patternTransition && prevPaths && (
            <path d={prevPaths} fill="black" stroke="black" strokeWidth={1 / zoom} style={{ opacity: 0, transition: "opacity 250ms ease-out" }} />
          )}
          <path d={tileRepeatPaths} fill="black" stroke="black" strokeWidth={1 / zoom} style={patternTransition ? { opacity: 1, transition: "opacity 200ms ease-in 50ms" } : undefined} />
        </g>
      </svg>

      {/* --- UI Controls --- */}
      {/* Top left: undo/redo */}
      <div style={controlToolbarStyle} className={`fixed top-3 left-3 flex-row ${controlToolbar}`}>
        <button onClick={undo} className={controlBtn} style={{ opacity: undoCount > 0 ? 0.7 : 0.3 }} title="Undo (Cmd+Z)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><path d="m16.25,11.2499c-.9467-2.9025-3.625-4.9999-6.75-4.9999-3.0059,0-5.4544,1.9155-6.5077,4.6187" /><polyline points="2.25 6.75 2.25 11.25 6.75 11.25" /></g></svg>
        </button>
        <button onClick={redo} className={controlBtn} style={{ opacity: redoCount > 0 ? 0.7 : 0.3 }} title="Redo (Cmd+Shift+Z)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><path d="m1.75,11.2499c.9467-2.9025,3.625-4.9999,6.75-4.9999,3.0059,0,5.4544,1.9155,6.5077,4.6187" /><polyline points="15.75 6.75 15.75 11.25 11.25 11.25" /></g></svg>
        </button>
      </div>

      {/* Top right: reset, download, copy SVG, share */}
      <div style={controlToolbarStyle} className={`fixed top-3 right-3 flex-row ${controlToolbar}`}>
        <button onClick={generateRandom} className={controlBtn} style={{ opacity: 0.85 }} title="Random (R)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
              <rect x="2.75" y="2.75" width="12.5" height="12.5" rx="2" ry="2" />
              <circle cx="12" cy="6" r="1" fill="currentColor" data-stroke="none" stroke="none" />
              <circle cx="9" cy="9" r="1" fill="currentColor" data-stroke="none" stroke="none" />
              <circle cx="6" cy="6" r="1" fill="currentColor" data-stroke="none" stroke="none" />
              <circle cx="12" cy="12" r="1" fill="currentColor" data-stroke="none" stroke="none" />
              <circle cx="6" cy="12" r="1" fill="currentColor" data-stroke="none" stroke="none" />
            </g>
          </svg>
        </button>
        <button onClick={handleReset} className={controlBtn} style={{ opacity: 0.85 }} title="Reset">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><path d="M6.096,7.032c.488,.791,1.111,1.636,1.904,2.468,1.074,1.125,2.194,1.948,3.204,2.546" /><line x1="16.25" y1="1.5" x2="10.376" y2="7.374" /><path d="M10.376,7.374c3.158,2.77-.077,6.653-2.123,8.288-.51,.408-1.186,.554-1.814,.375-2.745-.781-4.391-3.076-4.689-6.037,1.375-.188,2.192-.997,3.447-2.268,1.56-1.581,3.803-1.566,5.179-.358Z" /></g></svg>
        </button>
        <button onClick={handleDownloadSVG} className={controlBtn} style={{ opacity: 0.85 }} title="Download SVG">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><path d="M15.25,11.75v1.5c0,1.105-.895,2-2,2H4.75c-1.105,0-2-.895-2-2v-1.5" /><polyline points="5.5 6.75 9 10.25 12.5 6.75" /><line x1="9" y1="10.25" x2="9" y2="2.75" /></g></svg>
        </button>
        <button onClick={copySVGToClipboard} className={controlBtn} style={{ opacity: 0.85 }} title="Copy SVG (Cmd+C)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
              <path d="m10.75,6.25v-2c0-.8284-.6716-1.5-1.5-1.5h-1" />
              <path d="m4.25,2.75h-1c-.8284,0-1.5.6716-1.5,1.5v7.5c0,.8284.6716,1.5,1.5,1.5h3.75" />
              <rect x="4.5" y="1.75" width="3.5" height="2" rx=".5" ry=".5" fill="currentColor" />
              <rect x="7.25" y="6.25" width="9" height="10" rx="1.5" ry="1.5" />
              <line x1="10.25" y1="9.75" x2="13.25" y2="9.75" />
              <line x1="10.25" y1="12.75" x2="13.25" y2="12.75" />
            </g>
          </svg>
        </button>
        <button onClick={importImage} className={controlBtn} style={{ opacity: 0.85 }} title="Import image">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
              <path d="M3.762,14.989l6.074-6.075c.781-.781,2.047-.781,2.828,0l2.586,2.586" />
              <rect x="2.75" y="2.75" width="12.5" height="12.5" rx="2" ry="2" />
              <circle cx="6.25" cy="7.25" r="1.25" fill="currentColor" data-stroke="none" stroke="none" />
            </g>
          </svg>
        </button>
        <button onClick={shareURL} className={controlBtn} style={{ opacity: 0.85 }} title="Share URL (copies link)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
              <path d="M8.36909 6.8934C8.06649 7.0539 7.78239 7.2617 7.52799 7.517L7.51799 7.527C6.13699 8.908 6.13699 11.146 7.51799 12.527L9.69299 14.702C11.074 16.083 13.312 16.083 14.693 14.702L14.703 14.692C16.084 13.311 16.084 11.073 14.703 9.692L13.9406 8.9296" />
              <path d="M9.63289 11.1066C9.93549 10.9461 10.2196 10.7383 10.474 10.483L10.484 10.473C11.865 9.09199 11.865 6.85399 10.484 5.47299L8.30899 3.29799C6.92799 1.91699 4.68999 1.91699 3.30899 3.29799L3.29899 3.30799C1.91799 4.68899 1.91799 6.92699 3.29899 8.30799L4.06139 9.07039" />
            </g>
          </svg>
        </button>
      </div>

      {/* Bottom right: zoom, fit, symmetry, invert, tile, color */}
      <div style={controlToolbarStyle} className={`fixed bottom-3 right-3 flex-row ${controlToolbar}`}>
        <button onClick={() => { triggerAnimatedTransform(); setZoom((prev) => Math.min(ZOOM_MAX, prev * 1.2)); }} className={controlBtn} style={{ opacity: zoom >= ZOOM_MAX ? 0.3 : 0.7 }} title="Zoom in (Cmd+)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><line x1="9" y1="3.25" x2="9" y2="14.75" /><line x1="3.25" y1="9" x2="14.75" y2="9" /></g></svg>
        </button>
        <button onClick={() => { triggerAnimatedTransform(); setZoom((prev) => Math.max(ZOOM_MIN, prev / 1.2)); }} className={controlBtn} style={{ opacity: zoom <= ZOOM_MIN ? 0.3 : 0.7 }} title="Zoom out (Cmd-)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><line x1="3.25" y1="9" x2="14.75" y2="9" /></g></svg>
        </button>
        <button onClick={fitToContent} className={controlBtn} style={{ opacity: 0.85 }} title="Fit to content (0)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
              <path d="M1.75,6.75v-2c0-1.105,.895-2,2-2h2" />
              <path d="M12.25,2.75h2c1.105,0,2,.895,2,2v2" />
              <path d="M16.25,11.25v2c0,1.105-.895,2-2,2h-2" />
              <path d="M5.75,15.25H3.75c-1.105,0-2-.895-2-2v-2" />
            </g>
          </svg>
        </button>
        <button onClick={cycleSymmetry} className={controlBtn} style={{ opacity: symmetry !== "none" ? 1 : 0.5 }} title={`Symmetry: ${symmetry} (H/V/B)`}>
          <SymmetryIcon mode={symmetry} />
        </button>
        <button onClick={invertCells} className={controlBtn} style={{ opacity: 0.7 }} title="Invert (I)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
              <path d="M9,6v6c1.657,0,3-1.343,3-3s-1.343-3-3-3Z" fill="currentColor" data-stroke="none" stroke="none" />
              <path
                d="M9,12c-1.657,0-3-1.343-3-3s1.343-3,3-3V1.75C4.996,1.75,1.75,4.996,1.75,9s3.246,7.25,7.25,7.25v-4.25Z"
                fill="currentColor"
                data-stroke="none"
                stroke="none"
              />
              <circle cx="9" cy="9" r="7.25" />
            </g>
          </svg>
        </button>
        <button onClick={() => setShowTilePreview((p) => !p)} className={controlBtn} style={{ opacity: showTilePreview ? 1 : 0.5 }} title="Tile preview (T)">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
              <rect x="2.75" y="2.75" width="4.5" height="4.5" rx="1" ry="1" />
              <rect x="10.75" y="10.75" width="4.5" height="4.5" rx="1" ry="1" />
              <circle cx="13" cy="5" r="2.5" />
              <circle cx="5" cy="13" r="2.5" />
            </g>
          </svg>
        </button>
        <button onClick={toggleColor} className="size-8 opacity-60 duration-200 active:scale-95 rounded-full cursor-pointer transition-all" style={{ backgroundColor: brushColor === "black" ? "#000" : "#fff", borderColor: brushColor === "black" ? "#000" : "#ccc" }} title={`Brush: ${brushColor} (X)`} />
      </div>

      {/* Bottom left: pattern picker */}
      <div style={controlToolbarStyle} className={`fixed bottom-3 left-3 flex-col ${controlToolbar}`}>
        <button onClick={() => setShowPatternPicker((p) => !p)} className={`${controlBtn} ${showPatternPicker ? "bg-white/15" : ""}`} style={{ opacity: 0.85 }} title="Pattern (1-5)">
          <PatternIcon pattern={pattern} size={18} />
        </button>
      </div>

      {showPatternPicker && (
        <div className={`fixed bottom-16 left-3 rounded-[16px] p-1 flex flex-col gap-0.5 backdrop-blur-[10px]`} style={controlToolbarStyle}>
          {PATTERNS.map((p) => (
            <button
              key={p.id}
              onClick={() => { setPattern(p.id); setShowPatternPicker(false); }}
              className="flex items-center gap-2.5 px-2.5 py-2 rounded-[12px] cursor-pointer hover:bg-white/10 transition-colors text-white"
              style={{ background: pattern === p.id ? "rgba(255,255,255,0.12)" : "transparent", fontWeight: pattern === p.id ? 600 : 400 }}
            >
              <PatternIcon pattern={p.id} size={16} />
              <span className="text-xs">{p.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Hidden file input for image import */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFile}
      />
    </div>
  );
}
