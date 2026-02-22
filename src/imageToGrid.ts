import { LEGO_COLORS } from './colors';
import { config } from './config';
import type { Grid } from './types';

// Deterministic non-linear 2D hash → [0, 1) with no visible spatial pattern
function hash2d(x: number, y: number): number {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h = h ^ (h >>> 16);
  return ((h & 0x7fffffff) / 0x7fffffff);
}

// Pick a water gradient color using dithered interpolation instead of hard bands
function pickWaterGradient(t: number, x: number, y: number): string {
  const tScaled = Math.max(0, Math.min(3, t * 3));
  const lower = Math.min(2, Math.floor(tScaled));
  const upper = lower + 1;
  const frac = tScaled - lower;
  const gi = hash2d(x, y) < frac ? upper : lower;
  return WATER_GRADIENT[gi];
}

export function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return [0, 0, l];

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h: number;
  switch (max) {
    case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
    case g: h = ((b - r) / d + 2) / 6; break;
    default: h = ((r - g) / d + 4) / 6; break;
  }

  return [h * 360, s, l];
}

function hslDistance(h1: number, s1: number, l1: number, h2: number, s2: number, l2: number): number {
  const dh = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2)) / 180;
  const ds = s1 - s2;
  const dl = l1 - l2;
  const avgS = (s1 + s2) / 2;
  return dh * dh * avgS + ds * ds + dl * dl;
}

const PALETTE_HSL = LEGO_COLORS.map((c) => {
  const [r, g, b] = hexToRgb(c.hex);
  const [h, s, l] = rgbToHsl(r, g, b);
  return { hex: c.hex, h, s, l };
});

// --- Color sets by config name ---
const colorByName = new Map(config.colors.map((c) => [c.name, c.hex]));

const WATER_HEXES = new Set([
  colorByName.get('black'),
  colorByName.get('dark blue'),
  colorByName.get('turquoise'),
  colorByName.get('light blue'),
].filter(Boolean) as string[]);

const LAND_HEXES = new Set(
  config.colors
    .filter((c) => !WATER_HEXES.has(c.hex))
    .map((c) => c.hex),
);

// Water gradient from darkest to lightest
const WATER_GRADIENT = [
  colorByName.get('black')!,
  colorByName.get('dark blue')!,
  colorByName.get('turquoise')!,
  colorByName.get('light blue')!,
];

const LAND_PALETTE = PALETTE_HSL.filter((c) => LAND_HEXES.has(c.hex)).map(c => {
  const [r, g, b] = hexToRgb(c.hex);
  return { ...c, r, g, b };
});

// Land color matching: pre-boost saturation so muted map pixels
// separate clearly against our vivid palette, then use hue-primary distance.
function closestLandColor(r: number, g: number, b: number): string {
  const [h, s, l] = rgbToHsl(r, g, b);
  let bestDist = Infinity;
  let bestHex = LAND_PALETTE[0].hex;

  for (const pc of LAND_PALETTE) {
    let dist: number;

    if (s < 0.08 || (s < 0.25 && l > 0.75)) {
      // Near-achromatic or barely-colored very-light pixel: use RGB Euclidean distance
      dist = ((r - pc.r) ** 2 + (g - pc.g) ** 2 + (b - pc.b) ** 2) / (255 * 255 * 3);
    } else {
      // Chromatic pixel: boost saturation to bridge the gap between
      // the muted source image and our vivid palette, then match on hue
      const boostedS = Math.min(1, s * 2.5);
      const dh = Math.min(Math.abs(h - pc.h), 360 - Math.abs(h - pc.h)) / 180;
      const dl = l - pc.l;
      const ds = boostedS - pc.s;
      dist = dh * dh * 3.0 + dl * dl * 0.5 + ds * ds * 0.15;

      // Penalize achromatic palette colors (white) for any chromatic source pixel
      if (pc.s < 0.15) {
        dist += s * s * 8.0;
      }
    }

    if (dist < bestDist) { bestDist = dist; bestHex = pc.hex; }
  }
  return bestHex;
}

