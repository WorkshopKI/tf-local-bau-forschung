/**
 * Die Ruhe-Achse: abgeleitet aus der Beobachtbarkeit, kuriert nur als Ausnahme.
 *
 * Der wichtigste Test steht unten: **`referenzierbareFelder` darf nicht
 * schrumpfen**. Ruhe blendet aus, sie entwertet nicht — würde der Prüfbegriff
 * mitschrumpfen, wiese der Share-Import bestehende Regeln zurück, und zwar
 * genau die, die auf ein selten gewordenes Kürzel zeigen.
 */
import { describe, it, expect } from 'vitest';
import {
  EINSATZ_GENERATIONEN, aktuelleProgramme, einsatzJahre,
  hatSpalteAus, ruheGrund, ruhtFeld, ruhendeCodes, ruhendeFeldIds, schlafendeKuerzel,
  referenzierbareFelder, RICHTLINIEN_GENERATIONEN, lasseRuhen, raeumeRelevanzDerRuhenden,
  validiereImport, exportiereVersion,
  type EinsatzTreffer, type MappingVersion, type StatusFeldEintrag,
} from '@/core/status';

const feld = (p: Partial<StatusFeldEintrag> & { feldId: string }): StatusFeldEintrag => ({
  label: p.feldId, typ: 'datum', ebene: 'tv', kategorieId: 'tv.ab', rollen: [],
  prominenzDefault: 'normal', aktiv: true, unkuratiert: false, ...p,
});

/** `csvSpaltenJeFeld`-Form: feldId → Spalten, aus denen das Feld gefüllt wird. */
const spalten = (...ids: string[]): Map<string, string[]> =>
  new Map(ids.map(id => [id, [id]]));

describe('ruhende Kürzel — Ableitung', () => {
  it('lässt ein Kürzel ohne jede CSV-Spalte ruhen', () => {
    const f = feld({ feldId: 'D_YE', code: 'YE' });
    const hat = hatSpalteAus(spalten('D_AAE'));
    expect(ruhtFeld(f, hat(f))).toBe(true);
    expect(ruheGrund(f, hat(f))).toBe('nicht-im-export');
  });

  it('lässt ein gemapptes Kürzel wach', () => {
    const f = feld({ feldId: 'D_AAE', code: 'AAE' });
    const hat = hatSpalteAus(spalten('D_AAE'));
    expect(ruheGrund(f, hat(f))).toBeNull();
  });

  it('hält kanonische Felder wach — sie laufen nicht über das Spalten-Mapping', () => {
    const f = feld({ feldId: 'status', typ: 'wert' });
    const hat = hatSpalteAus(new Map());
    expect(ruhtFeld(f, hat(f))).toBe(false);
  });
});

describe('ruhende Kürzel — Kuration schlägt Ableitung', () => {
  const hat = hatSpalteAus(spalten('D_AAE'));

  it('ruht auf Anweisung, obwohl eine Spalte da ist', () => {
    const f = feld({ feldId: 'D_AAE', code: 'AAE', ruht: true });
    expect(ruheGrund(f, hat(f))).toBe('kuratiert');
  });

  it('bleibt auf Anweisung wach, obwohl keine Spalte da ist', () => {
    const f = feld({ feldId: 'D_NEU', code: 'NEU', ruht: false });
    expect(ruhtFeld(f, hat(f))).toBe(false);
  });
});

