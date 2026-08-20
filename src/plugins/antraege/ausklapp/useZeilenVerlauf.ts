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
 * **Das Journal hängt am Antrag, die Spuren am Verbund.** Die Chronik gehört
 * EINEM Teilvorhaben; sie auf die Spuren seiner Nachbarn anzuwenden hieße,
 * Beobachtungen zu behaupten, die es nicht gibt. Deshalb wird sie nur bei einem
 * Ein-TV-Vorhaben in die Ableitung gereicht — der Nullpunkt `journalAb` dagegen
 * immer, denn ohne ihn liest sich eine unvollständige Chronik als vollständige
 * (Abschnitt 12.2).
 *
 * **Geladen wird über `useJournalChroniken` für ALLE Teilvorhaben der Zeile**,
 * seit v4.57. Die Chronik-Ansicht zeigt zurückgenommene Termine, und eine
 * Verbund-Zeile trägt die Teilvorhaben aller. Bis dahin lud der Hook bei
 * `aktenzeichen === null` gar nichts. Die Ein-TV-Regel oben bleibt davon
 * unberührt: sie entscheidet, WAS weitergereicht wird, nicht, was geladen wird.
 *
 * **Nullpunkt und letzte Änderung sind zwei Dinge.** `journalAb` sagt, ab wann
 * das Journal überhaupt spricht (eine Zahl für den ganzen Bestand);
 * `journalAenderung` sagt, wann sich an DIESER Zeile zuletzt belegt etwas
 * bewegt hat. Beide sind `string | null`, weshalb der Typ ihre Verwechslung
 * nicht fangen konnte — der Guard `kein-nullpunkt-als-letzte-aenderung` tut es.
 */
