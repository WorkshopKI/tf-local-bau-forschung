/**
 * Pure-TS SHA-1 (synchron, zero-dep). Bewusst KEIN `node:crypto`, damit dieses
 * Modul auch unter der DOM-only-tsconfig der App typsauber bleibt (das Dev-Tool
 * läuft zwar nur in Node, wird aber von `tsc -b` mit-typgeprüft).
 *
 * Nur als deterministischer Hash für die Synthese stabiler Verwaltungsnummern
 * (FKZ/Aktenzeichen) genutzt — keine kryptografische Verwendung.
 */

function rotl(n: number, s: number): number {
  return ((n << s) | (n >>> (32 - s))) >>> 0;
}

/** Echtes SHA-1 über die UTF-8-Bytes von `input`, als 40-stelliger Lowercase-Hex-String. */
export function sha1Hex(input: string): string {
  const bytes = new TextEncoder().encode(input);
  const msgLen = bytes.length;

  // Padding: kleinste 64er-Vielfache, in das msgLen + 0x80 + 8 Längen-Bytes passt.
  const paddedLen = (((msgLen + 8) >>> 6) + 1) << 6;
  const msg = new Uint8Array(paddedLen);
  msg.set(bytes);
  msg[msgLen] = 0x80;

  const ml = msgLen * 8;
  const hi = Math.floor(ml / 0x100000000);
  const lo = ml >>> 0;
  msg[paddedLen - 8] = (hi >>> 24) & 0xff;
  msg[paddedLen - 7] = (hi >>> 16) & 0xff;
  msg[paddedLen - 6] = (hi >>> 8) & 0xff;
  msg[paddedLen - 5] = hi & 0xff;
  msg[paddedLen - 4] = (lo >>> 24) & 0xff;
  msg[paddedLen - 3] = (lo >>> 16) & 0xff;
  msg[paddedLen - 2] = (lo >>> 8) & 0xff;
  msg[paddedLen - 1] = lo & 0xff;

  let h0 = 0x67452301;
  let h1 = 0xefcdab89;
  let h2 = 0x98badcfe;
  let h3 = 0x10325476;
  let h4 = 0xc3d2e1f0;

  const w = new Uint32Array(80);

  for (let i = 0; i < paddedLen; i += 64) {
    for (let t = 0; t < 16; t++) {
      const j = i + t * 4;
      // Indizes sind per Konstruktion in-bounds; `!` umgeht noUncheckedIndexedAccess.
      w[t] = ((msg[j]! << 24) | (msg[j + 1]! << 16) | (msg[j + 2]! << 8) | msg[j + 3]!) >>> 0;
    }
    for (let t = 16; t < 80; t++) {
      w[t] = rotl(w[t - 3]! ^ w[t - 8]! ^ w[t - 14]! ^ w[t - 16]!, 1);
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;

    for (let t = 0; t < 80; t++) {
      let f: number;
      let k: number;
      if (t < 20) {
        f = (b & c) | (~b & d);
        k = 0x5a827999;
      } else if (t < 40) {
        f = b ^ c ^ d;
        k = 0x6ed9eba1;
      } else if (t < 60) {
        f = (b & c) | (b & d) | (c & d);
        k = 0x8f1bbcdc;
      } else {
        f = b ^ c ^ d;
        k = 0xca62c1d6;
      }
      const temp = (rotl(a, 5) + f + e + k + w[t]!) >>> 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = temp;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
  }

  return [h0, h1, h2, h3, h4].map(h => h.toString(16).padStart(8, '0')).join('');
}
