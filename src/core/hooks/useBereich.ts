/**
 * Der Betrachtungsbereich, wie ihn ein Konsument braucht: **eine Menge oder
 * `null`**, plus die Zahlen für den Chip.
 *
 * Führt die beiden Hälften zusammen — die Definition (Katalog-Fassung, sonst
 * Code-Seed) und die persönliche Auswahl (Standard / Alle / eigene). Getrennt
 * gehalten, weil sie verschiedene Lebensdauern und verschiedene Besitzer haben;
 * hier gebündelt, damit kein Konsument die Reihenfolge selbst nachbaut.
 *
 * `programme === null` heißt **kein Filter**. Konsumenten müssen den Bereich
 * ausdrücklich anwenden (Pitfall #46) — dieser Hook filtert nichts.
 */
import { useMemo } from 'react';
import {
  bereichsMenge, bereichsProgramme, bereichWeichtVomSeedAb, getAktiveVersion,
} from '@/core/status';
import { useBetrachtungsbereichStore, type BereichModus } from './useBetrachtungsbereich';

export interface Bereich {
  modus: BereichModus;
  /** Die geltenden Programm-Nummern; leer, wenn `modus === 'alle'`. */
  programme: readonly string[];
  /** Nachschlage-Menge für `istImBereich`; `null` = kein Filter. */
  menge: ReadonlySet<string> | null;
  /** Die Programme des Standard-Bereichs (unabhängig von der Auswahl). */
  standard: readonly string[];
  /** Weicht die gepflegte Definition vom ausgelieferten Stand ab? */
  weichtVomSeedAb: boolean;
  setModus: (modus: BereichModus) => void;
  setAuswahl: (programme: string[]) => void;
}

/**
 * Setzt eine gespeicherte Wahl mit der gepflegten Definition zu einem `Bereich`
 * zusammen. Rein — der Betrachtungsbereich und die Richtlinien-Auswahl der Suche
 * teilen sich diese Regel, damit „Standard" in beiden dasselbe meint.
 */
export function komponiereBereich(
  modus: BereichModus,
  auswahl: readonly string[],
  setModus: (m: BereichModus) => void,
  setAuswahl: (p: string[]) => void,
): Bereich {
  // `getAktiveVersion()` ist ohne `statusCockpit` null — dann gilt der
  // Code-Seed. Genau so wirkt der Bereich auch in prod/as.
  const version = getAktiveVersion();
  const standard = bereichsProgramme(version);
  const programme = modus === 'alle' ? [] : (modus === 'auswahl' ? auswahl : standard);
  return {
    modus,
    programme,
    menge: modus === 'alle' ? null : bereichsMenge(programme),
    standard,
    weichtVomSeedAb: bereichWeichtVomSeedAb(version),
    setModus,
    setAuswahl,
  };
}

export function useBereich(): Bereich {
  const modus = useBetrachtungsbereichStore(s => s.modus);
  const auswahl = useBetrachtungsbereichStore(s => s.auswahl);
  const setModus = useBetrachtungsbereichStore(s => s.setModus);
  const setAuswahl = useBetrachtungsbereichStore(s => s.setAuswahl);

  return useMemo(
    () => komponiereBereich(modus, auswahl, setModus, setAuswahl),
    [modus, auswahl, setModus, setAuswahl],
  );
}
