import { useEffect } from "react";
import type { PatternType, SymmetryMode } from "../types";
import { ZOOM_MIN, ZOOM_MAX } from "../types";

interface KeyboardShortcutsArgs {
  undo: () => void;
  redo: () => void;
  triggerAnimatedTransform: () => void;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  setPattern: React.Dispatch<React.SetStateAction<PatternType>>;
  setBrushColor: React.Dispatch<React.SetStateAction<"black" | "white">>;
  setSymmetry: React.Dispatch<React.SetStateAction<SymmetryMode>>;
  setShowTilePreview: React.Dispatch<React.SetStateAction<boolean>>;
  setShowShortcuts: React.Dispatch<React.SetStateAction<boolean>>;
  invertCells: () => void;
  fitToContent: () => void;
  copySVGToClipboard: () => void;
  generateRandom: () => void;
  pushUndo: (snapshot: Set<string>) => void;
  activeCellsRef: React.RefObject<Set<string>>;
  setActiveCells: React.Dispatch<React.SetStateAction<Set<string>>>;
}

export function useKeyboardShortcuts({
  undo, redo, triggerAnimatedTransform, setZoom,
  setPattern, setBrushColor, setSymmetry,
  setShowTilePreview, setShowShortcuts,
  invertCells, fitToContent, copySVGToClipboard,
  generateRandom, pushUndo, activeCellsRef, setActiveCells,
}: KeyboardShortcutsArgs) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if ((e.target as HTMLElement).tagName === "INPUT") return;

      if (mod && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (mod && e.key === "z" && e.shiftKey) { e.preventDefault(); redo(); }
      else if (mod && e.key === "y") { e.preventDefault(); redo(); }
      else if (mod && (e.key === "=" || e.key === "+")) { e.preventDefault(); triggerAnimatedTransform(); setZoom((prev) => Math.min(ZOOM_MAX, prev * 1.2)); }
      else if (mod && e.key === "-") { e.preventDefault(); triggerAnimatedTransform(); setZoom((prev) => Math.max(ZOOM_MIN, prev / 1.2)); }
      else if (mod && e.key === "c" && !e.shiftKey && activeCellsRef.current.size > 0) { e.preventDefault(); copySVGToClipboard(); }
      else if (!mod && (e.key === "?" || e.key === "/")) { setShowShortcuts((p) => !p); }
      else if (e.key === "Escape") { setShowShortcuts(false); }
      else if (!mod && !e.shiftKey) {
        switch (e.key) {
          case "1": setPattern("rounded"); break;
          case "2": setPattern("square"); break;
          case "3": setPattern("blob"); break;
          case "4": setPattern("leaf"); break;
          case "5": setPattern("squircle"); break;
          case "6": setPattern("chamfer"); break;
          case "7": setPattern("isometric"); break;
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
  }, [undo, redo, triggerAnimatedTransform, setZoom, setPattern, setBrushColor, setSymmetry, setShowTilePreview, setShowShortcuts, invertCells, fitToContent, copySVGToClipboard, generateRandom, pushUndo, activeCellsRef, setActiveCells]);
}
