import {
  type Neighbours,
  QUADRANTS,
  quadrantSquare,
  quadrantRounded,
  filletConcave,
  getQuadrantNeighbours,
  getFilletNeighbours,
} from "./quadrant-helpers";

export function generatePathsLeaf(
  cx: number, cy: number, half: number,
  on: boolean, n: Neighbours, paths: string[],
) {
  if (on) {
    for (let q = 0; q < 4; q++) {
      const [dx, dy] = QUADRANTS[q];
      const [a, b, c] = getQuadrantNeighbours(n, q);
      if (a || b || c) {
        paths.push(quadrantSquare(cx, cy, dx, dy, half));
      } else if (q === 0 || q === 2) {
        paths.push(quadrantRounded(cx, cy, dx, dy, half, 0.553));
      } else {
        paths.push(quadrantSquare(cx, cy, dx, dy, half));
      }
    }
  } else {
    for (let q = 0; q < 4; q++) {
      const [dx, dy] = QUADRANTS[q];
      const [a, b] = getFilletNeighbours(n, q);
      if (a && b && (q === 0 || q === 2)) paths.push(filletConcave(cx, cy, dx, dy, half, 0.553));
    }
  }
}
