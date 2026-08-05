/**
 * Die ZAH-Phasen sind kuratierbare Daten (v2.409). Vier Zusagen, die hier
 * einzeln festgehalten sind:
 *
 * 1. **Ohne Snapshot gilt der Seed** — nie eine leere Liste. Das ist der
 *    Normalfall in `prod` (kein `statusCockpit`, keine Fassung) und muss sich
 *    exakt wie vor der Kuratierbarkeit verhalten.
 * 2. **Die Ableitungen folgen den Daten**, nicht mehr festen Tabellen:
 *    `zieltageRelevant` statt `ZIELTAGE_PHASEN`, `kategorieVorgabe` statt
 *    `ZAH_PHASE_ZU_KATEGORIE`.
 * 3. **Grenzen werden gemeldet, Reihenfolge normalisiert, Verwaiste gezählt.**
 *    Drei verschiedene Antworten auf drei verschiedene Fragen.
 * 4. **Ein gesetzter Snapshot wirkt** — und zwar bis in die Sidebar-Gruppierung,
 *    nicht nur in der Funktion, die ihn liest.
 */
import { describe, it, expect, afterEach } from 'vitest';
import {
  SEED_ZAH_PHASEN, zahPhasenVon, zahPhaseLabel, zahPhaseRang, kategorieVorgabeVon,
  phaseFuerCode, istMarkerCode, geltenderSchnitt, zahPhasenGeneration,
  setZahPhasenSnapshot, setCodePhasenSnapshot, resetZahPhasenSnapshotFuerTests,
} from '@/core/status/zah-phasen';
import { kategorieFuerPhase, kategorieFuerCode } from '@/core/status/kategorie-ableitung';
import { schnittVon } from '@/core/status/phasen-schnitt';
import {
  MIN_PHASEN, MAX_PHASEN, pruefeZahPhasen, normalisiereReihenfolge, verwaisteZuordnungen,
  aendereZahPhase, fuegeZahPhaseHinzu, entferneZahPhase, verschiebeZahPhase, setzeCodePhasen,
} from '@/core/status/zah-phasen-edit';
import { groupStatusValues, getPhaseLabel } from '@/plugins/antraege/filter/statusGroups';
import type { MappingVersion, StatusWertEintrag, ZahPhase } from '@/core/status/typen';

afterEach(() => resetZahPhasenSnapshotFuerTests());

const phase = (p: Partial<ZahPhase> & { id: string }): ZahPhase => ({
  label: p.id, reihenfolge: 10, zieltageRelevant: false, kategorieVorgabe: 'offen', ...p,
});

const wert = (p: Partial<StatusWertEintrag> & { id: string }): StatusWertEintrag => ({
  feldId: 'status', wert: p.id, kategorie: 'offen', prominenz: 'normal',
  aktiv: true, unkuratiert: false, ...p,
});

const version = (p: Partial<MappingVersion> = {}): MappingVersion => ({
  version: 1, autor: null, zeitstempel: 'x', felder: [], werte: [], ...p,
});

// --- 1. Ohne Snapshot gilt der Seed -----------------------------------------

describe('Ohne Snapshot liefert jeder Leser die Auslieferung', () => {
  it('`zahPhasenVon()` gibt die sechs Seed-Phasen, nie eine leere Liste', () => {
    expect(zahPhasenVon()).toEqual(SEED_ZAH_PHASEN);
    expect(zahPhasenVon([])).toEqual(SEED_ZAH_PHASEN);
    expect(zahPhasenVon(undefined)).toEqual(SEED_ZAH_PHASEN);
  });

  it('`phaseFuerCode` / `istMarkerCode` folgen dem Auslieferungs-Schnitt', () => {
    expect(phaseFuerCode(11)).toBe('eingang');
    expect(phaseFuerCode(59)).toBe('begleitung');
    expect(phaseFuerCode(4711)).toBeNull();
    expect(istMarkerCode(29)).toBe(true);
    expect(istMarkerCode(11)).toBe(false);
  });

  it('Beschriftung, Rang und Kategorie-Vorgabe kommen aus dem Seed', () => {
    expect(zahPhaseLabel('pruefung')).toBe('Prüfung');
    expect(zahPhaseRang('eingang')).toBe(10);
    expect(kategorieVorgabeVon('pruefung')).toBe('in_pruefung');
  });

  it('ein leerer Snapshot ist wie kein Snapshot — nicht wie „keine Phasen"', () => {
    setZahPhasenSnapshot([]);
    expect(zahPhasenVon()).toEqual(SEED_ZAH_PHASEN);
    setCodePhasenSnapshot(null);
    expect(geltenderSchnitt().codeZuPhase.get(11)).toBe('eingang');
  });
});

