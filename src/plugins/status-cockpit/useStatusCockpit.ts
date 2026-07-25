/**
 * Zustand + IO des Status-Cockpits.
 *
 * Lädt die aktive Katalog-Version, den Bestand (alle Verbünde/Antraege für
 * Vorkommen + Simulation) und das Event-Log („zuletzt gesehen"). Hält einen
 * editierbaren Entwurf; Speichern legt eine neue Version an, aktiviert sie und
 * setzt den `getStatusCategory`-Snapshot neu. Katalog ist gerätelokal —
 * Portabilität nur über das JSON-Export/Import hier.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useMeinKuerzel } from '@/core/hooks/useMeinKuerzel';
import { listProgramme, listVerbuendeByProgramm, listAntraegeByProgramm } from '@/core/services/csv/idb-csv';
import { pickSchemaSnapshotFile } from '@/plugins/csv-sources-kuration/csv-file-picker';
import { downloadAsFile } from '@/core/services/search/eval/eval-export';
import {
  ladeAktiveVersion, listeVersionen, speichereVersion, setzeAktiv, naechsteVersionsnummer,
  getVersion, ladeUnkuratiert, speichereUnkuratiert, setStatusKatalogSnapshot, getAlleEvents,
  baueVerbundFelder, zaehleVorkommen, simuliere, verteilung, diffPhasen, zuletztGesehen,
  aendereWert, aendereFeld, aendereRegel, fuegeWertHinzu, exportiereVersion, validiereImport,
  wertId, schreibeKatalogAufShare,
  type MappingVersion, type StatusWertEintrag, type StatusFeldEintrag, type NaechsterSchrittRegel,
  type UnkuratierterFund, type VerbundFelder, type SimErgebnis, type PhasenWechsel, type SpinePhase,
} from '@/core/status';

export interface StatusCockpitApi {
  laden: boolean;
  fehler: string | null;
  aktiveVersion: MappingVersion | null;
  entwurf: MappingVersion | null;
  versionen: MappingVersion[];
  unkuratiert: UnkuratierterFund[];
  /** wertId → Anzahl Verbünde mit diesem (Feld,Wert). */
  vorkommen: Map<string, number>;
  /** wertId → jüngstes erfasstAm (ISO). */
  zuletzt: Map<string, string>;
  aktivVerteilung: Record<SpinePhase, number>;
  entwurfVerteilung: Record<SpinePhase, number>;
  phasenWechsel: PhasenWechsel[];
  konflikteAktiv: number;
  konflikteEntwurf: number;
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
  setRegel: (id: string, patch: Partial<NaechsterSchrittRegel>) => void;
  uebernehmen: (fund: UnkuratierterFund) => void;
  verwerfen: () => void;
  speichern: (kommentar: string) => Promise<void>;
  reaktivieren: (version: number) => Promise<void>;
  exportieren: () => void;
  importieren: () => Promise<void>;
}

interface Bestand {
  verbundFelder: VerbundFelder[];
  vorkommen: Map<string, number>;
  zuletzt: Map<string, string>;
  aktivSim: SimErgebnis[];
}

const LEER_VERTEILUNG: Record<SpinePhase, number> = {
  eingang: 0, vollstaendigkeit: 0, fachpruefung: 0, bewilligung: 0, schluss: 0, keine: 0,
};

