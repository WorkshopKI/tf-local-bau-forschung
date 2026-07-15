// Generator: bettet die ONNX-Runtime-WASM als gzip-komprimierten base64-Blob in
// src/generated/ort-wasm-gz.ts ein. Zur Laufzeit dekomprimiert ort-wasm-init.ts den
// Blob via DecompressionStream und uebergibt ihn ORT als `wasmBinary` — statt die
// ~21 MB WASM zweimal als data:-URL im Single-File-Bundle zu fuehren (Post-Build-Strip
// in build-with-config.mjs leert danach die inlined data:-URLs).
//
// Node-Stdlib only (zlib). Idempotent: gleicher Quell-Hash -> No-op (schneller Prebuild).
// Verdrahtet in package.json via `generate:ort-wasm` (an generate:test-assets + predev).

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Gebuendelte Variante: die asyncify-WASM (Loader-Glue ...asyncify.mjs liegt im Bundle).
// Bei Dependency-Update pruefen, ob onnxruntime-web eine andere Variante buendelt — es ist
// die, deren SHA-256 im base64-Blob der gebauten HTML auftaucht.
const WASM_PATH = resolve(ROOT, 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm');
const OUT_DIR = resolve(ROOT, 'src/generated');
const OUT_FILE = resolve(OUT_DIR, 'ort-wasm-gz.ts');

function main() {
  if (!existsSync(WASM_PATH)) {
    console.error(`[generate-ort-wasm] Quell-WASM nicht gefunden: ${WASM_PATH}`);
    console.error('[generate-ort-wasm] onnxruntime-web installiert? Variante umbenannt?');
    process.exit(1);
  }

  const raw = readFileSync(WASM_PATH);
  const sha256 = createHash('sha256').update(raw).digest('hex');

  // Idempotenz: existiert die Datei mit gleichem Quell-Hash, nichts tun.
  if (existsSync(OUT_FILE)) {
    const existing = readFileSync(OUT_FILE, 'utf8');
    if (existing.includes(`ORT_WASM_SHA256 = '${sha256}'`)) {
      console.log(`[generate-ort-wasm] aktuell (sha256=${sha256.slice(0, 12)}…), nichts zu tun.`);
      return;
    }
  }

  const gz = gzipSync(raw, { level: 9 });
  if (gz.length >= raw.length) {
    console.error(`[generate-ort-wasm] gzip (${gz.length}) nicht kleiner als roh (${raw.length}) — abgebrochen.`);
    process.exit(1);
  }
  const b64 = gz.toString('base64'); // nur [A-Za-z0-9+/=] -> in '' ohne Escaping sicher

  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

  const content =
    `// GENERIERT von scripts/generate-ort-wasm-module.mjs — nicht von Hand editieren.\n` +
    `// Quelle: ort-wasm-simd-threaded.asyncify.wasm\n` +
    `// sha256=${sha256}\n` +
    `// ${raw.length} Bytes roh, ${gz.length} Bytes gzip (Level 9), base64-Laenge ${b64.length}.\n` +
    `export const ORT_WASM_SHA256 = '${sha256}';\n` +
    `export const ORT_WASM_GZ_BASE64 =\n` +
    `  '${b64}';\n`;

  writeFileSync(OUT_FILE, content, 'utf8');
  console.log(`[generate-ort-wasm] geschrieben: ${OUT_FILE}`);
  console.log(
    `[generate-ort-wasm] roh=${(raw.length / 1e6).toFixed(1)}MB ` +
      `gzip=${(gz.length / 1e6).toFixed(1)}MB (${((gz.length / raw.length) * 100).toFixed(1)}%) ` +
      `sha256=${sha256}`,
  );
}

main();
