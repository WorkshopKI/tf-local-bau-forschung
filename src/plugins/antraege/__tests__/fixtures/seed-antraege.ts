/**
 * Fixture A — Bauantrag-artig: Antraege mit Snake-Case-Status-Werten aus
 * dem Bauantrag-Workflow (`neu`, `in_pruefung`, `genehmigt`, `abgelehnt`, ...).
 *
 * Spiegelt den Daten-Pfad der ehemaligen Pre-v2-Seeds. Jedes Item ist mit
 * Inline-Kommentar dokumentiert, in welche View(s) es fallen sollte. Alle
 * relativen Datums-Werte sind gegen `TEST_TODAY = 2026-05-12` ausgerichtet.
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

export const SEED_ANTRAEGE: readonly AntragListItem[] = [
  // 1 — offen, ≤30d (gruen), frist in 5d (diese_woche_faellig)
  mk({
    aktenzeichen: 'SEED-001', status: 'eingereicht', vb_phase: 1,
    antragsdatum: '2026-04-20', frist_datum: '2026-05-17',
  }),
  // 2 — in_pruefung, 41d (gelb), frist far future
  mk({
    aktenzeichen: 'SEED-002', status: 'in_pruefung', vb_phase: 2,
    antragsdatum: '2026-04-01', frist_datum: '2026-12-01',
  }),
  // 3 — in_begutachtung, 72d (orange), frist ueberfaellig (offen + ueberfaellig)
  mk({
    aktenzeichen: 'SEED-003', status: 'in_begutachtung', vb_phase: 3,
    antragsdatum: '2026-03-01', frist_datum: '2026-04-01',
  }),
  // 4 — in_bearbeitung, 131d (rot), frist far future
  mk({
    aktenzeichen: 'SEED-004', status: 'in_bearbeitung', vb_phase: 3,
    antragsdatum: '2026-01-01', frist_datum: '2026-09-01',
  }),
  // 5 — nachforderung, 25d (gruen), frist ueberfaellig
  mk({
    aktenzeichen: 'SEED-005', status: 'nachforderung', vb_phase: 3,
    antragsdatum: '2026-04-17', frist_datum: '2026-04-01',
  }),
  // 6 — nachbesserung, 87d (orange), SLA-Risiko diese Woche (rot bei >90)
  mk({
    aktenzeichen: 'SEED-006', status: 'nachbesserung', vb_phase: 4,
    antragsdatum: '2026-02-14', frist_datum: '2026-05-15',
  }),
  // 7 — bewilligt, in current year (bewilligt_jahr)
  mk({
    aktenzeichen: 'SEED-007', status: 'bewilligt', vb_phase: 3,
    antragsdatum: '2025-12-01', bewilligung_datum: '2026-03-15',
  }),
  // 8 — genehmigt (Bauantrag-Equivalent zu Foerderantrag-`bewilligt`), in current year
  mk({
    aktenzeichen: 'SEED-008', status: 'genehmigt', vb_phase: 4,
    antragsdatum: '2025-11-15', bewilligung_datum: '2026-02-01',
  }),
  // 9 — bewilligt, vergangenes Jahr (NICHT bewilligt_jahr)
  mk({
    aktenzeichen: 'SEED-009', status: 'bewilligt', vb_phase: 3,
    antragsdatum: '2024-08-01', bewilligung_datum: '2024-12-01',
  }),
  // 10 — abgelehnt, kein bewilligung_datum, antragsdatum alt → KEINE Ampel
  //      (isClosedStatus → isOpenStatus=false → Ampel null)
  mk({
    aktenzeichen: 'SEED-010', status: 'abgelehnt', vb_phase: 3,
    antragsdatum: '2026-02-01',
  }),
  // 11 — archiviert, mit bewilligung_datum
  mk({
    aktenzeichen: 'SEED-011', status: 'archiviert', vb_phase: 4,
    antragsdatum: '2025-06-01', bewilligung_datum: '2025-12-01',
  }),
  // 12 — abgeschlossen, mit bewilligung_datum
  mk({
    aktenzeichen: 'SEED-012', status: 'abgeschlossen', vb_phase: 5,
    antragsdatum: '2025-09-01', bewilligung_datum: '2026-01-15',
  }),
  // 13 — vb_phase=9 (Irrläufer), Status offen
  mk({
    aktenzeichen: 'SEED-013', status: 'eingereicht', vb_phase: 9,
    antragsdatum: '2026-04-20',
  }),
  // 14 — vb_phase=9 (Irrläufer), Status offen
  mk({
    aktenzeichen: 'SEED-014', status: 'in_pruefung', vb_phase: 9,
    antragsdatum: '2026-04-01',
  }),
  // 15 — "neu" (Bauantrag offen), 10d (gruen)
  mk({
    aktenzeichen: 'SEED-015', status: 'neu', vb_phase: 1,
    antragsdatum: '2026-05-02',
  }),
  // 16 — eingereicht, mit tib_kuerz='ABC' (für Bearbeiter-Filter), 5d
  mk({
    aktenzeichen: 'SEED-016', status: 'eingereicht', vb_phase: 2,
    antragsdatum: '2026-05-07', tib_kuerz: 'abc',
  }),
  // 17 — in_pruefung, mit bib_kuerz='XYZ' (für Bearbeiter-Filter), 20d
  mk({
    aktenzeichen: 'SEED-017', status: 'in_pruefung', vb_phase: 2,
    antragsdatum: '2026-04-22', bib_kuerz: 'xyz',
  }),
  // 18 — bewilligt, tib_kuerz='ABC', bewilligt_jahr 2026
  mk({
    aktenzeichen: 'SEED-018', status: 'bewilligt', vb_phase: 3,
    antragsdatum: '2025-10-01', bewilligung_datum: '2026-04-10', tib_kuerz: 'abc',
  }),
  // 19 — offen, KEIN antragsdatum (Ampel null)
  mk({
    aktenzeichen: 'SEED-019', status: 'eingereicht', vb_phase: 1,
  }),
  // 20 — offen, INVALID antragsdatum (Ampel null)
  mk({
    aktenzeichen: 'SEED-020', status: 'eingereicht', vb_phase: 1,
    antragsdatum: 'irgendwas-kein-datum',
  }),
];
