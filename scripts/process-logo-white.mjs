// Process the white logo PNG: any TRANSPARENT region fully enclosed by the
// crest linework becomes opaque white, so interiors stand out on the green
// header band instead of showing the band through. Transparent pixels
// connected to the image border stay transparent (true background).
// Usage: node scripts/process-logo-white.mjs <in.png> <out.png>
import fs from "node:fs";
import { PNG } from "pngjs";

const [src, dest] = process.argv.slice(2);
const png = PNG.sync.read(fs.readFileSync(src));
const { width, height, data } = png;

const idx = (x, y) => (y * width + x) * 4;
const isTransparent = (i) => data[i + 3] < 250;

// Flood fill from every border pixel across transparent pixels.
const borderReachable = new Uint8Array(width * height);
const queue = [];
for (let x = 0; x < width; x++) {
  for (const y of [0, height - 1]) {
    const i = idx(x, y);
    if (isTransparent(i) && !borderReachable[y * width + x]) {
      borderReachable[y * width + x] = 1;
      queue.push([x, y]);
    }
  }
}
for (let y = 0; y < height; y++) {
  for (const x of [0, width - 1]) {
    const i = idx(x, y);
    if (isTransparent(i) && !borderReachable[y * width + x]) {
      borderReachable[y * width + x] = 1;
      queue.push([x, y]);
    }
  }
}
while (queue.length > 0) {
  const [x, y] = queue.pop();
  for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
    if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
    const pi = ny * width + nx;
    if (borderReachable[pi]) continue;
    if (isTransparent(idx(nx, ny))) {
      borderReachable[pi] = 1;
      queue.push([nx, ny]);
    }
  }
}

// Enclosed transparent pixels (not border-reachable) become opaque white.
let filled = 0;
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const pi = y * width + x;
    const i = idx(x, y);
    if (isTransparent(i) && !borderReachable[pi]) {
      data[i] = 255; data[i + 1] = 255; data[i + 2] = 255; data[i + 3] = 255;
      filled++;
    }
  }
}

// Optional downscale (nearest neighbour) to a sensible embed resolution.
const target = Number(process.argv[4] ?? 0);
let outPng = png;
if (target > 0 && (width > target || height > target)) {
  const out = new PNG({ width: target, height: target });
  for (let y = 0; y < target; y++) {
    for (let x = 0; x < target; x++) {
      const sx = Math.min(width - 1, Math.round((x / target) * width));
      const sy = Math.min(height - 1, Math.round((y / target) * height));
      const si = idx(sx, sy), di = (y * target + x) * 4;
      out.data[di] = data[si]; out.data[di + 1] = data[si + 1];
      out.data[di + 2] = data[si + 2]; out.data[di + 3] = data[si + 3];
    }
  }
  outPng = out;
}

fs.writeFileSync(dest, PNG.sync.write(outPng));
console.log(`processed ${width}x${height}: filled ${filled} enclosed transparent px with white -> ${dest}${target ? ` (resized ${target}x${target})` : ""}`);
