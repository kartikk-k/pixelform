import type { PatternType, SymmetryMode } from "../types";

export function encodeState(cells: Set<string>, pattern: PatternType, symmetry: SymmetryMode): string {
  if (cells.size === 0) return "";
  const cellArr = Array.from(cells).map((k) => k.replace(",", "."));
  const data = { c: cellArr, p: pattern, s: symmetry };
  try {
    return btoa(JSON.stringify(data));
  } catch {
    return "";
  }
}

export function decodeState(hash: string): { cells: Set<string>; pattern: PatternType; symmetry: SymmetryMode } | null {
  if (!hash) return null;
  try {
    const data = JSON.parse(atob(hash));
    const cells = new Set<string>((data.c || []).map((k: string) => k.replace(".", ",")));
    return { cells, pattern: data.p || "rounded", symmetry: data.s || "none" };
  } catch {
    return null;
  }
}
