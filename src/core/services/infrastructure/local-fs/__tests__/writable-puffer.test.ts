/**
 * Chunk-Semantik von `createWritable()` — die reine Hälfte, ohne Transport.
 *
 * Die FSAPI nimmt in `write()` fünf verschiedene Formen entgegen (String,
 * Uint8Array, ArrayBuffer, TypedArray-View, Blob) plus drei Kommando-Objekte.
 * Der Konformitäts-Test deckt die im App-Code vorkommenden Fälle end-to-end ab;
 * hier stehen die Randfälle, die dort nur schwer herzustellen wären.
 */

import { describe, it, expect } from 'vitest';
import { WritablePuffer, type SchreibChunk, type SchreibAuftrag } from '../writable-puffer';

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

async function sammle(chunks: SchreibChunk[], behalteBestand = false): Promise<SchreibAuftrag | null> {
  const puffer = new WritablePuffer(behalteBestand);
  for (const c of chunks) await puffer.schreibe(c);
  return puffer.abschliessen();
}

describe('Chunk-Normalisierung', () => {
  it('nimmt String, Uint8Array, ArrayBuffer, View und Blob', async () => {
    const roh = new Uint8Array([65, 66, 67, 68]); // ABCD
    const faelle: Array<[string, SchreibChunk, string]> = [
      ['string', 'AB', 'AB'],
      ['Uint8Array', new Uint8Array([65, 66]), 'AB'],
      ['ArrayBuffer', new Uint8Array([65, 66]).buffer, 'AB'],
      ['View mit Offset', new Uint8Array(roh.buffer, 1, 2), 'BC'],
      ['Blob', new Blob(['AB']), 'AB'],
    ];
    for (const [name, chunk, erwartet] of faelle) {
      const auftrag = await sammle([chunk]);
      expect(text(auftrag!.bytes), name).toBe(erwartet);
    }
  });

  it('kodiert Umlaute als UTF-8', async () => {
    const auftrag = await sammle(['Hübsch']);
    expect(text(auftrag!.bytes)).toBe('Hübsch');
    expect(auftrag!.bytes.length).toBe(7); // ü = 2 Bytes
  });

  it('hält einen Blob NICHT für ein Kommando-Objekt', async () => {
    // Blob hat selbst eine `.type`-Property (MIME-Typ). Ein naives
    // `'type' in chunk` erklärt damit jeden Blob zum Kommando und liest ein
    // nicht existierendes `.data` — und genau Blobs reicht `atomic-write.ts`
    // in `fallbackRename`/`writeData` durch.
    expect(text((await sammle([new Blob(['nutzdaten'])]))!.bytes)).toBe('nutzdaten');
    // Auch mit gesetztem MIME-Typ, und selbst wenn der wie ein Kommando aussieht.
    expect(text((await sammle([new Blob(['x'], { type: 'application/json' })]))!.bytes)).toBe('x');
    expect(text((await sammle([new Blob(['y'], { type: 'write' })]))!.bytes)).toBe('y');
  });

  it('hält TypedArrays und ArrayBuffer NICHT für Kommando-Objekte', async () => {
    expect(text((await sammle([new Uint8Array([90])]))!.bytes)).toBe('Z');
    expect(text((await sammle([new Uint8Array([90]).buffer]))!.bytes)).toBe('Z');
  });

  it('ignoriert Objekte mit unbekanntem type-Wert als Kommando', async () => {
    // `{type:'irgendwas'}` ist kein FSAPI-Kommando — es soll als Nutzdaten
    // scheitern statt still als No-op durchzurutschen.
    const puffer = new WritablePuffer(false);
    await expect(puffer.schreibe({ type: 'quatsch' } as unknown as SchreibChunk))
      .rejects.toBeInstanceOf(TypeError);
  });

  it('lehnt unbekannte Chunk-Typen ab statt sie still zu verschlucken', async () => {
    const puffer = new WritablePuffer(false);
    await expect(puffer.schreibe(42 as unknown as SchreibChunk)).rejects.toBeInstanceOf(TypeError);
  });
});

describe('Cursor-Verhalten', () => {
  it('hängt sequenzielle Writes aneinander', async () => {
    const auftrag = await sammle(['eins', '-', 'zwei']);
    expect(text(auftrag!.bytes)).toBe('eins-zwei');
    expect(auftrag!.position).toBe(0);
  });

  it('schreibt an eine explizite Position und setzt den Cursor dahinter', async () => {
    const auftrag = await sammle([
      { type: 'write', position: 0, data: 'ABCD' },
      { type: 'write', position: 2, data: 'xy' },
      'Z',
    ]);
    expect(text(auftrag!.bytes)).toBe('ABxyZ');
  });

  it('seek versetzt den Cursor absolut', async () => {
    const auftrag = await sammle(['ABCD', { type: 'seek', position: 1 }, 'xy']);
    expect(text(auftrag!.bytes)).toBe('AxyD');
  });

  it('füllt Lücken mit Nullbytes (Sparse-Write wie in der FSAPI)', async () => {
    const auftrag = await sammle([{ type: 'write', position: 0, data: 'A' }, { type: 'write', position: 3, data: 'B' }]);
    expect(Array.from(auftrag!.bytes)).toEqual([65, 0, 0, 66]);
  });
});

describe('Abschluss-Auftrag', () => {
  it('meldet ohne keepExistingData „ersetzen" (FSAPI kürzt auf 0)', async () => {
    const auftrag = await sammle(['neu']);
    expect(auftrag!.ersetzen).toBe(true);
    expect(auftrag!.position).toBe(0);
  });

  it('meldet mit keepExistingData „anhängen" samt Startposition', async () => {
    const auftrag = await sammle([{ type: 'write', position: 120, data: 'zeile\n' }], true);
    expect(auftrag!.ersetzen).toBe(false);
    expect(auftrag!.position).toBe(120);
    expect(text(auftrag!.bytes)).toBe('zeile\n');
  });

  it('liefert bei gar keinem Write einen leeren Ersetz-Auftrag (Datei anlegen/leeren)', async () => {
    const auftrag = await sammle([]);
    expect(auftrag!.bytes.length).toBe(0);
    expect(auftrag!.ersetzen).toBe(true);
  });

  it('reicht truncate durch', async () => {
    const auftrag = await sammle(['ABCDEF', { type: 'truncate', size: 3 }]);
    expect(auftrag!.truncateAuf).toBe(3);
  });

  it('abbrechen() verwirft alles und liefert null', async () => {
    const puffer = new WritablePuffer(false);
    await puffer.schreibe('geht verloren');
    puffer.abbrechen();
    expect(puffer.abschliessen()).toBeNull();
  });

  it('nach abbrechen() ist Weiterschreiben ein Fehler, kein stiller No-op', async () => {
    const puffer = new WritablePuffer(false);
    puffer.abbrechen();
    await expect(puffer.schreibe('x')).rejects.toBeInstanceOf(TypeError);
  });
});
