import type { Cell } from "../types";

export function isoToScreen(col: number, row: number, gridSize: number): { x: number; y: number } {
  const halfW = gridSize;
  const halfH = gridSize / 2;
  return {
    x: (col - row) * halfW,
    y: (col + row) * halfH,
  };
}

export function screenToIso(px: number, py: number, gridSize: number): Cell {
  const halfW = gridSize;
  const halfH = gridSize / 2;
  const fc = (px / halfW + py / halfH) / 2;
  const fr = (py / halfH - px / halfW) / 2;
  return { x: Math.round(fc), y: Math.round(fr) };
}
