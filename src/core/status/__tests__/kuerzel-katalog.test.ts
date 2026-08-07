/**
 * Der Kürzel-Katalog gegen eine **von Hand hingeschriebene** Wahrheitstabelle.
 *
 * Der Kern ist die Zusage, für die es diesen Katalog gibt: dasselbe Kürzel
 * liefert je nach Projektform verschiedenen Klartext. Wer das flach macht,
 * zeigt 78,9 % der Anträge etwas Falsches — genau das war der Zustand davor.
 */
import { describe, it, expect } from 'vitest';
import {
  kuerzelAuskunft, heutigesKuerzel, projektformVonVbPhase, projektformLage,
  projektformAbhaengigeKuerzel, strittigeKuerzel, kuerzelKategorien,
} from '../kuerzel-katalog';

describe('projektformVonVbPhase — die Achsen decken sich nicht vollständig', () => {
  it('bildet NW 1 und NW 2 beide auf NW ab', () => {
    expect(projektformVonVbPhase(1)).toBe('NW');
    expect(projektformVonVbPhase(2)).toBe('NW');
  });

  it('bildet FuE und DL ab', () => {
    expect(projektformVonVbPhase(3)).toBe('FuE');
    expect(projektformVonVbPhase(4)).toBe('DL');
  });

  it('liefert für DS und Irrläufer `null` statt zu raten', () => {
    // DS (935 Anträge) und Irrläufer (82) haben in der Zuarbeit keine
    // Entsprechung. Eine geratene Zuordnung wäre schlimmer als keine.
    expect(projektformVonVbPhase(5)).toBeNull();
    expect(projektformVonVbPhase(9)).toBeNull();
    expect(projektformVonVbPhase(undefined)).toBeNull();
    expect(projektformVonVbPhase('quatsch')).toBeNull();
  });
});

describe('projektformLage — zwei Gründe hinter demselben `null`', () => {
  it('DS ist eine echte Projektform, die die Zuarbeit noch nicht kennt', () => {
    // Nachlieferbar: eine neuere Zuarbeit schließt die Lücke. Wer DS auf FuE
    // mappt, verankert eine Vermutung als Wert.
    expect(projektformLage(5)).toEqual({ art: 'zuarbeit-aelter', label: 'DS' });
  });

  it('Irrläufer ist begrifflich KEINE Projektform', () => {
    // „An uns gesendet, aber nicht unsere Zuständigkeit." Hier gibt es nichts
    // nachzuliefern — die Lücke soll bleiben.
    expect(projektformLage(9)).toEqual({ art: 'keine-projektform', label: 'Irrläufer' });
  });

  it('trennt die beiden Fälle — sie dürfen nie zu einem `unbekannt` verschmelzen', () => {
    expect(projektformLage(5).art).not.toBe(projektformLage(9).art);
  });

  it('nennt die Projektform, wo es eine gibt', () => {
    expect(projektformLage(3)).toEqual({ art: 'bekannt', form: 'FuE' });
    expect(projektformLage(1)).toEqual({ art: 'bekannt', form: 'NW' });
  });

  it('wirklich Unbekanntes bleibt `unbekannt`', () => {
    expect(projektformLage(42).art).toBe('unbekannt');
    expect(projektformLage(null).art).toBe('unbekannt');
  });
});

