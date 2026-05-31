export const GRID_SIZE_STEPS = 25;
export const GRID_SIZE_MIN = GRID_SIZE_STEPS * 2;
export const GRID_SIZE_MAX = GRID_SIZE_STEPS * 6;
export const GRID_SIZE_DEFAULT = 75;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 5;
export const MAX_UNDO = 100;

export type Cell = { x: number; y: number };
export type PatternType = "rounded" | "square" | "blob" | "leaf" | "chamfer" | "isometric";
export type SymmetryMode = "none" | "horizontal" | "vertical" | "both";
export type GridType = "square" | "isometric";

export function cellKey(x: number, y: number) {
  return `${x},${y}`;
}
