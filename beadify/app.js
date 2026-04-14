/* eslint-disable no-restricted-globals */

function clampByte(v) {
  if (v < 0) return 0;
  if (v > 255) return 255;
  return v;
}

function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const v = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

function hslToRgb(h, s, l) {
  // h: 0..360, s/l: 0..100
  const hh = ((h % 360) + 360) % 360;
  const ss = Math.max(0, Math.min(100, s)) / 100;
  const ll = Math.max(0, Math.min(100, l)) / 100;

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let rp = 0;
  let gp = 0;
  let bp = 0;
  if (hh < 60) [rp, gp, bp] = [c, x, 0];
  else if (hh < 120) [rp, gp, bp] = [x, c, 0];
  else if (hh < 180) [rp, gp, bp] = [0, c, x];
  else if (hh < 240) [rp, gp, bp] = [0, x, c];
  else if (hh < 300) [rp, gp, bp] = [x, 0, c];
  else [rp, gp, bp] = [c, 0, x];

  return {
    r: clampByte(Math.round((rp + m) * 255)),
    g: clampByte(Math.round((gp + m) * 255)),
    b: clampByte(Math.round((bp + m) * 255)),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`.toUpperCase();
}

function makeBrand72(prefix, brandName, opts) {
  // 72 色（更适合真实图片）：12 个中性色 + 60 个彩色
  // - 中性色：保证黑/灰/白能正确落到“黑/灰”，不会跑到红/紫等深色上
  // - 彩色：10 个色相 × 6 个明度 = 60
  // 注意：这里仍是“可用的 72 色示例”，不是官方色卡；若你提供官方色卡表，可替换为精确 HEX。
  const neutralCount = 12;
  const chromaHues = 10;
  const lightnessSteps = opts?.lightnessSteps || [30, 40, 50, 60, 70, 80];
  const sat = typeof opts?.sat === "number" ? opts.sat : 72;

  const colors = [];
  let n = 1;

  // Neutrals: black -> white
  for (let i = 0; i < neutralCount; i++) {
    const t = neutralCount === 1 ? 1 : i / (neutralCount - 1);
    const v = clampByte(Math.round(t * 255));
    const code = `${prefix}${String(n).padStart(2, "0")}`;
    const neutralName = i === 0 ? "Black" : i === neutralCount - 1 ? "White" : `Gray ${String(i).padStart(2, "0")}`;
    colors.push({ code, name: `${brandName} ${neutralName}`, hex: rgbToHex({ r: v, g: v, b: v }) });
    n++;
  }

  // Chromas
  for (const l of lightnessSteps) {
    for (let hi = 0; hi < chromaHues; hi++) {
      const h = Math.round((hi / chromaHues) * 360);
      const rgb = hslToRgb(h, sat, l);
      const code = `${prefix}${String(n).padStart(2, "0")}`;
      colors.push({ code, name: `${brandName} ${code}`, hex: rgbToHex(rgb) });
      n++;
    }
  }

  return colors.slice(0, 72);
}

function makeGray72() {
  const colors = [];
  for (let i = 0; i < 72; i++) {
    const t = i / 71;
    const v = Math.round(t * 255);
    const code = `G${String(i + 1).padStart(2, "0")}`;
    colors.push({ code, name: code, hex: rgbToHex({ r: v, g: v, b: v }) });
  }
  return colors;
}

function createEl(tag, attrs) {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else el.setAttribute(k, v);
    }
  }
  return el;
}

function makeVendorA100Colors() {
  // Note: 这里的 HEX 是按 HSL 规则生成的“通用 100 色”，名称为商家常见的 A1..A100 形式。
  // 如果你有某个具体商家的色卡（A1->#xxxxxx ...），可以把这段替换为精确映射。
  const hues = 20; // 20 * 5 = 100
  const lightnessSteps = [35, 45, 55, 65, 75];
  const sat = 72;
  const colors = [];
  let n = 1;
  for (let li = 0; li < lightnessSteps.length; li++) {
    for (let hi = 0; hi < hues; hi++) {
      const h = Math.round((hi / hues) * 360);
      const l = lightnessSteps[li];
      const rgb = hslToRgb(h, sat, l);
      colors.push({ name: `A${n}`, hex: rgbToHex(rgb) });
      n++;
    }
  }
  return colors;
}

const PALETTES = [
  {
    id: "perler72",
    name: "Perler（72色）",
    colors: makeBrand72("P", "Perler", { sat: 74 }),
  },
  {
    id: "hama72",
    name: "Hama（72色）",
    colors: makeBrand72("H", "Hama", { sat: 70 }),
  },
  {
    id: "gray72",
    name: "灰度（72色）",
    colors: makeGray72(),
  },
];

function compilePalette(palette) {
  const rgb = palette.colors.map((c) => ({ code: c.code || c.name, ...c, ...hexToRgb(c.hex) }));
  const r = new Uint8Array(rgb.map((c) => c.r));
  const g = new Uint8Array(rgb.map((c) => c.g));
  const b = new Uint8Array(rgb.map((c) => c.b));
  return { palette, rgb, r, g, b };
}

function nearestColorIndex(r, g, b, pal) {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < pal.r.length; i++) {
    const dr = r - pal.r[i];
    const dg = g - pal.g[i];
    const db = b - pal.b[i];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

function quantizeNoDither(imageData, pal) {
  const { width, height, data } = imageData;
  const out = new Uint16Array(width * height);
  for (let i = 0, p = 0; i < out.length; i++, p += 4) {
    out[i] = nearestColorIndex(data[p], data[p + 1], data[p + 2], pal);
  }
  return out;
}

function quantizeFloydSteinberg(imageData, pal) {
  const { width, height, data } = imageData;
  const n = width * height;
  const out = new Uint16Array(n);
  const bufR = new Float32Array(n);
  const bufG = new Float32Array(n);
  const bufB = new Float32Array(n);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    bufR[i] = data[p];
    bufG[i] = data[p + 1];
    bufB[i] = data[p + 2];
  }

  function addErr(x, y, er, eg, eb, factor) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = y * width + x;
    bufR[idx] += er * factor;
    bufG[idx] += eg * factor;
    bufB[idx] += eb * factor;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const oldR = clampByte(Math.round(bufR[idx]));
      const oldG = clampByte(Math.round(bufG[idx]));
      const oldB = clampByte(Math.round(bufB[idx]));

      const ci = nearestColorIndex(oldR, oldG, oldB, pal);
      out[idx] = ci;
      const newR = pal.r[ci];
      const newG = pal.g[ci];
      const newB = pal.b[ci];

      const er = oldR - newR;
      const eg = oldG - newG;
      const eb = oldB - newB;

      // Floyd–Steinberg
      addErr(x + 1, y, er, eg, eb, 7 / 16);
      addErr(x - 1, y + 1, er, eg, eb, 3 / 16);
      addErr(x, y + 1, er, eg, eb, 5 / 16);
      addErr(x + 1, y + 1, er, eg, eb, 1 / 16);
    }
  }
  return out;
}

function despeckleIndices(indices, width, height) {
  // 简单“去彩点”：如果某个点在 3x3 邻域里非常孤立，就替换成邻域众数
  // 目标：减少抖动在皮肤等区域引入的彩色噪点
  const src = indices;
  const dst = new Uint16Array(src.length);
  dst.set(src);

  const counts = new Map();
  function bump(k) {
    counts.set(k, (counts.get(k) || 0) + 1);
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      const center = src[idx];

      counts.clear();
      for (let yy = y - 1; yy <= y + 1; yy++) {
        if (yy < 0 || yy >= height) continue;
        for (let xx = x - 1; xx <= x + 1; xx++) {
          if (xx < 0 || xx >= width) continue;
          bump(src[yy * width + xx]);
        }
      }

      const centerCount = counts.get(center) || 0;
      let best = center;
      let bestCount = centerCount;
      for (const [k, v] of counts.entries()) {
        if (v > bestCount) {
          bestCount = v;
          best = k;
        }
      }

      // 判定“孤立”：中心色出现次数 <=2 且 邻域有明显多数色
      if (best !== center && centerCount <= 2 && bestCount >= 5) dst[idx] = best;
    }
  }
  return dst;
}

function drawBeads(outCanvas, gridW, gridH, beadSize, pal, indices, showGrid) {
  const ctx = outCanvas.getContext("2d", { alpha: false });
  const w = gridW * beadSize;
  const h = gridH * beadSize;
  outCanvas.width = w;
  outCanvas.height = h;

  ctx.fillStyle = "#0B1020";
  ctx.fillRect(0, 0, w, h);

  const r = beadSize * 0.46;
  const highlightR = beadSize * 0.17;
  const shadowR = beadSize * 0.43;

  ctx.save();
  ctx.translate(0.5, 0.5);
  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x;
      const c = pal.rgb[indices[idx]];

      const cx = x * beadSize + beadSize / 2;
      const cy = y * beadSize + beadSize / 2;

      // base bead
      ctx.beginPath();
      ctx.fillStyle = c.hex;
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // subtle shadow edge
      const grad = ctx.createRadialGradient(cx - beadSize * 0.1, cy - beadSize * 0.1, beadSize * 0.05, cx, cy, shadowR);
      grad.addColorStop(0, "rgba(255,255,255,0.18)");
      grad.addColorStop(1, "rgba(0,0,0,0.35)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      // highlight
      ctx.fillStyle = "rgba(255,255,255,0.22)";
      ctx.beginPath();
      ctx.arc(cx - beadSize * 0.14, cy - beadSize * 0.14, highlightR, 0, Math.PI * 2);
      ctx.fill();

      if (showGrid) {
        ctx.strokeStyle = "rgba(255,255,255,0.10)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
  ctx.restore();
}

function drawSourcePreview(srcCanvas, source) {
  // 原图预览：按较大尺寸渲染（不按格子缩小），便于观察抠图/卡通化效果
  const w0 = source.naturalWidth || source.width;
  const h0 = source.naturalHeight || source.height;
  const maxW = 980;
  const maxH = 520;
  const scale = Math.min(1, maxW / w0, maxH / h0);
  const w = Math.max(1, Math.round(w0 * scale));
  const h = Math.max(1, Math.round(h0 * scale));

  const ctx = srcCanvas.getContext("2d");
  srcCanvas.width = w;
  srcCanvas.height = h;
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
}

function downscaleToGrid(img, gridW, gridH) {
  const c = document.createElement("canvas");
  c.width = gridW;
  c.height = gridH;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, gridW, gridH);
  ctx.drawImage(img, 0, 0, gridW, gridH);
  return ctx.getImageData(0, 0, gridW, gridH);
}

function makeSolidCanvas(width, height, rgb) {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  ctx.fillStyle = rgbToHex(rgb);
  ctx.fillRect(0, 0, width, height);
  return c;
}

function rgbDist(a, b) {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function estimateBackgroundColor(imgData) {
  const { width, height, data } = imgData;
  const samples = [];

  function pushAt(x, y) {
    const p = (y * width + x) * 4;
    samples.push({ r: data[p], g: data[p + 1], b: data[p + 2] });
  }

  const pad = Math.max(1, Math.floor(Math.min(width, height) * 0.06));
  const points = [
    [pad, pad],
    [width - 1 - pad, pad],
    [pad, height - 1 - pad],
    [width - 1 - pad, height - 1 - pad],
    [Math.floor(width / 2), pad],
    [Math.floor(width / 2), height - 1 - pad],
    [pad, Math.floor(height / 2)],
    [width - 1 - pad, Math.floor(height / 2)],
  ];
  for (const [x, y] of points) pushAt(Math.max(0, Math.min(width - 1, x)), Math.max(0, Math.min(height - 1, y)));

  const rs = samples.map((s) => s.r).sort((a, b) => a - b);
  const gs = samples.map((s) => s.g).sort((a, b) => a - b);
  const bs = samples.map((s) => s.b).sort((a, b) => a - b);
  const mid = Math.floor(samples.length / 2);
  return { r: rs[mid], g: gs[mid], b: bs[mid] };
}

function simpleCutout(source, bgFill, threshold) {
  // “简单抠图”：适合背景较干净/纯色/大面积同色的照片
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const tmpW = Math.max(320, Math.min(960, w));
  const tmpH = Math.max(1, Math.round((h / w) * tmpW));

  const c = document.createElement("canvas");
  c.width = tmpW;
  c.height = tmpH;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, tmpW, tmpH);

  const imgData = ctx.getImageData(0, 0, tmpW, tmpH);
  const bg = estimateBackgroundColor(imgData);
  const data = imgData.data;

  const fillRgb = bgFill === "black" ? { r: 0, g: 0, b: 0 } : bgFill === "white" ? { r: 255, g: 255, b: 255 } : null;

  const mask = new Uint8Array(tmpW * tmpH); // 1=前景 0=背景
  for (let i = 0, p = 0; i < mask.length; i++, p += 4) {
    const px = { r: data[p], g: data[p + 1], b: data[p + 2] };
    mask[i] = rgbDist(px, bg) > threshold ? 1 : 0;
  }

  const smoothed = new Uint8Array(mask.length);
  for (let y = 0; y < tmpH; y++) {
    for (let x = 0; x < tmpW; x++) {
      let sum = 0;
      for (let yy = y - 1; yy <= y + 1; yy++) {
        if (yy < 0 || yy >= tmpH) continue;
        for (let xx = x - 1; xx <= x + 1; xx++) {
          if (xx < 0 || xx >= tmpW) continue;
          sum += mask[yy * tmpW + xx];
        }
      }
      smoothed[y * tmpW + x] = sum >= 5 ? 1 : 0;
    }
  }

  for (let i = 0, p = 0; i < smoothed.length; i++, p += 4) {
    if (smoothed[i] === 0) {
      if (bgFill === "keep") continue;
      data[p] = fillRgb.r;
      data[p + 1] = fillRgb.g;
      data[p + 2] = fillRgb.b;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return c;
}

function boxBlurRgb(data, width, height, radius) {
  // Very small radius blur for "cartoon smoothing" (separable box blur)
  if (radius <= 0) return;
  const w = width;
  const h = height;
  const tmp = new Uint8ClampedArray(data.length);

  // horizontal
  for (let y = 0; y < h; y++) {
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    const row = y * w;
    const window = radius * 2 + 1;

    for (let x = -radius; x <= radius; x++) {
      const xx = Math.max(0, Math.min(w - 1, x));
      const p = (row + xx) * 4;
      rSum += data[p];
      gSum += data[p + 1];
      bSum += data[p + 2];
    }
    for (let x = 0; x < w; x++) {
      const pOut = (row + x) * 4;
      tmp[pOut] = Math.round(rSum / window);
      tmp[pOut + 1] = Math.round(gSum / window);
      tmp[pOut + 2] = Math.round(bSum / window);
      tmp[pOut + 3] = data[pOut + 3];

      const xRemove = Math.max(0, x - radius);
      const xAdd = Math.min(w - 1, x + radius + 1);
      const pR = (row + xRemove) * 4;
      const pA = (row + xAdd) * 4;
      rSum += data[pA] - data[pR];
      gSum += data[pA + 1] - data[pR + 1];
      bSum += data[pA + 2] - data[pR + 2];
    }
  }

  // vertical
  for (let x = 0; x < w; x++) {
    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    const window = radius * 2 + 1;
    for (let y = -radius; y <= radius; y++) {
      const yy = Math.max(0, Math.min(h - 1, y));
      const p = (yy * w + x) * 4;
      rSum += tmp[p];
      gSum += tmp[p + 1];
      bSum += tmp[p + 2];
    }
    for (let y = 0; y < h; y++) {
      const pOut = (y * w + x) * 4;
      data[pOut] = Math.round(rSum / window);
      data[pOut + 1] = Math.round(gSum / window);
      data[pOut + 2] = Math.round(bSum / window);

      const yRemove = Math.max(0, y - radius);
      const yAdd = Math.min(h - 1, y + radius + 1);
      const pR = (yRemove * w + x) * 4;
      const pA = (yAdd * w + x) * 4;
      rSum += tmp[pA] - tmp[pR];
      gSum += tmp[pA + 1] - tmp[pR + 1];
      bSum += tmp[pA + 2] - tmp[pR + 2];
    }
  }
}

function posterizeRgb(data, levels) {
  const lv = Math.max(2, Math.min(64, Math.round(levels)));
  const step = 255 / (lv - 1);
  for (let p = 0; p < data.length; p += 4) {
    data[p] = clampByte(Math.round(Math.round(data[p] / step) * step));
    data[p + 1] = clampByte(Math.round(Math.round(data[p + 1] / step) * step));
    data[p + 2] = clampByte(Math.round(Math.round(data[p + 2] / step) * step));
  }
}

function sobelEdgesLuma(data, width, height) {
  // Returns edge magnitude per pixel (0..255ish)
  const w = width;
  const h = height;
  const luma = new Uint8ClampedArray(w * h);
  for (let i = 0, p = 0; i < luma.length; i++, p += 4) {
    // Rec. 709 luma approx
    luma[i] = (0.2126 * data[p] + 0.7152 * data[p + 1] + 0.0722 * data[p + 2]) | 0;
  }
  const out = new Uint8ClampedArray(w * h);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const a00 = luma[i - w - 1];
      const a01 = luma[i - w];
      const a02 = luma[i - w + 1];
      const a10 = luma[i - 1];
      const a12 = luma[i + 1];
      const a20 = luma[i + w - 1];
      const a21 = luma[i + w];
      const a22 = luma[i + w + 1];

      const gx = -a00 + a02 - 2 * a10 + 2 * a12 - a20 + a22;
      const gy = -a00 - 2 * a01 - a02 + a20 + 2 * a21 + a22;
      const mag = Math.min(255, Math.abs(gx) + Math.abs(gy));
      out[i] = mag;
    }
  }
  return out;
}

function cartoonifyCanvas(source, opts) {
  // Offline cartoon filter:
  // 1) downscale for speed  2) blur  3) posterize  4) draw edges
  const w0 = source.naturalWidth || source.width;
  const h0 = source.naturalHeight || source.height;
  const maxW = 720;
  const w = Math.min(maxW, w0);
  const h = Math.max(1, Math.round((h0 / w0) * w));

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(source, 0, 0, w, h);

  const imgData = ctx.getImageData(0, 0, w, h);
  const data = imgData.data;

  const smooth = Math.max(0, Math.min(5, opts.smooth | 0));
  for (let i = 0; i < smooth; i++) boxBlurRgb(data, w, h, 1);

  posterizeRgb(data, opts.levels);

  const edges = sobelEdgesLuma(data, w, h);
  const edgeTh = Math.max(1, Math.min(255, opts.edgeTh | 0));
  for (let i = 0, p = 0; i < edges.length; i++, p += 4) {
    if (edges[i] > edgeTh) {
      data[p] = 0;
      data[p + 1] = 0;
      data[p + 2] = 0;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return c;
}

async function loadScriptOnce(url) {
  if (document.querySelector(`script[data-src="${url}"]`)) return;
  await new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = url;
    s.async = true;
    s.defer = true;
    s.dataset.src = url;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load script: ${url}`));
    document.head.appendChild(s);
  });
}