// --- Pixel classification ---
function isWaterPixel(r: number, g: number, b: number): boolean {
  const [h, s, l] = rgbToHsl(r, g, b);
  // Very dark pixels → water
  if (l < 0.15) return true;
  // Blue/cyan hue range — require more saturation for lighter pixels
  // so ice/snow with a slight blue tint stays as land
  if (h >= 170 && h <= 260 && s > 0.15 + Math.max(0, l - 0.5) * 0.8) return true;
  // Desaturated dark-to-mid tones with blue-ish tint
  if (l < 0.45 && s < 0.2 && b > r) return true;
  return false;
}

// --- Distance transform (BFS) ---
function computeDistanceField(
  mask: boolean[],
  w: number,
  h: number,
  fromTrue: boolean,
): Float32Array {
  const dist = new Float32Array(w * h).fill(Infinity);
  const queue: number[] = [];

  for (let i = 0; i < w * h; i++) {
    if (mask[i] === fromTrue) {
      dist[i] = 0;
      queue.push(i);
    }
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    const cx = idx % w, cy = (idx - cx) / w;
    const nd = dist[idx] + 1;
    const neighbors = [
      cy > 0 ? idx - w : -1,
      cy < h - 1 ? idx + w : -1,
      cx > 0 ? idx - 1 : -1,
      cx < w - 1 ? idx + 1 : -1,
    ];
    for (const ni of neighbors) {
      if (ni >= 0 && nd < dist[ni]) {
        dist[ni] = nd;
        queue.push(ni);
      }
    }
  }
  return dist;
}

function computeEdgeDistance(w: number, h: number): Float32Array {
  const dist = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      dist[y * w + x] = Math.min(x, y, w - 1 - x, h - 1 - y);
    }
  }
  return dist;
}

// --- Downsample helper ---
function downsampleToBuffer(
  imageData: ImageData,
  gridWidth: number,
  gridHeight: number,
): Float32Array {
  const { width: imgW, height: imgH, data } = imageData;
  const buf = new Float32Array(gridWidth * gridHeight * 3);
  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const x0 = Math.floor((gx * imgW) / gridWidth);
      const x1 = Math.floor(((gx + 1) * imgW) / gridWidth);
      const y0 = Math.floor((gy * imgH) / gridHeight);
      const y1 = Math.floor(((gy + 1) * imgH) / gridHeight);
      let rSum = 0, gSum = 0, bSum = 0, count = 0;
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * imgW + x) * 4;
          rSum += data[i]; gSum += data[i + 1]; bSum += data[i + 2];
          count++;
        }
      }
      const idx = (gy * gridWidth + gx) * 3;
      buf[idx]     = count > 0 ? rSum / count : 0;
      buf[idx + 1] = count > 0 ? gSum / count : 0;
      buf[idx + 2] = count > 0 ? bSum / count : 0;
    }
  }
  return buf;
}

/** Convert an image to a LEGO dot grid with map-aware coloring.
 *  detailRes controls intermediate sampling resolution; the result is always gridWidth x gridHeight. */
