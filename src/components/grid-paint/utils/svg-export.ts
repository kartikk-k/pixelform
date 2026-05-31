import type { PatternType } from "../types";
import { generateAllPaths, getBoundsForPattern } from "../patterns";

export function buildSVGContent(cells: Set<string>, gridSize: number, pattern: PatternType): string | null {
  if (cells.size === 0) return null;
  const bounds = getBoundsForPattern(cells, gridSize, pattern);
  if (!bounds) return null;
  const padding = gridSize;
  const vx = bounds.x - padding, vy = bounds.y - padding;
  const vw = bounds.width + padding * 2, vh = bounds.height + padding * 2;
  const paths = generateAllPaths(cells, gridSize, 0, 0, 99999, 99999, pattern);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}"><path d="${paths.join("")}" fill="black"/></svg>`;
}

export function downloadSVG(cells: Set<string>, gridSize: number, pattern: PatternType) {
  const svgContent = buildSVGContent(cells, gridSize, pattern);
  if (!svgContent) return;
  const fullContent = `<?xml version="1.0" encoding="UTF-8"?>\n${svgContent}`;
  const blob = new Blob([fullContent], { type: "image/svg+xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const now = new Date();
  a.download = `gridpaint_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}-${String(now.getMinutes()).padStart(2, "0")}-${String(now.getSeconds()).padStart(2, "0")}.svg`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function copySVGToClipboard(cells: Set<string>, gridSize: number, pattern: PatternType) {
  const svgContent = buildSVGContent(cells, gridSize, pattern);
  if (!svgContent) return;
  navigator.clipboard.writeText(svgContent);
}
