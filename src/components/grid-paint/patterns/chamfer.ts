import { cellKey } from "../types";

export function generateChamferPaths(activeCells: Set<string>, gridSize: number): string[] {
  if (activeCells.size === 0) return [];
  const paths: string[] = [];
  const half = gridSize / 2;
  const cut = half;
  function isOn(cx: number, cy: number) { return activeCells.has(cellKey(cx, cy)); }

  const cellsToProcess = new Set<string>();
  activeCells.forEach((key) => {
    const [cx, cy] = key.split(",").map(Number);
    for (let dx = -1; dx <= 1; dx++)
      for (let dy = -1; dy <= 1; dy++)
        cellsToProcess.add(cellKey(cx + dx, cy + dy));
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
