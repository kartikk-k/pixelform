import type { PatternType } from "../types";

export function PatternIcon({ pattern, size }: { pattern: PatternType; size: number }) {
  const s = size, h = s / 2, q = s / 4;
  switch (pattern) {
    case "rounded": return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><rect x={1} y={1} width={s - 2} height={s - 2} rx={q} ry={q} fill="currentColor" /></svg>;
    case "square": return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><rect x={1} y={1} width={s - 2} height={s - 2} fill="currentColor" /></svg>;
    case "blob": return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><rect x={1} y={1} width={s - 2} height={s - 2} rx={h - 1} ry={h - 1} fill="currentColor" /></svg>;
    case "leaf": return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><path d={`M${h},1L${s - 1},1L${s - 1},${h}Q${s - 1},${s - 1},${h},${s - 1}L1,${s - 1}L1,${h}Q1,1,${h},1Z`} fill="currentColor" /></svg>;
    case "squircle": return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><rect x={1} y={1} width={s - 2} height={s - 2} rx={s * 0.32} ry={s * 0.32} fill="currentColor" /></svg>;
    case "chamfer": return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><polygon points={`${h},1 ${s - 1},${h} ${h},${s - 1} 1,${h}`} fill="currentColor" /></svg>;
    case "isometric": return <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}><polygon points={`${h},2 ${s - 2},${h} ${h},${s - 2} 2,${h}`} fill="currentColor" /></svg>;
  }
}