export function useStatusCockpit(): StatusCockpitApi {
  const storage = useStorage();
  const idb = storage.idb;
  const kuerzel = useMeinKuerzel();
  const heuteRef = useRef<string>(new Date().toISOString());

  const [laden, setLaden] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktiveVersion, setAktiveVersion] = useState<MappingVersion | null>(null);
  const [entwurf, setEntwurf] = useState<MappingVersion | null>(null);
  const [versionen, setVersionen] = useState<MappingVersion[]>([]);
  const [unkuratiert, setUnkuratiert] = useState<UnkuratierterFund[]>([]);
  const [bestand, setBestand] = useState<Bestand | null>(null);
  const [speichernBusy, setSpeichernBusy] = useState(false);
  const [speichernFehler, setSpeichernFehler] = useState<string | null>(null);
  const [nurLokal, setNurLokal] = useState(false);

  const ladeBestand = useCallback(async (version: MappingVersion): Promise<Bestand> => {
    const programme = await listProgramme(idb);
    const vf: VerbundFelder[] = [];
    for (const p of programme) {
      const [verbuende, antraege] = await Promise.all([
        listVerbuendeByProgramm(idb, p.id),
        listAntraegeByProgramm(idb, p.id),
      ]);
      const byVb = new Map<string, { aktenzeichen: string; record: Record<string, unknown> }[]>();
      const einzeln: { aktenzeichen: string; record: Record<string, unknown> }[] = [];
      for (const a of antraege) {
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
      for (const v of verbuende) {
        vf.push(baueVerbundFelder(version, v.verbund_id, v as unknown as Record<string, unknown>, byVb.get(v.verbund_id) ?? []));
        byVb.delete(v.verbund_id);
      }
      // Verbund-IDs ohne Verbund-Record (Waisen) + antragslose Einzelantraege
      for (const [vbid, tvs] of byVb) vf.push(baueVerbundFelder(version, vbid, {}, tvs));
      for (const e of einzeln) vf.push(baueVerbundFelder(version, e.aktenzeichen, {}, [e]));
    }
    const events = await getAlleEvents(idb);
    return {
      verbundFelder: vf,
      vorkommen: zaehleVorkommen(vf),
      zuletzt: zuletztGesehen(events),
      aktivSim: simuliere(version, vf, heuteRef.current),
    };
  }, [idb]);

  const ladeAlles = useCallback(async (): Promise<void> => {
    setLaden(true);
    setFehler(null);
    try {
      const version = await ladeAktiveVersion(idb);
      const [alleVersionen, unk, b] = await Promise.all([
        listeVersionen(idb), ladeUnkuratiert(idb), ladeBestand(version),
      ]);
      setAktiveVersion(version);
      setEntwurf(version);
      setVersionen(alleVersionen);
      setUnkuratiert(unk);
      setBestand(b);
    } catch (e) {
      setFehler((e as Error).message ?? 'Laden fehlgeschlagen.');
    } finally {
      setLaden(false);
    }
  }, [idb, ladeBestand]);

  useEffect(() => { void ladeAlles(); }, [ladeAlles]);

  const entwurfSim = useMemo<SimErgebnis[]>(
    () => (entwurf && bestand ? simuliere(entwurf, bestand.verbundFelder, heuteRef.current) : []),
    [entwurf, bestand],
  );

  const geaendert = useMemo(
    () => JSON.stringify(entwurf) !== JSON.stringify(aktiveVersion),
    [entwurf, aktiveVersion],
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
      setBestand(b => (b ? { ...b, aktivSim: simuliere(neu, b.verbundFelder, heuteRef.current) } : b));
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
  const setRegel = useCallback((id: string, patch: Partial<NaechsterSchrittRegel>) => {
    setEntwurf(v => (v ? aendereRegel(v, id, patch) : v));
  }, []);
  const uebernehmen = useCallback((fund: UnkuratierterFund) => {
    setEntwurf(v => (v ? fuegeWertHinzu(v, {
      id: fund.id, feldId: fund.feldId, wert: fund.wert,
      kategorie: 'sonstige', spinePhase: 'keine', rang: 0, prominenz: 'normal',
      terminal: false, aktiv: true, unkuratiert: false, erstmalsGesehen: fund.erstmalsGesehen,
    }) : v));
    setUnkuratiert(u => u.filter(x => x.id !== fund.id));
    void speichereUnkuratiert(idb, unkuratiert.filter(x => x.id !== fund.id)).catch(() => {});
  }, [idb, unkuratiert]);
  const verwerfen = useCallback(() => setEntwurf(aktiveVersion), [aktiveVersion]);

  return {
    laden, fehler, aktiveVersion, entwurf, versionen, unkuratiert,
    vorkommen: bestand?.vorkommen ?? new Map(),
    zuletzt: bestand?.zuletzt ?? new Map(),
    aktivVerteilung: bestand ? verteilung(bestand.aktivSim) : LEER_VERTEILUNG,
    entwurfVerteilung: bestand ? verteilung(entwurfSim) : LEER_VERTEILUNG,
    phasenWechsel: bestand ? diffPhasen(bestand.aktivSim, entwurfSim) : [],
    konflikteAktiv: bestand ? bestand.aktivSim.filter(s => s.konflikt).length : 0,
    konflikteEntwurf: entwurfSim.filter(s => s.konflikt).length,
    geaendert, speichernBusy, speichernFehler, nurLokal, erneutAufShare,
    setWert, setFeld, setRegel, uebernehmen, verwerfen, speichern, reaktivieren, exportieren, importieren,
  };
}

/** Re-Export für die Tab-Komponenten (Vorkommen-Key). */
export { wertId };
