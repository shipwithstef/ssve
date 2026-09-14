#!/usr/bin/env node
// scripts/stitch-side-by-side.mjs
//
// Shared 4-up landing-page side-by-side stitcher (WI-139).
//
// Stitching contract (single source of truth — referenced by benchmark-landing,
// landing-page Step 0.5, verify-promotion landing-tagged handler):
//
//   - 4 input tiles, each rendered at 1440×900 (typically by track-visuals --mode external-anchor)
//   - 2×2 layout: target top-left, top-2 sector anchors top-right + bottom-left, top-1 high-performer bottom-right
//   - Output: 2880×1800 JPEG, quality ≥85
//   - Anchor labels rendered as a thin caption strip across the bottom of each tile
//   - Path convention: docs/specs/landing/<wi-lower>-side-by-side.jpg
//     Note the LOWERCASE wi-lower — never WI-139, always wi-139.
//
// Backend selection: prefer `sharp` (npm) for speed + quality; fallback to
// `imagemagick convert` (system binary) if sharp is not installed. Run
// `--check-deps` to detect the active backend without producing output.
//
// Usage:
//   stitch-side-by-side.mjs --check-deps
//   stitch-side-by-side.mjs --help
//   stitch-side-by-side.mjs \
//     --target <path>      --target-label  "WI-139 (this branch)" \
//     --anchor1 <path>     --anchor1-label "Toast (sector top-1)" \
//     --anchor2 <path>     --anchor2-label "Notion (sector top-2)" \
//     --highperf <path>    --highperf-label "Linear (high-performer)" \
//     --output docs/specs/landing/wi-139-side-by-side.jpg

import { existsSync, mkdirSync } from "node:fs";
import { dirname, basename } from "node:path";
import { spawnSync } from "node:child_process";

const TILE_W = 1440;
const TILE_H = 900;
const OUT_W = TILE_W * 2;     // 2880
const OUT_H = TILE_H * 2;     // 1800
const JPEG_QUALITY = 85;
const LABEL_HEIGHT = 56;       // pixels reserved for caption strip per tile

