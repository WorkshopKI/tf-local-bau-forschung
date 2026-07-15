import { describe, it, expect } from 'vitest';
import { gzipSync, gunzipSync } from 'node:zlib';
import { vi } from 'vitest';

// env-Mock: ensureOrtWasmBinary ohne echtes @huggingface/transformers-Import testen.
vi.mock('@huggingface/transformers', () => ({
  env: { backends: { onnx: { wasm: {} as { wasmBinary?: ArrayBuffer } } }, useWasmCache: true },
}));
// Generat-Mock: der echte 7-MB-Blob wird hier nicht gebraucht (Dekompressor wird injiziert).
vi.mock('@/generated/ort-wasm-gz', () => ({
  ORT_WASM_GZ_BASE64: 'AAAA',
  ORT_WASM_SHA256: 'test',
}));

import { env } from '@huggingface/transformers';
import { decodeGzipToWasm, ensureOrtWasmBinary, type Decompressor } from '../ort-wasm-init';

// zlib-basierter Dekompressor: ersetzt DecompressionStream im Node-Test-Env deterministisch.
const zlibDecompress: Decompressor = async (gz) => {
  const out = gunzipSync(gz);
  return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
};

const toBase64 = (u8: Uint8Array): string => Buffer.from(u8).toString('base64');
const WASM_MAGIC = [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00];

describe('ort-wasm-init', () => {
  it('roundtrip: gzip-base64 -> gueltiger WASM-ArrayBuffer', async () => {
    const wasm = new Uint8Array([...WASM_MAGIC, 9, 8, 7, 6, 5]);
    const b64 = toBase64(gzipSync(wasm));
    const buf = await decodeGzipToWasm(b64, zlibDecompress);
    expect(new Uint8Array(buf)).toEqual(wasm);
  });

  it('wirft bei fehlender WASM-Magic (kein silent-fail)', async () => {
    const notWasm = new Uint8Array([1, 2, 3, 4, 5]);
    const b64 = toBase64(gzipSync(notWasm));
    await expect(decodeGzipToWasm(b64, zlibDecompress)).rejects.toThrow(/ungueltig/);
  });

  it('wirft bei zu kurzem Blob', async () => {
    const b64 = toBase64(gzipSync(new Uint8Array([0x00, 0x61])));
    await expect(decodeGzipToWasm(b64, zlibDecompress)).rejects.toThrow(/ungueltig/);
  });

  it('ensureOrtWasmBinary ist idempotent und setzt env (dekomprimiert nur einmal)', async () => {
    let calls = 0;
    const counting: Decompressor = async () => {
      calls++;
      return new Uint8Array(WASM_MAGIC).buffer;
    };
    await ensureOrtWasmBinary(counting);
    await ensureOrtWasmBinary(counting);
    expect(calls).toBe(1);

    const wasm = (env as unknown as { backends: { onnx: { wasm: { wasmBinary?: ArrayBuffer } } } }).backends.onnx.wasm;
    expect(wasm.wasmBinary).toBeInstanceOf(ArrayBuffer);
    expect(wasm.wasmBinary?.byteLength).toBe(WASM_MAGIC.length);
    expect((env as unknown as { useWasmCache: boolean }).useWasmCache).toBe(false);
  });
});
