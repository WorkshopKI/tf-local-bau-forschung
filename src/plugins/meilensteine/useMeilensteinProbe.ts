/**
 * Probe am Bestand für den Konfigurations-Reiter: lädt die Verbünde der
 * aktuellen Richtlinie EINMAL und zählt danach bei jeder Änderung live mit.
 * Die Rechnung steht in [probe.ts](../../core/meilensteine/probe.ts).
 *
 * **Warum nicht je Programm lesen.** Der Antrags-Store kennt nur einen Index auf
 * `programm_id` — und im Bestand gibt es EIN Programm („default-programm") mit
 * allen 14 225 Anträgen (gemessen 11.09.2026, dev:local). Ein Lesen je Programm
 * läse also alles. Stattdessen wird die schlanke Listen-Projektion (24 Felder je
 * Antrag, `getAll` in 222 ms) nach `unterprogramm_id` gefiltert, und nur diese
 * Schlüssel werden voll gelesen: 2 537 Anträge in 1 793 Verbünden, in Blöcken
 * zu 500. Jeder Block wird sofort auf die Felder des Spalten-Katalogs
 * projiziert — die vollen Datensätze (461 Felder) bleiben nie im Speicher.
 *
 * **Einmal laden, dann live.** Anders als die Regel-Wirkung der To-do-Regeln
 * (auf Knopfdruck, über den ganzen Bereich) ist dieser Bestand klein genug, um
 * im Speicher zu bleiben. Angestoßen wird beim ersten Aufklappen eines
 * Regel-Bereichs — ein Ereignis, kein Mount-Effekt.
 *
 * **Die Grundmenge ist die Richtlinie, nicht der Chip im Seitenkopf.** Die Probe
 * prüft eine Regel und ist kein Arbeitsvorrat; der Bereich bleibt ein
 * expliziter Parameter (Pitfall #46), hier bewusst ein fester. Die Anzeige
 * nennt ihn an jeder Zahl.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import {
  getAntraegeByKeys, listAllAntraegeListView, listProgramme, listVerbuendeByProgramm,
} from '@/core/services/csv/idb-csv';
import { verbundAntragsdatum } from '@/core/services/csv/frist';
import type { CsvSchema } from '@/core/services/csv/types';
import {
  AKTUELLE_RICHTLINIE, RICHTLINIEN_GENERATIONEN, bereichsMenge, istImBereich,
} from '@/core/status/betrachtungsbereich';
import type { Bedingung } from '@/core/status';
import { isTerminalStatus } from '@/core/utils/status-canonical';
import { getAntragstypBucket, type AntragstypBucket } from '@/core/utils/vb-phase-mappings';
import {
  ANKER_SPALTEN, baueAnkerLeser, baueProbeFaelle, benoetigteFelder, freigegebeneFassung,
  loeseFelderAuf, probeMeilensteine, zaehleBedingung,
  type KnotenProbe, type MeilensteinPlan, type ProbeVerbund, type ProbeZahlen, type SpaltenEintrag,
} from '@/core/meilensteine';

/** Vollständig gelesene Anträge je Transaktion. */
const BLOCK = 500;

/** Trenner im Schlüssel der Feldmenge — kommt in keiner Feld-Id vor (Codes wie `D_PC+`). */
const TRENNER = '\n';

const JUENGSTE = RICHTLINIEN_GENERATIONEN[RICHTLINIEN_GENERATIONEN.length - 1];
/** Die Grundmenge als Wort — steht an jeder Zahl der Probe. */
export const PROBE_GRUNDMENGE = JUENGSTE ? `Richtlinie ${JUENGSTE.jahr}` : 'aktuelle Richtlinie';

export interface MeilensteinProbeApi {
  /** Der Bestand ist geladen — die Zahlen stehen. */
  bereit: boolean;
  /** Busy/Fehler/Wiederholen (Pitfall #15). */
  aktion: UseAsyncActionResult<[]>;
  /** Einmal anstoßen; weitere Aufrufe bleiben folgenlos. */
  starte: () => void;
  grundmenge: string;
  /** Stichtag der Bewertung (ISO) — beim Laden gesetzt. */
  stand: string | null;
  /** Ladezeit in ms — gemessen, damit „einmal laden" belegt bleibt. */
  dauerMs: number | null;
  umfang: { offen: number; abgeschlossen: number } | null;
  /** Je Knoten-Id: was der Entwurf trifft. */
  entwurf: ReadonlyMap<string, KnotenProbe> | null;
  /** Je Knoten-Id: was die freigegebene Fassung trifft (Vergleich). */
  fassung: ReadonlyMap<string, KnotenProbe> | null;
  fassungVersion: number | null;
  /** Was eine Gruppe trifft, mit dem Nenner des Meilensteins (`nurTypen`). */
  zaehle: (b: Bedingung, nurTypen: readonly AntragstypBucket[]) => ProbeZahlen | null;
}

/** Nur die genannten Felder — der Rest des 461-Feld-Datensatzes fällt weg. */
function waehle(rec: Record<string, unknown>, keys: ReadonlySet<string>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    const v = rec[k];
    if (v !== undefined && v !== null && v !== '') out[k] = v;
  }
  return out;
}

