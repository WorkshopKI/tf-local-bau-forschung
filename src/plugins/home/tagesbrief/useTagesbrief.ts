/**
 * Tagesbrief — die Verdrahtung (unrein).
 *
 * Sammelt die Rohdaten aus den **bestehenden** Quellen und übergibt sie den
 * reinen Bauern (`punkte.ts`) und der reinen Komposition (`baueBrief.ts`). Alles
 * Unreine — Hooks, IDB, Uhr — lebt hier und nur hier.
 *
 * **Kosten.** Die Startseite startet den Bestandslauf der To-do-Kaskade ohnehin
 * viermal mit `'leerlauf'` (useDashboardData, useEingangAmpelCounts,
 * MeineAntraegeSection, AntragKanbanWidget); der Brief hängt sich an denselben
 * gecachten Lauf und kostet dafür nichts. „Jetzt eingreifen" teilt er sich mit
 * der Fristen-Karte (`useFristenLage`, v6.67) — eine Herleitung, zwei Leser, kein
 * Drift. Die Meilenstein-Projektion liest er dafür mit, um den nächsten fälligen
 * Meilenstein zu nennen; einen eigenen Meilenstein-Satz spricht er nicht
 * (s. `themen.ts`).
 *
 * **Ausnahme Auslastung.** Das einzige Thema, dessen Quelle sonst niemand auf
 * der Startseite lädt: sein Datenstand kostet zwei Läufe über den vollen
 * Antragsbestand. Der Brief **stößt ihn nicht an** — er liest ihn, wenn er
 * ohnehin geladen ist (weil das Auslastungs-Widget offen war), und schweigt
 * sonst. Eine Karte, die eine andere Karte teuer macht, wäre der falsche Handel.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useBestandsAufgaben, useZeilenAufgaben } from '@/core/hooks/useBestandsAufgaben';
import { useBestandGeneration } from '@/core/hooks/useBestandGeneration';
import {
  adresseFuerWaechter, adresseTeile, aufgabeAusBestand, aufgabenAnzeige, type AdressTeile,
} from '@/core/status';
import { letzterNachtLauf } from '@/core/status';
import { schrittText } from '@/core/utils/naechsterSchritt';
import { useMeineFeedbackIdentitaet } from '@/core/hooks/useMeineFeedbackIdentitaet';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { antragMatchesBearbeiter } from '@/plugins/antraege/bearbeiterFilter';
import { useAntraegeStore } from '@/plugins/antraege/store';
// Direkt aus dem Modul, nicht über das Plugin-Barrel: gebraucht wird die reine
// Vierteilung, nicht das Plugin samt Seite.
import { zustaendigkeitVon } from '@/plugins/vorgangs-board/zustaendigkeit';
import type { JournalEintrag } from '@/core/status/journal/typen';
import { getFeedbackList } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';
import { readCachedSkillRegistry } from '@/core/services/skills';
import { drohtInTagen } from '../widgets/fristenLage';
import { useFristenLage } from '../widgets/useFristenLage';
import { useQsFreigaben } from '../widgets/useQsFreigaben';
import { useFeedbackNewsAnchor } from '../widgets/useFeedbackNewsAnchor';
import { berechneFeedbackNews } from '../widgets/feedbackNews';
import { zaehleRegistryAenderungen } from '../widgets/registryAenderungen';
import { useWeitermachenRows } from '../WeitermachenSection';
import type { HomeWidgetContext } from '../widgets/widgetProps';
import type { AntragVorgang } from '../dashboardAggregate';
import { baueBrief, DRINGLICH_AB_TAGEN } from './baueBrief';
import { nachtlaufNamen, type AntragKopf, type NachtlaufName } from './nachtlaufNamen';
import {
  entwuerfePunkt, feedbackPunkt, kuerzelStatusPunkt, liegtBeiAnderenPunkte, nachtlaufPunkt, neuPunkt,
  registryPunkt, stillstandPunkte, weitermachenPunkt, zuTunPunkte,
  type AufgabeRoh, type AufgabeText, type FremdRoh, type FristRoh, type WiderspruchRoh,
} from './punkte';
import { aktiveThemen } from './themen';
import type { Brief, BriefPunkt, ThemaId } from './typen';

/**
 * So viele eigene Punkte je Uhr-Thema — mehr braucht der Deckel nie. Gekappt
 * wird NACH der Einordnung „wer ist dran": vorher gekappt leerte sich die
 * eigene Liste, sobald die dringlichsten Kandidaten bei anderen liegen.
 */
const KANDIDATEN = 8;