export function imageToGrid(
  imageData: ImageData,
  gridWidth: number,
  gridHeight: number,
  detailRes?: number,
): Grid {
  // If detailRes is given, sample at a smaller size then nearest-neighbour upscale
  if (detailRes && detailRes < Math.max(gridWidth, gridHeight)) {
    const aspect = gridWidth / gridHeight;
    let sw: number, sh: number;
    if (aspect >= 1) {
      sw = detailRes;
      sh = Math.max(1, Math.round(detailRes / aspect));
    } else {
      sh = detailRes;
      sw = Math.max(1, Math.round(detailRes * aspect));
    }
    const small = imageToGrid(imageData, sw, sh);
    const grid: Grid = Array.from({ length: gridHeight }, (_, r) => {
      const sr = Math.min(Math.floor((r * sh) / gridHeight), sh - 1);
      return Array.from({ length: gridWidth }, (_, c) => {
        const sc = Math.min(Math.floor((c * sw) / gridWidth), sw - 1);
        return small[sr][sc];
      });
    });
    return grid;
  }

  const buf = downsampleToBuffer(imageData, gridWidth, gridHeight);

  // 1) Classify each cell as water or land
  const isWater = new Array<boolean>(gridWidth * gridHeight);
  for (let i = 0; i < gridWidth * gridHeight; i++) {
    const r = buf[i * 3], g = buf[i * 3 + 1], b = buf[i * 3 + 2];
    isWater[i] = isWaterPixel(r, g, b);
  }

  // 2) Distance from each water cell to nearest land cell
  const distToLand = computeDistanceField(isWater, gridWidth, gridHeight, false);

  // 3) Distance from each cell to nearest edge
  const distToEdge = computeEdgeDistance(gridWidth, gridHeight);

  // Max distances for normalisation
  let maxLandDist = 1;
  let maxEdgeDist = 1;
  for (let i = 0; i < gridWidth * gridHeight; i++) {
    if (isWater[i]) {
      if (distToLand[i] < Infinity && distToLand[i] > maxLandDist) maxLandDist = distToLand[i];
    }
    if (distToEdge[i] > maxEdgeDist) maxEdgeDist = distToEdge[i];
  }

  // 4) Build grid
  const grid: Grid = Array.from({ length: gridHeight }, () =>
    Array(gridWidth).fill(null),
  );

  for (let gy = 0; gy < gridHeight; gy++) {
    for (let gx = 0; gx < gridWidth; gx++) {
      const i = gy * gridWidth + gx;
      const r = Math.max(0, Math.min(255, buf[i * 3]));
      const g = Math.max(0, Math.min(255, buf[i * 3 + 1]));
      const b = Math.max(0, Math.min(255, buf[i * 3 + 2]));

      if (isWater[i]) {
        // Water gradient: near land = light blue, far from land / near edge = black
        const landNorm = distToLand[i] < Infinity ? distToLand[i] / maxLandDist : 1;
        const edgeNorm = distToEdge[i] / maxEdgeDist;
        // 0 = dark (far from land, near edge), 1 = light (near land, far from edge)
        const t = (1 - landNorm) * 0.7 + (1 - edgeNorm) * 0.3;
        grid[gy][gx] = pickWaterGradient(t, gx, gy);
      } else {
        // Land: pick closest land color (no black), prioritise green/sage
        grid[gy][gx] = closestLandColor(r, g, b);
      }
    }
  }

  return grid;
}

/** Re-assign over-limit dots to nearest available color respecting map semantics.
 *  Uses priority scoring so limited colors are distributed evenly across the
 *  entire map rather than row-by-row top-to-bottom. */
