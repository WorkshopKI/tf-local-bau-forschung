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
  fuegeWertHinzu, fuegeFeldHinzu,
  fuegeKategorieHinzu, aendereKategorie, entferneKategorie, ergaenzeSeedFelder,
  seedTextAbweichungen, uebernimmSeedTexte, type TextAbweichung,
  uebernimmStatusCodes, ladeTrigger, speichereTrigger,
  vorgangssystemLuecke, ergaenzeVorgangssystemSeed,
  todoRegelDrift, zieheTodoRegelnNach, ENTFALLENE_REGEL_IDS, type TodoRegelDrift,
  relevanzLuecke, markiereRelevanz, AB_DASHBOARD_RELEVANZ,
  findeStatusCode, medianLiegezeit, letzteAktivitaetVon, vorkommenAus,
  baueSeedVersion, KANONISCHE_CODE_FELDER, AB_TODO_REGELN,
  STATUS_CODE_KATALOG, SEED_ZAH_PHASEN,
  type TriggerStand, type VorgangssystemLuecke,
  SEED_KATEGORIEN,
  exportiereVersion, validiereImport,
  wertId, schreibeKatalogAufShare,
  type MappingVersion, type StatusWertEintrag, type StatusFeldEintrag,
  type StatusKategorie, type UnkuratierterFund, type VerbundFelder,
  type StatusCodeEintrag, type TriggerZeile,
  type TodoRegel, type TextbausteinEintrag,
} from '@/core/status';

export interface StatusCockpitApi {
  laden: boolean;
  fehler: string | null;
  aktiveVersion: MappingVersion | null;
  entwurf: MappingVersion | null;
  versionen: MappingVersion[];
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
  setWert: (id: string, patch: Partial<StatusWertEintrag>) => void;
  setFeld: (feldId: string, patch: Partial<StatusFeldEintrag>) => void;
  setKategorie: (id: string, patch: Partial<StatusKategorie>) => void;
  addKategorie: (kategorie: StatusKategorie) => void;
  removeKategorie: (id: string) => void;
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
  // Eigene Sidecar, eigener Zustand — die Trigger reisen NICHT in der
  // Katalog-Fassung mit (`trigger-share.ts` erklärt, warum).
  const [trigger, setTrigger] = useState<TriggerStand>({ datei: null, herkunft: 'leer' });

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

  const speichern = useCallback(async (kommentar: string): Promise<void> => {
    if (!entwurf) return;
    setSpeichernBusy(true);
    setSpeichernFehler(null);
    try {
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
      // Schreibrecht), ist die Arbeit trotzdem nicht verloren — sie gilt nur
      // noch nicht team-weit, und genau das meldet `nurLokal`.
      await speichereVersion(idb, neu);
      await setzeAktiv(idb, nr);
      setStatusKatalogSnapshot(neu);
      setAktiveVersion(neu);
      setEntwurf(neu);
      setVersionen(await listeVersionen(idb));
      setNurLokal(!(await schreibeKatalogAufShare(idb)));
    } catch (e) {
      setSpeichernFehler((e as Error).message ?? 'Speichern fehlgeschlagen.');
      throw e;
    } finally {
      setSpeichernBusy(false);
    }
  }, [entwurf, idb, kuerzel]);

  const erneutAufShare = useCallback(async (): Promise<void> => {
    setSpeichernFehler(null);
    const ok = await schreibeKatalogAufShare(idb);
    setNurLokal(!ok);
    if (!ok) {
      setSpeichernFehler(
        'Der Katalog konnte nicht auf den Daten-Share geschrieben werden. '
        + 'Ist der Share verbunden und besteht Schreibberechtigung?',
      );
    }
  }, [idb]);

  const reaktivieren = useCallback(async (version: number): Promise<void> => {
    const alt = await getVersion(idb, version);
    if (!alt) return;
    setEntwurf({ ...alt });
  }, [idb]);

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
   * Der Zieltage-Vorschlag aus dem Ist. Gerechnet über den ohnehin geladenen
   * Bestand — die Liegezeit je Verbund kommt aus dem Wächter, damit die Zahl
   * unter dem Vorschlag mit der Zahl im Urteil zusammenpasst.
   */
  const liegezeitVorschlag = useMemo(() => {
    if (!entwurf || !bestand) return new Map<number, { median: number; n: number }>();
    const proben = bestand.verbundFelder.map(vf => {
      const roh = vf.felder.verbund_status ?? '';
      const code = findeStatusCode(roh)?.eintrag.code ?? null;
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
      return { statusCode: code, tage };
    });
    return medianLiegezeit(proben);
  }, [entwurf, bestand]);

  const relLuecke = useMemo(
    () => (entwurf ? relevanzLuecke(entwurf, AB_DASHBOARD_RELEVANZ) : 0),
    [entwurf],
  );

  const relevanzAusAbDashboard = useCallback(() => {
    setEntwurf(v => (v ? markiereRelevanz(v, AB_DASHBOARD_RELEVANZ) : v));
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
    setWert, setFeld, setKategorie, addKategorie, removeKategorie,
    uebernehmen, uebernehmeFeld, seedNachziehen, texteUebernehmen,
    darfSchreiben, statusCodesUebernehmen, trigger, triggerUebernehmen,
    programmeImBestand: [...(bestand?.programmAntraege ?? new Map())]
      .map(([programm, antraege]) => ({ programm, antraege }))
      .sort((a, b) => b.antraege - a.antraege),
    antraegeOhneProgramm: bestand?.antraegeOhneProgramm ?? 0,
    programmUneinheitlich: bestand?.programmUneinheitlich ?? [],
    vorgangssystemLuecke: vsLuecke, vorgangssystemNachziehen,
    relevanzLuecke: relLuecke, relevanzAusAbDashboard, liegezeitVorschlag,
    setTodoRegel, verschiebeTodoRegel: verschiebeTodo, todoRegelnNachziehen, todoDrift,
    verwerfen, speichern, reaktivieren, exportieren, importieren,
  };
}

/** Re-Export für die Tab-Komponenten (Vorkommen-Key). */
export { wertId };
