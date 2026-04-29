/**
 * Vitest Setup-Datei für die Phase-2-Eval-Tests.
 *
 * pdfjs-dist setzt im Modul-Init `DOMMatrix`/`Path2D`/`ImageData` voraus.
 * Im Browser sind die da, in Node nicht. Wir polyfillen sie als Stubs —
 * für unsere Triage-Use-Cases (Text-Layer-Probe + getTextContent) reicht
 * das aus, weil pdfjs Canvas-Rendering nur lazy zieht.
 */

class FakeDOMMatrix {
  a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
  constructor() { /* noop */ }
  multiply() { return this; }
  translate() { return this; }
  scale() { return this; }
  rotate() { return this; }
}

class FakePath2D {
  addPath() { /* noop */ }
}

class FakeImageData {
  width: number;
  height: number;
  data: Uint8ClampedArray;
  constructor(w: number, h: number) {
    this.width = w;
    this.height = h;
    this.data = new Uint8ClampedArray(w * h * 4);
  }
}

const g = globalThis as unknown as Record<string, unknown>;
if (typeof g.DOMMatrix === 'undefined') g.DOMMatrix = FakeDOMMatrix;
if (typeof g.Path2D === 'undefined') g.Path2D = FakePath2D;
if (typeof g.ImageData === 'undefined') g.ImageData = FakeImageData;
