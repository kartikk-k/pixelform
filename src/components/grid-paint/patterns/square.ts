export function generatePathsSquare(cx: number, cy: number, half: number, on: boolean, paths: string[]) {
  if (on) paths.push(`M${cx - half},${cy - half}L${cx + half},${cy - half}L${cx + half},${cy + half}L${cx - half},${cy + half}Z`);
}
