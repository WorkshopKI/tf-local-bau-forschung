// ORT-WASM-Bereitstellung fuer Transformers.js / onnxruntime-web unter `file://`.
//
// Statt die ~21 MB ONNX-Runtime-WASM zweimal als base64-`data:`-URL im Single-File-Bundle
// zu fuehren, liefern wir sie zur Laufzeit direkt als `env.backends.onnx.wasm.wasmBinary`:
// der gzip-Blob aus src/generated/ort-wasm-gz.ts (Prebuild-Generat) wird per
// DecompressionStream dekomprimiert und ORT uebergeben. Der Post-Build-Strip in
// scripts/build-with-config.mjs leert danach die inlined `data:`-URLs im Bundle
// (70 MB -> ~19 MB). Deshalb NIE `wasmPaths`/Asset-URLs reaktivieren (siehe Pitfall #39).
//
// `env`-Import lebt hier zentral (embedding-service/re-ranker/browser-llm rufen nur
// `ensureOrtWasmBinary()`); der Dekomprimier-Schritt ist injizierbar (Test mit zlib).

import { env } from '@huggingface/transformers';
import { ORT_WASM_GZ_BASE64 } from '@/generated/ort-wasm-gz';
import { pipelineLog } from './pipeline-logger';

export type Decompressor = (gz: Uint8Array) => Promise<ArrayBuffer>;

/** Default-Dekomprimierung im Browser: DecompressionStream('gzip') (auch unter file://). */
async function gunzipViaStream(gz: Uint8Array): Promise<ArrayBuffer> {
  const stream = new Blob([gz as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
  return await new Response(stream).arrayBuffer();
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

/**
 * Reiner Dekodier-/Validier-Pfad: base64-gzip -> dekomprimieren -> WASM-Magic pruefen.
 * Kein `env`-Zugriff (unit-testbar mit synthetischem Blob + injiziertem Dekompressor).
 */
export async function decodeGzipToWasm(b64: string, decompress: Decompressor): Promise<ArrayBuffer> {
  const gz = base64ToBytes(b64);
  const buffer = await decompress(gz);
  const bytes = new Uint8Array(buffer);
  // Integritaets-Check: nicht-leer + WASM-Magic "\0asm" (0x00 0x61 0x73 0x6d). Kein silent-fail.
  if (bytes.length < 4 || bytes[0] !== 0x00 || bytes[1] !== 0x61 || bytes[2] !== 0x73 || bytes[3] !== 0x6d) {
    throw new Error(
      `[ort-wasm-init] dekomprimiertes WASM ungueltig (len=${bytes.length}, magic=${Array.from(bytes.slice(0, 4)).join(',')})`,
    );
  }
  return buffer;
}

let ensurePromise: Promise<void> | null = null;

/**
 * Idempotent: stellt ORT das WASM-Binary genau einmal bereit (Promise gecacht).
 * VOR der ersten Pipeline-/Session-Erstellung in embedding-service/re-ranker/browser-llm aufrufen.
 */
export async function ensureOrtWasmBinary(decompress: Decompressor = gunzipViaStream): Promise<void> {
  if (!ensurePromise) {
    ensurePromise = provideWasmBinary(decompress).catch((err) => {
      ensurePromise = null; // Fehlschlag erlaubt spaeteren Retry
      throw err;
    });
  }
  return ensurePromise;
}

async function provideWasmBinary(decompress: Decompressor): Promise<void> {
  const buffer = await decodeGzipToWasm(ORT_WASM_GZ_BASE64, decompress);

  const onnxWasm = env.backends?.onnx?.wasm as unknown as { wasmBinary?: ArrayBuffer } | undefined;
  if (!onnxWasm) {
    throw new Error('[ort-wasm-init] env.backends.onnx.wasm nicht verfuegbar — Transformers-API geaendert?');
  }
  // Ist `wasmBinary` gesetzt, laedt ORT die WASM-URL nicht mehr.
  onnxWasm.wasmBinary = buffer;
  // Binary ist inline immer verfuegbar; der IDB/WASM-Cache wuerde die ~21 MB pro Browser-Profil
  // sinnlos duplizieren (und cachet ohnehin nur bei gesetztem `wasmPaths`-Objekt).
  env.useWasmCache = false;

  pipelineLog.info('Embedding', `ORT-WASM aus Inline-gzip bereitgestellt, ${(buffer.byteLength / 1e6).toFixed(1)} MB`);
}
