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
import { useEffect, useMemo, useRef, useState } from 'react';
import { istImBereich } from '@/core/status/betrachtungsbereich';
import { komponiereBereich, type Bereich } from '@/core/hooks/useBereich';
import { erzeugeBereichsStore } from '@/core/hooks/bereichsStore';
import { countAntraegeListViewByUnterprogramm } from '@/core/services/csv/idb-csv';
import type { IDBStore } from '@/core/services/storage/idb-store';
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

/**
 * Wie viele Anträge die Suche unter dieser Auswahl überhaupt erreichen kann —
 * der Nenner der Zeile „N Treffer in M Anträgen".
 *
 * Gerechnet als **Abzug vom Ganzen**, nicht als Summe der gewählten Programme:
 * so bleibt die Zahl im Grundzustand exakt die des Index (`gesamt`), und
 * Anträge ohne Programm-Nummer fallen nicht stillschweigend heraus — sie sind
 * ja auch in der Trefferliste noch da (siehe {@link wendeRichtlinienAn}).
 *
 * `menge === null` (Stufe „alle") oder eine noch leere Zählung geben `gesamt`
 * zurück: eine halb geladene Auskunft wäre schlechter als die ganze.
 */
export function zaehleErreichbareAntraege(
  gesamt: number,
  jeUnterprogramm: ReadonlyMap<string, number> | null,
  menge: ReadonlySet<string> | null,
): number {
  if (menge === null || jeUnterprogramm === null || jeUnterprogramm.size === 0) return gesamt;
  let draussen = 0;
  for (const [code, anzahl] of jeUnterprogramm) {
    if (code !== '' && !istImBereich(code, menge)) draussen += anzahl;
  }
  return Math.max(0, gesamt - draussen);
}

/**
 * Der Nenner der Ergebniszeile, nachgeladen **nur wenn nötig**.
 *
 * Im Grundzustand „alle Richtlinien" ist er die Index-Zahl, die ohnehin
 * schon dasteht — dann wird nichts gelesen. Erst wer einschränkt, löst den
 * einen Lauf über die schmale Projektion aus; das Ergebnis gilt für die ganze
 * Sitzung, weil sich der Bestand während ihrer nicht ändert.
 */
export function useErreichbareAntraege(params: {
  idb: IDBStore;
  programmId: string | null;
  /** Alle Anträge des Programms im Index — die Zahl im Grundzustand. */
  gesamt: number;
  menge: ReadonlySet<string> | null;
}): number {
  const { idb, programmId, gesamt, menge } = params;
  const [zaehlung, setZaehlung] = useState<
    { programmId: string; je: ReadonlyMap<string, number> } | null
  >(null);
  // Der Versuch wird gemerkt, nicht sein Ergebnis: ohne diese Marke liefe ein
  // Fehlschlag in eine Endlosschleife, weil jeder Rerender ihn wiederholte.
  const versucht = useRef<string | null>(null);

  useEffect(() => {
    if (programmId === null || menge === null) return;
    if (versucht.current === programmId) return;
    versucht.current = programmId;
    let abgebrochen = false;
    void countAntraegeListViewByUnterprogramm(idb, programmId)
      .then(je => { if (!abgebrochen) setZaehlung({ programmId, je }); })
      .catch(() => { /* ohne Zählung bleibt die Gesamtzahl stehen */ });
    return () => { abgebrochen = true; };
  }, [idb, programmId, menge]);

  const je = zaehlung !== null && zaehlung.programmId === programmId ? zaehlung.je : null;
  return zaehleErreichbareAntraege(gesamt, je, menge);
}
