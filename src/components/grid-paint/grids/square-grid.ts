import type { Cell } from "../types";

export function screenToSquare(px: number, py: number, gridSize: number): Cell {
  return { x: Math.round(px / gridSize), y: Math.round(py / gridSize) };
}
