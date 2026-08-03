/**
 * Antraege mit CSV-Rohwerten aus dem echten Foyer-Quellsystem — die
 * **einzige** Antrags-Fixture der View-/Dashboard-Tests.
 *
 * Sie spiegelt den Produktiv-Pfad. Bis v2.395 lief daneben eine zweite
 * Fixture mit Snake-Case-Werten der Bauantrag-Demo; beide gingen `describe.each`
 * gegen dieselben Erwartungen, damit Domaenen-Abhaengigkeiten auffliegen.
 * Mit dem Wegfall der zweiten Domaene entfaellt auch dieser Doppellauf.
 *
 * Jedes Item ist mit Inline-Kommentar dokumentiert, in welche View(s) es fallen
 * soll. Alle relativen Datums-Werte sind gegen `TEST_TODAY` ausgerichtet.
 */
import type { AntragListItem } from '@/core/services/csv/types';
import { asAntragStatusRaw } from '@/core/services/csv/types';

export const TEST_TODAY = '2026-05-12';
export const TEST_TODAY_MS = new Date(TEST_TODAY).getTime();

type Partial0 = Partial<Omit<AntragListItem, 'status'>> & {
  aktenzeichen: string;
  status: string;
};

function mk(p: Partial0): AntragListItem {
  const { status, ...rest } = p;
  return {
    programm_id: 'TEST-PROG',
    titel: `Titel ${p.aktenzeichen}`,
    _updated_at: '2026-05-01T08:00:00Z',
    ...rest,
    status: asAntragStatusRaw(status),
  };
}

export const REAL_CSV_ANTRAEGE: readonly AntragListItem[] = [
  // 1 — offen, ≤30d (gruen), frist in 5d (diese_woche_faellig)
  mk({
    aktenzeichen: 'REAL-001', status: 'beantragt', vb_phase: 1,
    antragsdatum: '2026-04-20', frist_datum: '2026-05-17',
  }),
  // 2 — in_pruefung, 41d (gelb), frist far future
  mk({
    aktenzeichen: 'REAL-002', status: 'VN geprüft', vb_phase: 2,
    antragsdatum: '2026-04-01', frist_datum: '2026-12-01',
  }),
  // 3 — in_pruefung (techn geprueft), 72d (orange), ueberfaellig
  mk({
    aktenzeichen: 'REAL-003', status: 'techn geprüft', vb_phase: 3,
    antragsdatum: '2026-03-01', frist_datum: '2026-04-01',
  }),
  // 4 — in_pruefung (kaufm), 131d (rot), frist far future
  mk({
    aktenzeichen: 'REAL-004', status: 'kaufm geprüft', vb_phase: 3,
    antragsdatum: '2026-01-01', frist_datum: '2026-09-01',
  }),
  // 5 — nachforderung, 25d (gruen), ueberfaellig
  mk({
    aktenzeichen: 'REAL-005', status: 'NF gestellt', vb_phase: 3,
    antragsdatum: '2026-04-17', frist_datum: '2026-04-01',
  }),
  // 6 — nachforderung, 87d (orange), SLA-Risiko diese Woche (rot bei >90)
  mk({
    aktenzeichen: 'REAL-006', status: 'NF gestellt', vb_phase: 4,
    antragsdatum: '2026-02-14', frist_datum: '2026-05-15',
  }),
  // 7 — bewilligt, in current year (bewilligt_jahr)
  mk({
    aktenzeichen: 'REAL-007', status: 'bewilligt', vb_phase: 3,
    antragsdatum: '2025-12-01', bewilligung_datum: '2026-03-15',
  }),
  // 8 — bewilligt, in current year (bewilligt_jahr)
  mk({
    aktenzeichen: 'REAL-008', status: 'bewilligt', vb_phase: 4,
    antragsdatum: '2025-11-15', bewilligung_datum: '2026-02-01',
  }),
  // 9 — bewilligt, vergangenes Jahr (NICHT bewilligt_jahr)
  mk({
    aktenzeichen: 'REAL-009', status: 'bewilligt', vb_phase: 3,
    antragsdatum: '2024-08-01', bewilligung_datum: '2024-12-01',
  }),
  // 10 — Schlussvermerk (abgeschlossen, final-closed) ohne bewilligung_datum
  // → Ampel null via Status-Check (nicht via Datum-Check).
  // Hinweis: Foerderantraege haben keinen final-`abgelehnt`-Endzustand;
  // negative Verfahren laufen via `Ablehnung`/`Widerruf` (Kategorie
  // `entscheidung`, noch offen!) und finalisieren via
  // `abgelehnt/zurueckgezogen` (Kategorie `abgeschlossen`).
  mk({
    aktenzeichen: 'REAL-010', status: 'Schlussvermerk', vb_phase: 3,
    antragsdatum: '2026-02-01',
  }),
  // 11 — Schlussvermerk (abgeschlossen)
  mk({
    aktenzeichen: 'REAL-011', status: 'Schlussvermerk', vb_phase: 4,
    antragsdatum: '2025-06-01', bewilligung_datum: '2025-12-01',
  }),
  // 12 — abgelehnt/zurueckgezogen (abgeschlossen)
  mk({
    aktenzeichen: 'REAL-012', status: 'abgelehnt/zurückgezogen', vb_phase: 5,
    antragsdatum: '2025-09-01', bewilligung_datum: '2026-01-15',
  }),
  // 13 — vb_phase=9 (Irrlaeufer), offen
  mk({
    aktenzeichen: 'REAL-013', status: 'beantragt', vb_phase: 9,
    antragsdatum: '2026-04-20',
  }),
  // 14 — vb_phase=9 (Irrlaeufer), in_pruefung
  mk({
    aktenzeichen: 'REAL-014', status: 'VN geprüft', vb_phase: 9,
    antragsdatum: '2026-04-01',
  }),
  // 15 — bearbeitungsreif (offen), 10d (gruen)
  mk({
    aktenzeichen: 'REAL-015', status: 'bearbeitungsreif', vb_phase: 1,
    antragsdatum: '2026-05-02',
  }),
  // 16 — beantragt, mit tib_kuerz='ABC', 5d
  mk({
    aktenzeichen: 'REAL-016', status: 'beantragt', vb_phase: 2,
    antragsdatum: '2026-05-07', tib_kuerz: 'abc',
  }),
  // 17 — VN geprueft, mit bib_kuerz='XYZ', 20d
  mk({
    aktenzeichen: 'REAL-017', status: 'VN geprüft', vb_phase: 2,
    antragsdatum: '2026-04-22', bib_kuerz: 'xyz',
  }),
  // 18 — bewilligt, tib_kuerz='ABC', bewilligt_jahr 2026
  mk({
    aktenzeichen: 'REAL-018', status: 'bewilligt', vb_phase: 3,
    antragsdatum: '2025-10-01', bewilligung_datum: '2026-04-10', tib_kuerz: 'abc',
  }),
  // 19 — offen, KEIN antragsdatum
  mk({
    aktenzeichen: 'REAL-019', status: 'beantragt', vb_phase: 1,
  }),
  // 20 — offen, INVALID antragsdatum (Ampel null) — parallel zu SEED-020
  mk({
    aktenzeichen: 'REAL-020', status: 'beantragt', vb_phase: 1,
    antragsdatum: 'irgendwas-kein-datum',
  }),
];
