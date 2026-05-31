import {
  type Neighbours,
  QUADRANTS,
  quadrantSquare,
  quadrantRounded,
  filletConcave,
  getQuadrantNeighbours,
  getFilletNeighbours,
} from "./quadrant-helpers";

export function generatePathsRounded(
  cx: number, cy: number, half: number, m: number,
  on: boolean, n: Neighbours, paths: string[],
) {
  if (on) {
    for (let q = 0; q < 4; q++) {
      const [dx, dy] = QUADRANTS[q];
      const [a, b, c] = getQuadrantNeighbours(n, q);
      paths.push((a || b || c) ? quadrantSquare(cx, cy, dx, dy, half) : quadrantRounded(cx, cy, dx, dy, half, m));
    }
  } else {
    for (let q = 0; q < 4; q++) {
      const [dx, dy] = QUADRANTS[q];
      const [a, b] = getFilletNeighbours(n, q);
      if (a && b) paths.push(filletConcave(cx, cy, dx, dy, half, m));
    }
  }
}
