/**
 * Die gemerkten Suchen: Liste, Persistenz, aktuelle Trefferzahlen.
 *
 * Die reinen Helfer (`merkeSuche`, `entferneSuche`, `vermerkeLauf`) leben
 * weiterhin in [gespeicherteSuchen.ts](./gespeicherteSuchen.ts) — hier steht
 * nur, was React davon braucht: der Zustand, das Zurückschreiben nach jedem
 * Eingriff und der Probelauf je Eintrag.
 *
 * Herausgezogen aus `SuchSeite`, weil es eine eigene Sache ist: Suchen merken
 * beantwortet eine andere Frage als suchen. Was hier NICHT hingehört, ist das
 * AUSFÜHREN einer gemerkten Suche — das stellt Verknüpfung, Wortformen und
 * Bereich der Seite um und gehört deshalb dorthin, wo diese Regler wohnen. Der
 * Aufrufer meldet den Lauf danach mit `vermerke` zurück.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  ladeGespeicherte, speichereGespeicherte, merkeSuche, entferneSuche, vermerkeLauf, heuteLokal,
  type GespeicherteSuche,
} from './gespeicherteSuchen';
import type { SuchVerknuepfung } from '@/core/hooks/useSuchVerknuepfung';
import type { Suchbereich } from '@/core/services/search/suchbereich';

/**
 * Was der Aufrufer zum Merken mitbringt: die Anfrage und ihre Regler.
 *
 * Trefferzahl und Datum stehen bewusst NICHT darin — beide stempelt der Hook
 * (siehe `merken`).
 */
export type NeueSuche = Omit<GespeicherteSuche, 'letzteTrefferzahl' | 'zuletzt'>;

export interface GespeicherteSuchenStand {
  liste: readonly GespeicherteSuche[];
  /** Aktuelle Trefferzahl je Eintrag (Probelauf), leer bis der Korpus steht. */
  treffer: ReadonlyMap<string, number>;
  merken: (eintrag: NeueSuche) => void;
  /** Nach dem Ausführen: Datum und Trefferzahl fortschreiben. */
  vermerke: (id: string) => void;
  loeschen: (id: string) => void;
}

export function useGespeicherteSuchen(
  probelauf: (q: string, o: { verknuepfung: SuchVerknuepfung; stammSuche: boolean; bereich: Suchbereich }) => number,
  korpusBereit: boolean,
): GespeicherteSuchenStand {
  const [liste, setListe] = useState<GespeicherteSuche[]>(() => ladeGespeicherte());

  const treffer = useMemo(() => {
    const m = new Map<string, number>();
    if (!korpusBereit) return m;
    for (const g of liste) {
      m.set(g.id, probelauf(g.query, {
        verknuepfung: g.verknuepfung, stammSuche: g.stammSuche, bereich: g.bereich,
      }));
    }
    return m;
  }, [liste, korpusBereit, probelauf]);

  // Alle drei Eingriffe rechnen aus dem VORIGEN Zustand heraus und schreiben in
  // derselben Bewegung zurück. Zustand und Ablage dürfen nie auseinanderlaufen —
  // und die Updater-Form ist zugleich der Schutz davor, dass zwei schnelle
  // Klicks auf demselben veralteten Stand rechnen.
  /**
   * **EINE Messlatte, nicht zwei.** Die Trefferzahl beim Merken stempelt der
   * Hook mit demselben Probelauf, gegen den sie später verglichen wird — nicht
   * der Aufrufer mit seiner Ergebniszahl.
   *
   * Die Seite zeigt die Menge NACH Facetten und Spaltenfiltern; der Probelauf
   * kennt nur Anfrage, Verknüpfung, Wortformen und Bereich. Wer mit gesetzter
   * Facette merkte, verglich also 99 gegen 484 und bekam Sekunden später „+385
   * seit zuletzt" gemeldet — eine Bestandsänderung, die es nie gab. Genau das
   * Signal, für das die Zeile da ist, war damit wertlos.
   *
   * Steht der Korpus noch nicht, bleibt die Zahl `null` = „noch nie ausgeführt":
   * lieber keine Differenz als eine gegen 0 gerechnete.
   */
  const merken = useCallback((eintrag: NeueSuche): void => {
    const voll: GespeicherteSuche = {
      ...eintrag,
      letzteTrefferzahl: korpusBereit
        ? probelauf(eintrag.query, {
          verknuepfung: eintrag.verknuepfung, stammSuche: eintrag.stammSuche, bereich: eintrag.bereich,
        })
        : null,
      zuletzt: heuteLokal(),
    };
    setListe(vorher => { const n = merkeSuche(vorher, voll); speichereGespeicherte(n); return n; });
  }, [probelauf, korpusBereit]);

  const vermerke = useCallback((id: string): void => {
    setListe(vorher => {
      const n = vermerkeLauf(vorher, id, treffer.get(id) ?? 0, heuteLokal());
      speichereGespeicherte(n);
      return n;
    });
  }, [treffer]);

  const loeschen = useCallback((id: string): void => {
    setListe(vorher => { const n = entferneSuche(vorher, id); speichereGespeicherte(n); return n; });
  }, []);

  return { liste, treffer, merken, vermerke, loeschen };
}