describe('Bestandsfassungen ohne die neuen Felder', () => {
  it('erben `zieltageRelevant` und `kategorieVorgabe` aus dem Seed', () => {
    const alt = SEED_ZAH_PHASEN.map(({ id, label, reihenfolge }) => ({ id, label, reihenfolge }));
    expect(zahPhasenVon(alt)).toEqual(SEED_ZAH_PHASEN);
  });

  it('eine unbekannte Id ohne Angaben bekommt `sonstige`, nicht geraten', () => {
    const [ergaenzt] = zahPhasenVon([{ id: 'fremd', label: 'Fremd', reihenfolge: 10 }]);
    expect(ergaenzt).toMatchObject({ kategorieVorgabe: 'sonstige', zieltageRelevant: false });
  });
});

// --- 2. Die Ableitungen folgen den Daten ------------------------------------

describe('Die Kategorie kommt aus `kategorieVorgabe`', () => {
  it('ohne Angabe gilt die Auslieferung — byte-identisch zu vorher', () => {
    expect(kategorieFuerPhase('eingang', 11)).toBe('offen');
    expect(kategorieFuerPhase('pruefung', 38)).toBe('in_pruefung');
    expect(kategorieFuerPhase('abgeschlossen', 99)).toBe('abgeschlossen');
    expect(kategorieFuerPhase(null, 29)).toBe('sonstige');
  });

  it('eine geänderte Vorgabe wirkt', () => {
    const eigene = SEED_ZAH_PHASEN.map(p => (
      p.id === 'pruefung' ? { ...p, kategorieVorgabe: 'entscheidung' as const } : p
    ));
    expect(kategorieFuerPhase('pruefung', 38, eigene)).toBe('entscheidung');
  });

  it('eine frei angelegte Phase bringt ihre eigene Arbeitsliste mit', () => {
    const mitNeuer = [...SEED_ZAH_PHASEN, phase({ id: 'p7', kategorieVorgabe: 'begleitung' })];
    expect(kategorieFuerPhase('p7', 4711, mitNeuer)).toBe('begleitung');
  });

  /**
   * Die vier Code-Ausnahmen hängen an den Phasen `vollstaendigkeit` und
   * `begleitung`. Das ist eine Setzung, kein Zufall — sie steht hier, damit ihr
   * Wegfall bei einem umdefinierten Schnitt nicht als Regression durchgeht.
   */
  it('35–37 sind Nachforderung, solange sie in „Vollständigkeit" liegen', () => {
    expect(kategorieFuerPhase('vollstaendigkeit', 35)).toBe('nachforderung');
    expect(kategorieFuerPhase('vollstaendigkeit', 34)).toBe('offen');
    // Umgehängt gilt die Vorgabe der neuen Phase, nicht mehr die Ausnahme.
    expect(kategorieFuerPhase('pruefung', 35)).toBe('in_pruefung');
  });

  it('59 ist die Bewilligung selbst, solange sie in „Begleitung" liegt', () => {
    expect(kategorieFuerPhase('begleitung', 59)).toBe('bewilligt');
    expect(kategorieFuerPhase('begleitung', 89)).toBe('begleitung');
  });

  it('`kategorieFuerCode` bleibt am Seed — sie speist die eingebaute Map', () => {
    // Auch mit gesetztem Snapshot: dieser Pfad läuft beim Modul-Laden.
    setZahPhasenSnapshot([phase({ id: 'eingang', kategorieVorgabe: 'abgelehnt' })]);
    expect(kategorieFuerCode(11)).toBe('offen');
  });
});

