/**
 * Verbund-Gruppierung für die Homepage-Sektion „Neue Anträge für dich".
 *
 * Fachlich übernimmt ein Bearbeiter immer den GANZEN Verbund, nie einzelne
 * Teilvorhaben (TVs). Die per-TV-`OffenerAntrag`-Liste (alle TVs eines
 * freigegebenen Verbundes teilen Klassifizierung + Frist) wird deshalb zu
 * EINER Zeile pro Verbund gebündelt. Solo-Anträge (kein `verbund_id`) bleiben
 * 1er-Gruppen.
 *
 * Pure + testbar. Reuse der etablierten Verbund-Helfer (`verbundKeyOf`,
 * `resolveVerbundMeta`) aus dem Auslastungs-Modul + `formatFkzRange` aus dem
 * Anträge-Plugin — keine eigene Gruppierungs-Semantik.
 */
import type { AntragOderSlim, Verbund } from '@/core/services/csv/types';
import { CANONICAL_TITEL, type Klassifizierung } from '@/plugins/auslastung/types';
import {
  verbundKeyOf,
  resolveVerbundMeta,
} from '@/plugins/auslastung/services/verbund';
import { formatFkzRange } from '@/plugins/antraege/antragGroups';

/** Ein offener (freigegebener, für den User passender) Teilvorhaben-Eintrag.
 *  Früher inline in NeueAntraegeFuerDich.tsx — hierher gezogen, damit die
 *  Gruppierung testbar ist. */
export interface OffenerAntrag {
  antrag: AntragOderSlim;
  klassifizierung: Klassifizierung;
  daysLeft: number;
  /** T_XSW enthält das EIGENE Kürzel des Users → „mein alter Antrag" → nach oben. */
  xswMine: boolean;
  /** Vom User vorgemerkt ODER bereits von der PL eingesammelt (Pending). */
  claimed: boolean;
}

/** Ein TV für den „N TV"-Badge-Tooltip. */
export interface VerbundTvInfo {
  aktenzeichen: string;
  titel: string;
}

/** Eine Zeile = ein Verbund (oder ein Solo-Antrag als 1er-Verbund). */
export interface VerbundEintrag {
  /** verbund_id, sonst aktenzeichen (Solo). Stabiler React-Key. */
  verbundId: string;
  /** Claim-Ziel: erster (FKZ-kleinster) der für den User offenen TVs.
   *  `handleClaim` leitet daraus verbund_id + echte TV-Anzahl ab. */
  leadAktenzeichen: string;
  /** Lead-Antrag (Slim reicht — XswSuffix liest t_xsw) . */
  leadAntrag: AntragOderSlim;
  akronym: string;
  verbundTitel: string;
  /** „16KN126325–126326" bzw. einzelnes FKZ. Über ALLE TVs des Verbundes. */
  fkzRange: string;
  /** Geteilte Klassifizierung (vom Lead) — alle TVs identisch. */
  klassifizierung: Klassifizierung;
  /** Kleinste verbleibende Frist der Gruppe (TVs teilen freigegebenAm). */
  daysLeft: number;
  xswMine: boolean;
  claimed: boolean;
  /** Echte Verbund-Größe (alle TVs, nicht nur die offenen). */
  tvCount: number;
  /** Alle TVs des Verbundes (FKZ + Titel) — speist den Badge-Tooltip. */
  alleTvs: VerbundTvInfo[];
  /** Aktuell vorgemerkte TVs (lokaler Wunsch ODER PL-Pending, ohne bereits
   *  zurueckgenommene) — Ziel-Liste für „Rückgängig". */
  claimedAktenzeichen: string[];
}

function readTitel(a: AntragOderSlim): string {
  const v = (a as Record<string, unknown>)[CANONICAL_TITEL];
  return typeof v === 'string' ? v : '';
}

/**
 * Ist dieses Aktenzeichen für den User „vorgemerkt"? Vorgemerkt = lokaler Wunsch
 * (`claimedSet`) ODER bereits von der PL eingesammelte `selbst`-Zuweisung
 * (`pendingSet`) — ABER nicht, wenn der User die Vormerkung gerade lokal
 * zurueckgenommen hat (`retractedSet`, Optimistic-Overlay; das geteilte
 * `auslastung.json` ist read-only, daher die UI-seitige Unterdrueckung).
 * Single Source of Truth für die per-TV- UND die Verbund-Sicht.
 */
