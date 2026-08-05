/**
 * Zustand + IO des Status-Cockpits.
 *
 * Lädt die aktive Katalog-Version, den Bestand (alle Verbünde/Anträge für
 * Vorkommen + Diagnose), die CSV-Schemas (Spalten-Herkunft je Feld) und das
 * Event-Log („zuletzt gesehen"). Hält einen editierbaren Entwurf; Speichern legt
 * eine neue Version an, aktiviert sie, setzt den `getStatusCategory`-Snapshot neu
 * und veröffentlicht sie auf dem Daten-Share (der Katalog gilt team-weit).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { useKuratorSession } from '@/core/hooks/useKuratorSession';
import { canWriteDatenShare } from '@/config/feature-flags';
import {
  listProgramme, listVerbuendeByProgramm, listAntraegeByProgramm, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import type { CsvSchema } from '@/core/services/csv/types';
import { pickSchemaSnapshotFile } from '@/plugins/csv-sources-kuration/csv-file-picker';
import { programmNummernVon } from '@/plugins/antraege/status/programmNummer';
import { downloadAsFile } from '@/core/services/search/eval/eval-export';
import {
  ladeAktiveVersion, listeVersionen, speichereVersion, setzeAktiv, naechsteVersionsnummer,
  getVersion, ladeUnkuratiert, speichereUnkuratiert, setStatusKatalogSnapshot, getAlleEvents,
  ladeUnkuratierteFelder, speichereUnkuratierteFelder, pruneKuratierteFelder,
  baueVerbundFelder, zaehleVorkommen, zuletztGesehen,
  csvSpaltenJeFeld, baueFeldAufloesung,
  aendereWert, aendereFeld, aendereTodoRegel, verschiebeTodoRegel,
  fuegeTodoRegelHinzu, codesMitRolle, ROLLE_LABEL,
  fuegeWertHinzu, fuegeFeldHinzu,
  fuegeKategorieHinzu, aendereKategorie, entferneKategorie, ergaenzeSeedFelder,
  seedTextAbweichungen, uebernimmSeedTexte, type TextAbweichung,
  uebernimmStatusCodes, ladeTrigger, speichereTrigger,
  vorgangssystemLuecke, ergaenzeVorgangssystemSeed,
  todoRegelDrift, zieheTodoRegelnNach, ENTFALLENE_REGEL_IDS, type TodoRegelDrift,
  setzeZieltage, waehleZieltageVorschlaege, MIN_STICHPROBE, type ZieltageAuswahl,
  setzeFeldPhasen, berechnePhasenVorschlag, schnittVon,
  pruefeZahPhasen, verwaisteZuordnungen, zahPhasenVon, type VerwaisteZuordnungen,
  aendereZahPhase, fuegeZahPhaseHinzu, entferneZahPhase, verschiebeZahPhase, setzeCodePhasen,
  type ZahPhase, type StatusCategory,
  type PhasenAuswahl,
  relevanzLuecke, markiereRelevanz, AB_DASHBOARD_RELEVANZ,
  findeStatusCode, medianLiegezeit, letzteAktivitaetVon, vorkommenAus,
  baueSeedVersion, KANONISCHE_CODE_FELDER, AB_TODO_REGELN,
  STATUS_CODE_KATALOG, SEED_ZAH_PHASEN, SEED_CODE_ZU_ZAH_PHASE,
  type TriggerStand, type VorgangssystemLuecke,
  SEED_KATEGORIEN,
  exportiereVersion, validiereImport,
  wertId, schreibeKatalogAufShare, vereinigeMitShare, leseKatalogVomShare, leseKatalogNummer,
  leseKatalogArchiv,
  synchronisiereKatalogVomShare, umnummeriereEigeneFassung, zaehleAbweichungen,
  type KatalogKonflikt, type StatusKatalogDatei,
  type MappingVersion, type StatusWertEintrag, type StatusFeldEintrag,
  type StatusKategorie, type UnkuratierterFund, type VerbundFelder,
  type StatusCodeEintrag, type TriggerZeile,
  type TodoRegel, type TextbausteinEintrag,
  type Bedingung, type PlatzhalterGruppe, type Rolle,
} from '@/core/status';

/** Der Konflikt, wie ihn die Oberfläche braucht: wer, wie weit, und was von mir. */
export interface KatalogKonfliktStand {
  konflikt: KatalogKonflikt;
  /** Wie viele Einträge die fremde Fassung anders führt als die eigene. */
  abweichungen: number;
  /** Nummer der eigenen, lokal bereits festgeschriebenen Fassung. */
  eigene: number | null;
}

