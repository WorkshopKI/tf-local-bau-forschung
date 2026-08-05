/**
 * Was diese Datei festnagelt:
 *
 * 1. **NUR die fehlende Zeichentabelle zählt.** Die erste Fassung fing auch
 *    `standardFontDataUrl` und `wasmUrl` — gemessen an einem echten
 *    Förder-PDF (`GMN9PQ01.pdf`, 1 498 Zeichen korrekt extrahiert) war das
 *    Fehlalarm für praktisch jedes Dokument mit nicht eingebetteter
 *    Standardschrift. Diese Tests halten die Verengung fest.
 * 2. **Der Warnungs-Kanal fängt den STILLEN Fall.** Das ist der Regelfall:
 *    pdf.js wirft nicht, es warnt und liefert weniger Text.
 * 3. **`console.warn` wird zurückgegeben, immer.** Auch wenn der Lauf wirft —
 *    eine dauerhaft gekaperte Konsole wäre schlimmer als das Problem.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  istFehlendesPdfAsset, sammlePdfWarnungen, PDF_ASSET_MELDUNG,
} from '@/core/services/converter/pdf-assets';

describe('istFehlendesPdfAsset', () => {
  it('erkennt die fehlende Zeichentabelle', () => {
    expect(istFehlendesPdfAsset(new Error(
      'Ensure that the `cMapUrl` and `cMapPacked` API parameters are provided.',
    ))).toBe(true);
  });

  it('erkennt sie auch, wenn pdf.js sie in eine Warnung einbettet', () => {
    expect(istFehlendesPdfAsset(new Error(
      'Warning: Error during font loading: Ensure that the `cMapUrl` and `cMapPacked` API parameters are provided.',
    ))).toBe(true);
  });

  it('meldet eine fehlende STANDARDSCHRIFT nicht — die kostet keinen Text', () => {
    // Gemessen an GMN9PQ01.pdf: warnt, liefert aber 1 498 Zeichen korrekt.
    // Nicht eingebettete Standardschriften sind der Normalfall; diese Signatur
    // hätte bei fast jedem PDF Fehlalarm ausgelöst.
    expect(istFehlendesPdfAsset(new Error(
      'Ensure that the `standardFontDataUrl` API parameter is provided.',
    ))).toBe(false);
  });

  it('meldet ein fehlendes Bild-WASM nicht — Bilder tragen keinen Text', () => {
    expect(istFehlendesPdfAsset(new Error(
      'Ensure that the `wasmUrl` API parameter is provided.',
    ))).toBe(false);
  });

  it('meldet einen Worker-Race NICHT als fehlende Zeichentabelle', () => {
    // Der hat seinen eigenen Retry-Pfad; ihn hier mitzufangen hieße, einen
    // behebbaren Fall als unlesbare Datei auszugeben.
    expect(istFehlendesPdfAsset(new Error('PDFWorker.create - the worker is being destroyed'))).toBe(false);
  });

  it('meldet ein kaputtes PDF NICHT als fehlende Zeichentabelle', () => {
    expect(istFehlendesPdfAsset(new Error('Invalid PDF structure'))).toBe(false);
    expect(istFehlendesPdfAsset(new Error('The API version does not match the Worker version'))).toBe(false);
  });

  it('kommt mit allem klar, was aus einem catch fallen kann', () => {
    expect(istFehlendesPdfAsset(undefined)).toBe(false);
    expect(istFehlendesPdfAsset(null)).toBe(false);
    expect(istFehlendesPdfAsset('Ensure that the `cMapUrl` fehlt')).toBe(true);
    expect(istFehlendesPdfAsset({ nachricht: 'irgendwas' })).toBe(false);
  });
});

describe('sammlePdfWarnungen', () => {
  it('fängt die Warnung, ohne den Lauf zu stören', async () => {
    const { ergebnis, cmapFehlt } = await sammlePdfWarnungen(async () => {
      console.warn('Warning: Ensure that the `cMapUrl` and `cMapPacked` API parameters are provided.');
      return 'Text der Seite';
    });
    expect(ergebnis).toBe('Text der Seite');
    expect(cmapFehlt).toBe(true);
  });

  it('meldet nichts, wenn nur harmlose Warnungen kommen', async () => {
    const { cmapFehlt } = await sammlePdfWarnungen(async () => {
      console.warn('Warning: Indexing all PDF objects');
      return 1;
    });
    expect(cmapFehlt).toBe(false);
  });

  it('reicht jede Warnung unveraendert weiter — wir kapern die Konsole, wir leeren sie nicht', async () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      await sammlePdfWarnungen(async () => { console.warn('Warning: hallo', 42); return 0; });
      expect(spy).toHaveBeenCalledWith('Warning: hallo', 42);
    } finally {
      spy.mockRestore();
    }
  });

  it('stellt console.warn wieder her — auch wenn der Lauf wirft', async () => {
    const vorher = console.warn;
    await expect(sammlePdfWarnungen(async () => { throw new Error('kaputt'); }))
      .rejects.toThrow('kaputt');
    expect(console.warn).toBe(vorher);
  });

  it('stellt console.warn auch im Erfolgsfall wieder her', async () => {
    const vorher = console.warn;
    await sammlePdfWarnungen(async () => 'ok');
    expect(console.warn).toBe(vorher);
  });
});

describe('PDF_ASSET_MELDUNG', () => {
  it('ist eine Handlungsanweisung, keine Fehlermeldung', () => {
    // Die Datei ist nicht kaputt — wir koennen sie nur nicht lesen. Der Satz
    // muss sagen, was der Mensch jetzt tut.
    expect(PDF_ASSET_MELDUNG).toContain('außerhalb der App');
    expect(PDF_ASSET_MELDUNG).not.toMatch(/cMapUrl|wasmUrl|standardFontDataUrl/);
    // Sie widerspricht der Gescannt-Vermutung ausdrücklich — sonst versucht der
    // Bearbeiter OCR an einem Dokument, das Text hat.
    expect(PDF_ASSET_MELDUNG).toContain('OCR hilft hier nicht');
  });
});
