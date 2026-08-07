/**
 * Die Kuration der Klärrunde — und die Gatter, die sie **regenerationsfest**
 * machen.
 *
 * `kuerzel-katalog.data.ts` wird von der nächsten Zuarbeit überschrieben. Eine
 * Kuration, die sich auf Wortlaute von heute stützt, würde dann still
 * danebengreifen: die Korrektur trifft nichts mehr, die Vereinheitlichung
 * beruft sich auf eine Form, die anders heißt. Beides sieht man nicht — es
 * sei denn, ein Test vergleicht. Genau das tun die ersten drei Blöcke.
 */
import { describe, expect, it } from 'vitest';
import { KUERZEL_KATALOG, type KuerzelForm, type Projektform } from '../kuerzel-katalog.data';
import { kuerzelAuskunft, projektformAbhaengigeKuerzel, uneinigeKuerzel } from '../kuerzel-katalog';
import {
  DIVERGENZ_BESTAETIGT, DS_BEDEUTUNG, QUELLKORREKTUREN, VEREINHEITLICHT,
  belegText, divergenzBestaetigt, dsBedeutungFuer, vereinheitlichtFuer,
} from '../kuerzel-kuration';
import { HERKUENFTE } from '../klaerfragen';

const ROH = new Map(KUERZEL_KATALOG.map(e => [e.kuerzel, e]));

/** Der Wortlaut einer Form in der ROHEN Zuarbeit — vor jeder Korrektur. */
function rohForm(kuerzel: string, form: Projektform): KuerzelForm | undefined {
  return ROH.get(kuerzel)?.formen[form];
}

/** Der Wortlaut einer Form NACH den Quellkorrekturen. */
function korrigiert(kuerzel: string, form: Projektform): string | undefined {
  const roh = rohForm(kuerzel, form)?.bezeichnung;
  if (roh === undefined) return undefined;
  const q = QUELLKORREKTUREN.find(x => x.kuerzel === kuerzel && x.formen.includes(form) && x.falsch === roh);
  return q ? q.richtig : roh;
}

const ALLE = [
  ...VEREINHEITLICHT.map(v => ({ kuerzel: v.kuerzel, beleg: v.beleg })),
  ...DIVERGENZ_BESTAETIGT.map(d => ({ kuerzel: d.kuerzel, beleg: d.beleg })),
  ...DS_BEDEUTUNG.map(d => ({ kuerzel: d.kuerzel, beleg: d.beleg })),
  ...QUELLKORREKTUREN.map(q => ({ kuerzel: q.kuerzel, beleg: q.beleg })),
];

describe('Drift-Gatter gegen eine neue Zuarbeit', () => {
  it('jeder vereinheitlichte Wortlaut steht wortgleich in der genannten Form', () => {
    for (const v of VEREINHEITLICHT) {
      expect(korrigiert(v.kuerzel, v.ausForm), `${v.kuerzel} / ${v.ausForm}`).toBe(v.bezeichnung);
    }
  });

  it('jeder DS-Wortlaut steht wortgleich in der Form, aus der er stammt', () => {
    for (const d of DS_BEDEUTUNG) {
      expect(korrigiert(d.kuerzel, d.entsprichtForm), `${d.kuerzel} / ${d.entsprichtForm}`)
        .toBe(d.bezeichnung);
    }
  });

  it('jede Quellkorrektur trifft noch etwas — sonst ist sie veraltet', () => {
    for (const q of QUELLKORREKTUREN) {
      for (const form of q.formen) {
        expect(rohForm(q.kuerzel, form)?.bezeichnung, `${q.kuerzel} / ${form}`).toBe(q.falsch);
      }
    }
  });

  it('kennt nur Kürzel, die der Katalog führt', () => {
    for (const { kuerzel } of ALLE) expect(ROH.has(kuerzel), kuerzel).toBe(true);
  });
});

describe('Widerspruchsfreiheit der vier Listen', () => {
  it('kein Kürzel ist zugleich vereinheitlicht und divergent bestätigt', () => {
    const einig = new Set(VEREINHEITLICHT.map(v => v.kuerzel));
    for (const d of DIVERGENZ_BESTAETIGT) expect(einig.has(d.kuerzel), d.kuerzel).toBe(false);
  });

  it('kein Kürzel ist zugleich vereinheitlicht und DS-kuratiert', () => {
    // Vereinheitlicht heißt „gilt für ALLE Formen, auch DS" — ein eigener
    // DS-Wortlaut daneben wäre zwei Antworten auf dieselbe Frage.
    const einig = new Set(VEREINHEITLICHT.map(v => v.kuerzel));
    for (const d of DS_BEDEUTUNG) expect(einig.has(d.kuerzel), d.kuerzel).toBe(false);
  });

  it('jede Liste führt jedes Kürzel höchstens einmal', () => {
    for (const [name, ks] of [
      ['VEREINHEITLICHT', VEREINHEITLICHT.map(v => v.kuerzel)],
      ['DIVERGENZ_BESTAETIGT', DIVERGENZ_BESTAETIGT.map(d => d.kuerzel)],
      ['DS_BEDEUTUNG', DS_BEDEUTUNG.map(d => d.kuerzel)],
    ] as const) {
      expect(new Set(ks).size, name).toBe(ks.length);
    }
  });
});