describe('ruhende Kürzel — Mengen für die Konsumenten', () => {
  const felder = [
    feld({ feldId: 'D_AAE', code: 'AAE' }),
    feld({ feldId: 'D_YE', code: 'YE' }),
    feld({ feldId: 'D_INFOB', code: 'INFOB', ruht: true, textSpalte: 'T_INFOB' }),
    feld({ feldId: 'status', typ: 'wert' }),
  ];
  const hat = hatSpalteAus(spalten('D_AAE', 'D_INFOB'));

  it('liefert die Codes NFC-normalisiert', () => {
    const mitUmlaut = [feld({ feldId: 'D_ÄA', code: 'ÄA'.normalize('NFD') })];
    const codes = ruhendeCodes(mitUmlaut, hatSpalteAus(new Map()));
    expect(codes.has('ÄA'.normalize('NFC'))).toBe(true);
  });

  it('nennt nur die ruhenden Codes', () => {
    expect([...ruhendeCodes(felder, hat)].sort()).toEqual(['INFOB', 'YE']);
  });

  it('nimmt die Begleit-Textspalte mit aus der Auswahl', () => {
    const ids = ruhendeFeldIds(felder, hat);
    expect(ids.has('D_INFOB')).toBe(true);
    expect(ids.has('T_INFOB'), 'sonst bliebe T_INFOB allein in der Liste stehen').toBe(true);
    expect(ids.has('D_AAE')).toBe(false);
    expect(ids.has('status')).toBe(false);
  });
});

describe('Einsatz-Fenster', () => {
  it('folgt der Generationen-Liste, statt Jahre abzuschreiben', () => {
    const erwartet = RICHTLINIEN_GENERATIONEN.slice(-EINSATZ_GENERATIONEN);
    expect(einsatzJahre()).toEqual(erwartet.map(g => g.jahr));
    for (const g of erwartet) {
      for (const p of g.programme) expect(aktuelleProgramme().has(p)).toBe(true);
    }
    // Die Generation davor gehört ausdrücklich NICHT dazu — sonst misst das
    // Fenster den Betrachtungsbereich nach und nicht den Einsatz.
    const davor = RICHTLINIEN_GENERATIONEN[
      RICHTLINIEN_GENERATIONEN.length - EINSATZ_GENERATIONEN - 1
    ];
    for (const p of davor?.programme ?? []) expect(aktuelleProgramme().has(p)).toBe(false);
  });
});

describe('schlafendeKuerzel — der Bestandsvorschlag', () => {
  const felder = [
    feld({ feldId: 'D_INFOB', code: 'INFOB' }),
    feld({ feldId: 'D_AAE', code: 'AAE' }),
    feld({ feldId: 'D_LW', code: 'LW' }),
    feld({ feldId: 'D_YE', code: 'YE' }),
    feld({ feldId: 'D_NEU', code: 'NEU', ruht: false }),
  ];
  const hat = hatSpalteAus(spalten('D_INFOB', 'D_AAE', 'D_LW', 'D_NEU'));
  // `VRM` fehlt in der Map mit Absicht: `kuerzelEinesVorgangs` liefert nur
  // GEFÜLLTE Spalten, ein nie gesetztes Kürzel taucht in der Zählung nie auf.
  const treffer = new Map<string, EinsatzTreffer>([
    ['INFOB', { aktuell: 0, frueher: 305 }],
    ['AAE', { aktuell: 4545, frueher: 4767 }],
    ['LW', { aktuell: 0, frueher: 1 }],
    ['YE', { aktuell: 0, frueher: 0 }],
  ]);

  it('schlägt nur beobachtbare Kürzel ohne aktuelle Treffer vor, schwerste zuerst', () => {
    expect(schlafendeKuerzel(felder, treffer, hat).map(s => s.code)).toEqual(['INFOB', 'LW']);
  });

  it('schlägt NICHT vor, was der Lauf nie gesehen hat', () => {
    // Der Kern der Zusage, in dev:local erkauft. Ein fehlender Treffer-Eintrag
    // heißt nicht „die Spalte war überall leer", sondern „die Auflösung hat das
    // Feld nie erreicht" — belegt an `QS`/`AQ4`: `normCode` streift `-`, also
    // fallen `D_QS` und `D_QS-` im Spalten-Index zusammen und der
    // Kollisionsschutz wirft eines aus der Auflösung. Die freundlichere Lesart
    // schlug am Echtbestand 24 statt 11 Kürzel vor — darunter genau diese.
    const mitQs = [...felder, feld({ feldId: 'D_QS', code: 'QS' })];
    const vorschlag = schlafendeKuerzel(mitQs, treffer, hatSpalteAus(
      spalten('D_INFOB', 'D_AAE', 'D_LW', 'D_NEU', 'D_QS'),
    ));
    expect(vorschlag.map(s => s.code)).toEqual(['INFOB', 'LW']);
  });

  it('lässt eine ausdrückliche Ausnahme in Ruhe', () => {
    // `NEU` hat 0 aktuelle Treffer, trägt aber `ruht: false`. Würde es wieder
    // vorgeschlagen, müsste die PL die Ausnahme nach jeder Messung neu setzen.
    expect(schlafendeKuerzel(felder, treffer, hat).some(s => s.code === 'NEU')).toBe(false);
  });

  it('schlägt ohne Messung nichts vor', () => {
    expect(schlafendeKuerzel(felder, new Map(), hat)).toEqual([]);
  });
});

