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
  SEED_ZAH_PHASEN, zahPhasenVon, zahPhaseLabel, zahPhaseRang,
  fristLaeuftVon, phaseFuerCode, istMarkerCode, geltenderSchnitt, zahPhasenGeneration,
  setZahPhasenSnapshot, setCodePhasenSnapshot, resetZahPhasenSnapshotFuerTests,
} from '@/core/status/zah-phasen';
import { kategorieFuerCode } from '@/core/status/kategorie-ableitung';
import { schnittVon } from '@/core/status/phasen-schnitt';
import {
  MIN_PHASEN, MAX_PHASEN, pruefeZahPhasen, normalisiereReihenfolge, verwaisteZuordnungen,
  aendereZahPhase, fuegeZahPhaseHinzu, entferneZahPhase, verschiebeZahPhase, setzeCodePhasen,
} from '@/core/status/zah-phasen-edit';
import { groupStatusValues, getPhaseLabel } from '@/plugins/antraege/filter/statusGroups';
import type { MappingVersion, StatusWertEintrag, ZahPhase } from '@/core/status/typen';

afterEach(() => resetZahPhasenSnapshotFuerTests());

const phase = (p: Partial<ZahPhase> & { id: string }): ZahPhase => ({
  label: p.id, reihenfolge: 10, zieltageRelevant: false, ...p,
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

  it('Beschriftung und Rang kommen aus dem Seed', () => {
    expect(zahPhaseLabel('pruefung')).toBe('Prüfung');
    expect(zahPhaseRang('eingang')).toBe(10);
  });

  it('ein leerer Snapshot ist wie kein Snapshot — nicht wie „keine Phasen"', () => {
    setZahPhasenSnapshot([]);
    expect(zahPhasenVon()).toEqual(SEED_ZAH_PHASEN);
    setCodePhasenSnapshot(null);
    expect(geltenderSchnitt().codeZuPhase.get(11)).toBe('eingang');
  });
});

/*
 * `fristLaeuftVon` hatte bis v4.3 keinen einzigen Aufrufer — das Vorgangs-Board
 * führte stattdessen eine eigene Menge von Phasen-Ids. Seit es der einzige Weg
 * ist, gehört sein Verhalten festgehalten.
 */
describe('`fristLaeuftVon` — die Uhr hängt an der Phase', () => {
  it('nimmt die Auslieferung, wenn nichts kuratiert ist', () => {
    expect(fristLaeuftVon('eingang')).toBe(true);
    expect(fristLaeuftVon('pruefung')).toBe(true);
    expect(fristLaeuftVon('entscheidung')).toBe(false);
    expect(fristLaeuftVon('begleitung')).toBe(false);
  });

  it('lässt sie bei Marker (`null`) und verwaister Id laufen — nicht wissen heißt nicht anhalten', () => {
    expect(fristLaeuftVon(null)).toBe(true);
    expect(fristLaeuftVon(undefined)).toBe(true);
    expect(fristLaeuftVon('gibt-es-nicht')).toBe(true);
  });

  it('folgt einer übergebenen Fassung, auch bei frisch angelegten Phasen', () => {
    const fassung = [
      phase({ id: 'erstsichtung', reihenfolge: 10, fristLaeuft: true }),
      phase({ id: 'erstsichtung-qs', reihenfolge: 20, fristLaeuft: false }),
    ];
    expect(fristLaeuftVon('erstsichtung', fassung)).toBe(true);
    expect(fristLaeuftVon('erstsichtung-qs', fassung)).toBe(false);
  });

  it('erbt bei einer Bestandsfassung ohne das Feld den Seed-Wert', () => {
    const ohneFeld = SEED_ZAH_PHASEN.map(({ id, label, reihenfolge }) => ({ id, label, reihenfolge }));
    expect(fristLaeuftVon('entscheidung', ohneFeld)).toBe(false);
    // Eine unbekannte Id ohne Angabe fällt auf `true` — die sichtbare Richtung.
    expect(fristLaeuftVon('fremd', [{ id: 'fremd', label: 'Fremd', reihenfolge: 10 }])).toBe(true);
  });
});

