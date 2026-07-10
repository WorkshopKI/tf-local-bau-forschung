/**
 * Cross-Tab-Sprung „Im Antrag öffnen" (Lesemodus) als React-Context.
 *
 * Der geteilte `FundstelleChip`/`FundstellePopover` wird an SECHS Stellen genutzt
 * (Steckbrief, Abdeckung, Zahlen, Fragen, StrukturKarte, Silhouette). Ein Context
 * gibt dem Chip die App-Level-Aktion (Tab wechseln + zur Sektion scrollen), OHNE
 * einen Callback durch alle sechs Konsumenten zu prop-drillen. Außerhalb des
 * Providers ist der Wert `null` → der Chip bleibt ein reiner Hover-Chip.
 */
import { createContext, useContext } from 'react';

/** Öffnet den Lesemodus-Tab und scrollt zur Sektion. `null` = kein Lesemodus (keine VB). */
export type LesemodusSprung = ((sektionId: string) => void) | null;

const LesemodusSprungContext = createContext<LesemodusSprung>(null);

/** Provider am Aufbereitungs-Seitenrahmen (kennt Tab-Wechsel + Sprungziel). */
export const LesemodusSprungProvider = LesemodusSprungContext.Provider;

/** Sprung-Funktion (oder `null`) für den geteilten Fundstellen-Chip. */
export function useLesemodusSprung(): LesemodusSprung {
  return useContext(LesemodusSprungContext);
}