// --- 3. Grenzen, Reihenfolge, Verwaiste -------------------------------------

describe('pruefeZahPhasen meldet, statt zu korrigieren', () => {
  const drei = [phase({ id: 'a' }), phase({ id: 'b' }), phase({ id: 'c' })];

  it('drei Phasen sind erlaubt, zwei nicht', () => {
    expect(pruefeZahPhasen(drei)).toEqual([]);
    expect(pruefeZahPhasen(drei.slice(0, 2))).toHaveLength(1);
    expect(pruefeZahPhasen(drei.slice(0, 2))[0]).toContain(String(MIN_PHASEN));
  });

  it('neun Phasen sind erlaubt, zehn nicht', () => {
    const neun = Array.from({ length: MAX_PHASEN }, (_, i) => phase({ id: `p${i}` }));
    expect(pruefeZahPhasen(neun)).toEqual([]);
    expect(pruefeZahPhasen([...neun, phase({ id: 'zuviel' })])[0]).toContain(String(MAX_PHASEN));
  });

  it('doppelte Kennungen werden namentlich genannt', () => {
    const fehler = pruefeZahPhasen([...drei, phase({ id: 'b' })]);
    expect(fehler.join(' ')).toContain('b');
  });

  it('leere Kennung und leere Beschriftung sind eigene Befunde', () => {
    expect(pruefeZahPhasen([...drei, phase({ id: '  ' })]).length).toBeGreaterThan(0);
    expect(pruefeZahPhasen([...drei, phase({ id: 'd', label: '' })]).length).toBeGreaterThan(0);
  });
});

describe('normalisiereReihenfolge', () => {
  it('vergibt 10, 20, 30 … in Ankunfts-Reihenfolge', () => {
    const wirr = [phase({ id: 'a', reihenfolge: 7 }), phase({ id: 'b', reihenfolge: 7 })];
    expect(normalisiereReihenfolge(wirr).map(p => p.reihenfolge)).toEqual([10, 20]);
  });
});

describe('Verwaiste Zuordnungen werden gezählt, nicht stillschweigend geheilt', () => {
  const v = version({
    zahPhasen: [phase({ id: 'a' }), phase({ id: 'b' }), phase({ id: 'c' })],
    werte: [
      wert({ id: 'w1', zahPhaseId: 'a' }),
      wert({ id: 'w2', zahPhaseId: 'weg' }),
      wert({ id: 'w3', zahPhaseId: null }),     // bewusst Marker — kein Verwaister
      wert({ id: 'w4' }),                       // nicht zugeordnet — kein Verwaister
    ],
    felder: [
      { feldId: 'd1', label: 'D1', typ: 'datum', ebene: 'tv', zahPhaseId: 'weg', aktiv: true },
      { feldId: 'd2', label: 'D2', typ: 'datum', ebene: 'tv', zahPhaseId: 'b', aktiv: true },
    ] as MappingVersion['felder'],
  });

  it('zählt beide Achsen und nur echte Verweise ins Leere', () => {
    expect(verwaisteZuordnungen(v)).toEqual({ werte: 1, felder: 1 });
  });

  it('liest den Verwaisten wie „ohne Phase"', () => {
    expect(zahPhaseLabel('weg', v.zahPhasen)).toBe('Marker (ohne Phase)');
    expect(zahPhaseRang('weg', v.zahPhasen)).toBe(Number.MAX_SAFE_INTEGER);
  });

  /**
   * Beschriftung und Arbeitsliste antworten hier BEWUSST verschieden: die
   * Anzeige sagt ehrlich „steht neben dem Verfahren", die Arbeitsliste läuft
   * trotzdem nicht leer. Ein gelöschter Schritt darf keine Anträge aus Reitern
   * und Zählern nehmen — der Hinweis dazu steht im Kopf des Katalog-Tabs.
   */
  it('behält aber die Arbeitsliste, solange die Auslieferung die Phase kennt', () => {
    const nurDrei = [phase({ id: 'a' }), phase({ id: 'b' }), phase({ id: 'c' })];
    expect(kategorieFuerPhase('begleitung', 89, nurDrei)).toBe('begleitung');
    // Eine Id, die auch die Auslieferung nicht kennt, wird `sonstige`.
    expect(kategorieFuerPhase('phase-7', 89, nurDrei)).toBe('sonstige');
  });
});

