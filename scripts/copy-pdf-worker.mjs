#!/usr/bin/env node
// Copies pdf.js's worker file into public/ so the /measure page can load it
// same-origin (no CDN dependency -- free stack only, and guarantees the
// worker version always exactly matches the installed pdfjs-dist version,
// which pdf.js requires). Runs on every `npm install` via postinstall, so
// it's always back in sync after a dependency bump.

import { copyFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const src = join(projectRoot, "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const dest = join(projectRoot, "public", "pdf.worker.min.mjs");

if (!existsSync(src)) {
  // pdfjs-dist isn't installed (e.g. a CI step that skips optional deps) --
  // don't fail the whole install over a missing dev convenience file.
  console.log("copy-pdf-worker: pdfjs-dist worker not found, skipping.");
  process.exit(0);
}

copyFileSync(src, dest);
console.log("copy-pdf-worker: copied pdf.worker.min.mjs to public/.");
