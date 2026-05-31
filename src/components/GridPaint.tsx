"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import Link from "next/link";

import {
  type PatternType, type SymmetryMode, type GridType,
  GRID_SIZE_DEFAULT, ZOOM_MAX, cellKey,
} from "./grid-paint/types";
import { PATTERNS, getGridType, generateAllPaths, getBoundsForPattern } from "./grid-paint/patterns";
import { GRID_ADAPTERS } from "./grid-paint/grids";
import { encodeState } from "./grid-paint/utils/url-encoding";
import { downloadSVG, copySVGToClipboard as copySVG } from "./grid-paint/utils/svg-export";
import { imageToGridCells } from "./grid-paint/utils/image-import";

import { useUndoRedo } from "./grid-paint/hooks/useUndoRedo";
import { useViewport } from "./grid-paint/hooks/useViewport";
import { usePainting } from "./grid-paint/hooks/usePainting";
import { useKeyboardShortcuts } from "./grid-paint/hooks/useKeyboardShortcuts";
import { usePersistence } from "./grid-paint/hooks/usePersistence";

import { controlToolbar, controlToolbarStyle, controlBtn } from "./grid-paint/ui/ToolbarStyles";
import { Tooltip } from "./grid-paint/ui/Tooltip";
import { PatternIcon } from "./grid-paint/ui/PatternIcon";
import { SymmetryIcon } from "./grid-paint/ui/SymmetryIcon";
import { ShortcutsModal } from "./grid-paint/ui/ShortcutsModal";