// --- Die Tabelle ändern -----------------------------------------------------

describe('Die Phasen-Tabelle ändern', () => {
  // VIER Phasen: aus einem Schnitt an der Untergrenze lässt sich nichts löschen,
  // und das ist eine eigene Zusage weiter unten.
  const basis = version({
    zahPhasen: [
      phase({ id: 'a' }), phase({ id: 'b', reihenfolge: 20 }),
      phase({ id: 'c', reihenfolge: 30 }), phase({ id: 'd', reihenfolge: 40 }),
    ],
    werte: [wert({ id: 'w1', code: 11, zahPhaseId: 'b' }), wert({ id: 'w2', code: 12, zahPhaseId: 'b' })],
  });

  it('Umbenennen lässt die Id in Ruhe — Nummern sind keine Identität', () => {
    const nachher = aendereZahPhase(basis, 'b', { label: 'Ganz anders', id: 'geklaut' });
    expect(nachher.zahPhasen?.map(p => p.id)).toEqual(['a', 'b', 'c', 'd']);
    expect(zahPhaseLabel('b', nachher.zahPhasen)).toBe('Ganz anders');
  });

  it('Anlegen hängt ans Ende und stoppt an der Obergrenze', () => {
    let v = basis;
    for (let i = 0; i < MAX_PHASEN; i++) v = fuegeZahPhaseHinzu(v, `Neu ${i}`, 'offen');
    expect(v.zahPhasen).toHaveLength(MAX_PHASEN);
    const nochmal = fuegeZahPhaseHinzu(v, 'zu viel', 'offen');
    expect(nochmal.zahPhasen).toHaveLength(MAX_PHASEN);
  });

  it('Löschen hängt die Werte um — nie stilles Verwaisen', () => {
    const nachher = entferneZahPhase(basis, 'b', 'c');
    expect(nachher.zahPhasen?.map(p => p.id)).toEqual(['a', 'c', 'd']);
    expect(nachher.werte.every(w => w.zahPhaseId === 'c')).toBe(true);
    expect(verwaisteZuordnungen(nachher)).toEqual({ werte: 0, felder: 0 });
  });

  it('Löschen nach `null` legt die Werte ausdrücklich neben das Verfahren', () => {
    const nachher = entferneZahPhase(basis, 'b', null);
    expect(nachher.werte.every(w => w.zahPhaseId === null)).toBe(true);
  });

  it('ein unbekanntes Ziel lässt den Griff ins Leere laufen, statt zu verwaisen', () => {
    expect(entferneZahPhase(basis, 'b', 'gibtsnicht')).toBe(basis);
  });

  it('an der Untergrenze wird nicht mehr gelöscht', () => {
    const drei = entferneZahPhase(basis, 'd', 'c');
    expect(drei.zahPhasen).toHaveLength(MIN_PHASEN);
    expect(entferneZahPhase(drei, 'c', 'a')).toBe(drei);
  });

  it('Verschieben nummeriert lückenlos neu', () => {
    const nachher = verschiebeZahPhase(basis, 'c', 0);
    expect(nachher.zahPhasen?.map(p => p.id)).toEqual(['c', 'a', 'b', 'd']);
    expect(nachher.zahPhasen?.map(p => p.reihenfolge)).toEqual([10, 20, 30, 40]);
  });

  it('Umhängen greift am CODE — also an beiden Feld-Einträgen', () => {
    const zweiFelder = version({
      zahPhasen: basis.zahPhasen,
      werte: [
        wert({ id: 'status::x', feldId: 'status', code: 40, zahPhaseId: 'a' }),
        wert({ id: 'verbund_status::x', feldId: 'verbund_status', code: 40, zahPhaseId: 'a' }),
      ],
    });
    const nachher = setzeCodePhasen(zweiFelder, new Map([[40, 'c']]));
    expect(nachher.werte.map(w => w.zahPhaseId)).toEqual(['c', 'c']);
    expect(nachher.werte.every(w => w.marker === false)).toBe(true);
    // Und der abgeleitete Schnitt ist dadurch eindeutig, nicht sortierabhängig.
    expect(schnittVon(nachher).codeZuPhase.get(40)).toBe('c');
  });

  it('Umhängen nach `null` setzt zugleich das Marker-Flag', () => {
    const nachher = setzeCodePhasen(basis, new Map([[11, null]]));
    expect(nachher.werte[0]).toMatchObject({ zahPhaseId: null, marker: true });
    expect(schnittVon(nachher).markerCodes.has(11)).toBe(true);
  });
});