describe('Provenienz', () => {
  it('jeder Beleg nennt eine Frage-Id mit bekannter Herkunft', () => {
    for (const { kuerzel, beleg } of ALLE) {
      const [herkunft, betrifft] = beleg.frageId.split(':');
      expect(HERKUENFTE, beleg.frageId).toContain(herkunft);
      expect(betrifft, beleg.frageId).toBe(kuerzel);
    }
  });

  it('jeder Beleg trägt Runde, Name und ein ISO-Datum', () => {
    for (const { beleg } of ALLE) {
      expect(beleg.quelle).not.toBe('');
      expect(beleg.name).not.toBe('');
      expect(beleg.datum).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it('schreibt den Beleg in einer Zeile', () => {
    expect(belegText({ quelle: 'Antwortrunde 1', name: 'AnMa', datum: '2026-08-07', frageId: 'x' }))
      .toBe('Antwortrunde 1 · AnMa · 07.08.2026');
  });
});

describe('Was noch gegengezeichnet werden muss', () => {
  it('nennt genau die zehn offenen Entscheidungen', () => {
    const offen = [
      ...VEREINHEITLICHT.filter(v => v.stand === 'bestaetigung_offen').map(v => v.kuerzel),
      ...DS_BEDEUTUNG.filter(d => d.stand === 'bestaetigung_offen').map(d => d.kuerzel),
    ].sort();
    // Acht DS-Einträge widersprechen der Sammelregel; `ÄZ` und `ÄZX`
    // überschreiben eine ANDERE Handlung, nicht eine Schreibweise.
    expect(offen).toEqual(
      ['AB', 'ABE', 'ALS', 'ALSB', 'ARR', 'GN', 'LZ', 'WRZ', 'ÄZ', 'ÄZX'].sort(),
    );
  });

  it('jede DS-Entscheidung ist offen — keine ist stillschweigend bestätigt', () => {
    // Alle acht widersprechen der Sammelantwort „DS = FuE". Solange die
    // Grundregel nicht geklärt ist, ist keine davon gegengezeichnet.
    for (const d of DS_BEDEUTUNG) expect(d.stand, d.kuerzel).toBe('bestaetigung_offen');
  });

  it('sechs folgen DL, zwei EP — der Beleg für die DL-Hypothese', () => {
    const je = DS_BEDEUTUNG.reduce<Record<string, number>>(
      (n, d) => ({ ...n, [d.entsprichtForm]: (n[d.entsprichtForm] ?? 0) + 1 }), {},
    );
    expect(je).toEqual({ DL: 6, EP: 2 });
  });
});

describe('Nachschlagen — die Reihenfolge', () => {
  it('vereinheitlicht: derselbe Wortlaut für jede Form, auch für DS', () => {
    const erwartet = 'Gutachten kaufmännisch fertig';
    for (const form of ['NW', 'FuE', 'DL', 'DS', null] as const) {
      const a = kuerzelAuskunft('AK4', form);
      expect(a.bezeichnung, String(form)).toBe(erwartet);
      expect(a.eindeutig, String(form)).toBe(true);
    }
    expect(kuerzelAuskunft('AK4', 'NW').herkunft).toBe('einheitlich');
  });

  it('DS-Kuration schlägt die Sammelregel', () => {
    const ds = kuerzelAuskunft('AB', 'DS');
    expect(ds.bezeichnung).toBe('Bewilligungsempfehlung durch Haushaltsbeauftrage/Titelverantwortliche');
    expect(ds.herkunft).toBe('ds-kuratiert');
    expect(ds.bestaetigungOffen).toBe(true);
    // Die Formen selbst bleiben unberührt — entschieden ist nur DS.
    expect(kuerzelAuskunft('AB', 'FuE').bezeichnung).toBe('bewilligungsreif/Akte an Euronorm');
    expect(kuerzelAuskunft('AB', 'FuE').herkunft).toBe('form');
  });

  it('ohne eigene Antwort greift die Sammelregel — aus FuE, als abgeleitet erkennbar', () => {
    const ds = kuerzelAuskunft('DMB', 'DS');
    expect(ds.bezeichnung).toBe(rohForm('DMB', 'FuE')?.bezeichnung);
    expect(ds.herkunft).toBe('ds-aus-fue');
    // Abgeleitet ≠ aus der eigenen Form: `quelle` bleibt leer, damit die Bahn
    // „geliehen" weiterhin von „eigene Form" unterscheidet.
    expect(ds.quelle).toBeNull();
  });

  it('führt der Katalog kein FuE, wird weiter nicht geraten', () => {
    // Nur EP führt `ABLWK` — für DS gibt es weder Antwort noch FuE-Fassung.
    const ds = kuerzelAuskunft('ABLWK', 'DS');
    expect(ds.herkunft).toBe('geliehen');
  });

  it('Irrläufer bekommen nichts — die Lücke schließt sich nie und soll es nicht', () => {
    const ohne = kuerzelAuskunft('AB', null);
    expect(ohne.eindeutig).toBe(false);
    expect(ohne.herkunft).toBe('geliehen');
  });

  it('kennt das Kürzel nicht ⇒ unbekannt, nicht leer geraten', () => {
    const a = kuerzelAuskunft('GIBTESNICHT', 'NW');
    expect(a.bezeichnung).toBeNull();
    expect(a.herkunft).toBe('unbekannt');
  });
});

describe('Quellkorrektur', () => {
  it('dreht XVK und XVT in NW zurück und lässt FuE unberührt', () => {
    expect(kuerzelAuskunft('XVK', 'NW').bezeichnung).toBe('Netzwerkvereinbarung kaufmännisch geprüft');
    expect(kuerzelAuskunft('XVT', 'NW').bezeichnung).toBe('Netzwerkvereinbarung technisch geprüft');
    expect(kuerzelAuskunft('XVK', 'FuE').bezeichnung).toBe('unterschriebener Koop-Vertrag kaufmännisch geprüft');
    expect(kuerzelAuskunft('XVT', 'FuE').bezeichnung).toBe('unterschriebener Koop-Vertrag technisch geprüft');
    expect(kuerzelAuskunft('XVK', 'NW').quellkorrigiert).toBe(true);
  });

  it('wirkt an allen genannten Formen, nicht nur an der ersten', () => {
    for (const form of ['NW', 'FuE', 'DL'] as const) {
      expect(kuerzelAuskunft('ABLK', form).bezeichnung, form)
        .toBe('Ablehnung adm. erstellt/ergänzt/keine Ergänzung');
    }
    // EP führt einen eigenen, fehlerfreien Wortlaut — der bleibt, wie er ist.
    expect(kuerzelAuskunft('ABLK', 'EP').bezeichnung).toBe('Ablehnung kaufm. erstellt/ergänzt');
  });

  it('wirkt VOR der Übernahme: DS erbt bei WRZ den korrigierten EP-Wortlaut', () => {
    expect(kuerzelAuskunft('WRZ', 'EP').bezeichnung).toBe('Widerrufsbescheid an ZE');
    expect(kuerzelAuskunft('WRZ', 'DS').bezeichnung).toBe('Widerrufsbescheid an ZE');
  });
});

describe('Zwei Marker, zwei Aussagen', () => {
  it('bedeutungsdivergenz meldet den inhaltlichen Widerspruch, strittig das Schreibvarianten-Patt', () => {
    // `YW` trägt BEIDE — „Wichtig" / „Wichtig:" ist ein Patt des Generators,
    // und der Fachbereich hat den Unterschied als projektformabhängig
    // bestätigt. Genau deshalb dürfen die Marker nicht verschmelzen.
    const yw = kuerzelAuskunft('YW', 'NW');
    expect(yw.strittig).toBe(true);
    expect(yw.bedeutungsdivergenz).toBe(true);

    // `VZE` war strittig UND uneinig; die Vereinheitlichung räumt die
    // Uneinigkeit ab, das Patt des Generators bleibt stehen.
    const vze = kuerzelAuskunft('VZE', 'NW');
    expect(vze.strittig).toBe(true);
    expect(vze.bedeutungsdivergenz).toBeUndefined();
  });

  it('bestätigte Divergenz bleibt in der Liste, aber als geklärt markiert', () => {
    const alle = uneinigeKuerzel();
    const dmb = alle.find(u => u.kuerzel === 'DMB');
    expect(dmb?.bestaetigt).toBe(true);
    expect(dmb?.beleg).toBe('Antwortrunde 1 · AnMa · 07.08.2026');

    const ab = alle.find(u => u.kuerzel === 'AB');
    expect(ab?.bestaetigt).toBe(false);
    expect(ab?.beleg).toBeNull();
  });

  it('vereinheitlichte Kürzel sind aus der Uneinigkeits-Liste verschwunden', () => {
    const namen = projektformAbhaengigeKuerzel();
    for (const v of VEREINHEITLICHT) expect(namen, v.kuerzel).not.toContain(v.kuerzel);
  });
});

describe('Nachschlage-Helfer', () => {
  it('finden ihre Einträge unabhängig von Schreibweise und Leerraum', () => {
    expect(vereinheitlichtFuer(' ak4 ')?.kuerzel).toBe('AK4');
    expect(divergenzBestaetigt('dmb')?.kuerzel).toBe('DMB');
    expect(dsBedeutungFuer('ab')?.kuerzel).toBe('AB');
  });

  it('liefern null, wo nichts entschieden wurde', () => {
    expect(vereinheitlichtFuer('AAE')).toBeNull();
    expect(divergenzBestaetigt('AAE')).toBeNull();
    expect(dsBedeutungFuer('AAE')).toBeNull();
  });
});
