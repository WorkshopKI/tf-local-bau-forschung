/**
 * **Beschriftet die App über beide Pfade gleich?** — `statusKurzLabel` /
 * `statusLabel` über den Katalog-Snapshot bitweise gleich wie über die
 * eingebaute Auslieferung, solange die Fassung nichts Eigenes pflegt.
 *
 * Dasselbe Anliegen wie `byte-identitaet.test.ts` eine Achse weiter: prod hat
 * keinen Snapshot (`statusCockpit` aus, `initStatusKatalog` läuft nie). Weichen
 * die Pfade ab, heißt derselbe Status in prod anders als in pl — in derselben
 * Version, und beide Fassungen sähen für sich plausibel aus.
 *
 * Der zweite Teil ist die Zusage, die die Beschriftung von der Kategorie
 * unterscheidet: sie fällt **je Schlüssel** durch. Eine Fassung, die eine
 * Schreibweise nicht führt, darf ihr die Kurzform nicht wegnehmen — genau
 * dieser Fehler ist der Kategorie schon einmal passiert (Fassung 12, Code 72).
 *
 * Setzt Modul-globalen Zustand (die Register in status-canonical.ts und
 * status-wert-labels.ts) → läuft im Projekt `isolated` und räumt in `afterAll`
 * auf.
 */
import { describe, it, expect, afterAll } from 'vitest';
import { statusLabel, statusKurzLabel, statusKurzLabelMit } from '@/core/utils/status-wert-labels';
import { setStatusKatalogSnapshot } from '@/core/status/snapshot';
import { setzeKurzLabel } from '@/core/status/katalog-edit';
import { baueSeedVersion } from '@/core/status/seed';
import { STATUS_CODE_KATALOG } from '@/core/status/status-codes';

/** Jede im Code-Katalog gepflegte Schreibweise — Text UND Varianten. */
const ALLE_SCHREIBWEISEN = STATUS_CODE_KATALOG.flatMap(e => [e.text, ...e.varianten]);
const RAND_WERTE = [
  'VN gegrüft',                       // Tippfehler aus der echten Quelle
  'BEWILLIGT', '  bewilligt  ', 'Wartet auf Rückmeldung der Fachabteilung',
  '', '   ',
];

afterAll(() => setStatusKatalogSnapshot(null));

describe('Byte-Identität Katalog-Snapshot vs. eingebaute Auslieferung', () => {
  it('Kurzform und Bezeichner sind für alle Schreib- und Randwerte identisch', () => {
    const werte = [...ALLE_SCHREIBWEISEN, ...RAND_WERTE];
    const kurzBasis = new Map(werte.map(w => [w, statusKurzLabel(w)]));
    const langBasis = new Map(werte.map(w => [w, statusLabel(w)]));

    setStatusKatalogSnapshot(baueSeedVersion());

    for (const w of werte) {
      expect(statusKurzLabel(w), `kurz „${w}"`).toBe(kurzBasis.get(w));
      expect(statusLabel(w), `lang „${w}"`).toBe(langBasis.get(w));
    }
  });

  it('die Herkunft bleibt „katalog", solange niemand kuratiert hat', () => {
    setStatusKatalogSnapshot(baueSeedVersion());
    for (const e of STATUS_CODE_KATALOG) {
      expect(statusKurzLabelMit(e.text).herkunft, `${e.code}`).toBe('katalog');
    }
  });

  it('nach Snapshot-Reset greift wieder die eingebaute Auslieferung', () => {
    const vorher = statusKurzLabel('Rücknahmeempfehlung');
    setStatusKatalogSnapshot(baueSeedVersion());
    setStatusKatalogSnapshot(null);
    expect(statusKurzLabel('Rücknahmeempfehlung')).toBe(vorher);
  });
});

describe('Die Fassung überlagert, sie ersetzt nicht', () => {
  it('ein kuratiertes Kurzlabel schlägt den Katalog — und nur an seinem Code', () => {
    setStatusKatalogSnapshot(setzeKurzLabel(baueSeedVersion(), new Map([[73, 'abgelehnt']])));
    expect(statusKurzLabelMit('abgelehnt/zurückgezogen')).toEqual({
      text: 'abgelehnt', herkunft: 'fassung', gekuerzt: false,
    });
    expect(statusKurzLabelMit('Schlussvermerk').herkunft).toBe('katalog');
  });

  it('die Kuration gilt unter BEIDEN Wert-Feldern — sonst entschiede die Sortierung', () => {
    // `setzeKurzLabel` schreibt je Code, nicht je Wert-Id: derselbe Code steht
    // unter `status` und `verbund_status`, und der Snapshot kollabiert beide
    // auf einen Schlüssel („letzter gewinnt").
    const v = setzeKurzLabel(baueSeedVersion(), new Map([[72, 'Stelln. RNE']]));
    const betroffen = v.werte.filter(w => w.code === 72);
    expect(betroffen).toHaveLength(2);
    expect(betroffen.map(w => w.feldId).sort()).toEqual(['status', 'verbund_status']);
    expect(new Set(betroffen.map(w => w.kurzLabel))).toEqual(new Set(['Stelln. RNE']));
  });

  it('ein leergeräumtes Feld nimmt die Kuration zurück, statt leer zu beschriften', () => {
    const kuratiert = setzeKurzLabel(baueSeedVersion(), new Map([[73, 'abgelehnt']]));
    setStatusKatalogSnapshot(setzeKurzLabel(kuratiert, new Map([[73, '   ']])));
    expect(statusKurzLabelMit('abgelehnt/zurückgezogen')).toEqual({
      text: 'abgel./zurückgez.', herkunft: 'katalog', gekuerzt: false,
    });
  });

  it('eine Fassung OHNE den Wert nimmt ihm die Kurzform NICHT weg', () => {
    // Der Fehler, den `mitAmtlichenSchreibweisen` für die Kategorie beheben
    // musste: Fassung 12 kannte Code 72 nur unter einer Schreibweise. Weil die
    // Beschriftung je Schlüssel durchfällt, kann er hier nicht auftreten.
    const leer = { ...baueSeedVersion(), werte: [] };
    setStatusKatalogSnapshot(leer);
    expect(statusKurzLabel('Stellungnahme zur Rücknahmeempfehlung')).toBe('Stelln. zur RNE');
    expect(statusLabel('Ablehnung')).toBe('Ablehnung versandt');
  });

  it('ein kuratiertes Label ändert den Tooltip, nicht die Kurzform', () => {
    const v = baueSeedVersion();
    setStatusKatalogSnapshot({
      ...v,
      werte: v.werte.map(w => (w.code === 59 ? { ...w, label: 'Bewilligt' } : w)),
    });
    expect(statusLabel('bewilligt')).toBe('Bewilligt');
    expect(statusKurzLabel('bewilligt')).toBe('Bewilligt');
    expect(statusKurzLabelMit('bewilligt').herkunft).toBe('katalog');
  });
});
