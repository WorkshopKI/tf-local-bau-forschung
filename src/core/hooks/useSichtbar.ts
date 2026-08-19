/**
 * Die eine Frage-Stelle der Sichtbarkeits-Achsen: „zeigt die App dieses
 * Element gerade?"
 *
 * Bündelt die beiden Profil-Schalter (Kontext, reaktiv) mit dem Kurator-Overlay
 * (zustand-Store, reaktiv). Beides ohne Neuladen — anders als beim
 * Modul-Schloss, das seine Prädikate beim Start zu Konstanten auflöst.
 *
 * Niemand liest `profile.beta_features` selbst; der Guard
 * `sichtbarkeit-eine-mechanik` wacht darüber. Sonst entstünde neben dieser
 * Regel eine zweite, die irgendwann anders antwortet.
 */
import { useCallback, useEffect, useMemo } from 'react';
import {
  SICHTBARKEITS_KATALOG, baueIndex, effektiveMarken, ersterSichtbarerReiter,
  filtereReiter, istSichtbar, reiterId, useSichtbarkeitStore, zaehleZugewinn,
  type Marke, type Schalter,
} from '@/core/sichtbarkeit';
import { useProfile } from './useProfile';

const INDEX = baueIndex(SICHTBARKEITS_KATALOG);

/** Stand der beiden Profil-Schalter. Fehlendes Feld = aus. */
export function useSichtbarkeitsSchalter(): Schalter {
  const { profile } = useProfile();
  const beta = profile?.beta_features === true;
  const experte = profile?.experten_modus === true;
  return useMemo(() => ({ beta, experte }), [beta, experte]);
}

/**
 * `sichtbar('reiter:suche/fragen')` — unbekannte Ids gelten als sichtbar.
 *
 * Das ist Absicht: eine Id, die (noch) nicht im Katalog steht, darf nichts
 * verbergen. Ein Tippfehler fällt dadurch nicht als verschwundene Oberfläche
 * auf, sondern im Guard `sichtbarkeit-ids-existieren` — die richtige Reihenfolge.
 */
export function useSichtbar(): (id: string) => boolean {
  const schalter = useSichtbarkeitsSchalter();
  const overlay = useSichtbarkeitStore(s => s.overlay);
  return useCallback(
    (id: string) => istSichtbar(effektiveMarken(id, INDEX, overlay), schalter),
    [overlay, schalter],
  );
}

/**
 * Reiter-Leiste auf das Sichtbare kürzen — und den gemerkten Reiter retten.
 *
 * Beides gehört zusammen: wer nur filtert, hinterlässt eine Seite, deren
 * aktiver Reiter nicht mehr in der Leiste steht (v4.107.2). Der Helfer schiebt
 * die Auswahl deshalb selbst auf den ersten sichtbaren Reiter, sobald der
 * gemerkte verschwindet — einmal, nicht in einer Schleife: er meldet nur, wenn
 * sich der korrigierte Wert vom aktuellen unterscheidet.
 *
 * ```ts
 * const tabs = useSichtbareReiter('auslastung', ALLE_TABS, t => t.id, tab, setTab);
 * ```
 */
export function useSichtbareReiter<T>(
  wirt: string,
  items: readonly T[],
  keyVon: (item: T) => string,
  aktiv: string,
  setzeAktiv: (key: string) => void,
): T[] {
  const sichtbar = useSichtbar();
  const gefiltert = useMemo(
    () => filtereReiter(items, item => reiterId(wirt, keyVon(item)), sichtbar),
    // `keyVon` ist an jeder Aufrufstelle ein Inline-Lambda und wechselt bei
    // jedem Render die Identität — es als Abhängigkeit zu führen, machte das
    // Memo wertlos. Der Schlüssel eines Reiters ändert sich nicht.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [items, wirt, sichtbar],
  );
  const korrigiert = ersterSichtbarerReiter(gefiltert, aktiv, keyVon);
  useEffect(() => {
    if (korrigiert !== aktiv) setzeAktiv(korrigiert);
    // `setzeAktiv` ist an den Aufrufstellen ein Inline-Lambda; als Abhängigkeit
    // liefe der Effekt bei jedem Render erneut.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [korrigiert, aktiv]);
  return gefiltert;
}

/** Wie viele Elemente dieser Schalter zusätzlich einblendet — im aktuellen Stand des anderen. */
export function useZugewinn(achse: Marke): number {
  const schalter = useSichtbarkeitsSchalter();
  const overlay = useSichtbarkeitStore(s => s.overlay);
  return useMemo(
    () => zaehleZugewinn(SICHTBARKEITS_KATALOG, overlay, schalter, achse),
    [overlay, schalter, achse],
  );
}