function printHelp() {
  console.log(`stitch-side-by-side.mjs — 4-up landing-page side-by-side stitcher (WI-139)

Modes:
  --help                       Show this help
  --check-deps                 Detect available backend (sharp | imagemagick); exit 0 if usable, 1 if neither

Stitch usage:
  --target <path>              Target page screenshot (top-left tile)
  --target-label <text>        Caption text for target tile
  --anchor1 <path>             Sector top-1 anchor screenshot (top-right tile)
  --anchor1-label <text>       Caption text for anchor1 tile
  --anchor2 <path>             Sector top-2 anchor screenshot (bottom-left tile)
  --anchor2-label <text>       Caption text for anchor2 tile
  --highperf <path>            High-performer anchor screenshot (bottom-right tile)
  --highperf-label <text>      Caption text for highperf tile
  --output <path>              Output JPEG path (must be docs/specs/landing/<wi-lower>-side-by-side.jpg)

Output: 2880×1800 JPEG, quality ${JPEG_QUALITY}, 4 tiles arranged 2×2 with bottom captions.
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") return { mode: "help" };
    if (a === "--check-deps") return { mode: "check-deps" };
    if (a.startsWith("--")) {
      args[a.slice(2)] = argv[++i];
    }
  }
  return { mode: "stitch", ...args };
}

async function detectBackend() {
  // Prefer sharp
  try {
    await import("sharp");
    return { backend: "sharp", available: true, detail: "node module 'sharp' importable" };
  } catch (e) {
    // Fall through
  }
  // Fallback: imagemagick `convert` on PATH
  const r = spawnSync("convert", ["-version"], { stdio: "pipe" });
  if (r.status === 0) {
    const ver = (r.stdout?.toString() || "").split("\n")[0] || "unknown";
    return { backend: "imagemagick", available: true, detail: ver };
  }
  return {
    backend: null,
    available: false,
    detail: "neither 'sharp' (npm) nor 'convert' (imagemagick) found",
  };
}

function ensureOutDir(p) {
  const d = dirname(p);
  if (!existsSync(d)) mkdirSync(d, { recursive: true });
}

function validateOutputPath(p) {
  // Path-casing convention (per WI-139 F1): lowercase wi-### in filename.
  // Accepts both planning-time `wi-NNN-side-by-side.jpg` and verify-promotion
  // post-deploy `wi-NNN-side-by-side-postdeploy.jpg` (per G5-B1 review).
  // Strict-lowercase regex per G5-B2 — drop the redundant /i flag.
  const fn = basename(p);
  if (!/^wi-\d+-side-by-side(-postdeploy)?\.jpg$/.test(fn)) {
    throw new Error(`output filename must match wi-NNN-side-by-side(-postdeploy)?.jpg (lowercase wi); got: ${fn}`);
  }
}

async function stitchWithSharp(args) {
  const sharp = (await import("sharp")).default;
  const tiles = [
    { path: args.target,    label: args["target-label"]    || "target",    x: 0,       y: 0 },
    { path: args.anchor1,   label: args["anchor1-label"]   || "anchor1",   x: TILE_W,  y: 0 },
    { path: args.anchor2,   label: args["anchor2-label"]   || "anchor2",   x: 0,       y: TILE_H },
    { path: args.highperf,  label: args["highperf-label"]  || "highperf",  x: TILE_W,  y: TILE_H },
  ];
  const composites = [];
  for (const t of tiles) {
    const buf = await sharp(t.path).resize(TILE_W, TILE_H, { fit: "cover" }).png().toBuffer();
    composites.push({ input: buf, top: t.y, left: t.x });
    const labelSvg = Buffer.from(
      `<svg width="${TILE_W}" height="${LABEL_HEIGHT}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="rgba(0,0,0,0.78)"/>
        <text x="20" y="${LABEL_HEIGHT - 18}" font-family="sans-serif" font-size="28" fill="white">${t.label.replace(/[<&>]/g,"")}</text>
      </svg>`
    );
    composites.push({ input: labelSvg, top: t.y + TILE_H - LABEL_HEIGHT, left: t.x });
  }
  await sharp({ create: { width: OUT_W, height: OUT_H, channels: 3, background: "#000" } })
    .composite(composites)
    .jpeg({ quality: JPEG_QUALITY })
    .toFile(args.output);
}

function stitchWithImagemagick(args) {
  // Compose: resize each tile, annotate, then montage 2×2.
  const tmp = `/tmp/wi139-stitch-${process.pid}`;
  spawnSync("mkdir", ["-p", tmp]);
  const tiles = [
    { path: args.target,    label: args["target-label"]    || "target" },
    { path: args.anchor1,   label: args["anchor1-label"]   || "anchor1" },
    { path: args.anchor2,   label: args["anchor2-label"]   || "anchor2" },
    { path: args.highperf,  label: args["highperf-label"]  || "highperf" },
  ];
  const annotated = [];
  for (let i = 0; i < tiles.length; i++) {
    const out = `${tmp}/tile-${i}.png`;
    const r = spawnSync("convert", [
      tiles[i].path,
      "-resize", `${TILE_W}x${TILE_H}^`,
      "-gravity", "center",
      "-extent", `${TILE_W}x${TILE_H}`,
      "-gravity", "South",
      "-background", "rgba(0,0,0,0.78)",
      "-fill", "white",
      "-pointsize", "28",
      "-splice", `0x${LABEL_HEIGHT}`,
      "-annotate", `+0+${Math.floor(LABEL_HEIGHT/4)}`, tiles[i].label,
      out,
    ], { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`convert failed for tile ${i}`);
    annotated.push(out);
  }
  // The splice grew each tile by LABEL_HEIGHT — crop back to TILE_H
  const cropped = [];
  for (let i = 0; i < annotated.length; i++) {
    const out = `${tmp}/tile-${i}-crop.png`;
    spawnSync("convert", [annotated[i], "-gravity", "South", "-crop", `${TILE_W}x${TILE_H}+0+0`, out], { stdio: "inherit" });
    cropped.push(out);
  }
  const montage = spawnSync("montage", [
    ...cropped,
    "-tile", "2x2",
    "-geometry", "+0+0",
    "-quality", String(JPEG_QUALITY),
    args.output,
  ], { stdio: "inherit" });
  if (montage.status !== 0) {
    // imagemagick v7+ exposes `magick montage` instead of `montage`
    const m2 = spawnSync("magick", ["montage", ...cropped, "-tile", "2x2", "-geometry", "+0+0", "-quality", String(JPEG_QUALITY), args.output], { stdio: "inherit" });
    if (m2.status !== 0) throw new Error("imagemagick montage failed (tried both `montage` and `magick montage`)");
  }
  spawnSync("rm", ["-rf", tmp]);
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.mode === "help") {
    printHelp();
    process.exit(0);
  }

  if (args.mode === "check-deps") {
    const d = await detectBackend();
    if (d.available) {
      console.log(`PASS: backend=${d.backend} (${d.detail})`);
      process.exit(0);
    } else {
      console.error(`FAIL: ${d.detail}`);
      console.error("Install one of: `npm install sharp`, OR system imagemagick (apt install imagemagick)");
      process.exit(1);
    }
  }

  // stitch mode
  const required = ["target", "anchor1", "anchor2", "highperf", "output"];
  for (const k of required) {
    if (!args[k]) {
      console.error(`missing required arg: --${k}`);
      printHelp();
      process.exit(2);
    }
  }
  for (const k of ["target", "anchor1", "anchor2", "highperf"]) {
    if (!existsSync(args[k])) {
      console.error(`input missing: --${k} ${args[k]}`);
      process.exit(2);
    }
  }
  validateOutputPath(args.output);
  ensureOutDir(args.output);

  const d = await detectBackend();
  if (!d.available) {
    console.error(`FAIL: ${d.detail}`);
    process.exit(1);
  }

  if (d.backend === "sharp") {
    await stitchWithSharp(args);
  } else {
    stitchWithImagemagick(args);
  }
  console.log(`OK: stitched ${OUT_W}x${OUT_H} JPEG (q${JPEG_QUALITY}) → ${args.output} (backend=${d.backend})`);
}

main().catch((e) => {
  console.error(`ERROR: ${e.message}`);
  process.exit(1);
});