export interface StatusCockpitApi {
  laden: boolean;
  fehler: string | null;
  aktiveVersion: MappingVersion | null;
  entwurf: MappingVersion | null;
  versionen: MappingVersion[];
  /**
   * Fassungen, die nur noch im Archiv liegen (nicht in `versionen`). Leer,
   * solange `archivLaden` nicht gerufen wurde.
   */
  archivFassungen: MappingVersion[];
  /** Ob das Archiv schon gelesen wurde — für „lädt …" gegen „ist leer". */
  archivGeladen: boolean;
  /** Archiv nachladen (beim Aufklappen der Versionsliste). */
  archivLaden: () => Promise<void>;
  unkuratiert: UnkuratierterFund[];
  /** In den CSV-Quellen gefundene Statusspalten, die der Katalog nicht kennt. */
  unkuratierteFelder: StatusFeldEintrag[];
  /** Wie viele Felder/Ordner die Auslieferung führt, die dem Entwurf fehlen. */
  seedLuecke: { felder: number; kategorien: number };
  /** Felder, deren Bezeichnung/Rollen von der Kürzel-Zuarbeit abweichen. */
  textAbweichungen: readonly TextAbweichung[];
  /** wertId → Anzahl Verbünde mit diesem (Feld,Wert). */
  vorkommen: Map<string, number>;
  /** wertId → jüngstes erfasstAm (ISO). */
  zuletzt: Map<string, string>;
  /** feldId → CSV-Spalten, aus denen das Feld gefüllt wird (Herkunft). */
  csvSpalten: Map<string, string[]>;
  /** Der geladene Bestand als reine Eingabe (Vorkommen, Zieltage-Vorschlag). */
  verbundFelder: VerbundFelder[];
  /** Der EINE Stichtag dieses Seitenaufrufs — in alle Engines injiziert. */
  stichtag: string;
  geaendert: boolean;
  speichernBusy: boolean;
  speichernFehler: string | null;
  /**
   * Die zuletzt gespeicherte Fassung liegt nur lokal — der Daten-Share war nicht
   * erreichbar oder der Build hat kein Schreibrecht. Sie gilt dann NICHT für das
   * Team; die Oberfläche sagt das und bietet einen erneuten Versuch an.
   */
  nurLokal: boolean;
  /** Zweiter Anlauf für den Share-Write nach `nurLokal`. */
  erneutAufShare: () => Promise<void>;
  /**
   * Jemand anderes hat veröffentlicht, während dieser Entwurf entstand. Die
   * eigene Arbeit ist lokal bereits festgeschrieben — offen ist nur die
   * Veröffentlichung. Bleibt stehen, bis einer der beiden Wege gewählt wurde.
   */
  konflikt: KatalogKonfliktStand | null;
  /** Ob der Konflikt gerade als Dialog vor dem Nutzer steht. */
  konfliktOffen: boolean;
  konfliktOeffnen: () => void;
  konfliktSchliessen: () => void;
  /** Eigene Fassung veröffentlichen; die fremde bleibt in der Datei. */
  trotzdemVeroeffentlichen: () => Promise<void>;
  /** Die fremde Fassung aktivieren; die eigene bleibt in der Fassungsliste. */
  fremdeFassungLaden: () => Promise<void>;
  /**
   * Frühwarnung: beim Zurückkommen ins Fenster lag auf dem Share eine neuere
   * aktive Fassung als die, auf der dieser Entwurf beruht. Kein automatisches
   * Umschalten — der Mensch entscheidet, wann er nachzieht.
   */
  neueFassungAufShare: number | null;
  setWert: (id: string, patch: Partial<StatusWertEintrag>) => void;
  setFeld: (feldId: string, patch: Partial<StatusFeldEintrag>) => void;
  setKategorie: (id: string, patch: Partial<StatusKategorie>) => void;
  addKategorie: (kategorie: StatusKategorie) => void;
  removeKategorie: (id: string) => void;
  /** Beschriftung, Arbeitslisten-Vorgabe und Zieltage-Relevanz einer Phase. */
  setZahPhase: (id: string, patch: Partial<ZahPhase>) => void;
  /** Legt eine Phase ans Ende an; über der Obergrenze ein No-op. */
  addZahPhase: (label: string, kategorieVorgabe: StatusCategory) => void;
  /** Entfernt eine Phase und hängt ihre Codes nach `zielId` um (`null` = ohne Phase). */
  removeZahPhase: (id: string, zielId: string | null) => void;
  /** Schiebt eine Phase an Position `index` (0-basiert, Anzeige-Reihenfolge). */
  moveZahPhase: (id: string, index: number) => void;
  /** Hängt Status-CODES um — beide Feld-Einträge in EINEM Schritt. */
  setCodePhase: (codes: readonly number[], zielId: string | null) => void;
  uebernehmen: (fund: UnkuratierterFund) => void;
  /** Ein entdecktes Feld in den Entwurf holen (aktiv, in den Sammelordner). */
  uebernehmeFeld: (feld: StatusFeldEintrag, kategorieId: string) => void;
  /** Fehlende Auslieferungs-Felder und -Ordner in den Entwurf nachziehen. */
  seedNachziehen: () => void;
  /** Bezeichnung + Rollen aus der Kürzel-Zuarbeit übernehmen (sonst nichts). */
  texteUebernehmen: () => void;
  /**
   * Darf dieser Build/Nutzer den Daten-Share schreiben? Steuert nur die
   * Sichtbarkeit der Bedienelemente — der physische Guard bleibt das self-gated
   * `schreibeKatalogAufShare` (Pitfall #25).
   */
  darfSchreiben: boolean;
  /** Importierten Status-Code-Katalog (+ Textbaustein-Legende) übernehmen. */
  statusCodesUebernehmen: (
    katalog: readonly StatusCodeEintrag[], textbausteine?: readonly TextbausteinEintrag[],
  ) => void;
  /** Was der Fassung aus der Vorgangssystem-Auslieferung fehlt (Codes/Phasen). */
  vorgangssystemLuecke: VorgangssystemLuecke;
  /** Codes, Varianten und ZAH-Phasen der Auslieferung nachziehen (additiv). */
  vorgangssystemNachziehen: () => void;
  /** Eine To-do-Regel ändern (Id und Position bleiben). */
  setTodoRegel: (id: string, patch: Partial<TodoRegel>) => void;
  /** Eine To-do-Regel um eine Position in der Kaskade verschieben. */
  verschiebeTodoRegel: (id: string, richtung: -1 | 1) => void;
  /** Den ausgelieferten AB-Regelsatz nachziehen (ersetzt die gelieferten Regeln). */
  todoRegelnNachziehen: () => void;
  /** Was die Auslieferung gegenüber der gepflegten Kaskade anders sagt. */
  todoDrift: TodoRegelDrift;
  /**
   * Status-Code → Median-Liegezeit im Bestand (Vorschlag für die Zieltage).
   * Näherung: gemessen wird die Zeit seit der jüngsten Aktivität, nicht die
   * echte Verweildauer im Status — die kennt der Export nicht.
   */
  liegezeitVorschlag: Map<number, { median: number; n: number }>;
  /**
   * Vorschau der Sammel-Übernahme: was gesetzt würde, und welche Statuswerte
   * mangels Stichprobe (< {@link MIN_STICHPROBE}) bewusst NICHT gesetzt werden.
   */
  zieltageAuswahl: ZieltageAuswahl;
  /** Alle Vorschläge aus {@link zieltageAuswahl} in EINEM Schritt übernehmen. */
  zieltageUebernehmen: () => void;
  /**
   * Welche ZAH-Phase an ein KÜRZEL gehört — aus der Trigger-Tabelle und aus der
   * Auslieferung, mit den Fällen, in denen es bewusst keinen Vorschlag gibt.
   * Ohne Phase am Feld erklärt der Katalog kein „seit wann" (`bestimmeSeit`).
   */
  feldPhasenAuswahl: PhasenAuswahl;
  /** Die ausgewählten Vorschläge in EINEM Schritt in den Entwurf übernehmen. */
  feldPhasenUebernehmen: (feldIds: readonly string[]) => void;
  /**
   * Zuordnungen auf Phasen, die der Entwurf nicht (mehr) führt. Gelesen werden
   * sie wie „ohne Phase" — aber gezählt, damit ein gelöschter Verfahrensschritt
   * nicht still Statuswerte aus jeder Auswertung nimmt.
   */
  verwaiste: VerwaisteZuordnungen;
  /**
   * Programme des Bestands (`FM_NUMMER` → `unterprogramm_id`) mit Antragszahl,
   * absteigend. Der Trigger-Import sagt damit, für welche Programme die Datei
   * schweigt — und wie viele Anträge das trifft.
   */
  programmeImBestand: { programm: string; antraege: number }[];
  /** Anträge ohne Programm-Nummer: dort kann das Vorgangssystem nie greifen. */
  antraegeOhneProgramm: number;
  /** Verbünde mit uneinheitlicher Programm-Nummer (Invariante, erwartet leer). */
  programmUneinheitlich: { verbundId: string; nummern: string[] }[];
  /** Wie viele Kürzel des AB-Dashboards noch kein Relevanz-Häkchen tragen. */
  relevanzLuecke: number;
  /** Die AB-Dashboard-Spalten als relevant markieren (setzt nur, nimmt nie weg). */
  relevanzAusAbDashboard: () => void;
  /**
   * Dasselbe je Rolle, gespeist aus dem KÜRZEL-KATALOG statt aus einer Liste:
   * für den AB gibt es die kuratierte Spaltenauswahl der Mappe, für die anderen
   * Rollen gibt es keine — die Zuarbeit weiß aber je Code, wer ihn setzt.
   */
  relevanzLueckeRolle: (rolle: Rolle) => number;
  relevanzAusRolle: (rolle: Rolle) => void;
  /** Eine Regel aus einem abgeleiteten Platzhalter erzeugen (stillgelegt). */
  todoRegelAusPlatzhalter: (g: PlatzhalterGruppe) => void;
  /**
   * Der Trigger-Stand aus `_intern/status-trigger.json` samt Herkunft
   * (`share`/`cache`/`leer`). Eigene Datei, nicht Teil des Katalog-Entwurfs —
   * siehe `trigger-share.ts`.
   */
  trigger: TriggerStand;
  /**
   * Importierte Trigger-Tabelle übernehmen: ersetzt die Tabelle, erhöht den
   * Import-Zähler und veröffentlicht sie. Anders als Katalog-Änderungen läuft
   * das NICHT über die Speicherleiste — die Trigger sind eine eigene Datei mit
   * eigenem Stand. Liefert `false`, wenn nur der lokale Cache geschrieben wurde.
   */
  triggerUebernehmen: (zeilen: readonly TriggerZeile[]) => Promise<boolean>;
  verwerfen: () => void;
  speichern: (kommentar: string) => Promise<void>;
  reaktivieren: (version: number) => Promise<void>;
  exportieren: () => void;
  importieren: () => Promise<void>;
}

