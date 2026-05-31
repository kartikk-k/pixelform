import { type PatternType, type GridType, cellKey } from "../types";
import { generatePathsRounded } from "./rounded";
import { generatePathsSquare } from "./square";
import { generatePathsBlob } from "./blob";
import { generatePathsLeaf } from "./leaf";
import { generateChamferPaths } from "./chamfer";
import { generateIsoPaths } from "./isometric";
import { isoToScreen } from "../grids/iso-grid";

export interface PatternDef {
  id: PatternType;
  label: string;
  gridType: GridType;
  shortcutKey: string;
}

export const PATTERNS: PatternDef[] = [
  { id: "rounded", label: "Rounded", gridType: "square", shortcutKey: "1" },
  { id: "square", label: "Square", gridType: "square", shortcutKey: "2" },
  { id: "blob", label: "Blob", gridType: "square", shortcutKey: "3" },
  { id: "leaf", label: "Leaf", gridType: "square", shortcutKey: "4" },
  { id: "chamfer", label: "Chamfer", gridType: "square", shortcutKey: "5" },
  { id: "isometric", label: "Isometric", gridType: "isometric", shortcutKey: "6" },
];

export function getPatternDef(pattern: PatternType): PatternDef {
  return PATTERNS.find((p) => p.id === pattern)!;
}

export function getGridType(pattern: PatternType): GridType {
  return getPatternDef(pattern).gridType;
}

export function generateAllPaths(
  activeCells: Set<string>, gridSize: number,
  panX: number, panY: number, viewWidth: number, viewHeight: number,
  pattern: PatternType,
): string[] {
  if (pattern === "chamfer") return generateChamferPaths(activeCells, gridSize);
  if (pattern === "isometric") return generateIsoPaths(activeCells, gridSize);

  const minVisibleCol = Math.floor((-panX - gridSize) / gridSize) - 1;
  const maxVisibleCol = Math.ceil((-panX + viewWidth + gridSize) / gridSize) + 1;
  const minVisibleRow = Math.floor((-panY - gridSize) / gridSize) - 1;
  const maxVisibleRow = Math.ceil((-panY + viewHeight + gridSize) / gridSize) + 1;
  let minCol = minVisibleCol, maxCol = maxVisibleCol, minRow = minVisibleRow, maxRow = maxVisibleRow;

  activeCells.forEach((key) => {
    const [cx, cy] = key.split(",").map(Number);
    minCol = Math.min(minCol, cx - 1);
    maxCol = Math.max(maxCol, cx + 1);
    minRow = Math.min(minRow, cy - 1);
    maxRow = Math.max(maxRow, cy + 1);
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

export function getBoundsForPattern(
  activeCells: Set<string>, gridSize: number, pattern: PatternType,
): { x: number; y: number; width: number; height: number } | null {
  if (activeCells.size === 0) return null;

  if (getGridType(pattern) === "isometric") {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    activeCells.forEach((key) => {
      const [col, row] = key.split(",").map(Number);
      const { x, y } = isoToScreen(col, row, gridSize);
      minX = Math.min(minX, x - gridSize);
      minY = Math.min(minY, y - gridSize / 2);
      maxX = Math.max(maxX, x + gridSize);
      maxY = Math.max(maxY, y + gridSize / 2);
    });
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }

  // Square grid bounds
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  activeCells.forEach((key) => {
    const [cx, cy] = key.split(",").map(Number);
    minX = Math.min(minX, cx * gridSize);
    minY = Math.min(minY, cy * gridSize);
    maxX = Math.max(maxX, cx * gridSize);
    maxY = Math.max(maxY, cy * gridSize);
  });
  const half = gridSize / 2;
  return { x: minX - half, y: minY - half, width: maxX - minX + gridSize, height: maxY - minY + gridSize };
}
