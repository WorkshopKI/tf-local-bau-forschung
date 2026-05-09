import { useDeferredValue, useMemo } from 'react';
import { useBauantraegeStore } from '@/plugins/bauantraege/store';
import { useAntraegeStore } from '@/plugins/antraege/store';
import type { Vorgang } from '@/core/types/vorgang';
import type { Antrag } from '@/core/services/csv/types';
import { useProfile } from '@/core/hooks/useProfile';
import {
  parseBearbeiterFilter,
  antragMatchesBearbeiter,
} from '@/plugins/antraege/bearbeiterFilter';
import { tfPerfStart } from '@/core/utils/tfPerf';

const KUERZ_KEYS_CANONICAL: readonly string[] = [
  'tib_kuerz', 'bib_kuerz', 'ztp_kuerz', 'pfm_kuerz',
];
const KUERZ_KEYS_CANONICAL_SET: ReadonlySet<string> = new Set(KUERZ_KEYS_CANONICAL);

/** Inline-Variante von hasAnyKuerzelData(single-record). Spart eine separate
 *  Full-Scan-Pass über die Antrag-Liste — wir checken im Aggregations-Loop
 *  parallel, ob irgendein Antrag eine der KUERZ-Spalten gesetzt hat. */
function antragHasAnyKuerzel(antrag: Antrag): boolean {
  const rec = antrag as Record<string, unknown>;
  for (const k of KUERZ_KEYS_CANONICAL) {
    const v = rec[k];
    if (typeof v === 'string' && v.trim().length > 0) return true;
  }
  for (const key in rec) {
    if (KUERZ_KEYS_CANONICAL_SET.has(key)) continue;
    const lk = key.toLowerCase();
    if (lk === key) continue;
    if (!KUERZ_KEYS_CANONICAL_SET.has(lk)) continue;
    const v = rec[key];
    if (typeof v === 'string' && v.trim().length > 0) return true;
  }
  return false;
}

const CLOSED = new Set(['genehmigt', 'abgelehnt', 'archiviert', 'bewilligt', 'abgeschlossen']);

function daysUntil(dateStr?: string): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

/** Minimal-Projektion eines Antrags auf eine Vorgang-aehnliche Shape. */
function antragToVorgangLike(a: Antrag): Vorgang & { _isAntrag: true } {
  const tags = Array.isArray(a.tags) ? (a.tags as string[]) : [];
  const notes = typeof a.notes === 'string' ? a.notes : '';
  const priority = (a.priority as Vorgang['priority']) ?? 'normal';
  const deadline = typeof a.frist_datum === 'string' ? a.frist_datum : undefined;
  const created = typeof a.antragsdatum === 'string' ? a.antragsdatum : a._updated_at;
  return {
    id: a.aktenzeichen,
    type: 'bauantrag', // Projektion: Antraege werden im Dashboard wie Vorgaenge behandelt.
    title: a.titel ?? a.aktenzeichen,
    status: (a.status as Vorgang['status']) ?? 'neu',
    priority,
    assignee: a.antragsteller ?? '',
    created,
    modified: a._updated_at,
    deadline,
    tags,
    notes,
    _isAntrag: true,
  };
}

export interface DashboardData {
  greeting: string;
  offeneVorgaenge: Vorgang[];
  dringend: Array<Vorgang & { daysLeft: number }>;
  naechsterSchritt: (Vorgang & { daysLeft: number }) | null;
  fristenDieseWoche: number;
  letzteAenderungen: Vorgang[];
  stats: { total: number; offen: number; inPruefung: number; nachforderung: number; genehmigt: number };
  /** Kürzel-Filter im Profil aktiv (≠ leer / "alle"). */
  bearbeiterFilterActive: boolean;
  /** Wenn true: Filter aktiv, aber keine KUERZ-Spalte in den Antraege-Daten gefunden. */
  bearbeiterKuerzelMissing: boolean;
  /** Tokens des aktiven Bearbeiter-Filters (uppercase, getrimmt). Leer wenn inaktiv. */
  bearbeiterTokens: string[];
}