interface Bestand {
  verbundFelder: VerbundFelder[];
  /** Roh mitgeführt: der Bedingungs-Editor braucht den Spalten-Vorrat. */
  schemas: CsvSchema[];
  vorkommen: Map<string, number>;
  zuletzt: Map<string, string>;
  csvSpalten: Map<string, string[]>;
  /** Programm-Nummer (`FM_NUMMER`) → Anzahl Anträge; für den Trigger-Import. */
  programmAntraege: Map<string, number>;
  /** Anträge ganz ohne Programm-Nummer — dort greift das Vorgangssystem nie. */
  antraegeOhneProgramm: number;
  /**
   * Verbünde, deren Teilvorhaben verschiedene Programm-Nummern tragen.
   *
   * Verletzt die Invariante „ein Verbund läuft in genau einer Richtlinie" — dann
   * hinge die Trigger-Auswahl an der Zeilenreihenfolge. Gemeldet statt geheilt
   * (`programmNummer`); erwartet ist 0.
   */
  programmUneinheitlich: { verbundId: string; nummern: string[] }[];
}

/**
 * Der Auslieferungsstand als Vergleichsmaß — einmal gebaut, nicht je Render.
 *
 * **Genau die Felder, die eine frische Installation bekommt**: die kanonischen
 * plus die Code-Felder OHNE die vier, die schon kanonisch belegt sind (`AAE` an
 * `antragsdatum`, `ABB` an `bewilligung_datum`, …). Zwei Gründe, warum hier
 * nicht die rohe Code-Liste steht:
 *
 * - Sie legte beim „Nachziehen" ein zweites Feld für dasselbe Ereignis an — mit
 *   dem Code, aber ohne je einen Wert (siehe `KANONISCHE_CODE_FELDER`).
 * - Sie ließ die kanonischen Felder aus dem Zuarbeit-Abgleich fallen. Deren
 *   Bezeichnung und Rollen (`ABB` = QS) stehen ebenso in der Zuarbeit; eine
 *   Bestandsfassung bekam sie nie zu sehen.
 */
const SEED_FELDER = baueSeedVersion().felder;