export function fixGridLimits(grid: Grid): Grid {
  const h = grid.length;
  const w = grid[0]?.length ?? 0;
  const total = w * h;
  const limits = new Map(config.colors.map((c) => [c.hex, c.quantity]));

  // Classify each cell as water or land based on its current color
  const cellIsWater: boolean[] = new Array(total);
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const hex = grid[r][c];
      cellIsWater[r * w + c] = hex != null && WATER_HEXES.has(hex);
    }
  }

  // Distance fields for priority scoring
  const distToLand = computeDistanceField(cellIsWater, w, h, false);
  const distToEdge = computeEdgeDistance(w, h);
  let maxLandDist = 1, maxEdgeDist = 1;
  for (let i = 0; i < total; i++) {
    if (cellIsWater[i] && distToLand[i] < Infinity && distToLand[i] > maxLandDist) maxLandDist = distToLand[i];
    if (distToEdge[i] > maxEdgeDist) maxEdgeDist = distToEdge[i];
  }

  // Collect positions grouped by color (with flat index for distance lookups)
  const colorPositions = new Map<string, { row: number; col: number; idx: number }[]>();
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const hex = grid[r][c];
      if (!hex) continue;
      const idx = r * w + c;
      let arr = colorPositions.get(hex);
      if (!arr) { arr = []; colorPositions.set(hex, arr); }
      arr.push({ row: r, col: c, idx });
    }
  }

  // Remaining budget per color
  const remaining = new Map<string, number>();
  for (const cc of config.colors) remaining.set(cc.hex, cc.quantity);

  const overColors: string[] = [];
  for (const [hex, positions] of colorPositions) {
    const limit = limits.get(hex) ?? 0;
    if (positions.length <= limit) {
      remaining.set(hex, limit - positions.length);
    } else {
      remaining.set(hex, 0);
      overColors.push(hex);
    }
  }

  if (overColors.length === 0) return grid;

  // Process most-constrained colors first (highest usage-to-limit ratio)
  overColors.sort((a, b) => {
    const aRatio = (colorPositions.get(a)!.length) / (limits.get(a) ?? 1);
    const bRatio = (colorPositions.get(b)!.length) / (limits.get(b) ?? 1);
    return bRatio - aRatio;
  });

  const newGrid: Grid = grid.map((row) => [...row]);

  const lightBlueHex = colorByName.get('light blue')!;
  const turquoiseHex = colorByName.get('turquoise')!;
  const darkBlueHex = colorByName.get('dark blue')!;
  const blackHex = colorByName.get('black')!;

  for (const hex of overColors) {
    const positions = colorPositions.get(hex)!;
    const limit = limits.get(hex) ?? 0;
    const isWaterColor = WATER_HEXES.has(hex);

    // Score each position — higher priority = more important to keep this color here
    const scored = positions.map(pos => {
      const landNorm = distToLand[pos.idx] < Infinity ? distToLand[pos.idx] / maxLandDist : 1;
      const edgeNorm = distToEdge[pos.idx] / maxEdgeDist;
      // Non-linear spatial jitter to break ties without diagonal artifacts
      const jitter = hash2d(pos.row, pos.col) * 0.0001;
      let priority: number;

      if (isWaterColor) {
        if (hex === lightBlueHex) {
          priority = (1 - landNorm) + jitter;
        } else if (hex === turquoiseHex) {
          priority = (1 - landNorm) * 0.85 + edgeNorm * 0.15 + jitter;
        } else if (hex === darkBlueHex) {
          priority = (1 - Math.abs(landNorm - 0.35)) + jitter;
        } else {
          priority = landNorm * 0.7 + (1 - edgeNorm) * 0.3 + jitter;
        }
      } else {
        // Land: non-linear 2D hash for organic distribution (no diagonal stripes)
        priority = hash2d(pos.row, pos.col);
      }
      return { ...pos, priority };
    });

    // Sort descending — keep the highest-priority (most important) positions
    scored.sort((a, b) => b.priority - a.priority);

    // Excess = lowest-priority positions that need reassignment
    const excess = scored.slice(limit);

    if (isWaterColor) {
      for (const pos of excess) {
        const landNorm = distToLand[pos.idx] < Infinity ? distToLand[pos.idx] / maxLandDist : 1;
        const edgeNorm = distToEdge[pos.idx] / maxEdgeDist;
        const t = (1 - landNorm) * 0.7 + (1 - edgeNorm) * 0.3;
        const idealHex = pickWaterGradient(t, pos.col, pos.row);

        const candidates = [idealHex, ...WATER_GRADIENT.filter(wh => wh !== idealHex)];
        let assigned = false;
        for (const ch of candidates) {
          if (ch === hex) continue;
          const rem = remaining.get(ch) ?? 0;
          if (rem > 0) {
            newGrid[pos.row][pos.col] = ch;
            remaining.set(ch, rem - 1);
            assigned = true;
            break;
          }
        }
        if (!assigned) {
          // Fallback to black (virtually unlimited)
          newGrid[pos.row][pos.col] = blackHex;
        }
      }
    } else {
      // Land: reassign to nearest available land color
      const [origR, origG, origB] = hexToRgb(hex);
      const [origH, origS, origL] = rgbToHsl(origR, origG, origB);
      const ranked = LAND_PALETTE
        .filter(pc => pc.hex !== hex)
        .map(pc => ({ hex: pc.hex, dist: hslDistance(origH, origS, origL, pc.h, pc.s, pc.l) }))
        .sort((a, b) => a.dist - b.dist);

      for (const pos of excess) {
        let assigned = false;
        for (const candidate of ranked) {
          const rem = remaining.get(candidate.hex) ?? 0;
          if (rem > 0) {
            newGrid[pos.row][pos.col] = candidate.hex;
            remaining.set(candidate.hex, rem - 1);
            assigned = true;
            break;
          }
        }
        if (!assigned) break;
      }
    }
  }

  return newGrid;
}

export function imageDataToBase64(imageData: ImageData): string {
  const canvas = document.createElement('canvas');
  canvas.width = imageData.width;
  canvas.height = imageData.height;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

export function base64ToImageData(dataUrl: string): Promise<ImageData> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      resolve(ctx.getImageData(0, 0, img.width, img.height));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function loadImageFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

export function getImageData(img: HTMLImageElement): ImageData {
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return ctx.getImageData(0, 0, img.width, img.height);
}