import { useMemo } from 'react';
import { findeStatusCode, type AntragsChronik, type AntragsChronikMitId } from '@/core/status';
import { fristFuerVorkommen, type FristBezug } from '@/core/status/frist-bezug';
import { baueVerlaufFuerVorgang } from '@/core/status/verlauf/fuer-vorgang';
import { haltedatumAusSpuren } from '@/core/status/verlauf/haltedatum-aus-verlauf';
import type { VerlaufsBezug, VerlaufsSpur } from '@/core/status/verlauf';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import { useJournalChroniken } from '../status/useJournalChroniken';
import { useStatusVerlauf, type StatusVerlauf } from '../status/useStatusVerlauf';
import { useAntraegeStore } from '../store';

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
   * Dieselben Teilvorhaben, aber **einzeln** — die Vorkommen je TV statt in
   * einem Topf.
   *
   * Steht neben {@link ZeilenVerlauf.vorkommen}, weil manche Auswertung genau
   * die Trennung braucht: die halb offenen Kürzel-Paare etwa lesen TV-Spalten,
   * und über die zusammengeworfene Menge gilt ein Kürzel als gesetzt, sobald
   * irgendein Teilvorhaben es trägt (`offenePaareJeTeilvorhaben`).
   */
  jeTeilvorhaben: readonly { aktenzeichen: string; titel: string; vorkommen: FeldVorkommen[] }[];
  /**
   * Bis wann die Achse läuft — Haltedatum bei angehaltener Uhr, sonst der
   * Stichtag. Steht in der Ausgabe, weil die Bahn ihn beschriftet.
   */
  bezugsZeitpunkt: string;
  /** Nullpunkt des Import-Diff-Journals; `null` = kein Journal geführt. */
  journalAb: string | null;
  /**
   * Die **belegte letzte Änderung dieser Zeile** — was der Stillstands-Wächter
   * als `journalAenderung` braucht. `null` heißt „nichts belegt"; dann bleibt er
   * bei seiner Näherung aus `max(D_)` und schreibt „seit mindestens".
   *
   * Nicht zu verwechseln mit {@link journalAb}: der Nullpunkt ist für den ganzen
   * Bestand **dieselbe** Zahl und sagt nur, ab wann das Journal überhaupt
   * Aussagen macht. Als Änderungsmeldung übergeben (v3.31–v3.43.1) machte er jeden
   * Vorgang gleich frisch — 1 056 von 1 057 hängenden meldeten „läuft", während
   * das Board dieselbe reine Funktion mit der richtigen Quelle fütterte und
   * weiter „hängt fest" sagte. Der Guard `kein-nullpunkt-als-letzte-aenderung`
   * hält die beiden auseinander.
   *
   * `null` auch dort, wo die geladene Chronik die Zeile nicht deckt (siehe
   * {@link ZeilenVerlauf.journalGenutzt}) — eine fremde Beobachtung ist kein
   * Beleg für diese.
   */
  journalAenderung: string | null;
  /** `false` = die Chronik gehört zu EINEM Teilvorhaben eines Mehr-TV-Vorhabens
   *  und wurde deshalb nicht in die Ableitung gegeben. */
  journalGenutzt: boolean;
  /**
   * Kann das Journal für DIESE Zeile überhaupt etwas beitragen? Wahr genau
   * dann, wenn die Zeile ein einzelnes Teilvorhaben trägt. Nur dort lohnt es,
   * auf {@link journalLaden} zu warten, bevor ein Stillstands-Urteil steht —
   * an einer verdichteten Verbund-Zeile ist `journalAenderung` ohnehin `null`.
   */
  journalDeckt: boolean;
  /**
   * Die Journal-Chroniken **aller** Teilvorhaben dieser Zeile — Grundlage der
   * zurückgenommenen Termine in der Chronik-Ansicht.
   *
   * Bewusst neben {@link journalAenderung} und nicht an deren Stelle: die beiden
   * beantworten verschiedene Fragen. Diese Liste sagt „was ist an dieser Zeile
   * einmal gelöscht worden", die letzte Änderung sagt „läuft dieser eine Vorgang
   * noch". Nur die zweite darf der Stillstands-Wächter sehen, und nur sie steht
   * unter der Ein-TV-Regel (§12.2, Guard `kein-nullpunkt-als-letzte-aenderung`).
   *
   * `null` = auf diesem Share wird kein Journal geführt — aber **erst**, wenn
   * {@link journalLaden} `false` ist (siehe dort).
   */
  chroniken: AntragsChronikMitId[] | null;
  /** `true`, solange das Journal gelesen wird. Vorher ist `chroniken === null`
   *  keine Aussage, sondern ein Zwischenstand. */
  journalLaden: boolean;
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
  datenStand: number,
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
  //
  // **Und der Datenstand ebenso** (v4.124): die Bahn liest `statusVbRoh`,
  // `statusTvRoh` und die Vorkommen: genau die Werte, die ein CSV-Import ändert,
  // ohne dass Fassung oder Trigger-Version wandern. `refreshAntraegeStoreAfterSync`
  // bumpt `lastLoadedAt` nach jedem Import und Snapshot-Sync — dieselbe Kopplung,
  // die `useJournalChroniken` mit derselben Begründung führt („Ein Cache ohne
  // dieses Glied zeigte nach dem Nacht-Import weiter den Stand von gestern").
  const schluessel = `${verbundId ?? aktenzeichen ?? '-'}|${version.version}|${bezugsZeitpunkt}`
    + `|${quelle.triggerVersion ?? '-'}|${journal ? 'j' : '-'}|${datenStand}`;
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
  const quelle = useStatusVerlauf(verbundId);
  // Datenstand des Antrags-Stores — gehört in den Spuren-Cache-Schlüssel
  // (siehe `baueSpuren`).
  const datenStand = useAntraegeStore(s => s.lastLoadedAt);

  const einTv = quelle.jeTeilvorhaben.length === 1;

  /**
   * Die Teilvorhaben, die **diese Zeile** trägt — Verbundzeile: alle.
   *
   * Eine Liste, zwei Ableitungen: die Vorkommen, über die geurteilt wird, und
   * die Frage, ob die geladene Chronik dieselbe Menge beschreibt. Getrennt
   * gerechnet gingen sie beim ersten Mehr-TV-Vorhaben auseinander.
   */
  const relevante = useMemo(
    () => (istVerbundZeile || aktenzeichen === null
      ? quelle.jeTeilvorhaben
      : quelle.jeTeilvorhaben.filter(t => t.aktenzeichen === aktenzeichen)),
    [quelle.jeTeilvorhaben, aktenzeichen, istVerbundZeile],
  );

  /** Die Vorkommen, die diese Zeile trägt — Verbundzeile: alle Teilvorhaben. */
  const vorkommen = useMemo(() => relevante.flatMap(t => t.vorkommen), [relevante]);

  /**
   * Deckt die geladene Chronik genau das, worüber hier geurteilt wird?
   *
   * Sie gehört EINEM Teilvorhaben (`chronikFuerAntrag(aktenzeichen)`). Nur wenn
   * die Zeile genau dieses eine trägt, ist ihre letzte Änderung auch die der
   * Zeile — bei einem Mehr-TV-Verbund wäre sie die Beobachtung eines Nachbarn.
   * Dieselbe Grenze, an der schon die Verlaufsableitung haltmacht.
   */
  const journalDeckt = aktenzeichen !== null
    && relevante.length === 1 && relevante[0]?.aktenzeichen === aktenzeichen;

  /**
   * Die Chroniken ALLER Teilvorhaben dieser Zeile — ein Lesevorgang, geteilt
   * mit der Historie-Sektion (`useJournalChroniken`).
   *
   * **Gelesen wird bis zum Stichtag, nicht bis zum Bezugszeitpunkt.** Bis v4.56
   * ging das Haltedatum als `heuteIso` in `chronikFuerAntrag` — ein Altfall mit
   * Haltedatum 2018 lud damit gar keine Monatsdatei, weil das Journal 2026
   * beginnt. Das war kein Entwurf, sondern eine Verwechslung von Achsenende und
   * Uhr. Die Wirkung ist einseitig: mehr belegte Statuswechsel können die
   * Konfidenz eines Übergangs nur **anheben** und die Herkunft von „abgeleitet"
   * auf „beobachtet" drehen — die Richtung, für die es das Journal gibt.
   */
  const journal = useJournalChroniken(
    useMemo(() => relevante.map(t => t.aktenzeichen), [relevante]),
    stichtag,
  );

  /** Die Chronik des Teilvorhabens, um das es in DIESER Zeile geht. */
  const chronik = useMemo(
    () => (aktenzeichen === null
      ? null
      : journal.chroniken?.find(c => c.antragId === aktenzeichen) ?? null),
    [journal.chroniken, aktenzeichen],
  );

  /**
   * **Erster Durchgang, mit dem nackten Stichtag.** `baueUebergaenge` nimmt den
   * Bezugszeitpunkt gar nicht entgegen — nur `baueSegmente` tut das. Die
   * Übergänge dieses Laufs sind deshalb dieselben wie die des endgültigen, und
   * aus ihrer letzten Kante kommt das Haltedatum, das die Frist erst braucht.
   * Ohne diesen Trick wäre es ein Zirkelschluss.
   */
  const spurenVorlaeufig = useMemo(
    () => baueSpuren(quelle, verbundId, aktenzeichen, stichtag, chronik, einTv, datenStand),
    [quelle, verbundId, aktenzeichen, stichtag, chronik, einTv, datenStand],
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

  /**
   * **Zweiter Durchgang, jetzt mit dem Haltedatum.** Nur die Segmente ändern
   * sich; kam kein Haltedatum heraus, ist der Bezugszeitpunkt der Stichtag und
   * der erste Lauf wird unverändert weitergereicht — dann läuft nichts zweimal.
   */
  const spuren = useMemo<VerlaufsSpur[]>(
    () => (bezugsZeitpunkt === stichtag
      ? spurenVorlaeufig
      : baueSpuren(quelle, verbundId, aktenzeichen, bezugsZeitpunkt, chronik, einTv, datenStand)),
    [spurenVorlaeufig, bezugsZeitpunkt, stichtag, quelle, verbundId, aktenzeichen, chronik, einTv, datenStand],
  );

  return {
    laden: quelle.laden,
    spuren,
    frist,
    vorkommen,
    jeTeilvorhaben: relevante,
    bezugsZeitpunkt,
    // Der Nullpunkt gilt für den ganzen Bestand und steht deshalb auch an einer
    // Verbund-Zeile (§12.2). Die letzte Änderung tut das NICHT — sie bleibt an
    // die Ein-TV-Regel gebunden, sonst erbt der Stillstands-Wächter die
    // Beobachtung eines Nachbarn (Guard `kein-nullpunkt-als-letzte-aenderung`).
    journalAb: journal.journalAb,
    journalAenderung: journalDeckt ? (chronik?.letzteAenderung ?? null) : null,
    journalGenutzt: einTv && chronik !== null,
    journalDeckt,
    chroniken: journal.chroniken,
    journalLaden: journal.laden,
    quelle,
  };
}