export function useMeilensteinProbe(
  entwurf: MeilensteinPlan | null,
  gespeichert: MeilensteinPlan | null,
  schemas: readonly CsvSchema[],
  spalten: readonly SpaltenEintrag[],
): MeilensteinProbeApi {
  const idb = useStorage().idb;
  const [bestand, setBestand] = useState<ProbeVerbund[] | null>(null);
  const [stand, setStand] = useState<string | null>(null);
  const [dauerMs, setDauerMs] = useState<number | null>(null);
  const gestartet = useRef(false);

  const lade = useCallback(async (): Promise<void> => {
    const t0 = performance.now();
    const menge = bereichsMenge(AKTUELLE_RICHTLINIE);
    const schluessel = (await listAllAntraegeListView(idb))
      .filter(a => a.verbund_id && istImBereich(a.unterprogramm_id, menge))
      .map(a => a.aktenzeichen)
      // Aufsteigend wie der `verbund_id`-Index der Projektion — dort ist das
      // erste Teilvorhaben das mit dem kleinsten Aktenzeichen, und von ihm
      // kommen Typ und (ersatzweise) Leit-Status.
      .sort();

    // Was ein Bedingungs-Feld überhaupt lesen kann (der Spalten-Katalog,
    // aufgelöst) plus das, was Anker, Typ und Leit-Status brauchen.
    const keys = new Set(
      loeseFelderAuf(schemas, [...spalten.map(s => s.feldId), ANKER_SPALTEN.alleAntraegeDa])
        .map(f => f.recordKey),
    );
    for (const k of ['antragsdatum', 'vb_phase', 'status']) keys.add(k);

    const tvs = new Map<string, { aktenzeichen: string; record: Record<string, unknown> }[]>();
    for (let i = 0; i < schluessel.length; i += BLOCK) {
      for (const a of await getAntraegeByKeys(idb, schluessel.slice(i, i + BLOCK))) {
        const rec = a as unknown as Record<string, unknown>;
        const verbundId = typeof rec.verbund_id === 'string' ? rec.verbund_id : '';
        if (!verbundId) continue;
        const liste = tvs.get(verbundId) ?? [];
        tvs.set(verbundId, liste);
        liste.push({ aktenzeichen: a.aktenzeichen, record: waehle(rec, keys) });
      }
    }

    const verbuende = new Map<string, Record<string, unknown>>();
    for (const p of await listProgramme(idb)) {
      for (const v of await listVerbuendeByProgramm(idb, p.id)) {
        if (tvs.has(v.verbund_id)) verbuende.set(v.verbund_id, v as unknown as Record<string, unknown>);
      }
    }

    const ankerVon = baueAnkerLeser(schemas);
    const out: ProbeVerbund[] = [];
    for (const [verbundId, antraege] of tvs) {
      const vb = verbuende.get(verbundId);
      // Wie die Projektion: gezählt wird, was als Verbund im Bestand steht.
      if (!vb) continue;
      const records = antraege.map(t => t.record);
      out.push({
        verbundId,
        typ: getAntragstypBucket(records[0]?.vb_phase),
        antragsdatum: verbundAntragsdatum(records),
        anker: ankerVon(records),
        // Derselbe Schnitt wie in der Projektion: Verbund-Status, sonst der
        // des ersten Teilvorhabens.
        abgeschlossen: isTerminalStatus(vb.status ?? records[0]?.status),
        verbundRecord: waehle(vb, keys),
        antraege,
      });
    }
    setBestand(out);
    setStand(new Date().toISOString());
    setDauerMs(Math.round(performance.now() - t0));
  }, [idb, schemas, spalten]);

  const aktion = useAsyncAction(lade);
  const { run } = aktion;
  const starte = useCallback((): void => {
    if (gestartet.current) return;
    gestartet.current = true;
    void run();
  }, [run]);

  const fassungPlan = useMemo(
    () => (gespeichert ? freigegebeneFassung(gespeichert) : null),
    [gespeichert],
  );

  // Die Kontexte hängen nur an der FELDMENGE — sie werden neu gebaut, wenn ein
  // Feld dazukommt, nicht bei jedem Tastendruck in einer Bezeichnung.
  const feldKey = useMemo(() => {
    const s = new Set<string>();
    if (entwurf) for (const f of benoetigteFelder(entwurf)) s.add(f);
    if (fassungPlan) for (const f of benoetigteFelder(fassungPlan)) s.add(f);
    return [...s].sort().join(TRENNER);
  }, [entwurf, fassungPlan]);

  const faelle = useMemo(
    () => (bestand
      ? baueProbeFaelle(bestand, loeseFelderAuf(schemas, feldKey ? feldKey.split(TRENNER) : []))
      : null),
    [bestand, schemas, feldKey],
  );

  const entwurfProbe = useMemo(
    () => (faelle && entwurf && stand ? probeMeilensteine(entwurf, faelle, stand) : null),
    [faelle, entwurf, stand],
  );
  const fassungProbe = useMemo(
    () => (faelle && fassungPlan && stand ? probeMeilensteine(fassungPlan, faelle, stand) : null),
    [faelle, fassungPlan, stand],
  );

  const umfang = useMemo(() => {
    if (!bestand) return null;
    const abgeschlossen = bestand.filter(v => v.abgeschlossen).length;
    return { offen: bestand.length - abgeschlossen, abgeschlossen };
  }, [bestand]);

  const zaehle = useCallback(
    (b: Bedingung, nurTypen: readonly AntragstypBucket[]): ProbeZahlen | null =>
      (faelle && stand ? zaehleBedingung(b, faelle, nurTypen, stand) : null),
    [faelle, stand],
  );

  return {
    bereit: bestand !== null,
    aktion,
    starte,
    grundmenge: PROBE_GRUNDMENGE,
    stand,
    dauerMs,
    umfang,
    entwurf: entwurfProbe,
    fassung: fassungProbe,
    fassungVersion: fassungPlan?.version ?? null,
    zaehle,
  };
}
