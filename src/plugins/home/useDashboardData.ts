import { useDeferredValue, useMemo } from 'react';
import { useAntraegeStore } from '@/plugins/antraege/store';
import type { Vorgang } from '@/core/types/vorgang';
import { useProfile } from '@/core/hooks/useProfile';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { parseBearbeiterFilter, applyInaktiveExclusion } from '@/plugins/antraege/bearbeiterFilter';
import { useInaktiveKuerzelSet } from '@/plugins/auslastung/hooks/useInaktiveKuerzelSet';
import { useShowInaktiveMasStore } from '@/plugins/antraege/useShowInaktiveMasStore';
import { tfPerfStart } from '@/core/utils/tfPerf';
import {
  computeDashboardAggregate,
  type AntragVorgang,
  type DashboardStats,
} from './dashboardAggregate';

export type { AntragVorgang };

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Guten Morgen';
  if (h < 18) return 'Guten Tag';
  return 'Guten Abend';
}

export interface DashboardData {
  greeting: string;
  offeneVorgaenge: Vorgang[];
  dringend: Array<Vorgang & { daysLeft: number }>;
  naechsterSchritt: (Vorgang & { daysLeft: number }) | null;
  fristenDieseWoche: number;
  letzteAenderungen: Vorgang[];
  /** Alle offenen eigenen Förderanträge, sortiert nach Frist asc, dann
   *  vb_phase asc. UI schneidet selbst ab (Default 5 via
   *  `profile.home_meine_antraege_count`, "+10 mehr"-Button erweitert
   *  in-page). Leer wenn kein Antrag gefunden. */
  meineAntraege: AntragVorgang[];
  stats: DashboardStats;
  /** Kürzel-Filter im Profil aktiv (≠ leer / "alle"). */
  bearbeiterFilterActive: boolean;
  /** Wenn true: Filter aktiv, aber keine KUERZ-Spalte in den Antraege-Daten gefunden. */
  bearbeiterKuerzelMissing: boolean;
  /** Tokens des aktiven Bearbeiter-Filters (uppercase, getrimmt). Leer wenn inaktiv. */
  bearbeiterTokens: string[];
}

export function useDashboardData(): DashboardData {
  const antraegeRaw = useAntraegeStore(s => s.antraege);
  const verbundByIdRaw = useAntraegeStore(s => s.verbundById);
  const { profile } = useProfile();
  const meinKuerzel = useMeinKuerzel();
  // „alle"-Modus: Förderanträge inaktiver MAs ausblenden (pl/dev). Außerhalb
  // pl/dev ist das Set leer → No-op.
  const inaktiveKuerzel = useInaktiveKuerzelSet();
  const showInaktive = useShowInaktiveMasStore(s => s.showInaktive);

  // useDeferredValue puffert die kaskadierenden Store-Updates beim Home-Mount
  // (Antraege landen asynchron im Store) und berechnet die Memo mit niedriger
  // Prioritaet, sobald sich der Wert stabilisiert hat.
  const antraege = useDeferredValue(antraegeRaw);
  const verbundById = useDeferredValue(verbundByIdRaw);

  return useMemo(() => {
    const end = tfPerfStart('useDashboardData memo');
    const bearbeiterMode = parseBearbeiterFilter(
      meinKuerzel,
      profile?.bearbeiter_inkl_begleitung,
    );
    // Im „alle"-Modus die Förderanträge inaktiver MAs ausblenden (pl/dev),
    // konsistent zur Förderanträge-Liste.
    const antraegeFiltered = applyInaktiveExclusion(antraege, bearbeiterMode.active, inaktiveKuerzel, showInaktive);

    const agg = computeDashboardAggregate(antraegeFiltered, bearbeiterMode, {
      includeAntraege: true,
      verbundById,
    });

    // KUERZ-Missing nur dann melden, wenn tatsächlich Antraege im Store
    // liegen. Beim ersten Render ist `antraege === []` — `anyKuerzelSeen`
    // wäre dann falsch-negativ und würde einen falschen Warnblock erzeugen,
    // der nach 1–2 s wieder verschwindet. Erst wenn echte Daten da sind,
    // kann KUERZ "fehlen".
    const bearbeiterKuerzelMissing =
      bearbeiterMode.active
      && antraege.length > 0
      && !agg.anyKuerzelSeen;

    const result: DashboardData = {
      greeting: getGreeting(),
      offeneVorgaenge: agg.offeneVorgaenge,
      dringend: agg.dringend,
      naechsterSchritt: agg.naechsterSchritt,
      fristenDieseWoche: agg.fristenDieseWoche,
      letzteAenderungen: agg.letzteAenderungen,
      meineAntraege: agg.meineAntraege,
      stats: agg.stats,
      bearbeiterFilterActive: bearbeiterMode.active,
      bearbeiterKuerzelMissing,
      bearbeiterTokens: bearbeiterMode.tokens,
    };
    end(`antraege=${antraege.length} → total=${agg.stats.total} offen=${agg.stats.offen}`);
    return result;
  }, [antraege, verbundById, meinKuerzel, profile?.bearbeiter_inkl_begleitung, inaktiveKuerzel, showInaktive]);
}