// --- 4. Ein gesetzter Snapshot wirkt ----------------------------------------

describe('Der Snapshot wirkt bis in die Sidebar, nicht nur in seiner Lesefunktion', () => {
  it('der Generationszähler steigt bei jedem Setzen', () => {
    const vorher = zahPhasenGeneration();
    setZahPhasenSnapshot([phase({ id: 'a' }), phase({ id: 'b' }), phase({ id: 'c' })]);
    expect(zahPhasenGeneration()).toBeGreaterThan(vorher);
    setCodePhasenSnapshot(null);
    expect(zahPhasenGeneration()).toBeGreaterThan(vorher + 1);
  });

  it('die Gruppierung des Status-Filters folgt dem gesetzten Schnitt', () => {
    const vorher = groupStatusValues(new Map()).map(g => g.id);
    expect(vorher).toEqual([...SEED_ZAH_PHASEN.map(p => p.id), 'marker', 'sonstige']);

    setZahPhasenSnapshot([
      phase({ id: 'anfang', label: 'Anfang' }),
      phase({ id: 'mitte', label: 'Mitte', reihenfolge: 20 }),
      phase({ id: 'ende', label: 'Ende', reihenfolge: 30 }),
    ]);

    const nachher = groupStatusValues(new Map());
    expect(nachher.map(g => g.id)).toEqual(['anfang', 'mitte', 'ende', 'marker', 'sonstige']);
    expect(nachher.map(g => g.label)).toContain('Mitte');
    expect(getPhaseLabel('ende')).toBe('Ende');
  });

  it('ein umgehängter Code landet in der neuen Gruppe — mit seiner Zählung', () => {
    setZahPhasenSnapshot([
      phase({ id: 'anfang' }), phase({ id: 'mitte', reihenfolge: 20 }),
      phase({ id: 'ende', reihenfolge: 30 }),
    ]);
    setCodePhasenSnapshot({
      codeZuPhase: new Map([[11, 'ende']]),
      markerCodes: new Set<number>(),
    });

    const gruppen = groupStatusValues(new Map([['Skizze eingegangen', 42]]));
    const ende = gruppen.find(g => g.id === 'ende')!;
    expect(ende.items.find(i => i.count === 42)?.value).toBe('Skizze eingegangen');
    // Kein Code geht dabei verloren: die Summe bleibt die Summe.
    const gesamt = gruppen.flatMap(g => g.items).reduce((n, i) => n + i.count, 0);
    expect(gesamt).toBe(42);
  });

  it('nach dem Zurücksetzen gilt wieder die Auslieferung', () => {
    setZahPhasenSnapshot([phase({ id: 'a' }), phase({ id: 'b' }), phase({ id: 'c' })]);
    resetZahPhasenSnapshotFuerTests();
    expect(groupStatusValues(new Map()).map(g => g.id))
      .toEqual([...SEED_ZAH_PHASEN.map(p => p.id), 'marker', 'sonstige']);
  });
});
