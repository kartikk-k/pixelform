import type { Neighbours } from "./quadrant-helpers";
import { generatePathsRounded } from "./rounded";

export function generatePathsBlob(cx: number, cy: number, half: number, on: boolean, n: Neighbours, paths: string[]) {
  generatePathsRounded(cx, cy, half, 0.85, on, n, paths);
}