/** Der Zugang eines Journal-Eintrags: ein Antrag, der erstmals im Export stand. */
const ART_NEU = 'antrag-neu';

interface Journalstand {
  /** Die geänderten Vorgänge mit Namen (ohne `antrag-neu`), je Verbund einer. */
  namen: NachtlaufName[];
  /** Anträge, die erstmals im Export standen. */
  neu: number;
}

/**
 * Eine Aufgabe und wer an ihr dran ist.
 *
 * `meine` rankt, `andere` steht unter „Liegt bei anderen", `fertig` spricht gar
 * nicht: für den Leser ist nichts zu tun, und niemand sonst ist benannt.
 */
interface Einordnung {
  aufgabe: AufgabeText;
  dran: 'meine' | 'andere' | 'fertig';
  /** Die Adresse bei `andere`; sonst `null`. */
  adresse: AdressTeile | null;
}

export function useTagesbrief(aktiv: boolean, ctx: HomeWidgetContext, aus: readonly ThemaId[]): Brief {
  const idb = useStorage().idb;
  // EIN Stichtag je Mount — in alle reinen Bausteine injiziert (Muster der
  // übrigen Karten; ein wandernder Stichtag entwertete den Bestands-Cache).
  const heuteRef = useRef<string>(new Date().toISOString());
  const jetztRef = useRef<number>(Date.parse(heuteRef.current));

  const themen = useMemo(() => aktiveThemen(aus), [aus]);

  // ------------------------------------------------------------- Quellen --

  // Dieselbe Lage wie die Fristen-Karte; der Brief spricht nur „Jetzt eingreifen".
  const lage = useFristenLage(aktiv && themen.has('stillstand'), ctx.data.meineAntraege, heuteRef.current);
  const bestand = useBestandsAufgaben('leerlauf', heuteRef.current);
  const zeilenAufgaben = useZeilenAufgaben('leerlauf', heuteRef.current);
  const { zeilen: qsZeilen } = useQsFreigaben(aktiv);
  const weitermachen = useWeitermachenRows()[0] ?? null;

  /**
   * Die Aktenzeichen, die das Journal des Briefs zählen darf.
   *
   * **Nicht** `meineAntraege`: das ist die Arbeitsliste (nicht-terminal), und
   * ein Statuswechsel betrifft gerade auch abgeschlossene Vorgänge. Gezählt wird
   * deshalb wie in der Karte „Änderungen der letzten Nacht" — der volle
   * Antragsbestand, eingeschränkt auf den Bearbeiter-Ausschnitt der Kopfzeile.
   * Dieselbe Rechnung, nicht eine zweite: ohne sie zählte der Brief 262
   * Vorgänge unter einem Chip, der „Kürzel ATh" sagt, mit `meineAntraege` nur 2
   * — die Karte nannte beide Male 7 (gemessen 09.09.2026).
   */
  const { mode: bearbeiterMode } = useBearbeiterSicht();
  const alleAntraege = useAntraegeStore(s => s.antraege);
  // Aktenzeichen → Verbund und Akronym: der Brief nennt die Änderungen je
  // Vorgang, nicht je Teilvorhaben (`nachtlaufNamen`).
  const meineAkten = useMemo(() => {
    const m = new Map<string, AntragKopf>();
    for (const a of alleAntraege) {
      if (bearbeiterMode.active && !antragMatchesBearbeiter(a, bearbeiterMode)) continue;
      m.set(a.aktenzeichen, { verbund_id: a.verbund_id, akronym: a.akronym });
    }
    return m;
  }, [alleAntraege, bearbeiterMode]);

  // Die Generation gehört in die Abhängigkeiten: ein Import schreibt einen neuen
  // Nachtlauf ins Journal, und ohne sie nannte der Satz bis zum Reload die Zahl
  // von davor (gemessen 11.09.2026 — kein Journal-Read nach dem Bestandswechsel).
  const generation = useBestandGeneration();
  const [journalRoh, setJournalRoh] = useState<JournalEintrag[] | null>(null);
  useEffect(() => {
    if (!aktiv) return;
    let abgebrochen = false;
    void (async () => {
      const lauf = await letzterNachtLauf(idb).catch(() => null);
      if (!abgebrochen) setJournalRoh(lauf?.eintraege ?? []);
    })();
    return () => { abgebrochen = true; };
  }, [idb, aktiv, generation]);

  const journal = useMemo((): Journalstand | null => {
    if (journalRoh === null) return null;
    const geaendert: JournalEintrag[] = [];
    let neu = 0;
    for (const e of journalRoh) {
      // Ein Eintrag zu einem Antrag außerhalb des Ausschnitts geht diesen Leser
      // nichts an. `antrag-neu` ist die Ausnahme: ein eben erst eingetroffener
      // Antrag steht noch in keinem Aggregat — ihn hier wegzufiltern hieße, den
      // Zugang nie zu melden.
      const drin = meineAkten.has(e.antragId);
      if (e.art === ART_NEU) { if (drin || meineAkten.size === 0) neu += 1; continue; }
      if (!drin) continue;
      geaendert.push(e);
    }
    return { namen: nachtlaufNamen(geaendert, id => meineAkten.get(id)), neu };
  }, [journalRoh, meineAkten]);

  const ich = useMeineFeedbackIdentitaet();
  const { anker } = useFeedbackNewsAnchor(ich);
  const [feedbackItems, setFeedbackItems] = useState<FeedbackItem[] | null>(null);
  useEffect(() => {
    if (!aktiv) return;
    let abgebrochen = false;
    getFeedbackList({ idb } as never)
      .then(l => { if (!abgebrochen) setFeedbackItems(l); })
      .catch(() => { if (!abgebrochen) setFeedbackItems([]); });
    return () => { abgebrochen = true; };
  }, [idb, aktiv]);

  const [registryAnzahl, setRegistryAnzahl] = useState(0);
  useEffect(() => {
    if (!aktiv || !themen.has('registry')) return;
    let abgebrochen = false;
    readCachedSkillRegistry(idb)
      .then(f => { if (!abgebrochen && f) setRegistryAnzahl(zaehleRegistryAenderungen(f.skills, f.regeln)); })
      .catch(() => { /* eine Quelle, die schweigt, nimmt die anderen nicht mit */ });
    return () => { abgebrochen = true; };
  }, [idb, aktiv, themen]);

  // ------------------------------------------------------------- Sätze --

  const punkte = useMemo((): BriefPunkt[] => {
    const raus: BriefPunkt[] = [];

    // Die Handlung an einem Vorgang: `aufgabenAnzeige` — dieselbe Formel wie die
    // Zeilen der Karte „Meine Anträge", inklusive des BESCHRIFTETEN Rückfalls auf
    // die alte Status-Formel. EINE Rechnung für beide Uhr-Themen: rankt ein
    // Stillstand den Verbund, verdrängt er dessen To-do-Punkt, und der Satz muss
    // die Aufgabe dann selbst sprechen. Gemessen 11.09.2026 (damals am
    // Meilenstein): „KITED ist seit 227 Tagen fällig (QS freigegeben und
    // versendet)" über einer Karte, die „Stellungnahme RNE prüfen" sagte.
    //
    // Dazu **wer dran ist** (v6.61): dieselbe Vierteilung wie das Vorgangs-Board
    // (`zustaendigkeitVon`), gelesen gegen die Rolle des LESERS. Gemessen
    // 11.09.2026 (Kürzel THü, liest als FB): oben standen AIRES „GA schreiben"
    // (liegt bei AB) und zwei Vorgänge mit „Keine Aufgabe mehr", deren FB-Teil
    // durch war und die beim AB lagen. Rückfall und Platzhalter ranken wie
    // bisher; über sie weiß der Brief nicht mehr als die Karte.
    const einordnen = (a: AntragVorgang): Einordnung | null => {
      const akten = a.tv_aktenzeichen ?? [];
      if (akten.length === 0) return null;
      const aufgabe = aufgabeAusBestand(
        akten, bestand.nachAktenzeichen, zeilenAufgaben.rolle, zeilenAufgaben.ohneRegeln,
      );
      const statusRoh = a.status ?? '';
      const anzeige = aufgabenAnzeige({
        aufgabe,
        rueckfall: schrittText(statusRoh),
        laeuftNoch: zeilenAufgaben.laeuftNoch,
        vorlaeufig: zeilenAufgaben.vorlaeufig,
        ausserhalbLauf: zeilenAufgaben.ausserhalb(akten),
        regeln: zeilenAufgaben.regeln,
        status: statusRoh,
      });
      if (!anzeige.text.trim()) return null;
      const text: AufgabeText = {
        text: anzeige.text,
        rueckfall: anzeige.quelle === 'rueckfall',
        vorlaeufig: anzeige.vorlaeufig === true,
      };
      if (anzeige.quelle === 'gesperrt') {
        // Für die eigene Rolle griff eine Sperre („Keine Aufgabe mehr") — der
        // Vorgang kann trotzdem bei jemand anderem liegen. Die Adresse kommt
        // dann aus dem AB-Satz, wie die „Liegt bei"-Kachel und der
        // Stillstands-Wächter sie lesen. Nennt er niemanden (oder die
        // Teilvorhaben sind uneinig), ist hier nichts zu melden.
        const jeTv = akten.flatMap(x => {
          const z = bestand.nachAktenzeichen.get(x);
          return z ? [z] : [];
        });
        const lage = adresseFuerWaechter(jeTv);
        const adresse = lage.todo ? adresseTeile(lage.todo) : null;
        return { aufgabe: text, dran: adresse ? 'andere' : 'fertig', adresse };
      }
      const ergebnis = aufgabe?.ergebnis ?? null;
      const traf = anzeige.quelle === 'kaskade' || anzeige.quelle === 'fremd';
      const adresse = traf && ergebnis ? adresseTeile(ergebnis) : null;
      const andere = adresse !== null && ergebnis !== null
        && zustaendigkeitVon(ergebnis, zeilenAufgaben.rolle) === 'warten';
      return { aufgabe: text, dran: andere ? 'andere' : 'meine', adresse: andere ? adresse : null };
    };

    /** verbund_id → der Eintrag der Karte (Verbünde stehen dort als einer). */
    const vorgangVon = new Map<string, AntragVorgang>();
    for (const a of ctx.data.meineAntraege) {
      if (a.verbund_id && !vorgangVon.has(a.verbund_id)) vorgangVon.set(a.verbund_id, a);
    }

    /** Was bei anderen liegt — aus beiden Uhr-Quellen; je Vorgang einmal (im Bauer). */
    const fremde: FremdRoh[] = [];

    // Solange die Kaskade zum ersten Mal rechnet, weiß der Brief nicht, wer dran
    // ist — er rankt dann gar nicht, statt Vorgänge zu zeigen, die Sekunden
    // später in den Nachsatz springen (gemessen nach einem Reload am
    // 11.09.2026: AIRES und DIVA NOTE standen mit „…" oben und wanderten dann
    // zu „bei AB liegen …"). Ein vorläufiger Stand von vor dem Import ist kein
    // Warten: er ist beschriftet und bleibt stehen.
    const kaskadeFehlt = zeilenAufgaben.laeuftNoch && !zeilenAufgaben.vorlaeufig;

    // Jetzt eingreifen: keine Bewegung bei laufender, nicht überschrittener
    // Frist — die Gruppe der Fristen-Karte (`fristenLage.ts`). Laut Kürzeln
    // Erledigtes steht dort schon nicht drin; es ist ein Befund unter
    // „Kürzel ↔ Status". Der Rang ist, was zuerst reißt — der nächste
    // Meilenstein oder die Frist (`drohtInTagen`, dieselbe Reihenfolge wie die Karte).
    const stillstand: FristRoh[] = [];
    for (const z of kaskadeFehlt ? [] : lage.zeilen) {
      if (z.gruppe !== 'eingreifen' || z.bewegung === null) continue;
      const naechsterTage = z.meilensteine?.naechster?.tageBis ?? null;
      const tage = drohtInTagen(z);
      const vorgang = vorgangVon.get(z.verbundId);
      const e = vorgang ? einordnen(vorgang) : null;
      if (e?.dran === 'fertig') continue;
      if (e?.dran === 'andere' && e.adresse) {
        if (tage <= DRINGLICH_AB_TAGEN) {
          fremde.push({ scopeId: z.verbundId, titel: z.akronym, tage, adresse: e.adresse });
        }
        continue;
      }
      stillstand.push({
        verbundId: z.verbundId,
        akronym: z.akronym,
        grund: z.bewegung.grund?.text ?? '',
        tage,
        liegeTage: z.bewegung.liegeTage,
        zieltage: z.bewegung.zieltage,
        belegt: z.bewegung.belegt,
        naechsterTage,
        ...(e ? { aufgabe: e.aufgabe } : {}),
      });
    }
    if (themen.has('stillstand')) raus.push(...stillstandPunkte(stillstand.slice(0, KANDIDATEN)));

    // Was zu tun ist: die Vorgänge mit laufender Uhr, dringlichste zuerst.
    //
    // Grundmenge, Uhr und Namen kommen aus DEMSELBEN Aggregat, das die Karte
    // „Meine Anträge" rendert — nicht aus dem rohen Bestandslauf. Gemessen,
    // warum: über `bestand.zeilen` lief der Brief über alle ~12 000 Zeilen und
    // nahm die rohe `restTage`. An der Spitze standen dann drei Vorgänge mit
    // „seit 4028 Tagen überfällig" (Aktenzeichen von 2015, ohne Akronym),
    // während die Karte zwanzig Pixel darunter 13 Einträge mit höchstens 223
    // Tagen zeigte. `fristTage` ist dagegen `null`, wo die Uhr steht
    // (`criticalFristErgebnis`, dieselbe Engine wie die Fördertabelle) —
    // dieselbe Lehre wie v4.131.
    const aufgaben: AufgabeRoh[] = [];
    const widersprueche: WiderspruchRoh[] = [];
    for (const a of ctx.data.meineAntraege) {
      const akte = a.tv_aktenzeichen?.[0] ?? a.id;
      const scopeId = a.verbund_id ?? akte;
      const titel = a.acronym ?? a.verbund_titel ?? a.title ?? akte;
      // Laut Kürzeln erledigt: dieselbe Menge, die „Meine Anträge" als
      // Zählzeile führt und nicht mehr als offen zählt — gelesen, nicht neu
      // hergeleitet. Aus der Rangliste bleibt der Vorgang auch dann, wenn das
      // Thema abgewählt ist: eine Aufgabe ist er nicht.
      if (a.erledigtLautKuerzeln) {
        widersprueche.push({ scopeId, titel, status: a.status ?? '' });
        continue;
      }
      if (kaskadeFehlt || typeof a.fristTage !== 'number' || a.fristTage > DRINGLICH_AB_TAGEN) continue;
      const e = einordnen(a);
      if (!e || e.dran === 'fertig') continue;
      if (e.dran === 'andere' && e.adresse) {
        fremde.push({ scopeId, titel, tage: a.fristTage, adresse: e.adresse });
        continue;
      }
      aufgaben.push({ scopeId, titel, ...e.aufgabe, tage: a.fristTage });
    }
    if (themen.has('zu-tun')) {
      raus.push(...zuTunPunkte(aufgaben.sort((x, y) => x.tage - y.tage).slice(0, KANDIDATEN)));
    }
    if (themen.has('liegt-bei-anderen')) raus.push(...liegtBeiAnderenPunkte(fremde));
    if (themen.has('kuerzel-status')) {
      const p = kuerzelStatusPunkt(widersprueche);
      if (p) raus.push(p);
    }

    // --- ohne Uhr: der Nachsatz ---
    if (themen.has('nachtlauf') && journal) {
      const p = nachtlaufPunkt(journal.namen, 'über Nacht');
      if (p) raus.push(p);
    }
    if (themen.has('eingang') && journal) {
      const p = neuPunkt(journal.neu);
      if (p) raus.push(p);
    }
    if (themen.has('entwuerfe')) {
      const p = entwuerfePunkt(qsZeilen.length, qsZeilen[0]?.scopeId ?? null);
      if (p) raus.push(p);
    }
    if (themen.has('weitermachen') && weitermachen) {
      // Akronym vor Titel — dieselbe Vorzugsreihenfolge wie die Resume-Karte;
      // `fkz` ist zugleich das Deep-Link-Ziel.
      const a = weitermachen.anzeige;
      const p = weitermachenPunkt(a.akronym || a.titel || a.fkz, a.fkz);
      if (p) raus.push(p);
    }
    if (themen.has('feedback') && feedbackItems && anker) {
      const news = berechneFeedbackNews(feedbackItems, ich, anker, Number.MAX_SAFE_INTEGER, jetztRef.current);
      const p = feedbackPunkt(news.length);
      if (p) raus.push(p);
    }
    if (themen.has('registry')) {
      const p = registryPunkt(registryAnzahl);
      if (p) raus.push(p);
    }

    return raus;
  }, [
    themen, lage.zeilen, bestand.zeilen, bestand.nachAktenzeichen, zeilenAufgaben,
    ctx.data.meineAntraege, journal, qsZeilen, weitermachen, feedbackItems, anker, ich, registryAnzahl,
  ]);

  // Solange irgendeine Quelle unterwegs ist, ist Leere kein Befund.
  // Ein vorläufiger Stand ist kein Warten: der Brief steht, nur seine To-dos
  // tragen den Vermerk — und der Zähler bleibt eine Zahl.
  const laedt = lage.laden || bestand.laden
    || (zeilenAufgaben.laeuftNoch && !zeilenAufgaben.vorlaeufig) || journal === null;

  return useMemo(
    () => baueBrief({ punkte, aktiv: themen, laedt }),
    [punkte, themen, laedt],
  );
}
