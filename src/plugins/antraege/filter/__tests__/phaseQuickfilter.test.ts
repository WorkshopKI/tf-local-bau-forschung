/**
 * Die Invariante der Status-Pille: **die Zahl an der Pille ist die Zeilenzahl,
 * die ihr Klick liefert.**
 *
 * Sie war zweimal gebrochen. Erstens schrieb `applyPhase` normalisierte
 * Kleinschreib-Schlüssel in den Filter, während die Engine exakt gegen den
 * CSV-Rohwert verglich — jeder großgeschriebene Status (`NF gestellt`,
 * `Schlussvermerk`, `VN geprüft`) fiel still aus dem Filter und wurde trotzdem
 * gezählt („NF 2" bei 0 Zeilen). Zweitens hängte `applyPhase` alle
 * `sonstige`-Werte an, die die Zählung nicht kannte.
 *
 * Deshalb läuft der Test gegen `REAL_CSV_ANTRAEGE` (echte, gemischt
 * geschriebene Rohwerte) und vergleicht nicht Erwartungszahlen, sondern die
 * beiden Wege gegeneinander: gezählt vs. gefiltert.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { applyFilters } from '@/core/services/csv/filter/engine';
import type { ActiveFilter, FilterDefinition } from '@/core/services/csv/filter/types';
import { getStatusValuesByCategory, setStatusKatalogSnapshotMap, type StatusCategory } from '@/core/utils/status-canonical';
import type { AntragListItem } from '@/core/services/csv/types';
import { REAL_CSV_ANTRAEGE } from '../../__tests__/fixtures/real-csv-antraege';
import {
  getPhaseItems, applyPhase, getPhaseFromActive, STATUS_FILTER_ID, EIGENE_AUSWAHL_LABEL,
} from '../phaseQuickfilter';
import {
  STATUS_QUICK_CHIPS, chipStatusValues, chipLabelKurz, type StatusQuickChipId,
} from '../statusQuickChips';

const STATUS_DEF: FilterDefinition = {
  id: STATUS_FILTER_ID,
  programm_id: 'TEST-PROG',
  scope: 'system',
  name: 'Status',
  feld: 'status',
  typ: 'multi_select',
  config: { werte_quelle: 'auto' },
  anzeige_reihenfolge: 1,
  versteckt: false,
  erstellt_am: '2026-01-01',
  aktualisiert_am: '2026-01-01',
};

const ANTRAEGE = [...REAL_CSV_ANTRAEGE];
// Die Beschriftungen kommen aus derselben Einzelquelle wie die Oberflaeche
// (v2.409). Eine eigene Liste hier waere das siebte Vokabular — und der Test
// wuerde dann nur noch pruefen, dass zwei Kopien uebereinstimmen.
const PHASEN = STATUS_QUICK_CHIPS.map(c => chipLabelKurz(c.id));

/** Fährt `applyPhase` und gibt den Filter-Zustand zurück, den die Pille setzt. */
function filterNachKlick(phase: string): ActiveFilter[] {
  let active: ActiveFilter[] = [];
  applyPhase(
    phase as Parameters<typeof applyPhase>[0],
    (filterId, value) => { active = [{ filterId, value }]; },
    () => { active = []; },
  );
  return active;
}

function zeilenNachKlick(phase: string): number {
  return applyFilters(ANTRAEGE, filterNachKlick(phase), [STATUS_DEF]).length;
}

function zahlAnDerPille(phase: string): number {
  const item = getPhaseItems(ANTRAEGE).find(i => i.label === phase);
  if (!item) throw new Error(`Pille ${phase} fehlt`);
  return item.count ?? 0;
}

describe('Status-Pille: Zahl == Zeilen', () => {
  it('die Fixture enthält die großgeschriebenen Rohwerte, an denen es brach', () => {
    const rohwerte = new Set(ANTRAEGE.map(a => String(a.status)));
    expect(rohwerte.has('NF gestellt')).toBe(true);
    expect(rohwerte.has('Schlussvermerk')).toBe(true);
    expect(rohwerte.has('VN geprüft')).toBe(true);
  });

  it.each(PHASEN)('%s: die Pillen-Zahl ist die gefilterte Zeilenzahl', (phase) => {
    expect(zeilenNachKlick(phase)).toBe(zahlAnDerPille(phase));
  });

  it('mindestens eine Phase zählt echte Treffer (der Test prüft nicht 0 === 0)', () => {
    const summe = PHASEN.reduce((n, p) => n + zahlAnDerPille(p), 0);
    expect(summe).toBeGreaterThan(0);
  });

  it('„Alle" löscht den Filter und zeigt den ganzen Bestand', () => {
    expect(filterNachKlick('Alle')).toEqual([]);
    expect(zahlAnDerPille('Alle')).toBe(ANTRAEGE.length);
  });

  it('die Phasen-Summe übersteigt „Alle" nie — kein Wert zählt doppelt', () => {
    const summe = PHASEN.reduce((n, p) => n + zahlAnDerPille(p), 0);
    expect(summe).toBeLessThanOrEqual(ANTRAEGE.length);
  });
});

