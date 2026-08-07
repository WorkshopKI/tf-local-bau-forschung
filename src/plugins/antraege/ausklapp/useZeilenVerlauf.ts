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
import { chronikFuerAntrag, findeStatusCode, type AntragsChronik } from '@/core/status';
import { fristFuerVorkommen, type FristBezug } from '@/core/status/frist-bezug';
import { baueVerlaufFuerVorgang } from '@/core/status/verlauf/fuer-vorgang';
import { haltedatumAusSpuren } from '@/core/status/verlauf/haltedatum-aus-verlauf';
import type { VerlaufsBezug, VerlaufsSpur } from '@/core/status/verlauf';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import { useStatusVerlauf, type StatusVerlauf } from '../status/useStatusVerlauf';

export interface ZeilenVerlauf {
  laden: boolean;
  spuren: VerlaufsSpur[];
  /**
   * Die Fristrechnung dieser Zeile — **einmal** gerechnet.
   *
   * Bis v3.29 rief der Hook `bezugsZeitpunktFuerVorkommen` und der Frist-Reiter
   * gleich darauf `fristFuerVorkommen` mit denselben Eingaben: dieselbe Rechnung
   * zweimal, und beim ersten Auseinanderlaufen zwei Wahrheiten. `null` nur,
   * solange die Fassung fehlt.
   */
  frist: FristBezug | null;
  /**
   * Die Statuseinträge, die **diese Zeile** trägt — bei einer Verbundzeile alle
   * Teilvorhaben, sonst nur das eigene.
   *
   * Steht in der Ausgabe, weil Wächter und Zieltage dieselbe Menge brauchen wie
   * die Frist. Wer sie sich selbst zusammensucht, nimmt leicht die falsche: der
   * Verbund-Status und der eines Teilvorhabens gehen im Bestand regelmäßig
   * auseinander (Pitfall #44), und dann stünde im selben Band die Frist des
   * einen neben den Zieltagen des anderen.
   */
  vorkommen: readonly FeldVorkommen[];
  /**
   * Bis wann die Achse läuft — Haltedatum bei angehaltener Uhr, sonst der
   * Stichtag. Steht in der Ausgabe, weil die Bahn ihn beschriftet.
   */
  bezugsZeitpunkt: string;
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

/**
 * Ein Verlaufs-Durchgang zu einem gegebenen Bezugszeitpunkt.
 *
 * Herausgezogen, weil er ZWEIMAL laufen kann: einmal mit dem Stichtag, um die
 * letzte Kante und damit das Haltedatum zu bekommen, und einmal mit diesem
 * Haltedatum für die endgültigen Segmente. Der Cache ist auf den
 * Bezugszeitpunkt gekeyt, beide Läufe liegen also getrennt darin.
 */
function baueSpuren(
  quelle: StatusVerlauf, verbundId: string | null, aktenzeichen: string | null,
  bezugsZeitpunkt: string, chronik: AntragsChronik | null, einTv: boolean,
): VerlaufsSpur[] {
  const { version, jeTeilvorhaben } = quelle;
  if (!version || jeTeilvorhaben.length === 0) return [];
  const bezug: VerlaufsBezug = {
    verbundId,
    statusVbRoh: quelle.statusVbRoh,
    vbPhaseRoh: quelle.vbPhaseRoh,
    programm: quelle.programm,
    bezugsZeitpunkt,
    teilvorhaben: jeTeilvorhaben.map(tv => ({
      aktenzeichen: tv.aktenzeichen,
      statusTvRoh: tv.statusTvRoh,
      vorkommen: tv.vorkommen,
      vbPhaseRoh: tv.vbPhaseRoh,
    })),
  };
  const journal = einTv ? chronik : null;
  // Der Trigger-Stand gehört in den Schlüssel: ein Neu-Import ändert die
  // Regeln, und ein Cache, der das nicht sieht, zeigt die alte Bahn weiter.
  const schluessel = `${verbundId ?? aktenzeichen ?? '-'}|${version.version}|${bezugsZeitpunkt}`
    + `|${quelle.triggerVersion ?? '-'}|${journal ? 'j' : '-'}`;
  return ausCache(schluessel, () => baueVerlaufFuerVorgang(bezug, version, quelle.trigger, journal));
}

export function useZeilenVerlauf(
  /**
   * Das Aktenzeichen der geklickten Zeile — oder `null` für „das ganze
   * Vorhaben" (Verbund-Detailseite). Bei `null` entfällt die Antrags-Chronik:
   * das Journal wird je Teilvorhaben geführt, und eines davon auf den Verbund
   * anzuwenden hieße, Beobachtungen zu behaupten, die es nicht gibt.
   */
  verbundId: string | null, aktenzeichen: string | null, stichtag: string,
  istVerbundZeile: boolean, statusRoh: unknown,
): ZeilenVerlauf {
  const idb = useStorage().idb;
  const quelle = useStatusVerlauf(verbundId);
  const [chronik, setChronik] = useState<AntragsChronik | null>(null);

  const einTv = quelle.jeTeilvorhaben.length === 1;

  /** Die Vorkommen, die diese Zeile trägt — Verbundzeile: alle Teilvorhaben. */
  const vorkommen = useMemo(() => {
    const relevante = istVerbundZeile || aktenzeichen === null
      ? quelle.jeTeilvorhaben
      : quelle.jeTeilvorhaben.filter(t => t.aktenzeichen === aktenzeichen);
    return relevante.flatMap(t => t.vorkommen);
  }, [quelle.jeTeilvorhaben, aktenzeichen, istVerbundZeile]);

  /**
   * **Erster Durchgang, mit dem nackten Stichtag.** `baueUebergaenge` nimmt den
   * Bezugszeitpunkt gar nicht entgegen — nur `baueSegmente` tut das. Die
   * Übergänge dieses Laufs sind deshalb dieselben wie die des endgültigen, und
   * aus ihrer letzten Kante kommt das Haltedatum, das die Frist erst braucht.
   * Ohne diesen Trick wäre es ein Zirkelschluss.
   */
  const spurenVorlaeufig = useMemo(
    () => baueSpuren(quelle, verbundId, aktenzeichen, stichtag, chronik, einTv),
    [quelle, verbundId, aktenzeichen, stichtag, chronik, einTv],
  );

  // Nicht der nackte Stichtag: bei angehaltener Uhr endet die Achse am
  // HALTEDATUM. Sonst streckt ein 2018 entschiedener Altfall seinen letzten
  // Status über acht Jahre und verschluckt die ganze Bahn (`frist-bezug.ts`).
  const frist = useMemo<FristBezug | null>(() => {
    const { version } = quelle;
    if (!version || quelle.jeTeilvorhaben.length === 0) return null;
    const eigenerStatus = istVerbundZeile || aktenzeichen === null ? statusRoh : statusRoh;
    const art = istVerbundZeile || aktenzeichen === null ? 'verbund' : 'tv';
    const id = art === 'verbund' ? (verbundId ?? '') : (aktenzeichen ?? '');
    const code = findeStatusCode(eigenerStatus)?.eintrag.code ?? null;
    return fristFuerVorkommen(version, vorkommen, eigenerStatus, stichtag, {
      verlauf: haltedatumAusSpuren(spurenVorlaeufig, art, id, code),
    });
  }, [quelle, vorkommen, statusRoh, stichtag, spurenVorlaeufig, istVerbundZeile, aktenzeichen, verbundId]);

  const bezugsZeitpunkt = frist?.bezugsZeitpunkt ?? stichtag;

  useEffect(() => {
    let abgebrochen = false;
    setChronik(null);
    if (aktenzeichen === null) return;
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

  /**
   * **Zweiter Durchgang, jetzt mit dem Haltedatum.** Nur die Segmente ändern
   * sich; kam kein Haltedatum heraus, ist der Bezugszeitpunkt der Stichtag und
   * der erste Lauf wird unverändert weitergereicht — dann läuft nichts zweimal.
   */
  const spuren = useMemo<VerlaufsSpur[]>(
    () => (bezugsZeitpunkt === stichtag
      ? spurenVorlaeufig
      : baueSpuren(quelle, verbundId, aktenzeichen, bezugsZeitpunkt, chronik, einTv)),
    [spurenVorlaeufig, bezugsZeitpunkt, stichtag, quelle, verbundId, aktenzeichen, chronik, einTv],
  );

  return {
    laden: quelle.laden,
    spuren,
    frist,
    vorkommen,
    bezugsZeitpunkt,
    journalAb: chronik?.journalAb ?? null,
    journalGenutzt: einTv && chronik !== null,
    quelle,
  };
}
