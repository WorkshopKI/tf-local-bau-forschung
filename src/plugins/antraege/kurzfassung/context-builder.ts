/**
 * Baut den `KurzfassungContext` aus Verbund + lead-first sortierten TVs — EINE
 * Quelle → kein zweiter Prompt-Pfad zwischen Einzellauf und Batch. `headerId` =
 * Verbund-ID bzw. echtes Aktenzeichen bei Solo/pseudo. Strukturelle Param-Typen,
 * damit sowohl `Antrag` als auch `AntragListItem` (beide haben `aktenzeichen` +
 * die Display-Felder) passen.
 *
 * Hinweis: Der Projekt-`titel` bevorzugt hier bewusst das Lead-TV-Thema (THEMA_AD)
 * vor `verbund_titel` (Begründung unten) — das weicht von der reinen Header-Anzeige
 * in VerbundDetail ab, die den Verbund-Titel zuerst nimmt.
 */
import type { KurzfassungContext } from './types';

interface VerbundLike {
  akronym?: unknown;
  titel?: unknown;
}
interface TvLike {
  aktenzeichen: string;
  akronym?: unknown;
  titel?: unknown;
  antragsteller?: unknown;
}

function strOrNull(v: unknown): string | null {
  const s = typeof v === 'string' ? v.trim() : '';
  return s.length > 0 ? s : null;
}

export function buildKurzfassungContext(
  verbund: VerbundLike | null,
  antraege: TvLike[],
  headerId: string,
  /** Letzter Akronym-Fallback (VerbundDetail nutzt `verbund.verbund_id`; Batch `headerId`). */
  akronymFallback: string = headerId,
): KurzfassungContext {
  const lead = antraege[0];
  const akronym = strOrNull(verbund?.akronym) ?? strOrNull(lead?.akronym) ?? akronymFallback;
  // Projekt-Titel: das Lead-TV-Thema (THEMA_AD → tv.titel) hat Vorrang vor dem
  // Verbund-Titel (VB_TITEL). VB_TITEL ist in Verbünden ohne Projektbeschreibungs-
  // Enrichment oft ein generischer Platzhalter („Muster VB Titel N"), während THEMA_AD
  // das echte Vorhaben-Thema trägt — so bekommt das LLM (Kurzfassung/Gutachten-Stammdaten)
  // den aussagekräftigen Titel. `verbund.titel` bleibt Fallback, wenn der Lead-TV keinen
  // Titel führt. Das Akronym behält bewusst Verbund-Vorrang (stabiler Kurzname).
  const titel = strOrNull(lead?.titel) ?? strOrNull(verbund?.titel);
  const antragsteller = strOrNull(lead?.antragsteller);
  return {
    key: headerId,
    akronym,
    titel,
    antragsteller,
    foerderkennzeichen: headerId,
    knownIds: [headerId, ...antraege.map(a => a.aktenzeichen)],
    teilvorhaben: antraege.map((tv, idx) => ({
      nr: idx + 1,
      aktenzeichen: tv.aktenzeichen,
      titel: strOrNull(tv.titel),
      antragsteller: strOrNull(tv.antragsteller),
    })),
  };
}
