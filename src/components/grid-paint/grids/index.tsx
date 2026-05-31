import type { Cell, GridType } from "../types";
import { screenToSquare } from "./square-grid";
import { screenToIso, isoToScreen } from "./iso-grid";

export interface GridAdapter {
  screenToCell(worldX: number, worldY: number, gridSize: number): Cell;
  renderDots(
    pan: { x: number; y: number }, zoom: number, gridSize: number,
    dimensions: { width: number; height: number },
  ): React.JSX.Element[];
}

const squareGrid: GridAdapter = {
  screenToCell(worldX, worldY, gridSize) {
    return screenToSquare(worldX, worldY, gridSize);
  },
  renderDots(pan, zoom, gridSize, dimensions) {
    const dots: React.JSX.Element[] = [];
    const scaledGrid = gridSize * zoom;
    if (scaledGrid <= 8) return dots;
    const startCol = Math.floor(-pan.x / scaledGrid) - 1;
    const endCol = Math.ceil((-pan.x + dimensions.width) / scaledGrid) + 1;
    const startRow = Math.floor(-pan.y / scaledGrid) - 1;
    const endRow = Math.ceil((-pan.y + dimensions.height) / scaledGrid) + 1;
    for (let col = startCol; col <= endCol; col++) {
      for (let row = startRow; row <= endRow; row++) {
        dots.push(
          // eslint-disable-next-line react/jsx-key
          <circle key={`${col},${row}`} cx={col * scaledGrid + pan.x} cy={row * scaledGrid + pan.y} r={1} fill="#ccc" />,
        );
      }
    }
    return dots;
  },
};

const isoGrid: GridAdapter = {
  screenToCell(worldX, worldY, gridSize) {
    return screenToIso(worldX, worldY, gridSize);
  },
  renderDots(pan, zoom, gridSize, dimensions) {
    const dots: React.JSX.Element[] = [];
    const gs = gridSize * zoom;
    if (gs <= 8) return dots;
    for (let col = -15; col <= 15; col++) {
      for (let row = -15; row <= 15; row++) {
        const { x, y } = isoToScreen(col, row, gridSize);
        const sx = x * zoom + pan.x, sy = y * zoom + pan.y;
        if (sx > -gs && sx < dimensions.width + gs && sy > -gs && sy < dimensions.height + gs) {
          dots.push(
            // eslint-disable-next-line react/jsx-key
            <circle key={`${col},${row}`} cx={sx} cy={sy} r={1} fill="#ccc" />,
          );
        }
      }
    }
    return dots;
  },
};

export const GRID_ADAPTERS: Record<GridType, GridAdapter> = {
  square: squareGrid,
  isometric: isoGrid,
};
