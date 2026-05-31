import { isoToScreen } from "../grids/iso-grid";

function isoDiamondPath(cx: number, cy: number, gridSize: number): string {
  const hw = gridSize, hh = gridSize / 2;
  return `M${cx},${cy - hh}L${cx + hw},${cy}L${cx},${cy + hh}L${cx - hw},${cy}Z`;
}

export function generateIsoPaths(activeCells: Set<string>, gridSize: number): string[] {
  const paths: string[] = [];
  activeCells.forEach((key) => {
    const [col, row] = key.split(",").map(Number);
    const { x, y } = isoToScreen(col, row, gridSize);
    paths.push(isoDiamondPath(x, y, gridSize * 0.98));
  });
  return paths;
}