export default function GridPaint() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [activeCells, setActiveCells] = useState<Set<string>>(() => new Set());
  const [gridSize] = useState(GRID_SIZE_DEFAULT);
  const [brushColor, setBrushColor] = useState<"black" | "white">("black");
  const [pattern, setPattern] = useState<PatternType>("rounded");
  const [symmetry, setSymmetry] = useState<SymmetryMode>("none");
  const [showPatternPicker, setShowPatternPicker] = useState(false);
  const [patternTransition, setPatternTransition] = useState(false);
  const [prevPaths, setPrevPaths] = useState("");
  const [showTilePreview, setShowTilePreview] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);

  const activeCellsRef = useRef(activeCells);
  const gridSizeRef = useRef(gridSize);
  const brushColorRef = useRef(brushColor);
  const patternRef = useRef(pattern);
  const symmetryRef = useRef(symmetry);
  activeCellsRef.current = activeCells;
  gridSizeRef.current = gridSize;
  brushColorRef.current = brushColor;
  patternRef.current = pattern;
  symmetryRef.current = symmetry;

  const gridType: GridType = getGridType(pattern);
  const gridTypeRef = useRef(gridType);
  gridTypeRef.current = gridType;

  // --- Hooks ---
  const { pushUndo, undo, redo, undoCount, redoCount } = useUndoRedo(activeCellsRef, setActiveCells);
  const {
    pan, setPan, panRef,
    zoom, setZoom, zoomRef,
    dimensions,
    animateTransform,
    triggerAnimatedTransform,
    isPaintingRef,
  } = useViewport(containerRef);

  const { handlePointerDown, handlePointerMove, handlePointerUp } = usePainting(
    panRef, zoomRef, gridSizeRef, brushColorRef, symmetryRef, gridTypeRef,
    activeCellsRef, setActiveCells, setPan, pushUndo, isPaintingRef,
  );

  usePersistence(
    activeCells, pattern, symmetry,
    setActiveCells, setPattern, setSymmetry,
    setZoom, setPan, triggerAnimatedTransform,
    activeCellsRef, gridSizeRef, dimensions,
  );

  // --- Invert ---
  const invertCells = useCallback(() => {
    const cells = activeCellsRef.current;
    if (cells.size === 0) return;
    pushUndo(cells);
    const bounds = getBoundsForPattern(cells, gridSizeRef.current, patternRef.current);
    if (!bounds) return;
    const gs = gridSizeRef.current;

    if (getGridType(patternRef.current) === "isometric") {
      // For iso grid, invert within a bounding range of col/row
      let minCol = Infinity, maxCol = -Infinity, minRow = Infinity, maxRow = -Infinity;
      cells.forEach((key) => {
        const [c, r] = key.split(",").map(Number);
        minCol = Math.min(minCol, c); maxCol = Math.max(maxCol, c);
        minRow = Math.min(minRow, r); maxRow = Math.max(maxRow, r);
      });
      const next = new Set<string>();
      for (let col = minCol - 1; col <= maxCol + 1; col++) {
        for (let row = minRow - 1; row <= maxRow + 1; row++) {
          const key = cellKey(col, row);
          if (!cells.has(key)) next.add(key);
        }
      }
      setActiveCells(next);
      return;
    }

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
    const size = 3 + Math.floor(Math.random() * 4);
    const density = 0.3 + Math.random() * 0.4;
    const useSymmetry = Math.random() > 0.3;
    const symType = useSymmetry
      ? (["horizontal", "vertical", "both"] as const)[Math.floor(Math.random() * 3)]
      : null;
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
    setPan({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    setZoom(1);
  }, [pushUndo, setPan, setZoom]);

  // --- Fit to content ---
  const fitToContent = useCallback(() => {
    const cells = activeCellsRef.current;
    if (cells.size === 0) return;
    const bounds = getBoundsForPattern(cells, gridSizeRef.current, patternRef.current);
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
  }, [triggerAnimatedTransform, setZoom, setPan]);

  // --- Share URL ---
  const shareURL = useCallback(() => {
    const hash = encodeState(activeCellsRef.current, patternRef.current, symmetryRef.current);
    window.location.hash = hash;
    navigator.clipboard.writeText(window.location.href);
  }, []);

  // --- Copy SVG to clipboard ---
  const copySVGToClipboard = useCallback(() => {
    copySVG(activeCellsRef.current, gridSizeRef.current, patternRef.current);
  }, []);

  // --- Download SVG ---
  const handleDownloadSVG = useCallback(() => {
    downloadSVG(activeCellsRef.current, gridSizeRef.current, patternRef.current);
  }, []);

  // --- Reset ---
  const handleReset = useCallback(() => {
    pushUndo(activeCellsRef.current);
    setActiveCells(new Set());
    setBrushColor("black");
  }, [pushUndo]);

  const toggleColor = useCallback(() => { setBrushColor((prev) => (prev === "black" ? "white" : "black")); }, []);

  const cycleSymmetry = useCallback(() => {
    setSymmetry((s) => {
      const modes: SymmetryMode[] = ["none", "horizontal", "vertical", "both"];
      return modes[(modes.indexOf(s) + 1) % modes.length];
    });
  }, []);

  // --- Keyboard shortcuts ---
  useKeyboardShortcuts({
    undo, redo, triggerAnimatedTransform, setZoom,
    setPattern, setBrushColor, setSymmetry,
    setShowTilePreview, setShowShortcuts,
    invertCells, fitToContent, copySVGToClipboard,
    generateRandom, pushUndo, activeCellsRef, setActiveCells,
  });

  // --- Pattern morph transition ---
  const prevPatternRef = useRef(pattern);
  useEffect(() => {
    if (prevPatternRef.current !== pattern && activeCells.size > 0) {
      const oldPaths = generateAllPaths(activeCells, gridSize, pan.x, pan.y, dimensions.width, dimensions.height, prevPatternRef.current);
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

  // --- Import image ---
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
        const next = imageToGridCells(img);
        setActiveCells(next);
        setPan({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
        requestAnimationFrame(() => {
          const bounds = getBoundsForPattern(next, gridSizeRef.current, patternRef.current);
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
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, [pushUndo, triggerAnimatedTransform, setPan, setZoom]);

  // --- Generate paths ---
  const paths = generateAllPaths(activeCells, gridSize, pan.x, pan.y, dimensions.width, dimensions.height, pattern);
  const tileRepeatPaths = paths.join("");
  const tileBounds = getBoundsForPattern(activeCells, gridSize, pattern);

  // --- Grid dots ---
  const gridDots = GRID_ADAPTERS[gridType].renderDots(pan, zoom, gridSize, dimensions);

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
        <g>{gridDots}</g>
        {symmetryGuides}

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
          {patternTransition && prevPaths && (
            <path d={prevPaths} fill="black" stroke="black" strokeWidth={1 / zoom} style={{ opacity: 0, transition: "opacity 250ms ease-out" }} />
          )}
          <path d={tileRepeatPaths} fill="black" stroke="black" strokeWidth={1 / zoom} style={patternTransition ? { opacity: 1, transition: "opacity 200ms ease-in 50ms" } : undefined} />
        </g>
      </svg>

      {/* Top left: undo/redo */}
      <div style={controlToolbarStyle} className={`fixed top-3 left-3 flex-row ${controlToolbar}`}>
        <Tooltip label="Undo" shortcut="⌘Z" side="bottom" align="start"><button onClick={undo} className={controlBtn} style={{ opacity: undoCount > 0 ? 0.7 : 0.3 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><path d="m16.25,11.2499c-.9467-2.9025-3.625-4.9999-6.75-4.9999-3.0059,0-5.4544,1.9155-6.5077,4.6187" /><polyline points="2.25 6.75 2.25 11.25 6.75 11.25" /></g></svg>
        </button></Tooltip>
        <Tooltip label="Redo" shortcut="⌘⇧Z" side="bottom"><button onClick={redo} className={controlBtn} style={{ opacity: redoCount > 0 ? 0.7 : 0.3 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><path d="m1.75,11.2499c.9467-2.9025,3.625-4.9999,6.75-4.9999,3.0059,0,5.4544,1.9155,6.5077,4.6187" /><polyline points="15.75 6.75 15.75 11.25 11.25 11.25" /></g></svg>
        </button></Tooltip>
      </div>

      {/* Top right: actions */}
      <div style={controlToolbarStyle} className={`fixed top-3 right-3 flex-row ${controlToolbar}`}>
        <Tooltip label="Random" shortcut="R" side="bottom"><button onClick={generateRandom} className={controlBtn} style={{ opacity: 0.85 }}>
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
        </button></Tooltip>
        <Tooltip label="Clear" side="bottom"><button onClick={handleReset} className={controlBtn} style={{ opacity: 0.85 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><path d="M6.096,7.032c.488,.791,1.111,1.636,1.904,2.468,1.074,1.125,2.194,1.948,3.204,2.546" /><line x1="16.25" y1="1.5" x2="10.376" y2="7.374" /><path d="M10.376,7.374c3.158,2.77-.077,6.653-2.123,8.288-.51,.408-1.186,.554-1.814,.375-2.745-.781-4.391-3.076-4.689-6.037,1.375-.188,2.192-.997,3.447-2.268,1.56-1.581,3.803-1.566,5.179-.358Z" /></g></svg>
        </button></Tooltip>
        <Tooltip label="Download SVG" side="bottom"><button onClick={handleDownloadSVG} className={controlBtn} style={{ opacity: 0.85 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><path d="M15.25,11.75v1.5c0,1.105-.895,2-2,2H4.75c-1.105,0-2-.895-2-2v-1.5" /><polyline points="5.5 6.75 9 10.25 12.5 6.75" /><line x1="9" y1="10.25" x2="9" y2="2.75" /></g></svg>
        </button></Tooltip>
        <Tooltip label="Copy SVG" shortcut="⌘C" side="bottom"><button onClick={copySVGToClipboard} className={controlBtn} style={{ opacity: 0.85 }}>
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
        </button></Tooltip>
        <Tooltip label="Import image" side="bottom"><button onClick={importImage} className={controlBtn} style={{ opacity: 0.85 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
              <path d="M3.762,14.989l6.074-6.075c.781-.781,2.047-.781,2.828,0l2.586,2.586" />
              <rect x="2.75" y="2.75" width="12.5" height="12.5" rx="2" ry="2" />
              <circle cx="6.25" cy="7.25" r="1.25" fill="currentColor" data-stroke="none" stroke="none" />
            </g>
          </svg>
        </button></Tooltip>
        <Tooltip label="Share link" side="bottom" align="end"><button onClick={shareURL} className={controlBtn} style={{ opacity: 0.85 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
              <path d="M8.36909 6.8934C8.06649 7.0539 7.78239 7.2617 7.52799 7.517L7.51799 7.527C6.13699 8.908 6.13699 11.146 7.51799 12.527L9.69299 14.702C11.074 16.083 13.312 16.083 14.693 14.702L14.703 14.692C16.084 13.311 16.084 11.073 14.703 9.692L13.9406 8.9296" />
              <path d="M9.63289 11.1066C9.93549 10.9461 10.2196 10.7383 10.474 10.483L10.484 10.473C11.865 9.09199 11.865 6.85399 10.484 5.47299L8.30899 3.29799C6.92799 1.91699 4.68999 1.91699 3.30899 3.29799L3.29899 3.30799C1.91799 4.68899 1.91799 6.92699 3.29899 8.30799L4.06139 9.07039" />
            </g>
          </svg>
        </button></Tooltip>
      </div>

      <div style={controlToolbarStyle} className={`fixed top-15 right-3 flex-row ${controlToolbar}`}>
        <Tooltip label="Collection" side="bottom"><Link href="/collection" target="_blank" className={controlBtn} style={{ opacity: 0.85 }}>
          <svg xmlns="http://www.w3.org/2000/svg" className="size-4" width="18" height="18" viewBox="0 0 18 18"><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><rect x="2.75" y="7.75" width="12.5" height="7.5" rx="1" ry="1"></rect><line x1="5.75" y1="1.75" x2="12.25" y2="1.75"></line><line x1="4.25" y1="4.75" x2="13.75" y2="4.75"></line></g></svg>
        </Link></Tooltip>
        <Tooltip label="Shortcuts" shortcut="/" side="bottom" align="end"><button onClick={() => setShowShortcuts((p) => !p)} className={controlBtn} style={{ opacity: 0.85 }}>
          <svg className="size-4" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18"><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><rect x="6.75" y="6.75" width="4.5" height="4.5"></rect><path d="M4.75,2.75h0c1.104,0,2,.896,2,2v2h-2c-1.104,0-2-.896-2-2h0c0-1.104,.896-2,2-2Z"></path><path d="M13.25,2.75h0c1.104,0,2,.896,2,2v2h-2c-1.104,0-2-.896-2-2h0c0-1.104,.896-2,2-2Z" transform="translate(18 -8.5) rotate(90)"></path><path d="M13.25,11.25h0c1.104,0,2,.896,2,2v2h-2c-1.104,0-2-.896-2-2h0c0-1.104,.896-2,2-2Z" transform="translate(26.5 26.5) rotate(-180)"></path><path d="M4.75,11.25h0c1.104,0,2,.896,2,2v2h-2c-1.104,0-2-.896-2-2h0c0-1.104,.896-2,2-2Z" transform="translate(-8.5 18) rotate(-90)"></path></g></svg>
        </button></Tooltip>
      </div>

      {/* Bottom right: zoom, fit, symmetry, invert, tile, color */}
      <div style={controlToolbarStyle} className={`fixed bottom-3 right-3 flex-row ${controlToolbar}`}>
        <Tooltip label="Zoom in" shortcut="⌘+" side="top"><button onClick={() => { triggerAnimatedTransform(); setZoom((prev) => Math.min(ZOOM_MAX, prev * 1.2)); }} className={controlBtn} style={{ opacity: zoom >= ZOOM_MAX ? 0.3 : 0.7 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><line x1="9" y1="3.25" x2="9" y2="14.75" /><line x1="3.25" y1="9" x2="14.75" y2="9" /></g></svg>
        </button></Tooltip>
        <Tooltip label="Zoom out" shortcut="⌘−" side="top"><button onClick={() => { triggerAnimatedTransform(); setZoom((prev) => Math.max(0.1, prev / 1.2)); }} className={controlBtn} style={{ opacity: zoom <= 0.1 ? 0.3 : 0.7 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden><g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor"><line x1="3.25" y1="9" x2="14.75" y2="9" /></g></svg>
        </button></Tooltip>
        <Tooltip label="Fit to content" shortcut="0" side="top"><button onClick={fitToContent} className={controlBtn} style={{ opacity: 0.85 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
              <path d="M1.75,6.75v-2c0-1.105,.895-2,2-2h2" />
              <path d="M12.25,2.75h2c1.105,0,2,.895,2,2v2" />
              <path d="M16.25,11.25v2c0,1.105-.895,2-2,2h-2" />
              <path d="M5.75,15.25H3.75c-1.105,0-2-.895-2-2v-2" />
            </g>
          </svg>
        </button></Tooltip>
        <Tooltip label="Symmetry" shortcut="H/V/B" side="top"><button onClick={cycleSymmetry} className={controlBtn} style={{ opacity: symmetry !== "none" ? 1 : 0.5 }}>
          <SymmetryIcon mode={symmetry} />
        </button></Tooltip>
        <Tooltip label="Invert" shortcut="I" side="top"><button onClick={invertCells} className={controlBtn} style={{ opacity: 0.7 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
              <path d="M9,6v6c1.657,0,3-1.343,3-3s-1.343-3-3-3Z" fill="currentColor" data-stroke="none" stroke="none" />
              <path d="M9,12c-1.657,0-3-1.343-3-3s1.343-3,3-3V1.75C4.996,1.75,1.75,4.996,1.75,9s3.246,7.25,7.25,7.25v-4.25Z" fill="currentColor" data-stroke="none" stroke="none" />
              <circle cx="9" cy="9" r="7.25" />
            </g>
          </svg>
        </button></Tooltip>
        <Tooltip label="Tile preview" shortcut="T" side="top"><button onClick={() => setShowTilePreview((p) => !p)} className={controlBtn} style={{ opacity: showTilePreview ? 1 : 0.5 }}>
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 18 18" aria-hidden>
            <g fill="none" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" stroke="currentColor">
              <rect x="2.75" y="2.75" width="4.5" height="4.5" rx="1" ry="1" />
              <rect x="10.75" y="10.75" width="4.5" height="4.5" rx="1" ry="1" />
              <circle cx="13" cy="5" r="2.5" />
              <circle cx="5" cy="13" r="2.5" />
            </g>
          </svg>
        </button></Tooltip>
        <Tooltip label="Brush" shortcut="X" side="top" align="end"><div onClick={toggleColor} className="size-8 opacity-60 duration-200 active:scale-95 rounded-full cursor-pointer transition-all" style={{ backgroundColor: brushColor === "black" ? "#000" : "#fff", borderColor: brushColor === "black" ? "#000" : "#ccc" }} /></Tooltip>
      </div>

      {/* Bottom left: pattern picker */}
      <div style={controlToolbarStyle} className={`fixed bottom-3 left-3 flex-col ${controlToolbar}`}>
        <Tooltip label="Pattern" shortcut="1-6" side="top" align="start"><button onClick={() => setShowPatternPicker((p) => !p)} className={`${controlBtn} ${showPatternPicker ? "bg-white/15" : ""}`} style={{ opacity: 0.85 }}>
          <PatternIcon pattern={pattern} size={18} />
        </button></Tooltip>
      </div>

      {showPatternPicker && (
        <>
          <div className="fixed inset-0 z-[51]" onClick={() => setShowPatternPicker(false)} />
          <div className={`fixed bottom-16 left-3 rounded-[16px] p-1 flex flex-col gap-0.5 backdrop-blur-[10px] z-[52]`} style={controlToolbarStyle}>
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
        </>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />

      {showShortcuts && <ShortcutsModal onClose={() => setShowShortcuts(false)} />}
    </div>
  );
}