export function useDashboardData(department: 'antraege' | 'bauantraege' | 'beide' = 'beide'): DashboardData {
  const bauantraegeRaw = useBauantraegeStore(s => s.bauantraege);
  const antraegeRaw = useAntraegeStore(s => s.antraege);
  const { profile } = useProfile();

  // useDeferredValue puffert die kaskadierenden Store-Updates beim
  // Home-Mount: zuerst landet `antraege` im Store, kurz darauf
  // `bauantraege` (Promise.all in HomePage). Ohne Deferral lief das
  // useMemo dazwischen 2-3x; mit Deferral berechnet React die Memo erst
  // wenn beide Werte stabilisiert sind und mit niedriger Prioritaet.
  const antraege = useDeferredValue(antraegeRaw);
  const bauantraege = useDeferredValue(bauantraegeRaw);

  return useMemo(() => {
    const end = tfPerfStart('useDashboardData memo');
    const bearbeiterMode = parseBearbeiterFilter(
      profile?.bearbeiter_kuerzel,
      profile?.bearbeiter_inkl_begleitung,
    );
    const includeBauantraege = department !== 'antraege';
    const includeAntraege = department !== 'bauantraege';

    // Single-Pass-Aggregation: ein Loop über bauantraege + ein Loop über
    // antraege berechnet alle Counter und akkumuliert nur die Kandidaten,
    // die anschließend sortiert werden — keine Zwischen-Arrays für jede
    // Pipeline-Stufe (filter→map→filter→map→filter→sort). Das spart bei
    // 13k+ Records dramatisch GC-Druck und ~6 Full-Array-Allokationen.
    let total = 0;
    let offen = 0;
    let inPruefung = 0;
    let nachforderung = 0;
    let genehmigt = 0;
    let anyKuerzelSeen = false;
    const offeneVorgaenge: Vorgang[] = [];
    const fristKandidaten: Array<Vorgang & { daysLeft: number }> = [];

    if (includeBauantraege) {
      for (const v of bauantraege) {
        total++;
        const status = v.status as string;
        if (status === 'in_pruefung' || status === 'in_begutachtung') inPruefung++;
        else if (status === 'nachforderung' || status === 'nachbesserung') nachforderung++;
        else if (status === 'genehmigt' || status === 'bewilligt') genehmigt++;
        if (CLOSED.has(status)) continue;
        offen++;
        offeneVorgaenge.push(v);
        const dl = daysUntil(v.deadline);
        if (dl !== null) fristKandidaten.push({ ...v, daysLeft: dl });
      }
    }

    if (includeAntraege) {
      for (const a of antraege) {
        // KUERZ-Detection läuft VOR dem Bearbeiter-Filter, damit der
        // UX-Hint ("KUERZ-Spalten fehlen") auch dann korrekt ist, wenn
        // der Filter alle Records ausblendet.
        if (!anyKuerzelSeen && antragHasAnyKuerzel(a)) anyKuerzelSeen = true;
        if (bearbeiterMode.active && !antragMatchesBearbeiter(a, bearbeiterMode)) continue;
        const v = antragToVorgangLike(a);
        total++;
        const status = v.status as string;
        if (status === 'in_pruefung' || status === 'in_begutachtung') inPruefung++;
        else if (status === 'nachforderung' || status === 'nachbesserung') nachforderung++;
        else if (status === 'genehmigt' || status === 'bewilligt') genehmigt++;
        if (CLOSED.has(status)) continue;
        offen++;
        offeneVorgaenge.push(v);
        const dl = daysUntil(v.deadline);
        if (dl !== null) fristKandidaten.push({ ...v, daysLeft: dl });
      }
    }

    // Sortierungen am Ende — auf den schon kleineren Akkumulator-Arrays.
    fristKandidaten.sort((x, y) => x.daysLeft - y.daysLeft);
    const dringend = fristKandidaten.filter(v => v.daysLeft <= 7);
    const naechster = fristKandidaten[0] ?? null;
    let fristenDieseWoche = 0;
    for (const v of fristKandidaten) {
      if (v.daysLeft >= 0 && v.daysLeft <= 7) fristenDieseWoche++;
    }

    // letzteAenderungen: top-8 aus den offenen — sort über offeneVorgaenge,
    // nicht über die Vollmenge `alle` wie früher.
    const letzteAenderungen = [...offeneVorgaenge]
      .sort((a, b) => b.modified.localeCompare(a.modified))
      .slice(0, 8);

    // KUERZ-Missing nur dann melden, wenn tatsächlich Antraege im Store
    // liegen. Beim ersten Render ist `antraege === []` — `anyKuerzelSeen`
    // wäre dann falsch-negativ und würde einen falschen Warnblock erzeugen,
    // der nach 1–2 s wieder verschwindet. Erst wenn echte Daten da sind,
    // kann KUERZ "fehlen".
    const bearbeiterKuerzelMissing =
      bearbeiterMode.active
      && includeAntraege
      && antraege.length > 0
      && !anyKuerzelSeen;

    const result = {
      greeting: getGreeting(),
      offeneVorgaenge,
      dringend,
      naechsterSchritt: naechster,
      fristenDieseWoche,
      letzteAenderungen,
      stats: { total, offen, inPruefung, nachforderung, genehmigt },
      bearbeiterFilterActive: bearbeiterMode.active,
      bearbeiterKuerzelMissing,
      bearbeiterTokens: bearbeiterMode.tokens,
    };
    end(`antraege=${antraege.length} bauantraege=${bauantraege.length} → total=${total} offen=${offen}`);
    return result;
  }, [bauantraege, antraege, department, profile?.bearbeiter_kuerzel, profile?.bearbeiter_inkl_begleitung]);
}