export function isClaimed(
  aktenzeichen: string,
  claimedSet: ReadonlySet<string>,
  pendingSet: ReadonlySet<string>,
  retractedSet: ReadonlySet<string>,
): boolean {
  if (retractedSet.has(aktenzeichen)) return false;
  return claimedSet.has(aktenzeichen) || pendingSet.has(aktenzeichen);
}

function byFkz(a: { aktenzeichen: string }, b: { aktenzeichen: string }): number {
  return a.aktenzeichen.localeCompare(b.aktenzeichen, 'de');
}

/**
 * Bündelt die per-TV-`OffenerAntrag`-Liste zu einer Liste pro Verbund.
 * Reihenfolge: vorgemerkte ans Ende; offene: eigene Wiedereinreicher zuerst,
 * dann Frist aufsteigend; Tiebreak Akronym — analog der per-TV-Sortierung.
 */
export function groupEintraegeByVerbund(
  eintraege: readonly OffenerAntrag[],
  cacheAntraege: ReadonlyArray<AntragOderSlim>,
  verbuendeById: ReadonlyMap<string, Verbund>,
  claimedSet: ReadonlySet<string>,
  pendingSet: ReadonlySet<string> = new Set(),
  retractedSet: ReadonlySet<string> = new Set(),
): VerbundEintrag[] {
  // Alle TVs pro Verbund-Key (für fkzRange, tvCount, Tooltip). O(n) einmal.
  const tvsByKey = new Map<string, AntragOderSlim[]>();
  for (const a of cacheAntraege) {
    const key = verbundKeyOf(a);
    let b = tvsByKey.get(key);
    if (!b) { b = []; tvsByKey.set(key, b); }
    b.push(a);
  }

  // Offene Einträge nach Verbund-Key bündeln, First-Seen-Order merken.
  const buckets = new Map<string, OffenerAntrag[]>();
  const order: string[] = [];
  for (const e of eintraege) {
    const key = verbundKeyOf(e.antrag);
    let b = buckets.get(key);
    if (!b) { b = []; buckets.set(key, b); order.push(key); }
    b.push(e);
  }

  const out: VerbundEintrag[] = [];
  for (const key of order) {
    const group = buckets.get(key)!;
    group.sort((a, b) => byFkz(a.antrag, b.antrag));
    const lead = group[0]!;
    const { akronym, verbundTitel } = resolveVerbundMeta(verbuendeById.get(key), lead.antrag);
    // Vollständige TV-Liste des Verbundes (Fallback: die offenen TVs, falls der
    // Cache den Verbund nicht kennt — sollte praktisch nicht vorkommen).
    const fullTvs = (tvsByKey.get(key) ?? group.map(g => g.antrag)).slice().sort(byFkz);
    out.push({
      verbundId: key,
      leadAktenzeichen: lead.antrag.aktenzeichen,
      leadAntrag: lead.antrag,
      akronym,
      verbundTitel,
      fkzRange: formatFkzRange(fullTvs),
      klassifizierung: lead.klassifizierung,
      daysLeft: Math.min(...group.map(g => g.daysLeft)),
      xswMine: group.some(g => g.xswMine),
      claimed: group.some(g => g.claimed),
      tvCount: fullTvs.length,
      alleTvs: fullTvs.map(a => ({ aktenzeichen: a.aktenzeichen, titel: readTitel(a) })),
      claimedAktenzeichen: group
        .filter(g => isClaimed(g.antrag.aktenzeichen, claimedSet, pendingSet, retractedSet))
        .map(g => g.antrag.aktenzeichen),
    });
  }

  // Verbund-Level-Sortierung — spiegelt die frühere per-TV-Sortierung.
  out.sort((a, b) => {
    if (a.claimed !== b.claimed) return a.claimed ? 1 : -1;
    if (!a.claimed) {
      if (a.xswMine !== b.xswMine) return a.xswMine ? -1 : 1;
      if (a.daysLeft !== b.daysLeft) return a.daysLeft - b.daysLeft;
    }
    return (a.akronym || a.leadAktenzeichen).localeCompare(b.akronym || b.leadAktenzeichen);
  });

  return out;
}