/** Pille → Chip, gespiegelt aus `PHASE_LABEL_BY_CHIP_ID` (dort modul-privat). */
const CHIP_ZU_PHASE: Record<StatusQuickChipId, string> = {
  offen: chipLabelKurz('offen'),
  nachforderung: chipLabelKurz('nachforderung'),
  bewilligt: chipLabelKurz('bewilligt'),
  begleitung: chipLabelKurz('begleitung'),
  abgeschlossen: chipLabelKurz('abgeschlossen'),
};

describe('applyPhase schreibt genau die gezählte Wertemenge', () => {
  it.each(STATUS_QUICK_CHIPS)('$id: Filter-Wert === chipStatusValues', (chip) => {
    const active = filterNachKlick(CHIP_ZU_PHASE[chip.id]);
    expect(active).toHaveLength(1);
    const geschrieben = new Set(active[0]!.value as string[]);
    expect([...geschrieben].sort()).toEqual([...chipStatusValues(chip.id)].sort());
  });

  it('kein Phasen-Filter schleppt fremde sonstige-Werte mit', () => {
    const sonstige = getStatusValuesByCategory('sonstige');
    for (const chip of STATUS_QUICK_CHIPS) {
      const geschrieben = new Set(filterNachKlick(CHIP_ZU_PHASE[chip.id])[0]!.value as string[]);
      for (const v of sonstige) {
        if (chipStatusValues(chip.id).has(v)) continue;
        expect(geschrieben.has(v), `${chip.id} schleppt ${v} mit`).toBe(false);
      }
    }
  });
});

describe('getPhaseFromActive', () => {
  it.each(PHASEN)('%s: erkennt den eigenen Filter-Wert zurück', (phase) => {
    expect(getPhaseFromActive(filterNachKlick(phase))).toBe(phase);
  });

  it('erkennt auch den früher gespeicherten Wertesatz (Bucket + sonstige)', () => {
    const alt = [
      ...chipStatusValues('nachforderung'),
      ...getStatusValuesByCategory('sonstige'),
    ];
    expect(getPhaseFromActive([{ filterId: STATUS_FILTER_ID, value: alt }])).toBe(chipLabelKurz('nachforderung'));
  });

  it('gemischte Hand-Auswahl aus der Sidebar heißt „Eigene Auswahl", nicht „Alle"', () => {
    // Bis v4.65 stand hier „Alle" — die Pille behauptete damit das Gegenteil
    // dessen, was die Liste zeigte: gefiltert, aber „Alle 38" daneben.
    const gemischt = [[...chipStatusValues('bewilligt')][0]!, [...chipStatusValues('nachforderung')][0]!];
    expect(getPhaseFromActive([{ filterId: STATUS_FILTER_ID, value: gemischt }]))
      .toBe(EIGENE_AUSWAHL_LABEL);
  });

  it('ohne Status-Filter „Alle"', () => {
    expect(getPhaseFromActive([])).toBe('Alle');
  });

  it('ein leerer Werte-Satz filtert nichts und heißt deshalb „Alle"', () => {
    expect(getPhaseFromActive([{ filterId: STATUS_FILTER_ID, value: [] }])).toBe('Alle');
  });
});

describe('„Eigene Auswahl" ist eine Auskunft, keine Wahl', () => {
  it('steht nur dann als Segment in der Liste, wenn sie auch gilt', () => {
    const ohne = getPhaseItems([], 'Alle').map(i => i.label);
    expect(ohne).not.toContain(EIGENE_AUSWAHL_LABEL);
    const mit = getPhaseItems([], EIGENE_AUSWAHL_LABEL).map(i => i.label);
    expect(mit).toContain(EIGENE_AUSWAHL_LABEL);
  });

  it('trägt keinen Zähler — was die Leiste gesetzt hat, zählt die Pille nicht nach', () => {
    const eintrag = getPhaseItems([], EIGENE_AUSWAHL_LABEL)
      .find(i => i.label === EIGENE_AUSWAHL_LABEL)!;
    expect(eintrag.count).toBeUndefined();
  });

  it('ein Klick darauf lässt den Filter unangetastet', () => {
    let gesetzt = 0;
    let geleert = 0;
    applyPhase(EIGENE_AUSWAHL_LABEL, () => { gesetzt++; }, () => { geleert++; });
    expect(gesetzt).toBe(0);
    expect(geleert).toBe(0);
  });
});

describe('Zähler = Filter gilt auch mit gesetztem Katalog-Snapshot', () => {
  afterEach(() => { setStatusKatalogSnapshotMap(null); });

  it('eine Schreibweise, die nur der Snapshot kennt, wird gezählt UND gefiltert', () => {
    const daten = [
      { aktenzeichen: 'A', programm_id: 'P', status: 'Sonderfall XY', _updated_at: '2026-01-01T00:00:00Z' },
    ] as never as AntragListItem[];
    setStatusKatalogSnapshotMap(new Map<string, StatusCategory>([
      ['sonderfall xy', 'entscheidung'],
    ]));
    const gezaehlt = getPhaseItems(daten).find(i => i.label === chipLabelKurz('offen'))?.count ?? 0;
    expect(gezaehlt).toBe(1);

    let geschrieben: string[] = [];
    applyPhase(chipLabelKurz('offen'), (_id, v) => { geschrieben = v; }, () => {});
    expect(geschrieben).toContain('sonderfall xy');
  });
});
