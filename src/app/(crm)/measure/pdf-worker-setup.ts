import { GlobalWorkerOptions } from "pdfjs-dist";

let configured = false;

/** Points pdf.js at its own worker file, served same-origin from public/ (copied there by scripts/copy-pdf-worker.mjs on every install) rather than a CDN -- free stack only, and guarantees the worker version always exactly matches the installed pdfjs-dist version. Call once before any getDocument(). */
export function ensurePdfWorkerConfigured(): void {
  if (configured) return;
  GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  configured = true;
}
