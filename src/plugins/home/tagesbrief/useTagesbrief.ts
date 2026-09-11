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
 * gecachten Lauf und kostet dafür nichts. Die Frist-Anlässe teilt er sich mit
 * dem Fristen-Widget (`useFristAnlaesse`, v6.45 gehoben) — eine Herleitung, zwei
 * Leser, kein Drift.
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
import { aufgabeAusBestand, aufgabenAnzeige } from '@/core/status';
import { letzterNachtLauf } from '@/core/status';
import { schrittText } from '@/core/utils/naechsterSchritt';
import { useMeineFeedbackIdentitaet } from '@/core/hooks/useMeineFeedbackIdentitaet';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { antragMatchesBearbeiter } from '@/plugins/antraege/bearbeiterFilter';
import { useAntraegeStore } from '@/plugins/antraege/store';
import type { JournalEintrag } from '@/core/status/journal/typen';
import { getFeedbackList } from '@/core/services/feedback';
import type { FeedbackItem } from '@/core/types/feedback';
import { readCachedSkillRegistry } from '@/core/services/skills';
import { useFristAnlaesse } from '../widgets/useFristAnlaesse';
import { useQsFreigaben } from '../widgets/useQsFreigaben';
import { useFeedbackNewsAnchor } from '../widgets/useFeedbackNewsAnchor';
import { berechneFeedbackNews } from '../widgets/feedbackNews';
import { zaehleRegistryAenderungen } from '../widgets/registryAenderungen';
import { useWeitermachenRows } from '../WeitermachenSection';
import type { HomeWidgetContext } from '../widgets/widgetProps';
import type { AntragVorgang } from '../dashboardAggregate';
import { baueBrief } from './baueBrief';
import {
  entwuerfePunkt, feedbackPunkt, meilensteinPunkte, nachtlaufPunkt, neuPunkt,
  registryPunkt, stillstandPunkte, weitermachenPunkt, zuTunPunkte,
  type AufgabeRoh, type AufgabeText, type FristRoh,
} from './punkte';
import { aktiveThemen } from './themen';
import type { Brief, BriefPunkt, ThemaId } from './typen';

/**
 * So viele Kandidaten je Uhr-Thema — mehr braucht der Deckel nie, und die
 * teuren Schritte (`aufgabeAusBestand` je Vorgang) laufen nur für diese.
 */
const KANDIDATEN = 8;

/** Der Zugang eines Journal-Eintrags: ein Antrag, der erstmals im Export stand. */
const ART_NEU = 'antrag-neu';

interface Journalstand {
  /** Vorgänge mit mindestens einer Feld-Änderung (ohne `antrag-neu`). */
  geaendert: number;
  /** Anträge, die erstmals im Export standen. */
  neu: number;
}

