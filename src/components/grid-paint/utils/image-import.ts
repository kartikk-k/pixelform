import { cellKey } from "../types";

export function imageToGridCells(img: HTMLImageElement): Set<string> {
  const targetCells = 20;
  const aspect = img.width / img.height;
  let cols: number, rows: number;
  if (aspect >= 1) {
    cols = targetCells;
    rows = Math.round(targetCells / aspect);
  } else {
    rows = targetCells;
    cols = Math.round(targetCells * aspect);
  }

  const canvas = document.createElement("canvas");
  canvas.width = cols;
  canvas.height = rows;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new Set();
  ctx.drawImage(img, 0, 0, cols, rows);
  const imageData = ctx.getImageData(0, 0, cols, rows);

  const next = new Set<string>();
  const halfCols = Math.floor(cols / 2);
  const halfRows = Math.floor(rows / 2);
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = imageData.data[i],
        g = imageData.data[i + 1],
        b = imageData.data[i + 2],
        a = imageData.data[i + 3];
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114) * (a / 255);
      if (brightness < 128) {
        next.add(cellKey(x - halfCols, y - halfRows));
      }
    }
  }
  return next;
}
