/**
 * Der Konfliktfall des Status-Katalogs, rein geprüft.
 *
 * Die Frage hinter allem: kann eine fremde Fassung verschwinden, ohne dass es
 * jemand merkt? Vereinigt wird die LISTE, nie der Inhalt — und wo beide dieselbe
 * Nummer verschieden belegt haben, muss das ein Konflikt sein statt einer
 * stillen Entscheidung.
 */
import { describe, it, expect } from 'vitest';
import {
  planeVereinigung, findeKonflikt, istSelbeFassung, zaehleAbweichungen, leseNummerAusKopf,
} from '@/core/status/katalog-konflikt';
import type { StatusKatalogDatei } from '@/core/status/katalog-share';
import type { MappingVersion } from '@/core/status/typen';

function fassung(version: number, patch: Partial<MappingVersion> = {}): MappingVersion {
  return {
    version,
    autor: 'AB',
    zeitstempel: `2026-08-04T10:${String(version).padStart(2, '0')}:00.000Z`,
    felder: [],
    werte: [],
    ...patch,
  };
}

describe('planeVereinigung', () => {
  it('holt fremde Fassungen, die die lokale Liste nicht kennt', () => {
    const { zuUebernehmen, kollisionen } = planeVereinigung(
      [fassung(1), fassung(2)],
      [fassung(1), fassung(2), fassung(3)],
    );
    expect(zuUebernehmen.map(v => v.version)).toEqual([3]);
    expect(kollisionen).toEqual([]);
  });

  it('lässt gleiche Fassungen unter gleicher Nummer in Ruhe', () => {
    const { zuUebernehmen, kollisionen } = planeVereinigung([fassung(4)], [fassung(4)]);
    expect(zuUebernehmen).toEqual([]);
    expect(kollisionen).toEqual([]);
  });

  it('meldet dieselbe Nummer mit anderem Inhalt als Kollision, statt sie zu überschreiben', () => {
    const meins = fassung(13, { autor: 'AB', zeitstempel: '2026-08-04T14:00:00.000Z' });
    const fremd = fassung(13, { autor: 'TP', zeitstempel: '2026-08-04T14:20:00.000Z' });
    expect(istSelbeFassung(meins, fremd)).toBe(false);
    expect(planeVereinigung([meins], [fremd]).kollisionen).toEqual([13]);
  });

  it('nach der Vereinigung kennt die lokale Liste die höchste Share-Nummer', () => {
    // Genau das schützt die Nummernvergabe: `naechsteVersionsnummer` zählt die
    // lokale Liste hoch, und die enthält die fremden Nummern jetzt.
    const lokal = [fassung(1), fassung(2)];
    const { zuUebernehmen } = planeVereinigung(lokal, [fassung(2), fassung(3)]);
    const nachher = [...lokal, ...zuUebernehmen];
    expect(nachher.reduce((m, v) => Math.max(m, v.version), 1) + 1).toBe(4);
  });
});

describe('findeKonflikt', () => {
  it('meldet die fremde Fassung mit Autor und Zeitpunkt, wenn jemand schneller war', () => {
    const fremd = fassung(13, { autor: 'TP', zeitstempel: '2026-08-04T14:20:00.000Z' });
    const k = findeKonflikt([fassung(12), fremd], [fassung(12), fremd], 13, 12);
    expect(k?.grund).toBe('neuer-stand');
    expect(k?.fremde).toEqual({ version: 13, autor: 'TP', zeitstempel: '2026-08-04T14:20:00.000Z' });
    expect(k?.basis).toBe(12);
  });

  it('schweigt, wenn der Share nicht weiter ist als die eigene Grundlage', () => {
    expect(findeKonflikt([fassung(12)], [fassung(12)], 12, 12)).toBeNull();
    expect(findeKonflikt([fassung(12)], [fassung(12)], 12, 14)).toBeNull();
  });

  it('meldet eine Nummern-Kollision auch ohne Grundlage — dort ginge sonst etwas verloren', () => {
    const meins = fassung(13, { autor: 'AB', zeitstempel: '2026-08-04T14:00:00.000Z' });
    const fremd = fassung(13, { autor: 'TP', zeitstempel: '2026-08-04T14:20:00.000Z' });
    const k = findeKonflikt([meins], [fremd], 13, null);
    expect(k?.grund).toBe('nummern-kollision');
    expect(k?.fremde.autor).toBe('TP');
  });

  it('prüft ohne Grundlage NICHT auf „jemand war schneller"', () => {
    expect(findeKonflikt([fassung(12)], [fassung(12), fassung(13)], 13, null)).toBeNull();
  });

  it('nennt die Kollision zuerst — sie braucht die aufwändigere Auflösung', () => {
    const meins = fassung(13, { autor: 'AB', zeitstempel: '2026-08-04T14:00:00.000Z' });
    const fremd13 = fassung(13, { autor: 'TP', zeitstempel: '2026-08-04T14:20:00.000Z' });
    const fremd14 = fassung(14, { autor: 'TP' });
    const k = findeKonflikt([fassung(12), meins], [fremd13, fremd14], 14, 12);
    expect(k?.grund).toBe('nummern-kollision');
  });
});

