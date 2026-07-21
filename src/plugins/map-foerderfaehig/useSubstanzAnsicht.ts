/**
 * Ableitungen des Substanzchecks für die Oberfläche.
 *
 * Bindeglied zwischen `useMapVb` (liefert die KI-Befunde) und `useMapPruefung`
 * (hält den Prüfstand). Eigene Datei, weil die Komponenten des Moduls
 * ausdrücklich nichts rechnen — die Zuordnung Widerspruch → Prüfkriterium und
 * die Auswahl der Zielkriterien sind Ableitungen, keine Darstellung.
 *
 * Die eigentliche Logik liegt rein in `substanz/`; hier steht nur das
 * Zusammenstecken und das Anstossen der Schreib-Aktionen.
 */
import { useCallback, useMemo } from 'react';
import type { MapPraezisionsNf } from './checkliste/typen';
import type { SdtDeltaZeile } from './infografik/schema';
import type { UnschaerfeBegriff } from './infografik/substanz';
import { nfAusDeltaZeile, nfAusUnschaerfe } from './substanz/nf-praezision';
import { waehleZielkriterien, type Zielkriterium } from './substanz/zielkriterien';
import { findePassendesItem, widerspruchAlsBemerkung } from './substanz/zuordnung';
import type { WiderspruchZeile } from './components/WiderspruchListe';
import type { UseMapPruefungResult } from './useMapPruefung';
import type { UseMapVbResult } from './useMapVb';

export interface UseSubstanzAnsichtResult {
  widerspruchZeilen: WiderspruchZeile[];
  unschaerfe: readonly UnschaerfeBegriff[];
  zielkriterien: Zielkriterium[];
  zielkriterienAus: readonly string[];
  praezisionsNf: readonly MapPraezisionsNf[];
  /** Auslöser mit bereits erzeugter Nachforderung — die Knöpfe schalten darauf ab. */
  erledigteAusloeser: ReadonlySet<string>;
  uebernehmeWiderspruch: (zeile: WiderspruchZeile) => void;
  nachfordernDelta: (zeile: SdtDeltaZeile) => void;
  nachfordernUnschaerfe: (begriff: UnschaerfeBegriff) => void;
}

export function useSubstanzAnsicht(
  vb: UseMapVbResult, pruefung: UseMapPruefungResult,
): UseSubstanzAnsichtResult {
  const vbMarkdown = vb.korpus?.markdown ?? '';
  const infografik = vb.infografik;

  const praezisionsNf = useMemo(
    () => pruefung.pruefung?.praezisionsNf ?? [], [pruefung.pruefung],
  );
  const zielkriterienAus = useMemo(
    () => pruefung.pruefung?.zielkriterienAus ?? [], [pruefung.pruefung],
  );
  const erledigteAusloeser = useMemo(
    () => new Set(praezisionsNf.map(n => n.ausloeser)), [praezisionsNf],
  );
  const zielkriterien = useMemo(
    () => waehleZielkriterien(infografik?.sdtDelta ?? [], zielkriterienAus),
    [infografik, zielkriterienAus],
  );

  /**
   * Nur ANWENDBARE Kriterien kommen als Ziel in Frage: ein entfallener Block
   * („Sofern …") darf keine Nachforderung tragen, sonst blockierte er später den
   * Abschluss, obwohl er für diese Prüfung gar nicht gilt.
   */
  const widerspruchZeilen = useMemo<WiderspruchZeile[]>(() => {
    const anwendbare = (pruefung.ergebnis?.zustaende ?? [])
      .filter(z => z.anwendbar)
      .map(z => z.item);

    return (infografik?.widersprueche ?? []).map(w => {
      const treffer = findePassendesItem(w, anwendbare, vb.aspektMapping, vb.gliederung, vbMarkdown);
      const ziel = treffer === null ? undefined : anwendbare.find(i => i.id === treffer.itemId);
      return {
        widerspruch: w,
        zielItemId: ziel?.id ?? null,
        zielKriterium: ziel?.kriterium ?? null,
      };
    });
  }, [infografik, vb.aspektMapping, vb.gliederung, vbMarkdown, pruefung.ergebnis]);

  const { bewerteItem, ergaenzePraezisionsNf } = pruefung;

  const uebernehmeWiderspruch = useCallback((zeile: WiderspruchZeile): void => {
    if (zeile.zielItemId === null) return;
    void bewerteItem({
      itemId: zeile.zielItemId,
      status: 'nf-notwendig',
      bemerkung: widerspruchAlsBemerkung(zeile.widerspruch),
    });
  }, [bewerteItem]);

  const nachfordernDelta = useCallback((zeile: SdtDeltaZeile): void => {
    void ergaenzePraezisionsNf(nfAusDeltaZeile(zeile, new Date().toISOString()));
  }, [ergaenzePraezisionsNf]);

  const nachfordernUnschaerfe = useCallback((begriff: UnschaerfeBegriff): void => {
    void ergaenzePraezisionsNf(nfAusUnschaerfe(begriff, new Date().toISOString()));
  }, [ergaenzePraezisionsNf]);

  return {
    widerspruchZeilen,
    unschaerfe: infografik?.unschaerfeBegriffe ?? [],
    zielkriterien,
    zielkriterienAus,
    praezisionsNf,
    erledigteAusloeser,
    uebernehmeWiderspruch,
    nachfordernDelta,
    nachfordernUnschaerfe,
  };
}