describe('kuerzelAuskunft — Schlüssel ist Kürzel × Projektform', () => {
  it('gibt für AB je nach Projektform VERSCHIEDENEN Klartext', () => {
    const dl = kuerzelAuskunft('AB', 'DL');
    const fue = kuerzelAuskunft('AB', 'FuE');
    expect(dl.bezeichnung).toMatch(/Haushaltsbeauftrag/);
    expect(fue.bezeichnung).toMatch(/bewilligungsreif/);
    expect(dl.bezeichnung).not.toBe(fue.bezeichnung);
    expect(dl.eindeutig).toBe(true);
    expect(fue.eindeutig).toBe(true);
  });

  it('nennt die Projektform, aus der die Auskunft stammt', () => {
    expect(kuerzelAuskunft('AB', 'DL').quelle).toBe('DL');
  });

  it('ohne Projektform: einig → eindeutig, uneinig → NICHT eindeutig', () => {
    // AB ist der Musterfall der Uneinigkeit.
    const ohne = kuerzelAuskunft('AB', null);
    expect(ohne.eindeutig).toBe(false);
    expect(ohne.quelle).toBeNull();
    // AAE sagt in allen Formen dasselbe.
    const einig = kuerzelAuskunft('AAE', null);
    expect(einig.eindeutig).toBe(true);
  });

  it('kennt das Kürzel nicht → bezeichnung null, nicht geraten', () => {
    const a = kuerzelAuskunft('GIBTESNICHT', 'FuE');
    expect(a.bezeichnung).toBeNull();
    expect(a.eindeutig).toBe(false);
    expect(a.rollen).toEqual([]);
  });

  it('ist unabhängig von Schreibweise und Rand-Leerzeichen', () => {
    expect(kuerzelAuskunft('  ab  ', 'DL').bezeichnung)
      .toBe(kuerzelAuskunft('AB', 'DL').bezeichnung);
  });

  it('führt Rollen nur, wo die App sie kennt — nie geraten', () => {
    const erlaubt = new Set(['ab', 'fb', 'qs', 'pa', 'jur']);
    for (const k of ['AAE', 'AB', 'ABB', 'VBE']) {
      for (const pf of ['NW', 'FuE', 'DL', 'EP'] as const) {
        for (const r of kuerzelAuskunft(k, pf).rollen) {
          expect(erlaubt.has(r), `${k}/${pf}: ${r}`).toBe(true);
        }
      }
    }
  });

  it('trägt Scope am Paar, nicht am Kürzel', () => {
    const a = kuerzelAuskunft('AAE', 'NW');
    for (const s of a.scope) expect(['tv', 'verbund']).toContain(s);
  });
});

describe('heutigesKuerzel — Altfälle bleiben lesbar', () => {
  it('löst ein umbenanntes Kürzel auf', () => {
    // AAW hieß früher so und heißt heute ARW.
    expect(heutigesKuerzel('AAW')).toBe('ARW');
  });

  it('liefert null, wo nie umbenannt wurde', () => {
    expect(heutigesKuerzel('AAE')).toBeNull();
  });
});

describe('Kuration + Glossar', () => {
  it('meldet die projektform-abhängigen Kürzel — das ist der Bestandsfehler', () => {
    // 81 vor der Klärrunde, 58 danach: 23 Widersprüche sind vereinheitlicht und
    // damit KEINE mehr. Die Untergrenze hält fest, dass die Liste noch trägt;
    // die Obergrenze, dass die Kuration nicht versehentlich alles glattbügelt.
    const liste = projektformAbhaengigeKuerzel();
    expect(liste.length).toBeGreaterThan(40);
    expect(liste.length).toBeLessThan(70);
    // `AB` bleibt drin: DL sagt weiter etwas anderes als NW/FuE/EP — für DS ist
    // das entschieden, zwischen den Formen bleibt es ein echter Unterschied.
    expect(liste).toContain('AB');
    // Vereinheitlicht ⇒ nicht mehr uneinig.
    expect(liste).not.toContain('AK4');
  });

  it('die Kuratorenliste bleibt klein und ist NICHT stillschweigend entschieden', () => {
    // Schreibvarianten im Patt: es wurde bewusst keine gewählt.
    expect(strittigeKuerzel().sort()).toEqual(['VBE', 'VZE', 'YB', 'YW']);
  });

  it('liefert die Glossar-Gliederung ohne Müll-Kategorien', () => {
    const namen = kuerzelKategorien().map(k => k.name.toLowerCase());
    expect(namen).not.toContain('test');
    expect(namen).not.toContain('kvjkf');
    expect(namen).not.toContain('sonstiges');
    // Dubletten sind zusammengefasst.
    expect(namen).toContain('vor-ort-besuch');
    expect(namen).not.toContain('vor-ort-besuche');
  });
});
