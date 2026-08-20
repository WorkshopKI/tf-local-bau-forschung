import { useDeferredValue, useMemo, useRef } from 'react';
import { useAntraegeStore } from '@/plugins/antraege/store';
import type { Vorgang } from '@/core/types/vorgang';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { useBereich } from '@/core/hooks/useBereich';
import { useBestandsAufgaben } from '@/core/hooks/useBestandsAufgaben';
import { istImBereich } from '@/core/status/betrachtungsbereich';
import { applyInaktiveExclusion } from '@/plugins/antraege/bearbeiterFilter';
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
  /**
   * Vorgänge mit offenem Status, die laut Kürzeln erledigt sind (Schlussvermerk
   * bzw. Zuwendungsbescheid). Sie zählen nicht als offen — gemeldet werden sie
   * trotzdem: das ist ein Befund für das Fachsystem, kein Anzeigefehler.
   */
  erledigtLautKuerzeln: number;
}

export function useDashboardData(): DashboardData {
  const antraegeRaw = useAntraegeStore(s => s.antraege);
  const verbundByIdRaw = useAntraegeStore(s => s.verbundById);
  // Kürzel + Meine/Alle-Sicht in einem — dieselbe Quelle wie die
  // Förderanträge-Liste, damit beide Seiten denselben Ausschnitt meinen.
  const { mode: bearbeiterMode } = useBearbeiterSicht();
  // „alle"-Modus: Förderanträge inaktiver MAs ausblenden (pl/dev). Außerhalb
  // pl/dev ist das Set leer → No-op.
  const inaktiveKuerzel = useInaktiveKuerzelSet();
  const showInaktive = useShowInaktiveMasStore(s => s.showInaktive);

  // useDeferredValue puffert die kaskadierenden Store-Updates beim Home-Mount
  // (Antraege landen asynchron im Store) und berechnet die Memo mit niedriger
  // Prioritaet, sobald sich der Wert stabilisiert hat.
  const bereichMenge = useBereich().menge;
  const antraege = useDeferredValue(antraegeRaw);
  const verbundById = useDeferredValue(verbundByIdRaw);
  // **Was laut Kürzeln erledigt ist, zählt nicht mehr als offen** (v4.132). Der
  // amtliche Status hinkt manchmal nach: gemessen am 20.08.2026 trugen drei
  // Vorgänge einen Schlussvermerk (`D_VV`) und trotzdem einen offenen
  // `STATUS_TV` — auf der Startseite standen sie mit dreistelligem Rückstand an
  // der Spitze. Solange der Lauf nicht durch ist, ist die Menge leer und alles
  // verhält sich wie vorher.
  const heuteRef = useRef<string>(new Date().toISOString());
  const { abgeschlossen } = useBestandsAufgaben('leerlauf', heuteRef.current);

  return useMemo(() => {
    const end = tfPerfStart('useDashboardData memo');
    // Im „alle"-Modus die Förderanträge inaktiver MAs ausblenden (pl/dev),
    // konsistent zur Förderanträge-Liste.
    const antraegeFiltered = applyInaktiveExclusion(antraege, bearbeiterMode.active, inaktiveKuerzel, showInaktive);
    // Betrachtungsbereich: die Startseite zeigt Arbeitsvorrat, also gilt er hier
    // wie in der Liste. Ohne ihn nennte das Dashboard Zahlen, die im
    // Förderanträge-Tab darunter nie erscheinen.
    const imBereich = bereichMenge === null
      ? antraegeFiltered
      : antraegeFiltered.filter(a => istImBereich(a.unterprogramm_id, bereichMenge));

    const agg = computeDashboardAggregate(imBereich, bearbeiterMode, {
      includeAntraege: true,
      verbundById,
      gesperrt: abgeschlossen,
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
      erledigtLautKuerzeln: agg.erledigtLautKuerzeln,
    };
    end(`antraege=${antraege.length} → total=${agg.stats.total} offen=${agg.stats.offen}`);
    return result;
  }, [antraege, verbundById, bearbeiterMode, inaktiveKuerzel, showInaktive, bereichMenge, abgeschlossen]);
}
