import type { Neighbours } from "./quadrant-helpers";

// Soft rounded-rectangle ("squircle") cells. Unlike the rounded pattern (which
// renders quarter-circle corners that turn an isolated cell into a full circle),
// squircle keeps long flat edges and only sweeps the exposed corners, so runs of
// cells read as crisp bars while diagonal steps flow together with smooth joints.
const CUT_RATIO = 0.6; // corner size relative to the half-cell
const K = 0.5523;      // cubic handle length for a circular-arc corner

export function generatePathsSquircle(
  cx: number, cy: number, half: number,
  on: boolean, n: Neighbours, paths: string[],
) {
  const cut = half * CUT_RATIO;
  const top = n[1][0], bottom = n[1][2], left = n[0][1], right = n[2][1];
  const tl = n[0][0], tr = n[2][0], bl = n[0][2], br = n[2][2];
  const xl = cx - half, xr = cx + half, yt = cy - half, yb = cy + half;
  const h = K; // shorthand for the arc handle factor

  if (on) {
    // A corner is swept only when fully exposed (no orthogonal or diagonal fill).
    const TL = (top || left || tl) ? 0 : cut;
    const TR = (top || right || tr) ? 0 : cut;
    const BL = (bottom || left || bl) ? 0 : cut;
    const BR = (bottom || right || br) ? 0 : cut;
    let d = `M${xl + TL},${yt}`;
    d += `L${xr - TR},${yt}`; if (TR) d += `C${xr - TR * (1 - h)},${yt},${xr},${yt + TR * (1 - h)},${xr},${yt + TR}`;
    d += `L${xr},${yb - BR}`; if (BR) d += `C${xr},${yb - BR * (1 - h)},${xr - BR * (1 - h)},${yb},${xr - BR},${yb}`;
    d += `L${xl + BL},${yb}`; if (BL) d += `C${xl + BL * (1 - h)},${yb},${xl},${yb - BL * (1 - h)},${xl},${yb - BL}`;
    d += `L${xl},${yt + TL}`; if (TL) d += `C${xl},${yt + TL * (1 - h)},${xl + TL * (1 - h)},${yt},${xl + TL},${yt}`;
    d += "Z";
    paths.push(d);
  } else {
    // Fill the concave notch left at the inner corner of a diagonal step.
    if (right && bottom) paths.push(`M${xr - cut},${yb}C${xr - cut * (1 - h)},${yb},${xr},${yb - cut * (1 - h)},${xr},${yb - cut}L${xr},${yb}Z`);
    if (left && bottom) paths.push(`M${xl + cut},${yb}C${xl + cut * (1 - h)},${yb},${xl},${yb - cut * (1 - h)},${xl},${yb - cut}L${xl},${yb}Z`);
    if (left && top) paths.push(`M${xl + cut},${yt}C${xl + cut * (1 - h)},${yt},${xl},${yt + cut * (1 - h)},${xl},${yt + cut}L${xl},${yt}Z`);
    if (right && top) paths.push(`M${xr - cut},${yt}C${xr - cut * (1 - h)},${yt},${xr},${yt + cut * (1 - h)},${xr},${yt + cut}L${xr},${yt}Z`);
  }
}