describe('Bestandsfassungen ohne die neuen Felder', () => {
  it('erben `zieltageRelevant` und `fristLaeuft` aus dem Seed', () => {
    const alt = SEED_ZAH_PHASEN.map(({ id, label, reihenfolge }) => ({ id, label, reihenfolge }));
    expect(zahPhasenVon(alt)).toEqual(SEED_ZAH_PHASEN);
  });

  it('eine unbekannte Id ohne Angaben bekommt keine Zieltage, nicht geraten', () => {
    const [ergaenzt] = zahPhasenVon([{ id: 'fremd', label: 'Fremd', reihenfolge: 10 }]);
    expect(ergaenzt).toMatchObject({ zieltageRelevant: false });
  });

  it('ein `kategorieVorgabe` aus einer Fassung vor v4.87 wird verworfen, nicht getragen', () => {
    // Keine Migration nötig — und genau das ist der Gewinn: eine alte Fassung
    // kann die Arbeitslisten nicht mehr verschieben.
    const altfeld = [{ id: 'eingang', label: 'Eingang', reihenfolge: 10, kategorieVorgabe: 'abgelehnt' }];
    expect(zahPhasenVon(altfeld as unknown as ZahPhase[])[0]).not.toHaveProperty('kategorieVorgabe');
  });
});

// --- 2. Die Ableitungen folgen den Daten ------------------------------------

/**
 * Was die Phase NICHT mehr trägt.
 *
 * Bis v4.86 stand an ihr eine `kategorieVorgabe`, und ein ganzer Block hier
 * prüfte, welche Arbeitsliste aus welchem Zuschnitt fällt. Die Frage stellt sich
 * nicht mehr: die Arbeitsliste hängt am Statuscode. Was von diesem Block bleibt,
 * ist die Gegenprobe — der Zuschnitt darf sie unter keinen Umständen bewegen.
 * Die Tabelle selbst prüft `kategorie-ableitung.test.ts`.
 */
describe('Der Phasen-Zuschnitt bewegt keine Arbeitsliste', () => {
  /**
   * Der Fall, der v3.24 den Altanträge-Balken geleert hat: die Katalog-Fassung
   * 19 vom 05.08.2026 löste „Vollständigkeit" auf und hängte ihre Codes an
   * „Prüfung". Weil `pruefung` damals `in_pruefung` vorgab, rutschten vier der
   * fünf Status der täglichen Arbeit mit — 448 Anträge im Bestand, die Lane
   * „Wartet auf Antragsteller" fiel auf 0.
   */
  it('auch der Zuschnitt von Fassung 19 lässt jede Arbeitsliste stehen', () => {
    setZahPhasenSnapshot([phase({ id: 'pruefung', reihenfolge: 10, label: 'In Prüfung' })]);
    setCodePhasenSnapshot({
      codeZuPhase: new Map([[33, 'pruefung'], [34, 'pruefung'], [35, 'pruefung'],
        [36, 'pruefung'], [37, 'pruefung'], [38, 'pruefung']]),
      markerCodes: new Set(),
    });
    expect(kategorieFuerCode(35)).toBe('nachforderung');
    for (const code of [33, 34, 36, 37]) expect(kategorieFuerCode(code)).toBe('offen');
    expect(kategorieFuerCode(38)).toBe('in_pruefung');
  });

  it('ein Snapshot kann die Arbeitsliste eines Codes nicht überschreiben', () => {
    // Der Weg, den es bis v4.86 gab: eine Phase mit fremder Vorgabe darüberlegen.
    setZahPhasenSnapshot([phase({ id: 'eingang' })]);
    setCodePhasenSnapshot({ codeZuPhase: new Map([[11, 'eingang']]), markerCodes: new Set() });
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
   *
   * Bis v4.86 hing das an einem Fallback auf den Auslieferungs-Schnitt und galt
   * deshalb nur, solange die Auslieferung die Phase kannte. Seit die Arbeitsliste
   * am Code hängt, gilt es ohne Wenn und Aber.
   */
  it('behält die Arbeitsliste, egal was mit der Phase passiert', () => {
    setZahPhasenSnapshot([phase({ id: 'a' }), phase({ id: 'b' }), phase({ id: 'c' })]);
    setCodePhasenSnapshot({ codeZuPhase: new Map([[89, 'weg-damit']]), markerCodes: new Set() });
    expect(zahPhaseLabel('weg-damit')).toBe('Marker (ohne Phase)');
    expect(kategorieFuerCode(89)).toBe('begleitung');
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
    for (let i = 0; i < MAX_PHASEN; i++) v = fuegeZahPhaseHinzu(v, `Neu ${i}`);
    expect(v.zahPhasen).toHaveLength(MAX_PHASEN);
    const nochmal = fuegeZahPhaseHinzu(v, 'zu viel');
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
