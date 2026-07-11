/**
 * Memory-Poisoning-Abwehr (deterministisch, rein).
 *
 * Ereignisinhalte — insbesondere Suchanfragen — sind Daten, nie Anweisungen.
 * Der Konsolidierungs-Prompt sagt das explizit; DIESER Guard ist die
 * Code-Rückversicherung: ein vom LLM vorgeschlagener Eintrags-Text, der
 * imperativisch/instruktiv geformt ist (Aufforderungs-/Injection-Muster) oder
 * Format-/Längengrenzen reißt, wird VERWORFEN und im Lauf-Protokoll vermerkt.
 *
 * Bewusst konservativ: normale deutsche Faktensätze („Arbeitet seit Juni an
 * Verbund X.", „Bevorzugt den Skill Kurzfassung.") dürfen NICHT fälschlich
 * greifen. Deutsche Alltagswörter wie „immer"/„nie" sind daher NICHT gelistet;
 * getroffen werden klare Instruktions-/Injection-Marker (überwiegend englische
 * Direktiven, die in einem deutschen Faktensatz nichts zu suchen haben) und
 * strukturelle Prompt-Injection-Artefakte.
 */

import { MAX_TEXT_LEN } from './types';

/** Instruktions-/Injection-Muster (case-insensitive). */
const VERDAECHTIGE_MUSTER: readonly RegExp[] = [
  // Imperative „vergiss/ignoriere"-Direktiven (DE + EN)
  /\bignorier/i,
  /\bignore\b/i,
  /\bvergiss\b/i,
  /\bdisregard\b/i,
  /\boverride\b/i,
  // „du sollst/musst …" / „you must/should …"
  /\bdu (sollst|musst|darfst|wirst)\b/i,
  /\byou (are|must|should|shall|will|need to)\b/i,
  // Englische always/never-Direktiven (in DE-Faktensätzen unerwartet)
  /\balways\b/i,
  /\bnever\b/i,
  // Rollen-/System-Prompt-Adressierung
  /\bsystem[-\s]?prompt\b/i,
  /\bals (ki|ai|assistent|modell|system)\b/i,
  /\b(system|assistant|user)\s*:/i,
  // Strukturelle Injection-Marker
  /```/,
  /<\|/,
  /\[\/?inst\]/i,
  /<\/?(system|instruction|prompt)\b/i,
];

/** Ergebnis der Verdachts-Prüfung. */
export interface VerdachtsErgebnis {
  verdaechtig: boolean;
  grund?: string;
}

/**
 * Prüft einen Eintrags-Text auf Poisoning-/Instruktions-Verdacht.
 * Rein & synchron. Längen-/Leer-Prüfung macht die Operations-Validierung; hier
 * greift zusätzlich ein harter Längen-Deckel als Format-Reißer.
 */
export function istVerdaechtig(text: string): VerdachtsErgebnis {
  const t = text.trim();
  if (t.length === 0) return { verdaechtig: true, grund: 'leerer Text' };
  if (t.length > MAX_TEXT_LEN) {
    return { verdaechtig: true, grund: `Text über ${MAX_TEXT_LEN} Zeichen` };
  }
  // Mehrzeilige „Textwände" sind für einen Faktensatz untypisch → Format-Reißer.
  if ((t.match(/\n/g)?.length ?? 0) >= 2) {
    return { verdaechtig: true, grund: 'mehrzeiliger Text (kein Faktensatz)' };
  }
  for (const muster of VERDAECHTIGE_MUSTER) {
    if (muster.test(t)) {
      return { verdaechtig: true, grund: `Instruktions-/Injection-Muster (${muster.source})` };
    }
  }
  return { verdaechtig: false };
}
