/**
 * Deterministische Aufbereitung der Konsolidierungs-Eingabe (REIN, LLM-frei).
 *
 * Aus den neuen Ereignissen seit Wasserzeichen (aufsteigend) + dem aktiven
 * Bestand entsteht die Eingabe für EINEN LLM-Aufruf: die JÜNGSTEN
 * MAX_EREIGNISSE_EINGABE Ereignisse im Volltext, der ältere Überhang als bloße
 * Zähl-Zusammenfassung je Typ (keine LLM-Vorverdichtung). Der `belegIndex`
 * enthält NUR die im Volltext gezeigten Ereignis-IDs — nur diese darf das Modell
 * als Beleg zitieren.
 */
import { MAX_EREIGNISSE_EINGABE } from './types';
import type { GedaechtnisEintrag } from './types';
import type { AssistentEreignis } from '../protokoll';

export interface KonsolidierungsEingabe {
  /** Jüngste ≤ MAX_EREIGNISSE_EINGABE Ereignisse (aufsteigend), im Volltext. */
  vollEreignisse: AssistentEreignis[];
  /** Zähl-Zusammenfassung des älteren Überhangs je Ereignistyp. */
  ueberhangJeTyp: Record<string, number>;
  ueberhangGesamt: number;
  /** Neues Wasserzeichen bei Erfolg = jüngster Zeitstempel ALLER neuen Ereignisse. */
  juengsterZeitstempel: number | null;
  aktiveEintraege: GedaechtnisEintrag[];
  /** Gültige Beleg-IDs = IDs der im Volltext gezeigten Ereignisse. */
  belegIndex: Set<string>;
}

/**
 * @param neueAufsteigend Neue Ereignisse seit Wasserzeichen, ältestes zuerst.
 * @param aktive Aktive Gedächtnis-Einträge aller Blocks.
 */
export function baueEingabe(
  neueAufsteigend: readonly AssistentEreignis[],
  aktive: readonly GedaechtnisEintrag[],
): KonsolidierungsEingabe {
  const juengsterZeitstempel = neueAufsteigend.length > 0
    ? neueAufsteigend[neueAufsteigend.length - 1]!.zeitstempel
    : null;

  let vollEreignisse: AssistentEreignis[] = [...neueAufsteigend];
  const ueberhangJeTyp: Record<string, number> = {};
  let ueberhangGesamt = 0;

  if (neueAufsteigend.length > MAX_EREIGNISSE_EINGABE) {
    const grenze = neueAufsteigend.length - MAX_EREIGNISSE_EINGABE;
    const ueberhang = neueAufsteigend.slice(0, grenze); // die älteren
    vollEreignisse = neueAufsteigend.slice(grenze);     // die jüngsten MAX
    for (const e of ueberhang) {
      ueberhangJeTyp[e.typ] = (ueberhangJeTyp[e.typ] ?? 0) + 1;
      ueberhangGesamt++;
    }
  }

  return {
    vollEreignisse,
    ueberhangJeTyp,
    ueberhangGesamt,
    juengsterZeitstempel,
    aktiveEintraege: [...aktive],
    belegIndex: new Set(vollEreignisse.map(e => e.id)),
  };
}