export function useTagesbrief(aktiv: boolean, ctx: HomeWidgetContext, aus: readonly ThemaId[]): Brief {
  const idb = useStorage().idb;
  // EIN Stichtag je Mount — in alle reinen Bausteine injiziert (Muster der
  // übrigen Karten; ein wandernder Stichtag entwertete den Bestands-Cache).
  const heuteRef = useRef<string>(new Date().toISOString());
  const jetztRef = useRef<number>(Date.parse(heuteRef.current));

  const themen = useMemo(() => aktiveThemen(aus), [aus]);

  // ------------------------------------------------------------- Quellen --

  /** verbund_id → Akronym, aus dem bereits berechneten Dashboard-Aggregat. */
  const meineVerbuende = useMemo(() => {
    const m = new Map<string, string>();
    for (const a of ctx.data.meineAntraege) {
      if (!a.verbund_id || m.has(a.verbund_id)) continue;
      m.set(a.verbund_id, a.acronym ?? a.verbund_titel ?? a.title ?? a.verbund_id);
    }
    return m;
  }, [ctx.data.meineAntraege]);

  const fristen = useFristAnlaesse(aktiv, meineVerbuende, heuteRef.current);
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
  const meineAkten = useMemo(() => {
    const s = new Set<string>();
    for (const a of alleAntraege) {
      if (!bearbeiterMode.active || antragMatchesBearbeiter(a, bearbeiterMode)) s.add(a.aktenzeichen);
    }
    return s;
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
    const betroffen = new Set<string>();
    let neu = 0;
    for (const e of journalRoh) {
      // Ein Eintrag zu einem Antrag außerhalb des Ausschnitts geht diesen Leser
      // nichts an. `antrag-neu` ist die Ausnahme: ein eben erst eingetroffener
      // Antrag steht noch in keinem Aggregat — ihn hier wegzufiltern hieße, den
      // Zugang nie zu melden.
      const drin = meineAkten.has(e.antragId);
      if (e.art === ART_NEU) { if (drin || meineAkten.size === 0) neu += 1; continue; }
      if (!drin) continue;
      betroffen.add(e.antragId);
    }
    return { geaendert: betroffen.size, neu };
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
    // die alte Status-Formel. EINE Rechnung für alle Uhr-Themen: rankt ein
    // Meilenstein den Verbund, verdrängt er dessen To-do-Punkt, und der Satz muss
    // die Aufgabe dann selbst sprechen. Gemessen 11.09.2026: „KITED ist seit 227
    // Tagen fällig (QS freigegeben und versendet)" über einer Karte, die
    // „Stellungnahme RNE prüfen" sagte.
    const aufgabeFuer = (a: AntragVorgang): AufgabeText | null => {
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
      return {
        text: anzeige.text,
        rueckfall: anzeige.quelle === 'rueckfall',
        vorlaeufig: anzeige.vorlaeufig === true,
      };
    };

    /** verbund_id → der Eintrag der Karte (Verbünde stehen dort als einer). */
    const vorgangVon = new Map<string, AntragVorgang>();
    for (const a of ctx.data.meineAntraege) {
      if (a.verbund_id && !vorgangVon.has(a.verbund_id)) vorgangVon.set(a.verbund_id, a);
    }

    // Frist-Anlässe: EINE Quelle, zwei Themen — getrennt nach ihrer Art, weil
    // Zieltage Stillstand messen und Meilensteine einen Termin ab Eingang
    // (CONTEXT.md). Vorzeichen gedreht: `ueberTage` zählt Tage ÜBER dem
    // Vorgesehenen, `BriefPunkt.tage` Tage BIS zur Fälligkeit.
    const roh = (a: (typeof fristen.anlaesse)[number]): FristRoh => {
      const vorgang = vorgangVon.get(a.verbundId);
      const aufgabe = vorgang ? aufgabeFuer(vorgang) : null;
      return {
        verbundId: a.verbundId,
        akronym: a.akronym,
        grund: a.grund,
        tage: -(a.ueberTage ?? 0),
        weitere: a.weitere ?? 0,
        ...(aufgabe ? { aufgabe } : {}),
      };
    };
    const bezifferbar = fristen.anlaesse.filter(a => a.ueberTage !== null);
    if (themen.has('fristen')) {
      raus.push(...meilensteinPunkte(
        bezifferbar.filter(a => a.art === 'meilenstein').slice(0, KANDIDATEN).map(roh),
      ));
    }
    if (themen.has('stillstand')) {
      raus.push(...stillstandPunkte(
        bezifferbar.filter(a => a.art === 'zieltag').slice(0, KANDIDATEN).map(roh),
      ));
    }

    // Was zu tun ist: die Vorgänge mit laufender Uhr, dringlichste zuerst. Der
    // Text kommt aus `aufgabeFuer` (s.o.).
    if (themen.has('zu-tun')) {
      // Grundmenge, Uhr und Namen kommen aus DEMSELBEN Aggregat, das die Karte
      // „Meine Anträge" rendert — nicht aus dem rohen Bestandslauf.
      //
      // Gemessen, warum: über `bestand.zeilen` lief der Brief über alle ~12 000
      // Zeilen und nahm die rohe `restTage`. An der Spitze standen dann drei
      // Vorgänge mit „seit 4028 Tagen überfällig" (Aktenzeichen von 2015, ohne
      // Akronym), während die Karte zwanzig Pixel darunter 13 Einträge mit
      // höchstens 223 Tagen zeigte. `fristTage` ist dagegen `null`, wo die Uhr
      // steht (`criticalFristErgebnis`, dieselbe Engine wie die Fördertabelle) —
      // dieselbe Lehre wie v4.131.
      const kandidaten = ctx.data.meineAntraege
        .filter(a => typeof a.fristTage === 'number')
        .sort((a, b) => (a.fristTage as number) - (b.fristTage as number))
        .slice(0, KANDIDATEN);
      const aufgaben: AufgabeRoh[] = [];
      for (const a of kandidaten) {
        const aufgabe = aufgabeFuer(a);
        if (!aufgabe) continue;
        // `aufgabeFuer` liefert nur bei mindestens einem Aktenzeichen etwas.
        const akte = a.tv_aktenzeichen![0]!;
        aufgaben.push({
          scopeId: a.verbund_id ?? akte,
          titel: a.acronym ?? a.verbund_titel ?? a.title ?? akte,
          ...aufgabe,
          tage: a.fristTage as number,
        });
      }
      raus.push(...zuTunPunkte(aufgaben));
    }

    // --- ohne Uhr: der Nachsatz ---
    if (themen.has('nachtlauf') && journal) {
      const p = nachtlaufPunkt(journal.geaendert, 'über Nacht');
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
    themen, fristen.anlaesse, bestand.zeilen, bestand.nachAktenzeichen, zeilenAufgaben,
    ctx.data.meineAntraege, meineVerbuende, journal, qsZeilen, weitermachen, feedbackItems, anker, ich, registryAnzahl,
  ]);

  // Solange irgendeine Quelle unterwegs ist, ist Leere kein Befund.
  // Ein vorläufiger Stand ist kein Warten: der Brief steht, nur seine To-dos
  // tragen den Vermerk — und der Zähler bleibt eine Zahl.
  const laedt = fristen.laden || bestand.laden
    || (zeilenAufgaben.laeuftNoch && !zeilenAufgaben.vorlaeufig) || journal === null;

  return useMemo(
    () => baueBrief({ punkte, aktiv: themen, laedt }),
    [punkte, themen, laedt],
  );
}
