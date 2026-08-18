/**
 * Die **Richtlinien-Auswahl der Suche**: welche Förder-Richtlinien dürfen in der
 * Trefferliste stehen?
 *
 * Die Suche ist Evidenz, nicht Arbeitsvorrat — deshalb steht sie im
 * Grundzustand auf **alle Richtlinien** und nimmt nichts weg, was jemand
 * eingetippt hat (Pitfall #46). Wer die stillgelegten Altprogramme dauerhaft
 * loswerden will, sagt es einmal am Chip; die Wahl wird gemerkt.
 *
 * **Getrennt vom Betrachtungsbereich**, mit Absicht: der schneidet den
 * Arbeitsvorrat und steht auf „letzte 3 Richtlinien". Ein gemeinsamer Speicher
 * könnte nicht zwei Grundzustände haben, und ein Bereichswechsel auf den
 * Förderanträgen würde die Suche mitverstellen, ohne dass jemand danach gefragt
 * hätte. Geteilt werden Mechanik und Bedienung
 * ([bereichsStore](@/core/hooks/bereichsStore), `BereichAuswahlChip`), nicht der
 * Zustand.
 *
 * **Ohne Programm-Nummer bleibt ein Treffer stehen.** Geraten wird nicht: ein
 * Dokument ohne verknüpften Antrag trägt keine Richtlinie und verschwände sonst,
 * sobald irgendeine Einschränkung gilt — dieselbe Regel, nach der die Marke
 * „außerhalb des Anzeigebereichs" nur an Treffern MIT Code hängt.
 */
import { useMemo } from 'react';
import { istImBereich } from '@/core/status/betrachtungsbereich';
import { komponiereBereich, type Bereich } from '@/core/hooks/useBereich';
import { erzeugeBereichsStore } from '@/core/hooks/bereichsStore';
import type { UnifiedSearchResult } from '@/core/types/search-result';

/** Versionierter Key — siehe `erzeugeBereichsStore`. */
const KEY = 'teamflow_suche_richtlinien_v1';

export const useSuchRichtlinienStore = erzeugeBereichsStore(KEY, 'alle');

export function useSuchRichtlinien(): Bereich {
  const modus = useSuchRichtlinienStore(s => s.modus);
  const auswahl = useSuchRichtlinienStore(s => s.auswahl);
  const setModus = useSuchRichtlinienStore(s => s.setModus);
  const setAuswahl = useSuchRichtlinienStore(s => s.setAuswahl);

  return useMemo(
    () => komponiereBereich(modus, auswahl, setModus, setAuswahl),
    [modus, auswahl, setModus, setAuswahl],
  );
}

/**
 * Filtert die Trefferliste auf die gewählten Richtlinien. `menge === null`
 * (Stufe „alle") gibt die Liste unverändert zurück — identisch, nicht kopiert,
 * damit die nachgelagerten `useMemo` nicht bei jedem Lauf neu rechnen.
 */
export function wendeRichtlinienAn(
  results: readonly UnifiedSearchResult[],
  menge: ReadonlySet<string> | null,
): readonly UnifiedSearchResult[] {
  if (menge === null) return results;
  return results.filter(
    r => r.unterprogrammCode === undefined || istImBereich(r.unterprogrammCode, menge),
  );
}
