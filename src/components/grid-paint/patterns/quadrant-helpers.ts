export type Neighbours = boolean[][];

export const QUADRANTS: [number, number][] = [
  [1, 1],
  [-1, 1],
  [-1, -1],
  [1, -1],
];

export function quadrantSquare(cx: number, cy: number, dx: number, dy: number, half: number) {
  return `M${cx},${cy}L${cx + dx * half},${cy}L${cx + dx * half},${cy + dy * half}L${cx},${cy + dy * half}Z`;
}

export function quadrantRounded(cx: number, cy: number, dx: number, dy: number, half: number, m: number) {
  return `M${cx},${cy}L${cx + dx * half},${cy}C${cx + dx * half},${cy + dy * half * m},${cx + dx * half * m},${cy + dy * half},${cx},${cy + dy * half}Z`;
}

export function filletConcave(cx: number, cy: number, dx: number, dy: number, half: number, m: number) {
  return `M${cx + dx * half},${cy}C${cx + dx * half},${cy + dy * half * m},${cx + dx * half * m},${cy + dy * half},${cx},${cy + dy * half}L${cx + dx * half},${cy + dy * half}Z`;
}

export function getQuadrantNeighbours(n: Neighbours, q: number): [boolean, boolean, boolean] {
  switch (q) {
    case 0: return [n[2][1], n[2][2], n[1][2]];
    case 1: return [n[0][1], n[0][2], n[1][2]];
    case 2: return [n[0][1], n[0][0], n[1][0]];
    case 3: return [n[1][0], n[2][0], n[2][1]];
    default: return [false, false, false];
  }
}

export function getFilletNeighbours(n: Neighbours, q: number): [boolean, boolean] {
  switch (q) {
    case 0: return [n[2][1], n[1][2]];
    case 1: return [n[1][2], n[0][1]];
    case 2: return [n[0][1], n[1][0]];
    case 3: return [n[1][0], n[2][1]];
    default: return [false, false];
  }
}
