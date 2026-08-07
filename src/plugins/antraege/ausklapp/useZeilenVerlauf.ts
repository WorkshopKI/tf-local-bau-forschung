/**
 * Die Daten des aufgeklappten Bereichs — Spuren aus Phase 1b, Frist aus Phase 0.
 *
 * **Rechnet nichts nach.** Der Hook stellt nur zusammen, was `baueVerlauf` und
 * `berechneFrist` brauchen; beide Engines bleiben die einzigen, die rechnen.
 *
 * **Lädt erst beim Öffnen.** Er hängt an `useStatusVerlauf`, der seinerseits
 * einen `useEffect` je `verbundId` fährt — solange der Bereich zu ist, ist die
 * Komponente nicht gemountet und es passiert nichts. Für 403 Tabellenzeilen
 * wird nie etwas vorberechnet.
 *
 * **Das Journal hängt am Antrag, die Spuren am Verbund.** `chronikFuerAntrag`
 * liefert die Chronik EINES Teilvorhabens; sie auf die Spuren seiner Nachbarn
 * anzuwenden hieße, Beobachtungen zu behaupten, die es nicht gibt. Deshalb wird
 * sie nur bei einem Ein-TV-Vorhaben durchgereicht — der Nullpunkt `journalAb`
 * dagegen immer, denn ohne ihn liest sich eine unvollständige Chronik als
 * vollständige (Abschnitt 12.2).
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { chronikFuerAntrag, type AntragsChronik } from '@/core/status';
import { baueVerlaufFuerVorgang } from '@/core/status/verlauf/fuer-vorgang';
import type { VerlaufsBezug, VerlaufsSpur } from '@/core/status/verlauf';
import { useStatusVerlauf, type StatusVerlauf } from '../status/useStatusVerlauf';

export interface ZeilenVerlauf {
  laden: boolean;
  spuren: VerlaufsSpur[];
  /** Nullpunkt des Import-Diff-Journals; `null` = kein Journal geführt. */
  journalAb: string | null;
  /** `false` = die Chronik gehört zu EINEM Teilvorhaben eines Mehr-TV-Vorhabens
   *  und wurde deshalb nicht in die Ableitung gegeben. */
  journalGenutzt: boolean;
  /** Die geladene Fassung und die Vorkommen — der Frist-Reiter braucht beides. */
  quelle: StatusVerlauf;
}

/**
 * Gerechnete Spuren, gekeyt über Vorhaben, Fassung und Bezugszeitpunkt.
 *
 * Modul-lokal mit Deckel: derselbe Vorgang wird beim Auf- und Zuklappen sonst
 * jedes Mal neu gerechnet. Der Deckel hält den Cache klein — wer zwanzig Zeilen
 * durchgesehen hat, braucht die erste nicht mehr.
 */
const CACHE = new Map<string, VerlaufsSpur[]>();
const CACHE_MAX = 20;

function ausCache(schluessel: string, rechne: () => VerlaufsSpur[]): VerlaufsSpur[] {
  const da = CACHE.get(schluessel);
  if (da) return da;
  const neu = rechne();
  if (CACHE.size >= CACHE_MAX) {
    const aeltester = CACHE.keys().next().value;
    if (aeltester !== undefined) CACHE.delete(aeltester);
  }
  CACHE.set(schluessel, neu);
  return neu;
}

export function useZeilenVerlauf(
  verbundId: string | null, aktenzeichen: string, bezugsZeitpunkt: string,
): ZeilenVerlauf {
  const idb = useStorage().idb;
  const quelle = useStatusVerlauf(verbundId);
  const [chronik, setChronik] = useState<AntragsChronik | null>(null);

  useEffect(() => {
    let abgebrochen = false;
    setChronik(null);
    void (async () => {
      try {
        const c = await chronikFuerAntrag(idb, aktenzeichen, bezugsZeitpunkt);
        if (!abgebrochen) setChronik(c);
      } catch {
        if (!abgebrochen) setChronik(null);
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, aktenzeichen, bezugsZeitpunkt]);

  const einTv = quelle.jeTeilvorhaben.length === 1;

  const spuren = useMemo<VerlaufsSpur[]>(() => {
    const { version, jeTeilvorhaben } = quelle;
    if (!version || jeTeilvorhaben.length === 0) return [];
    const bezug: VerlaufsBezug = {
      verbundId,
      statusVbRoh: quelle.statusVbRoh,
      vbPhaseRoh: quelle.vbPhaseRoh,
      bezugsZeitpunkt,
      teilvorhaben: jeTeilvorhaben.map(tv => ({
        aktenzeichen: tv.aktenzeichen,
        statusTvRoh: tv.statusTvRoh,
        vorkommen: tv.vorkommen,
        vbPhaseRoh: tv.vbPhaseRoh,
      })),
    };
    const journal = einTv ? chronik : null;
    const schluessel = `${verbundId ?? aktenzeichen}|${version.version}|${bezugsZeitpunkt}`
      + `|${journal ? 'j' : '-'}`;
    return ausCache(schluessel, () => baueVerlaufFuerVorgang(bezug, version, journal));
  }, [quelle, verbundId, aktenzeichen, bezugsZeitpunkt, chronik, einTv]);

  return {
    laden: quelle.laden,
    spuren,
    journalAb: chronik?.journalAb ?? null,
    journalGenutzt: einTv && chronik !== null,
    quelle,
  };
}