let _selfieSeg = null;
async function smartCutout(source, bgFill) {
  // 智能抠图：MediaPipe Selfie Segmentation（需要联网加载模型）
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const bgCanvas =
    bgFill === "keep" ? null : makeSolidCanvas(w, h, bgFill === "black" ? { r: 0, g: 0, b: 0 } : { r: 255, g: 255, b: 255 });

  await loadScriptOnce("https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js");
  const SelfieSegmentation = globalThis.SelfieSegmentation;
  if (!SelfieSegmentation) throw new Error("MediaPipe 未加载成功");

  if (!_selfieSeg) {
    _selfieSeg = new SelfieSegmentation({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
    });
    _selfieSeg.setOptions({ modelSelection: 1 });
  }

  const result = await new Promise((resolve) => {
    _selfieSeg.onResults((r) => resolve(r));
    _selfieSeg.send({ image: source });
  });

  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  ctx.imageSmoothingEnabled = true;

  if (bgCanvas) ctx.drawImage(bgCanvas, 0, 0, w, h);
  ctx.drawImage(source, 0, 0, w, h);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(result.segmentationMask, 0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";

  return c;
}

function formatInt(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = createEl("a", { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

function downloadCanvasPng(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(filename, blob);
  }, "image/png");
}

function buildCsv(pal, counts) {
  const rows = [["颜色名", "HEX", "数量"]];
  for (const item of counts) rows.push([item.name, item.hex, String(item.count)]);
  return rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
}

function buildCsvWithCodes(pal, counts, codeByPaletteIndex) {
  // 导出“打印编号(短码)+颜色名+HEX+数量”，短码用于模板格内显示，颜色名用于对照实物/购买链接。
  const rows = [["打印编号", "颜色名", "HEX", "数量"]];
  for (const item of counts) {
    const code = codeByPaletteIndex.get(item.idx) || "";
    rows.push([code, item.name, item.hex, String(item.count)]);
  }
  return rows.map((r) => r.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(",")).join("\n");
}

function computeCounts(pal, indices) {
  const m = new Map();
  for (const idx of indices) m.set(idx, (m.get(idx) || 0) + 1);
  const out = [];
  for (const [idx, count] of m.entries()) {
    out.push({ idx, count, name: pal.rgb[idx].name, hex: pal.rgb[idx].hex });
  }
  out.sort((a, b) => b.count - a.count);
  return out;
}

function renderLegend(legendEl, counts, codeByPaletteIndex) {
  legendEl.innerHTML = "";
  if (counts.length === 0) {
    legendEl.appendChild(createEl("div", { class: "hint", text: "生成后会在这里显示各颜色用量。" }));
    return;
  }
  for (const c of counts) {
    const item = createEl("div", { class: "legend__item" });
    const sw = createEl("div", { class: "swatch" });
    sw.style.background = c.hex;
    item.appendChild(sw);
    const code = codeByPaletteIndex ? codeByPaletteIndex.get(c.idx) : "";
    const label = code && code !== c.name ? `[${code}] ${c.name}  ${c.hex}` : `${c.name}  ${c.hex}`;
    item.appendChild(createEl("div", { class: "legend__name", text: label }));
    item.appendChild(createEl("div", { class: "legend__count", text: `${formatInt(c.count)}` }));
    legendEl.appendChild(item);
  }
}

function buildCodeMap(counts) {
  // Give frequently used colors smaller codes (1..N) for easier printing.
  const codeByPaletteIndex = new Map();
  const list = counts.slice().sort((a, b) => b.count - a.count);
  for (let i = 0; i < list.length; i++) {
    codeByPaletteIndex.set(list[i].idx, String(i + 1));
  }
  return codeByPaletteIndex;
}

function buildPrintCodeMap(pal, counts) {
  const m = new Map();
  for (let i = 0; i < pal.rgb.length; i++) m.set(i, pal.rgb[i].code || pal.rgb[i].name);
  return m;
}

function chooseTickStep(n) {
  if (n <= 30) return 1;
  if (n <= 60) return 5;
  if (n <= 120) return 10;
  return 20;
}

function drawPrintGrid({ gridW, gridH, pal, indices, showCoords, showNumbers, codeByPaletteIndex: providedCodeMap }) {
  // Cell size tuned so the output stays printable and not insanely huge.
  const maxDim = Math.max(gridW, gridH);
  const cell = Math.max(14, Math.min(28, Math.floor(5200 / maxDim)));
  const margin = showCoords ? Math.max(38, Math.floor(cell * 2.4)) : 18;
  const pad = 18;

  const canvas = document.createElement("canvas");
  canvas.width = pad * 2 + margin + gridW * cell;
  canvas.height = pad * 2 + margin + gridH * cell;
  const ctx = canvas.getContext("2d", { alpha: false });

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const originX = pad + margin;
  const originY = pad + margin;

  const counts = computeCounts(pal, indices);
  const codeByPaletteIndex = providedCodeMap || buildCodeMap(counts);

  // Draw cells
  ctx.save();
  ctx.translate(originX, originY);

  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(0,0,0,0.18)";

  const fontSize = Math.max(8, Math.min(16, Math.floor(cell * 0.50)));
  ctx.font = `${fontSize}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let y = 0; y < gridH; y++) {
    for (let x = 0; x < gridW; x++) {
      const idx = y * gridW + x;
      const c = pal.rgb[indices[idx]];
      const px = x * cell;
      const py = y * cell;

      ctx.fillStyle = c.hex;
      ctx.fillRect(px, py, cell, cell);

      ctx.strokeRect(px, py, cell, cell);

      if (showNumbers) {
        const code = codeByPaletteIndex.get(indices[idx]) || "";
        if (code) {
          // Choose text color by luminance.
          const lum = (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
          ctx.fillStyle = lum > 0.58 ? "rgba(0,0,0,0.82)" : "rgba(255,255,255,0.92)";
          ctx.fillText(code, px + cell / 2, py + cell / 2);
        }
      }
    }
  }
  ctx.restore();

  // Coordinates
  if (showCoords) {
    const stepX = chooseTickStep(gridW);
    const stepY = chooseTickStep(gridH);
    const labelFont = Math.max(10, Math.min(16, Math.floor(cell * 0.52)));

    ctx.font = `${labelFont}px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`;
    ctx.fillStyle = "rgba(0,0,0,0.78)";

    // top labels (columns)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let x = 0; x < gridW; x++) {
      const col = x + 1;
      if (col % stepX !== 0 && col !== 1 && col !== gridW) continue;
      const cx = originX + x * cell + cell / 2;
      const cy = pad + Math.floor(margin / 2);
      ctx.fillText(String(col), cx, cy);
    }

    // left labels (rows)
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    for (let y = 0; y < gridH; y++) {
      const row = y + 1;
      if (row % stepY !== 0 && row !== 1 && row !== gridH) continue;
      const cx = pad + Math.floor(margin / 2);
      const cy = originY + y * cell + cell / 2;
      ctx.fillText(String(row), cx, cy);
    }

    // axis titles
    ctx.font = `600 ${Math.max(11, Math.min(18, labelFont + 2))}px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("列 →", originX, pad + 16);

    ctx.save();
    ctx.translate(pad + 16, originY + gridH * cell);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("行 →", 0, 0);
    ctx.restore();
  }

  // Header info
  ctx.fillStyle = "rgba(0,0,0,0.72)";
  ctx.font = `600 14px ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`;
  ctx.textAlign = "right";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(`${gridW}×${gridH}（${counts.length}色）`, canvas.width - 14, 22);

  return { canvas, codeByPaletteIndex, counts };
}

function main() {
  const fileInput = document.getElementById("file");
  const cols = document.getElementById("cols");
  const colsLabel = document.getElementById("colsLabel");
  const beadSize = document.getElementById("beadSize");
  const beadSizeLabel = document.getElementById("beadSizeLabel");
  const paletteSel = document.getElementById("palette");
  const paletteButtons = Array.from(document.querySelectorAll("[data-palette]"));
  const dither = document.getElementById("dither");
  const despeckle = document.getElementById("despeckle");
  const cutout = document.getElementById("cutout");
  const cutoutPanel = document.getElementById("cutoutPanel");
  const cutoutMode = document.getElementById("cutoutMode");
  const cutoutThreshold = document.getElementById("cutoutThreshold");
  const cutoutThresholdLabel = document.getElementById("cutoutThresholdLabel");
  const bgFill = document.getElementById("bgFill");
  const cutoutHint = document.getElementById("cutoutHint");
  const cartoon = document.getElementById("cartoon");
  const cartoonPanel = document.getElementById("cartoonPanel");
  const cartoonSmooth = document.getElementById("cartoonSmooth");
  const cartoonSmoothLabel = document.getElementById("cartoonSmoothLabel");
  const cartoonLevels = document.getElementById("cartoonLevels");
  const cartoonLevelsLabel = document.getElementById("cartoonLevelsLabel");
  const cartoonEdge = document.getElementById("cartoonEdge");
  const cartoonEdgeLabel = document.getElementById("cartoonEdgeLabel");
  const grid = document.getElementById("grid");
  const renderBtn = document.getElementById("render");
  const downloadPngBtn = document.getElementById("downloadPng");
  const downloadCsvBtn = document.getElementById("downloadCsv");
  const printCoords = document.getElementById("printCoords");
  const printNumbers = document.getElementById("printNumbers");
  const downloadPrintPngBtn = document.getElementById("downloadPrintPng");
  const stats = document.getElementById("stats");
  const legend = document.getElementById("legend");
  const srcCanvas = document.getElementById("srcCanvas");
  const outCanvas = document.getElementById("outCanvas");

  for (const p of PALETTES) {
    const opt = createEl("option", { value: p.id, text: p.name });
    paletteSel.appendChild(opt);
  }
  paletteSel.value = "perler72";

  function syncPaletteButtons() {
    for (const btn of paletteButtons) {
      const id = btn.getAttribute("data-palette");
      btn.classList.toggle("seg__btn--active", id === paletteSel.value);
      btn.setAttribute("aria-selected", id === paletteSel.value ? "true" : "false");
    }
  }
  syncPaletteButtons();

  function syncLabels() {
    colsLabel.textContent = `${cols.value} 列`;
    beadSizeLabel.textContent = `${beadSize.value}px`;
    cutoutThresholdLabel.textContent = `${cutoutThreshold.value}`;
    cartoonSmoothLabel.textContent = `${cartoonSmooth.value}`;
    cartoonLevelsLabel.textContent = `${cartoonLevels.value}`;
    cartoonEdgeLabel.textContent = `${cartoonEdge.value}`;
  }
  syncLabels();

  let currentImg = null;
  let lastResult = null; // { gridW, gridH, pal, indices, counts }

  function setEnabled(enabled) {
    renderBtn.disabled = !enabled;
    downloadPngBtn.disabled = !enabled;
    downloadCsvBtn.disabled = !enabled;
    downloadPrintPngBtn.disabled = !enabled;
  }

  setEnabled(false);
  renderLegend(legend, [], null);

  function getPalette() {
    const picked = PALETTES.find((p) => p.id === paletteSel.value) || PALETTES[0];
    return compilePalette(picked);
  }

  function computeGrid(img, targetCols) {
    const aspect = img.height / img.width;
    const w = Math.max(1, Math.round(targetCols));
    const h = Math.max(1, Math.round(w * aspect));
    return { w, h };
  }

  async function doRender() {
    if (!currentImg) return;
    const targetCols = Number(cols.value);
    const beadPx = Number(beadSize.value);
    const { w: gridW, h: gridH } = computeGrid(currentImg, targetCols);
    const pal = getPalette();

    let src = currentImg;
    cutoutHint.textContent = "";
    if (cutout.checked) {
      cutoutPanel.hidden = false;
      const fill = bgFill.value;
      if (cutoutMode.value === "smart") {
        try {
          cutoutHint.textContent = "正在加载/运行智能人像分割（首次会稍慢）…";
          src = await smartCutout(currentImg, fill);
          cutoutHint.textContent = "智能抠图完成。";
        } catch (e) {
          cutoutHint.textContent = `智能抠图失败（可能未联网），已回退到简单模式。`;
          src = simpleCutout(currentImg, fill, Number(cutoutThreshold.value));
        }
      } else {
        src = simpleCutout(currentImg, fill, Number(cutoutThreshold.value));
      }
    } else {
      cutoutPanel.hidden = true;
    }

    if (cartoon.checked) {
      cartoonPanel.hidden = false;
      src = cartoonifyCanvas(src, {
        smooth: Number(cartoonSmooth.value),
        levels: Number(cartoonLevels.value),
        edgeTh: Number(cartoonEdge.value),
      });
    } else {
      cartoonPanel.hidden = true;
    }

    drawSourcePreview(srcCanvas, src);
    const imgData = downscaleToGrid(src, gridW, gridH);
    let indices = dither.checked ? quantizeFloydSteinberg(imgData, pal) : quantizeNoDither(imgData, pal);
    if (despeckle.checked) indices = despeckleIndices(indices, gridW, gridH);

    drawBeads(outCanvas, gridW, gridH, beadPx, pal, indices, grid.checked);

    const counts = computeCounts(pal, indices);
    const codeByPaletteIndex = buildPrintCodeMap(pal, counts);
    renderLegend(legend, counts, codeByPaletteIndex);
    const total = gridW * gridH;
    stats.innerHTML =
      `<div>尺寸：<code>${gridW}</code> × <code>${gridH}</code>（共 <code>${formatInt(total)}</code> 颗）</div>` +
      `<div>配色：<code>${pal.palette.name}</code>（使用 <code>${counts.length}</code> 种颜色）</div>`;

    lastResult = { gridW, gridH, pal, indices, counts, codeByPaletteIndex };
    setEnabled(true);
  }

  cols.addEventListener("input", () => {
    syncLabels();
  });
  beadSize.addEventListener("input", () => {
    syncLabels();
  });
  cutoutThreshold.addEventListener("input", () => syncLabels());
  cartoonSmooth.addEventListener("input", () => syncLabels());
  cartoonLevels.addEventListener("input", () => syncLabels());
  cartoonEdge.addEventListener("input", () => syncLabels());

  renderBtn.addEventListener("click", () => doRender());
  paletteSel.addEventListener("change", () => {
    if (currentImg) doRender();
    syncPaletteButtons();
  });
  for (const btn of paletteButtons) {
    btn.addEventListener("click", () => {
      const id = btn.getAttribute("data-palette");
      if (!id) return;
      paletteSel.value = id;
      syncPaletteButtons();
      if (currentImg) doRender();
    });
  }
  dither.addEventListener("change", () => {
    if (currentImg) doRender();
  });
  despeckle.addEventListener("change", () => {
    if (currentImg) doRender();
  });
  cutout.addEventListener("change", () => {
    if (!currentImg) {
      cutoutPanel.hidden = !cutout.checked;
      return;
    }
    doRender();
  });
  cutoutMode.addEventListener("change", () => {
    if (currentImg) doRender();
  });
  bgFill.addEventListener("change", () => {
    if (currentImg) doRender();
  });
  cartoon.addEventListener("change", () => {
    if (!currentImg) {
      cartoonPanel.hidden = !cartoon.checked;
      return;
    }
    doRender();
  });
  cartoonSmooth.addEventListener("change", () => {
    if (currentImg) doRender();
  });
  cartoonLevels.addEventListener("change", () => {
    if (currentImg) doRender();
  });
  cartoonEdge.addEventListener("change", () => {
    if (currentImg) doRender();
  });
  grid.addEventListener("change", () => {
    if (currentImg) doRender();
  });

  downloadPngBtn.addEventListener("click", () => {
    if (!lastResult) return;
    downloadCanvasPng(outCanvas, `beadify_${lastResult.gridW}x${lastResult.gridH}.png`);
  });

  downloadCsvBtn.addEventListener("click", () => {
    if (!lastResult) return;
    const csv = buildCsvWithCodes(
      lastResult.pal,
      lastResult.counts,
      lastResult.codeByPaletteIndex || buildPrintCodeMap(lastResult.pal, lastResult.counts),
    );
    downloadBlob(`beadify_${lastResult.gridW}x${lastResult.gridH}_palette.csv`, new Blob([csv], { type: "text/csv;charset=utf-8" }));
  });

  downloadPrintPngBtn.addEventListener("click", () => {
    if (!lastResult) return;
    const { canvas } = drawPrintGrid({
      gridW: lastResult.gridW,
      gridH: lastResult.gridH,
      pal: lastResult.pal,
      indices: lastResult.indices,
      showCoords: printCoords.checked,
      showNumbers: printNumbers.checked,
      codeByPaletteIndex: lastResult.codeByPaletteIndex,
    });
    downloadCanvasPng(canvas, `beadify_${lastResult.gridW}x${lastResult.gridH}_print.png`);
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files && fileInput.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      URL.revokeObjectURL(url);
      currentImg = img;
      setEnabled(true);
      doRender();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      currentImg = null;
      lastResult = null;
      setEnabled(false);
      stats.textContent = "图片加载失败，请换一张试试。";
    };
    img.src = url;
  });
}

document.addEventListener("DOMContentLoaded", main);