describe('Ruhe ist Sichtbarkeit, nicht Wahrheit', () => {
  const felder = [
    feld({ feldId: 'D_INFOB', code: 'INFOB', ruht: true, textSpalte: 'T_INFOB' }),
    feld({ feldId: 'D_AAE', code: 'AAE' }),
  ];

  it('lässt referenzierbareFelder unangetastet', () => {
    const erlaubt = referenzierbareFelder(felder);
    expect(erlaubt.has('D_INFOB'), 'sonst kippt jede bestehende Regel darauf').toBe(true);
    expect(erlaubt.has('T_INFOB')).toBe(true);
  });

  it('hält eine Regel auf ein ruhendes Feld über den Export-Import gültig', () => {
    const version: MappingVersion = {
      version: 1, autor: null, zeitstempel: '2026-08-17T00:00:00.000Z',
      felder, werte: [],
      kategorien: [{
        id: 'tv.ab', elternId: null, label: 'AB', ebene: 'tv', reihenfolge: 10, aktiv: true,
      }],
      todoRegeln: [{
        id: 'r1', reihenfolge: 10, aktiv: true, todo: 'Info nachhalten',
        beschreibung: 'Regel auf ein ruhendes Feld', zustaendig: ['ab'],
        bedingung: { feldId: 'D_INFOB', op: 'gefuellt' },
      }],
    };
    const ergebnis = validiereImport(exportiereVersion(version));
    expect(ergebnis.fehler).toBeUndefined();
    expect(ergebnis.ok).toBe(true);
    // Und das Flag überlebt den Roundtrip — sonst wachte die Fassung beim
    // nächsten Share-Import wieder vollständig auf.
    expect(ergebnis.version?.felder.find(f => f.feldId === 'D_INFOB')?.ruht).toBe(true);
  });
});

describe('Sammel-Aktionen', () => {
  const basis: MappingVersion = {
    version: 1, autor: null, zeitstempel: '2026-08-17T00:00:00.000Z',
    felder: [
      feld({ feldId: 'D_INFOB', code: 'INFOB' }),
      feld({ feldId: 'D_YE', code: 'YE', relevant: true }),
      feld({ feldId: 'D_AAE', code: 'AAE', relevant: true }),
    ],
    werte: [],
  };

  it('lasseRuhen setzt genau die genannten Felder und ist idempotent', () => {
    const nach = lasseRuhen(basis, ['D_INFOB']);
    expect(nach.felder.find(f => f.feldId === 'D_INFOB')?.ruht).toBe(true);
    expect(nach.felder.find(f => f.feldId === 'D_AAE')?.ruht).toBeUndefined();
    expect(lasseRuhen(nach, ['D_INFOB']), 'gleiche Referenz, wenn nichts zu tun').toBe(nach);
  });

  it('raeumeRelevanzDerRuhenden fasst nur ruhende Felder an', () => {
    const nach = raeumeRelevanzDerRuhenden(basis, new Set(['D_YE']));
    expect(nach.felder.find(f => f.feldId === 'D_YE')?.relevant).toBe(false);
    expect(nach.felder.find(f => f.feldId === 'D_AAE')?.relevant).toBe(true);
    expect(raeumeRelevanzDerRuhenden(nach, new Set(['D_YE']))).toBe(nach);
  });
});