export function useStatusCockpit(): StatusCockpitApi {
  const storage = useStorage();
  const idb = storage.idb;
  const kuerzel = useMeinKuerzel();
  const istKurator = useKuratorSession(s => s.isActive);
  const darfSchreiben = canWriteDatenShare(istKurator);
  // Der Stichtag wird EINMAL je Seitenaufruf gestempelt und in alle Engines
  // injiziert — nie `new Date()` in der Berechnung selbst, sonst lieferten zwei
  // Renders derselben Daten verschiedene Ergebnisse.
  const heuteRef = useRef<string>(new Date().toISOString());

  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktiveVersion, setAktiveVersion] = useState<MappingVersion | null>(null);
  const [entwurf, setEntwurf] = useState<MappingVersion | null>(null);
  const [versionen, setVersionen] = useState<MappingVersion[]>([]);
  const [unkuratiert, setUnkuratiert] = useState<UnkuratierterFund[]>([]);
  const [unkuratierteFelder, setUnkuratierteFelder] = useState<StatusFeldEintrag[]>([]);
  const [bestand, setBestand] = useState<Bestand | null>(null);
  const [speichernBusy, setSpeichernBusy] = useState(false);
  const [speichernFehler, setSpeichernFehler] = useState<string | null>(null);
  const [nurLokal, setNurLokal] = useState(false);
  const [konflikt, setKonflikt] = useState<KatalogKonfliktStand | null>(null);
  const [konfliktOffen, setKonfliktOffen] = useState(false);
  const [neueFassungAufShare, setNeueFassungAufShare] = useState<number | null>(null);
  /**
   * Die Fassung, auf der dieser Entwurf beruht — die Grundlage der
   * Konfliktprüfung. Sie beantwortet „welchen Team-Stand kenne ich", nicht
   * „welchen Inhalt bearbeite ich": beim Reaktivieren einer alten Fassung wird
   * sie deshalb NICHT gesenkt, sonst meldete das Speichern einen Konflikt gegen
   * die eigene, längst veröffentlichte Fassung.
   */
  const basisRef = useRef<number | null>(null);
  /** Verhindert überlappende Frühwarn-Lesevorgänge bei schnellen Fokuswechseln. */
  const fruehwarnungLaeuft = useRef(false);
  // Eigene Sidecar, eigener Zustand — die Trigger reisen NICHT in der
  // Katalog-Fassung mit (`trigger-share.ts` erklärt, warum).
  const [trigger, setTrigger] = useState<TriggerStand>({ datei: null, herkunft: 'leer' });
  // Archivierte Fassungen — erst gelesen, wenn jemand die Versionsliste öffnet.
  const [archivFassungen, setArchivFassungen] = useState<MappingVersion[]>([]);
  const [archivGeladen, setArchivGeladen] = useState(false);

  const ladeBestand = useCallback(async (version: MappingVersion): Promise<Bestand> => {
    const programme = await listProgramme(idb);
    const vf: VerbundFelder[] = [];
    const schemas: CsvSchema[] = [];
    // Fällt hier kostenlos ab: die Schleife liest die Anträge ohnehin. Ein
    // zweiter Durchlauf für dieselbe Zahl wäre eine zweite Wahrheit.
    const programmAntraege = new Map<string, number>();
    let antraegeOhneProgramm = 0;
    const programmUneinheitlich: { verbundId: string; nummern: string[] }[] = [];
    for (const p of programme) {
      const [verbuende, antraege, programmSchemas] = await Promise.all([
        listVerbuendeByProgramm(idb, p.id),
        listAntraegeByProgramm(idb, p.id),
        listSchemasByProgramm(idb, p.id),
      ]);
      schemas.push(...programmSchemas);
      // Je Programm auflösen: dieselbe Spalte kann in verschiedenen Programmen
      // unter verschiedenen Record-Keys liegen.
      const aufloesung = baueFeldAufloesung(programmSchemas, version.felder);
      const byVb = new Map<string, { aktenzeichen: string; record: Record<string, unknown> }[]>();
      const einzeln: { aktenzeichen: string; record: Record<string, unknown> }[] = [];
      for (const a of antraege) {
        const up = typeof a.unterprogramm_id === 'string' ? a.unterprogramm_id.trim() : '';
        if (up) programmAntraege.set(up, (programmAntraege.get(up) ?? 0) + 1);
        else antraegeOhneProgramm += 1;
        const rec = a as unknown as Record<string, unknown>;
        const vbid = typeof a.verbund_id === 'string' && a.verbund_id ? a.verbund_id : null;
        const eintrag = { aktenzeichen: a.aktenzeichen, record: rec };
        if (vbid) {
          const list = byVb.get(vbid);
          if (list) list.push(eintrag); else byVb.set(vbid, [eintrag]);
        } else {
          einzeln.push(eintrag);
        }
      }
      // Invariante „ein Verbund läuft in genau einer Richtlinie" — hier prüfbar,
      // weil die Gruppierung ohnehin steht. Erwartet ist eine leere Liste.
      for (const [vbid, tvs] of byVb) {
        const nummern = programmNummernVon(tvs.map(t => ({
          unterprogramm_id: typeof t.record.unterprogramm_id === 'string'
            ? t.record.unterprogramm_id : undefined,
        })));
        if (nummern.length > 1) programmUneinheitlich.push({ verbundId: vbid, nummern });
      }
      for (const v of verbuende) {
        vf.push(baueVerbundFelder(version, v.verbund_id, v as unknown as Record<string, unknown>, byVb.get(v.verbund_id) ?? [], aufloesung));
        byVb.delete(v.verbund_id);
      }
      // Verbund-IDs ohne Verbund-Record (Waisen) + antragslose Einzelantraege
      for (const [vbid, tvs] of byVb) vf.push(baueVerbundFelder(version, vbid, {}, tvs, aufloesung));
      for (const e of einzeln) vf.push(baueVerbundFelder(version, e.aktenzeichen, {}, [e], aufloesung));
    }
    const events = await getAlleEvents(idb);
    return {
      verbundFelder: vf,
      schemas,
      vorkommen: zaehleVorkommen(vf),
      zuletzt: zuletztGesehen(events),
      csvSpalten: csvSpaltenJeFeld(schemas),
      programmAntraege,
      antraegeOhneProgramm,
      programmUneinheitlich,
    };
  }, [idb]);

  const ladeAlles = useCallback(async (): Promise<void> => {
    setLaden(true);
    setFehler(null);
    try {
      const version = await ladeAktiveVersion(idb);
      const [alleVersionen, unk, unkFelder, b, triggerStand] = await Promise.all([
        listeVersionen(idb), ladeUnkuratiert(idb), ladeUnkuratierteFelder(idb), ladeBestand(version),
        ladeTrigger(idb),
      ]);
      setTrigger(triggerStand);
      // Der Snapshot folgt der geladenen Fassung. Beim Mount ist das ein No-op
      // (`initStatusKatalog` hat ihn gesetzt); nach dem Übernehmen einer fremden
      // Fassung ist es die Stelle, an der `getStatusCategory` nachzieht.
      setStatusKatalogSnapshot(version);
      basisRef.current = version.version;
      setAktiveVersion(version);
      setEntwurf(version);
      setVersionen(alleVersionen);
      setUnkuratiert(unk);
      // Was die PL inzwischen kuratiert hat, ist kein Fund mehr — sonst hinge
      // der Puffer dieses Geräts der Team-Fassung ewig hinterher.
      setUnkuratierteFelder(pruneKuratierteFelder(version, unkFelder));
      setBestand(b);
    } catch (e) {
      setFehler((e as Error).message ?? 'Laden fehlgeschlagen.');
    } finally {
      setLaden(false);
    }
  }, [idb, ladeBestand]);

  useEffect(() => { void ladeAlles(); }, [ladeAlles]);

  const geaendert = useMemo(
    () => JSON.stringify(entwurf) !== JSON.stringify(aktiveVersion),
    [entwurf, aktiveVersion],
  );

  /**
   * Was die Auslieferung führt und dem Entwurf fehlt. Bestandsinstallationen
   * haben eine kuratierte Fassung > 1 — die bekommt den Code-Katalog nicht
   * automatisch, sondern erst wenn die PL ihn hier nachzieht und speichert.
   */
  const seedLuecke = useMemo(() => {
    if (!entwurf) return { felder: 0, kategorien: 0 };
    const r = ergaenzeSeedFelder(entwurf, SEED_FELDER, SEED_KATEGORIEN);
    return { felder: r.neueFelder, kategorien: r.neueKategorien };
  }, [entwurf]);

  /**
   * Wo Bezeichnung oder Rollen der Fassung von der Kürzel-Zuarbeit abweichen.
   * Getrennt vom Nachziehen, weil es hier um **Fremddaten** geht: die Zuarbeit
   * ist die Quelle der Wahrheit für „wie heißt der Code" und „wer setzt ihn",
   * unsere Kuration (Ordner, Phase, Rang) bleibt unangetastet.
   */
  const textAbweichungen = useMemo(
    () => (entwurf ? seedTextAbweichungen(entwurf, SEED_FELDER) : []),
    [entwurf],
  );

  /**
   * Den Konflikt für die Oberfläche aufbereiten: die fremde Fassung aus der
   * Share-Datei nachschlagen (Autor, Zeitpunkt) und ausrechnen, wie weit sie von
   * der eigenen entfernt ist. `datei` wird durchgereicht, wo sie schon gelesen
   * wurde — sonst kostet der seltene Fall ein Volllesen.
   */
  const meldeKonflikt = useCallback(async (
    roh: KatalogKonflikt, eigene: MappingVersion | null, datei: StatusKatalogDatei | null,
  ): Promise<void> => {
    const quelle = datei ?? await leseKatalogVomShare(idb);
    const fremd = quelle?.fassungen.find(f => f.version === roh.fremde.version) ?? null;
    setKonflikt({
      konflikt: fremd
        ? { ...roh, fremde: { version: fremd.version, autor: fremd.autor, zeitstempel: fremd.zeitstempel } }
        : roh,
      abweichungen: eigene && fremd ? zaehleAbweichungen(eigene, fremd) : 0,
      eigene: eigene?.version ?? null,
    });
    setKonfliktOffen(true);
    setNurLokal(false);
    setNeueFassungAufShare(null);
  }, [idb]);

  const speichern = useCallback(async (kommentar: string): Promise<void> => {
    if (!entwurf) return;
    // Vor allem anderen: ein Zuschnitt, der die Grenzen verletzt, wird gemeldet
    // und NICHT stillschweigend zurechtgebogen. Die Prüfung sitzt hier und nicht
    // im Editor, weil auch ein JSON-Import über diesen Weg läuft.
    const phasenFehler = pruefeZahPhasen(zahPhasenVon(entwurf.zahPhasen));
    if (phasenFehler.length > 0) {
      setSpeichernFehler(phasenFehler.join(' '));
      return;
    }
    setSpeichernBusy(true);
    setSpeichernFehler(null);
    try {
      // Vorschritt: was der Share an unbekannten Fassungen führt, kommt VOR der
      // Nummernvergabe in den lokalen Cache. Sonst vergäben zwei Rechner mit
      // demselben Startstand dieselbe Nummer. Der gelesene Stand wird
      // weitergereicht, statt die Datei gleich noch einmal zu holen.
      const { datei } = await vereinigeMitShare(idb);
      const basisVorher = basisRef.current;

      const nr = await naechsteVersionsnummer(idb);
      const neu: MappingVersion = {
        ...entwurf,
        version: nr,
        autor: kuerzel ?? null,
        zeitstempel: new Date().toISOString(),
        kommentar: kommentar.trim() || undefined,
      };
      // Erst lokal festschreiben, dann für das Team veröffentlichen. Diese
      // Reihenfolge ist Absicht: schlägt der Share-Write fehl (offline, kein
      // Schreibrecht, Konflikt), ist die Arbeit trotzdem nicht verloren — sie
      // gilt nur noch nicht team-weit.
      await speichereVersion(idb, neu);
      await setzeAktiv(idb, nr);
      setStatusKatalogSnapshot(neu);
      setAktiveVersion(neu);
      setEntwurf(neu);
      setVersionen(await listeVersionen(idb));
      basisRef.current = nr;

      const ergebnis = await schreibeKatalogAufShare(idb, { basisVersion: basisVorher, stand: datei });
      if (ergebnis.art === 'konflikt') {
        await meldeKonflikt(ergebnis.konflikt, neu, datei);
        return;
      }
      setKonflikt(null);
      setKonfliktOffen(false);
      setNeueFassungAufShare(null);
      setNurLokal(ergebnis.art === 'nur-lokal');
    } catch (e) {
      setSpeichernFehler((e as Error).message ?? 'Speichern fehlgeschlagen.');
      throw e;
    } finally {
      setSpeichernBusy(false);
    }
  }, [entwurf, idb, kuerzel, meldeKonflikt]);

  const erneutAufShare = useCallback(async (): Promise<void> => {
    setSpeichernFehler(null);
    const ergebnis = await schreibeKatalogAufShare(idb, { basisVersion: basisRef.current });
    if (ergebnis.art === 'konflikt') {
      await meldeKonflikt(ergebnis.konflikt, aktiveVersion, null);
      return;
    }
    setNurLokal(ergebnis.art === 'nur-lokal');
    if (ergebnis.art === 'nur-lokal') {
      setSpeichernFehler(
        'Der Katalog konnte nicht auf den Daten-Share geschrieben werden. '
        + 'Ist der Share verbunden und besteht Schreibberechtigung?',
      );
    }
  }, [idb, aktiveVersion, meldeKonflikt]);

  /**
   * Der seltene Rest: dieselbe Nummer trägt hier und dort verschiedene
   * Fassungen. Die eigene wandert auf die nächste freie Nummer, die fremde
   * bekommt ihre zurück — beide bleiben erhalten. Ohne diesen Schritt fiele eine
   * von beiden aus der Datei, egal welchen Weg der Mensch wählt.
   */
  const loeseNummernKollision = useCallback(async (
    stand: KatalogKonfliktStand,
  ): Promise<void> => {
    if (stand.konflikt.grund !== 'nummern-kollision') return;
    const datei = await leseKatalogVomShare(idb);
    const fremd = datei?.fassungen.find(f => f.version === stand.konflikt.fremde.version);
    if (!fremd) return;
    const neueNr = await umnummeriereEigeneFassung(idb, fremd.version, fremd);
    if (neueNr == null) return;
    const umbenannt = await getVersion(idb, neueNr);
    if (umbenannt) {
      setStatusKatalogSnapshot(umbenannt);
      setAktiveVersion(umbenannt);
      setEntwurf(umbenannt);
    }
    basisRef.current = neueNr;
    setVersionen(await listeVersionen(idb));
  }, [idb]);

  const trotzdemVeroeffentlichen = useCallback(async (): Promise<void> => {
    if (!konflikt) return;
    setSpeichernFehler(null);
    await loeseNummernKollision(konflikt);
    const ergebnis = await schreibeKatalogAufShare(idb, { basisVersion: basisRef.current });
    if (ergebnis.art === 'konflikt') {
      await meldeKonflikt(ergebnis.konflikt, aktiveVersion, null);
      return;
    }
    setKonflikt(null);
    setKonfliktOffen(false);
    setNurLokal(ergebnis.art === 'nur-lokal');
  }, [idb, konflikt, aktiveVersion, loeseNummernKollision, meldeKonflikt]);

  const fremdeFassungLaden = useCallback(async (): Promise<void> => {
    setSpeichernFehler(null);
    // Erst die eigene Fassung aus der Schusslinie nehmen, dann den Share
    // übernehmen: `uebernehmeKatalogVomShare` überschreibt gleichnummerige
    // Fassungen, und verworfen heißt hier „nicht aktiv", nicht „weg".
    if (konflikt) await loeseNummernKollision(konflikt);
    await synchronisiereKatalogVomShare(idb);
    await ladeAlles();
    setKonflikt(null);
    setKonfliktOffen(false);
    setNeueFassungAufShare(null);
    setNurLokal(false);
  }, [idb, konflikt, loeseNummernKollision, ladeAlles]);

  // Neu nachgesehen wird beim Zurückkommen ins Fenster — und sonst nur, wenn
  // gespeichert wird. Kein Intervall: mehrere Clients, die ein SMB-Verzeichnis
  // pollen, sind ein schlechter Nachbar. Gelesen werden 4 KB Dateikopf, nicht
  // die ~2,9 MB dahinter.
  useEffect(() => {
    const beiRueckkehr = (): void => {
      if (document.visibilityState !== 'visible') return;
      if (fruehwarnungLaeuft.current) return;
      fruehwarnungLaeuft.current = true;
      void leseKatalogNummer(idb)
        .then(nr => {
          const basis = basisRef.current;
          setNeueFassungAufShare(nr != null && basis != null && nr > basis ? nr : null);
        })
        .catch((err: unknown) => { console.warn('[status-cockpit] Frühwarnung fehlgeschlagen:', err); })
        .finally(() => { fruehwarnungLaeuft.current = false; });
    };
    document.addEventListener('visibilitychange', beiRueckkehr);
    window.addEventListener('focus', beiRueckkehr);
    return () => {
      document.removeEventListener('visibilitychange', beiRueckkehr);
      window.removeEventListener('focus', beiRueckkehr);
    };
  }, [idb]);

  const reaktivieren = useCallback(async (version: number): Promise<void> => {
    // Erst der lokale Cache, dann das Archiv. Auf einem frisch aufgesetzten
    // Rechner kennt die IDB nur die Fassungen der Hauptdatei — eine ältere ist
    // dann ausschließlich über das Archiv erreichbar, und genau dafür ist die
    // Versionierung da.
    const alt = (await getVersion(idb, version))
      ?? (await leseKatalogArchiv(idb))?.fassungen.find(f => f.version === version);
    if (!alt) return;
    // Ins IDB übernehmen: wer eine archivierte Fassung einmal geholt hat, soll
    // sie beim nächsten Mal nicht erneut über den Share suchen müssen.
    await speichereVersion(idb, alt);
    setVersionen(await listeVersionen(idb));
    // `basisRef` bleibt, wo sie ist: welche Fassung als Entwurf dient, ändert
    // nichts daran, welchen Team-Stand dieses Fenster kennt.
    setEntwurf({ ...alt });
  }, [idb]);

  /**
   * Die archivierten Fassungen nachladen — auf Anforderung, nicht beim Start.
   *
   * Das Archiv ist die Datei, die aus der Startzeit herausgehalten werden soll;
   * es beim Laden mitzulesen machte die Rotation sinnlos. Das Versions-Panel
   * ist per Default zu, sein Aufklappen ist der ehrliche Auslöser.
   */
  const archivLaden = useCallback(async (): Promise<void> => {
    if (archivGeladen) return;
    const archiv = await leseKatalogArchiv(idb);
    setArchivGeladen(true);
    if (!archiv || archiv.fassungen.length === 0) return;
    setArchivFassungen(archiv.fassungen);
  }, [idb, archivGeladen]);

  const exportieren = useCallback((): void => {
    if (!aktiveVersion) return;
    downloadAsFile(exportiereVersion(aktiveVersion), `status-katalog-v${aktiveVersion.version}.json`, 'application/json');
  }, [aktiveVersion]);

  const importieren = useCallback(async (): Promise<void> => {
    const picked = await pickSchemaSnapshotFile();
    if (!picked) return;
    const ergebnis = validiereImport(picked.text);
    if (!ergebnis.ok || !ergebnis.version) {
      setFehler(`Import abgelehnt: ${ergebnis.fehler ?? 'unbekannt'}`);
      return;
    }
    setFehler(null);
    setEntwurf(ergebnis.version);
  }, []);

  const setWert = useCallback((id: string, patch: Partial<StatusWertEintrag>) => {
    setEntwurf(v => (v ? aendereWert(v, id, patch) : v));
  }, []);
  const setFeld = useCallback((feldId: string, patch: Partial<StatusFeldEintrag>) => {
    setEntwurf(v => (v ? aendereFeld(v, feldId, patch) : v));
  }, []);
  const setKategorie = useCallback((id: string, patch: Partial<StatusKategorie>) => {
    setEntwurf(v => (v ? aendereKategorie(v, id, patch) : v));
  }, []);
  const addKategorie = useCallback((kategorie: StatusKategorie) => {
    setEntwurf(v => (v ? fuegeKategorieHinzu(v, kategorie) : v));
  }, []);
  const removeKategorie = useCallback((id: string) => {
    setEntwurf(v => (v ? entferneKategorie(v, id) : v));
  }, []);

  // --- Verfahrensschnitt: Phasen und ihre Codes ----------------------------
  // Jede Aktion ist EIN setState (Pitfall #16/#20) — auch das Umhängen, das
  // zwei Wert-Einträge desselben Codes anfasst.
  const setZahPhase = useCallback((id: string, patch: Partial<ZahPhase>) => {
    setEntwurf(v => (v ? aendereZahPhase(v, id, patch) : v));
  }, []);
  const addZahPhase = useCallback((label: string, kategorieVorgabe: StatusCategory) => {
    setEntwurf(v => (v ? fuegeZahPhaseHinzu(v, label, kategorieVorgabe) : v));
  }, []);
  const removeZahPhase = useCallback((id: string, zielId: string | null) => {
    setEntwurf(v => (v ? entferneZahPhase(v, id, zielId) : v));
  }, []);
  const moveZahPhase = useCallback((id: string, index: number) => {
    setEntwurf(v => (v ? verschiebeZahPhase(v, id, index) : v));
  }, []);
  const setCodePhase = useCallback((codes: readonly number[], zielId: string | null) => {
    setEntwurf(v => (v ? setzeCodePhasen(v, new Map(codes.map(c => [c, zielId]))) : v));
  }, []);

  const uebernehmen = useCallback((fund: UnkuratierterFund) => {
    setEntwurf(v => (v ? fuegeWertHinzu(v, {
      id: fund.id, feldId: fund.feldId, wert: fund.wert,
      kategorie: 'sonstige', prominenz: 'normal',
      aktiv: true, unkuratiert: false, erstmalsGesehen: fund.erstmalsGesehen,
    }) : v));
    setUnkuratiert(u => u.filter(x => x.id !== fund.id));
    void speichereUnkuratiert(idb, unkuratiert.filter(x => x.id !== fund.id)).catch(() => {});
  }, [idb, unkuratiert]);

  const uebernehmeFeld = useCallback((feld: StatusFeldEintrag, kategorieId: string) => {
    // Beim Übernehmen wird das Feld aktiv und bekommt einen Platz im Baum —
    // ohne Rang, also zunächst ohne Wirkung auf die Ableitung.
    setEntwurf(v => (v ? fuegeFeldHinzu(v, {
      ...feld, kategorieId, aktiv: true, unkuratiert: false,
    }) : v));
    const rest = unkuratierteFelder.filter(f => f.feldId !== feld.feldId);
    setUnkuratierteFelder(rest);
    void speichereUnkuratierteFelder(idb, rest).catch(() => {});
  }, [idb, unkuratierteFelder]);

  const seedNachziehen = useCallback(() => {
    setEntwurf(v => (v ? ergaenzeSeedFelder(v, SEED_FELDER, SEED_KATEGORIEN).version : v));
  }, []);

  const texteUebernehmen = useCallback(() => {
    setEntwurf(v => (v ? uebernimmSeedTexte(v, SEED_FELDER) : v));
  }, []);

  // Beide Referenz-Übernahmen schreiben in EINEM `setState` in den Entwurf;
  // festgeschrieben wird erst über die Speicherleiste (ein `persist`, #16/#20).
  const statusCodesUebernehmen = useCallback((
    katalog: readonly StatusCodeEintrag[], textbausteine: readonly TextbausteinEintrag[] = [],
  ) => {
    setEntwurf(v => (v ? uebernimmStatusCodes(v, katalog, textbausteine) : v));
  }, []);

  /**
   * Was der Fassung aus der Vorgangssystem-Auslieferung fehlt. Bestandsfassungen
   * (> 1) haben den Seed nie gesehen — ohne diesen Weg stünden dort dauerhaft
   * „0 Statuswerte mit Code" und die ganze neue Schicht bliebe wirkungslos.
   */
  const vsLuecke = useMemo(
    () => (entwurf
      ? vorgangssystemLuecke(entwurf, STATUS_CODE_KATALOG, KANONISCHE_CODE_FELDER)
      : { werteOhneCode: 0, phasenFehlen: false, doppelteCodes: 0, todoRegelnFehlen: false }),
    [entwurf],
  );

  const vorgangssystemNachziehen = useCallback(() => {
    setEntwurf(v => (v
      ? ergaenzeVorgangssystemSeed(
        v, STATUS_CODE_KATALOG, SEED_ZAH_PHASEN, KANONISCHE_CODE_FELDER, AB_TODO_REGELN,
      )
      : v));
  }, []);

  const setTodoRegel = useCallback((id: string, patch: Partial<TodoRegel>) => {
    setEntwurf(v => (v ? aendereTodoRegel(v, id, patch) : v));
  }, []);

  const verschiebeTodo = useCallback((id: string, richtung: -1 | 1) => {
    setEntwurf(v => (v ? verschiebeTodoRegel(v, id, richtung) : v));
  }, []);

  const todoRegelnNachziehen = useCallback(() => {
    setEntwurf(v => (v ? zieheTodoRegelnNach(v, AB_TODO_REGELN, ENTFALLENE_REGEL_IDS) : v));
  }, []);

  /**
   * Was die Auslieferung anders sagt als die gepflegte Kaskade. Sichtbar, weil
   * der Regelsatz wächst: die Fachabstimmung hat Sperren ergänzt und eine Regel
   * nach Rollen geteilt. Ohne Anzeige liefe jede bestehende Fassung weiter auf
   * dem Stand ihres ersten Seeds, und niemand sähe es.
   */
  const todoDrift = useMemo(
    () => (entwurf
      ? todoRegelDrift(entwurf, AB_TODO_REGELN, ENTFALLENE_REGEL_IDS)
      : { neu: [], geaendert: [], entfallen: [] }),
    [entwurf],
  );

  /**
   * Der Zieltage-Vorschlag aus dem Ist.
   *
   * **Gezählt werden Verbund- UND Teilvorhaben-Status.** Bis v2.388 speiste sich
   * die Stichprobe allein aus `verbund_status` — und weil Werte wie „NF gestellt"
   * oder „techn geprüft" fast nur am TV stehen, kam dort `n = 2` heraus und der
   * Vorschlag fiel unter die Stichproben-Grenze. Ausgerechnet die Status, für die
   * eine Zielvorgabe am meisten trägt, bekamen so nie eine.
   *
   * Die Liegezeit bleibt die des Verbunds (`letzteAktivitaetVon` über dessen
   * Vorkommen) — dieselbe Näherung wie bisher, nur an der Stelle gezählt, an der
   * der Status wirklich steht.
   */
  const liegezeitVorschlag = useMemo(() => {
    if (!entwurf || !bestand) return new Map<number, { median: number; n: number }>();
    const proben: { statusCode: number | null; tage: number | null }[] = [];
    for (const vf of bestand.verbundFelder) {
      // Über `letzteAktivitaetVon`, nicht über eine zweite Schleife hier: der
      // Vorschlag muss dieselbe Zahl rechnen wie das Urteil im Board — inklusive
      // Relevanz- und Zukunftsfilter.
      const { letzteAktivitaet } = letzteAktivitaetVon(
        vorkommenAus(entwurf, vf), entwurf, heuteRef.current,
      );
      const tage = letzteAktivitaet
        ? Math.floor(
          (new Date(heuteRef.current).getTime() - new Date(letzteAktivitaet).getTime()) / 86_400_000,
        )
        : null;
      const nimm = (roh: string | undefined): void => {
        const code = findeStatusCode(roh ?? '')?.eintrag.code ?? null;
        proben.push({ statusCode: code, tage });
      };
      nimm(vf.felder.verbund_status);
      for (const tv of Object.values(vf.tvFelder)) nimm(tv.status);
    }
    return medianLiegezeit(proben);
  }, [entwurf, bestand]);

  /**
   * Die Sammel-Übernahme der Zieltage: was gesetzt würde und was mangels
   * Stichprobe NICHT gesetzt wird. Beides sichtbar, bevor irgendetwas passiert.
   */
  const zieltageAuswahl = useMemo(
    () => (entwurf
      ? waehleZieltageVorschlaege(
        entwurf.werte, liegezeitVorschlag,
        w => (w.zahPhaseId !== undefined
          ? w.zahPhaseId
          : (w.code !== undefined ? SEED_CODE_ZU_ZAH_PHASE.get(w.code) ?? null : null)),
        entwurf.zahPhasen,
      )
      : { uebernehmen: [], zuWenigDaten: [] }),
    [entwurf, liegezeitVorschlag],
  );

  const zieltageUebernehmen = useCallback(() => {
    // EIN setState mit der ganzen Map — nicht 60 einzelne `setWert` (Pitfall #16).
    setEntwurf(v => (v
      ? setzeZieltage(v, new Map(zieltageAuswahl.uebernehmen.map(u => [u.id, u.neu])))
      : v));
  }, [zieltageAuswahl]);

  /**
   * Welche ZAH-Phase an ein KÜRZEL gehört — aus der Trigger-Tabelle und aus der
   * Auslieferung. Der Katalog-Schnitt der Fassung geht vor, wo sie einen führt:
   * die Codes wurden womöglich schon umgehängt.
   */
  const feldPhasenAuswahl = useMemo(
    () => berechnePhasenVorschlag(
      entwurf?.felder ?? [], trigger.datei?.trigger ?? [], SEED_FELDER,
      schnittVon(entwurf), entwurf?.zahPhasen,
    ),
    [entwurf, trigger],
  );

  const feldPhasenUebernehmen = useCallback((feldIds: readonly string[]) => {
    const gewaehlt = new Set(feldIds);
    // EIN setState mit der ganzen Map — nicht 46 einzelne `setFeld` (Pitfall #16).
    setEntwurf(v => (v
      ? setzeFeldPhasen(v, new Map(feldPhasenAuswahl.vorschlaege
        .filter(p => gewaehlt.has(p.feldId))
        .map(p => [p.feldId, p.phase])))
      : v));
  }, [feldPhasenAuswahl]);

  const verwaiste = useMemo(
    () => (entwurf ? verwaisteZuordnungen(entwurf) : { werte: 0, felder: 0 }),
    [entwurf],
  );

  const relLuecke = useMemo(
    () => (entwurf ? relevanzLuecke(entwurf, AB_DASHBOARD_RELEVANZ) : 0),
    [entwurf],
  );

  const relevanzAusAbDashboard = useCallback(() => {
    setEntwurf(v => (v ? markiereRelevanz(v, AB_DASHBOARD_RELEVANZ) : v));
  }, []);

  const relevanzLueckeRolle = useCallback(
    (rolle: Rolle) => (entwurf ? relevanzLuecke(entwurf, codesMitRolle(entwurf, rolle)) : 0),
    [entwurf],
  );

  const relevanzAusRolle = useCallback((rolle: Rolle) => {
    setEntwurf(v => (v ? markiereRelevanz(v, codesMitRolle(v, rolle)) : v));
  }, []);

  /**
   * Aus einem Platzhalter eine echte Regel machen.
   *
   * Vorbefüllt mit der Bedingung der auslösenden Regel — die steht ja schon
   * fest, und sie abzutippen wäre die fehleranfälligste Stelle des ganzen
   * Termins. Rolle gedreht (`wartetAuf: fb` wird zu `zustaendig: ['fb']`) und
   * **stillgelegt**: `fuegeTodoRegelHinzu` erzwingt das für jeden Satz außer AB.
   *
   * **Der `strang` wird geerbt** (v2.412). Die neue Regel bekommt eine neue Id
   * und stand damit in keiner Sperre, die ihre Ziele namentlich nennt — gemessen
   * traf dieselbe Bedingung als `r2` 59 Vorgänge, unter neuer Id 179. Über den
   * Strang gehört sie derselben Kette an wie ihre Herkunft, und die Sperre
   * greift von Anfang an.
   */
  const todoRegelAusPlatzhalter = useCallback((g: PlatzhalterGruppe) => {
    setEntwurf(v => {
      if (!v) return v;
      const quelle = (v.todoRegeln ?? []).find(r => r.id === g.quellRegelId);
      if (!quelle) return v;
      return fuegeTodoRegelHinzu(v, {
        id: `${g.rolle}-${quelle.id}`,
        reihenfolge: 0,
        beschreibung: `${ROLLE_LABEL[g.rolle]} · aus ${quelle.beschreibung}`,
        bedingung: JSON.parse(JSON.stringify(quelle.bedingung)) as Bedingung,
        todo: g.todo,
        zustaendig: [g.rolle],
        wartetAuf: null,
        regelsatz: g.rolle,
        ...(quelle.strang !== undefined ? { strang: quelle.strang } : {}),
        aktiv: false,
      });
    });
  }, []);

  const triggerUebernehmen = useCallback(async (zeilen: readonly TriggerZeile[]): Promise<boolean> => {
    const { datei, aufShare } = await speichereTrigger(
      idb, zeilen, kuerzel ?? null, trigger.datei?.version ?? 0, new Date().toISOString(),
    );
    setTrigger({ datei, herkunft: aufShare ? 'share' : 'cache' });
    return aufShare;
  }, [idb, kuerzel, trigger.datei?.version]);

  const verwerfen = useCallback(() => setEntwurf(aktiveVersion), [aktiveVersion]);

  return {
    laden, fehler, aktiveVersion, entwurf, versionen, unkuratiert, unkuratierteFelder,
    seedLuecke, textAbweichungen,
    vorkommen: bestand?.vorkommen ?? new Map(),
    zuletzt: bestand?.zuletzt ?? new Map(),
    csvSpalten: bestand?.csvSpalten ?? new Map(),
    verbundFelder: bestand?.verbundFelder ?? [],
    stichtag: heuteRef.current,
    geaendert, speichernBusy, speichernFehler, nurLokal, erneutAufShare,
    konflikt, konfliktOffen,
    konfliktOeffnen: () => setKonfliktOffen(true),
    konfliktSchliessen: () => setKonfliktOffen(false),
    trotzdemVeroeffentlichen, fremdeFassungLaden, neueFassungAufShare,
    setWert, setFeld, setKategorie, addKategorie, removeKategorie,
    setZahPhase, addZahPhase, removeZahPhase, moveZahPhase, setCodePhase,
    uebernehmen, uebernehmeFeld, seedNachziehen, texteUebernehmen,
    darfSchreiben, statusCodesUebernehmen, trigger, triggerUebernehmen,
    programmeImBestand: [...(bestand?.programmAntraege ?? new Map())]
      .map(([programm, antraege]) => ({ programm, antraege }))
      .sort((a, b) => b.antraege - a.antraege),
    antraegeOhneProgramm: bestand?.antraegeOhneProgramm ?? 0,
    programmUneinheitlich: bestand?.programmUneinheitlich ?? [],
    vorgangssystemLuecke: vsLuecke, vorgangssystemNachziehen,
    relevanzLuecke: relLuecke, relevanzAusAbDashboard, liegezeitVorschlag,
    relevanzLueckeRolle, relevanzAusRolle, todoRegelAusPlatzhalter,
    zieltageAuswahl, zieltageUebernehmen,
    feldPhasenAuswahl, feldPhasenUebernehmen, verwaiste,
    setTodoRegel, verschiebeTodoRegel: verschiebeTodo, todoRegelnNachziehen, todoDrift,
    verwerfen, speichern, reaktivieren, exportieren, importieren,
    archivFassungen, archivGeladen, archivLaden,
  };
}

/** Re-Export für die Tab-Komponenten (Vorkommen-Key). */
export { wertId };