describe('zaehleAbweichungen', () => {
  const wert = (feldId: string, w: string, kategorie: string): never =>
    ({ feldId, wert: w, kategorie } as never);

  it('zählt neue, entfallene und geänderte Einträge', () => {
    const a = fassung(1, {
      werte: [wert('D_ARZ', 'ja', 'aktiv'), wert('D_ARZ', 'nein', 'aktiv')],
      felder: [{ feldId: 'D_ARZ', label: 'Alt', typ: 'wert', ebene: 'verbund' } as never],
    });
    const b = fassung(2, {
      // 'nein' fällt weg, 'ja' ändert die Kategorie, 'vielleicht' kommt dazu,
      // das Feld bekommt eine andere Bezeichnung.
      werte: [wert('D_ARZ', 'ja', 'abgeschlossen'), wert('D_ARZ', 'vielleicht', 'aktiv')],
      felder: [{ feldId: 'D_ARZ', label: 'Neu', typ: 'wert', ebene: 'verbund' } as never],
    });
    expect(zaehleAbweichungen(a, b)).toBe(4);
  });

  it('ist 0 für inhaltlich gleiche Fassungen mit verschiedener Nummer', () => {
    expect(zaehleAbweichungen(fassung(1), fassung(2))).toBe(0);
  });

  it('zählt die optionalen Listen des Vorgangssystems mit', () => {
    const a = fassung(1, { todoRegeln: [], zahPhasen: [], textbausteine: [] });
    const b = fassung(1, {
      todoRegeln: [{ id: 'r1' } as never],
      textbausteine: [{ kennung: 'x', text: 'y' }],
    });
    expect(zaehleAbweichungen(a, b)).toBe(2);
  });
});

describe('leseNummerAusKopf', () => {
  /** Genau so, wie `schreibeKatalogAufShare` serialisiert. */
  function alsDatei(aktiv: number, fassungen: MappingVersion[]): string {
    const datei: StatusKatalogDatei = {
      version: 1, aktiv, fassungen, updatedAt: '2026-08-04T14:20:00.000Z',
    };
    return JSON.stringify(datei, null, 2);
  }

  it('findet die Nummer in den ersten 4 KB einer echt serialisierten Datei', () => {
    const kopf = alsDatei(13, [fassung(12), fassung(13)]).slice(0, 4096);
    expect(leseNummerAusKopf(kopf)).toBe(13);
  });

  it('lässt sich von den aktiv-FLAGS an Ordnern und Feldern nicht täuschen', () => {
    // `aktiv: true` ist ein Wahrheitswert und kann nicht treffen — und der
    // Datei-Schlüssel steht ohnehin vor den Fassungen.
    const kopf = alsDatei(7, [fassung(7, {
      kategorien: [{ id: 'vb.a', elternId: null, label: 'A', ebene: 'verbund', reihenfolge: 10, aktiv: true }],
    })]).slice(0, 4096);
    expect(leseNummerAusKopf(kopf)).toBe(7);
  });

  it('sagt lieber nichts, als etwas zu erfinden', () => {
    expect(leseNummerAusKopf('')).toBeNull();
    expect(leseNummerAusKopf('{ "version": 1, "fassungen": [] }')).toBeNull();
    expect(leseNummerAusKopf('{ "aktiv": true }')).toBeNull();
  });
});
