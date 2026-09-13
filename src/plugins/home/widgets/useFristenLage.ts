/**
 * Die Fristen-Lage laden — die **eine** Quelle für die Fristen-Karte und das
 * Tagesbrief-Thema „Jetzt eingreifen" (v6.67, vorher `useFristAnlaesse`).
 *
 * Zwei Leser, eine Herleitung: die Karte zeigt beide Gruppen, der Brief spricht
 * nur „Jetzt eingreifen". Zwei Flächen, die dieselbe Zahl unabhängig herleiten,
 * laufen genau dann auseinander, wenn es darauf ankommt (v4.131).
 *
 * Geladen wird nur, was das Dashboard-Aggregat nicht trägt: das Urteil des
 * Stillstands-Wächters je Verbund und die Meilenstein-Bewertung aus der
 * Projektion. Frist-Zustand und -Tage kommen aus dem Aggregat — dieselbe Engine
 * wie die Frist-Spalte — und werden hier nicht noch einmal gerechnet.
 */
import { useEffect, useMemo, useState } from 'react';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { useStorage } from '@/core/hooks/useStorage';
import { isMeilensteinMonitoringEnabled, isVorgangssystemEnabled } from '@/config/feature-flags';
import {
  getVerbund, listAntraegeByVerbund, listProgramme, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import {
  baueFeldAufloesung, findeStatusCode, getAktiveVersion, kuerzelIndex, ladeAktiveVersion,
  pruefeStillstand, sammleVorkommen, type WaechterErgebnis,
} from '@/core/status';
import {
  freigegebeneFassung, holeProjektion, knotenOhneBedingung, ladePlan,
  type MeilensteinKnoten, type VerbundMeilensteine,
} from '@/core/meilensteine';
import type { AntragVorgang } from '@/plugins/home/dashboardAggregate';
import {
  baueFristenLage, stillstandGrund, zaehleOhneLaufendeFrist,
  type FristenZeile, type StillstandGrund, type VerbundQuelle,
} from './fristenLage';

export interface FristenLage {
  /** Sortiert (`sortiereLage`), beide Gruppen. */
  zeilen: FristenZeile[];
  /** Eigene Verbünde ohne auswertbare Zieltage — eine Aussage über die Belastbarkeit. */
  unbewertet: number;
  /** Knoten des Meilenstein-Plans ohne Bedingung — eine Aussage über den PLAN. */
  ohneBedingung: number;
  /** Eigene offene Vorgänge, deren Frist nicht läuft — sie stehen in keiner Gruppe. */
  ohneLaufendeFrist: number;
  laden: boolean;
}

type WaechterJeVerbund = ReadonlyMap<string, { waechter: WaechterErgebnis; grund: StillstandGrund }>;

interface Geladen {
  waechter: WaechterJeVerbund;
  bewertungen: ReadonlyMap<string, VerbundMeilensteine>;
  knoten: readonly MeilensteinKnoten[];
  unbewertet: number;
  ohneBedingung: number;
  laden: boolean;
}

const LEER: Geladen = {
  waechter: new Map(), bewertungen: new Map(), knoten: [], unbewertet: 0, ohneBedingung: 0, laden: false,
};

/** Abbruch-Signal des Effekts — beide Sammler prüfen es nach jedem await. */
type Abbruch = () => boolean;

/**
 * Das Urteil des Stillstands-Wächters je Verbund, samt Grund und seinen Feldern.
 *
 * Die Zieltage hängen am Status der ZEILE (`AntragVorgang.status`), wie im
 * aufgeklappten Bereich und im Vorgangs-Board — nicht am Verbund-Status. Bis
 * v6.66 las diese Stelle `STATUS_VB`; gemessen am 13.09.2026 stand AXPUMP
 * deshalb auf der Karte mit „Ziel 14 T" und zwei Klicks weiter mit „Ziel 10 T".
 */
async function sammleWaechter(
  idb: IDBStore,
  vorgaenge: ReadonlyMap<string, AntragVorgang>,
  stichtag: string,
  abgebrochen: Abbruch,
): Promise<{ je: WaechterJeVerbund; unbewertet: number }> {
  const je = new Map<string, { waechter: WaechterErgebnis; grund: StillstandGrund }>();
  let unbewertet = 0;
  const version = getAktiveVersion() ?? await ladeAktiveVersion(idb);
  // Einmal je Lauf — trägt das Kürzel-Paar eines Stillstands zu seinen Feldern.
  const kuerzel = kuerzelIndex(version.felder);
  const schemaCache = new Map<string, Awaited<ReturnType<typeof listSchemasByProgramm>>>();

  for (const [verbundId, vorgang] of vorgaenge) {
    const [verbund, antraege] = await Promise.all([
      getVerbund(idb, verbundId), listAntraegeByVerbund(idb, verbundId),
    ]);
    if (abgebrochen()) return { je, unbewertet };
    const programmId = verbund?.programm_id ?? antraege[0]?.programm_id ?? null;
    if (!programmId) continue;

    let schemas = schemaCache.get(programmId);
    if (!schemas) {
      schemas = await listSchemasByProgramm(idb, programmId);
      schemaCache.set(programmId, schemas);
    }
    if (abgebrochen()) return { je, unbewertet };

    const aufloesung = baueFeldAufloesung(schemas, version.felder);
    const vbRecord = (verbund ?? {}) as unknown as Record<string, unknown>;
    const statusRoh = vorgang.status || (typeof verbund?.status === 'string' ? verbund.status : '');
    const waechter = pruefeStillstand({
      version,
      vorkommen: sammleVorkommen(version.felder, vbRecord, antraege.map(a => ({
        aktenzeichen: a.aktenzeichen, record: a as unknown as Record<string, unknown>,
      })), aufloesung),
      statusCode: findeStatusCode(statusRoh)?.eintrag.code ?? null,
      stichtag,
    });
    if (waechter.urteil === 'unbewertet') unbewertet += 1;
    je.set(verbundId, { waechter, grund: stillstandGrund(waechter, statusRoh, kuerzel) });
  }
  return { je, unbewertet };
}

/** Die Meilenstein-Bewertungen der eigenen Verbünde, über alle Programme. */
async function sammleBewertungen(
  idb: IDBStore,
  eigene: ReadonlySet<string>,
  stichtag: string,
  abgebrochen: Abbruch,
): Promise<{ je: ReadonlyMap<string, VerbundMeilensteine>; knoten: readonly MeilensteinKnoten[]; ohneBedingung: number }> {
  const geladen = await ladePlan(idb);
  const plan = freigegebeneFassung(geladen.plan);
  if (!plan) return { je: new Map(), knoten: [], ohneBedingung: 0 };

  // Knoten ohne Bedingung zählen nicht als gerissen — sie verschweigen sich aber auch nicht.
  const ohneBedingung = knotenOhneBedingung(plan.knoten).length;
  const je = new Map<string, VerbundMeilensteine>();
  for (const p of await listProgramme(idb)) {
    const schemas = await listSchemasByProgramm(idb, p.id);
    const projektion = await holeProjektion(idb, p.id, plan, schemas, stichtag);
    if (abgebrochen()) return { je, knoten: plan.knoten, ohneBedingung };
    for (const b of projektion.verbuende) if (eigene.has(b.verbundId)) je.set(b.verbundId, b);
  }
  return { je, knoten: plan.knoten, ohneBedingung };
}

/**
 * @param aktiv Nur laden, wenn die Fläche das Ergebnis auch zeigt (eingeklappte
 *   Karten rechnen nicht — Lazy-Zusage der `WidgetShell`).
 * @param meineAntraege Das bereits berechnete Dashboard-Aggregat. **Kein zweiter
 *   Bearbeiter-Filter.**
 * @param stichtag ISO, einmal je Aufrufer gestempelt.
 */
export function useFristenLage(
  aktiv: boolean,
  meineAntraege: readonly AntragVorgang[],
  stichtag: string,
): FristenLage {
  const idb = useStorage().idb;
  const [geladen, setGeladen] = useState<Geladen>(LEER);

  /** Ein Eintrag je Verbund — Verbünde stehen im Aggregat als einer. */
  const vorgaenge = useMemo(() => {
    const m = new Map<string, AntragVorgang>();
    for (const a of meineAntraege) {
      if (a.verbund_id && !m.has(a.verbund_id)) m.set(a.verbund_id, a);
    }
    return m;
  }, [meineAntraege]);

  useEffect(() => {
    const zieltage = isVorgangssystemEnabled();
    const meilensteine = isMeilensteinMonitoringEnabled();
    if (!aktiv || vorgaenge.size === 0 || (!zieltage && !meilensteine)) {
      setGeladen(LEER);
      return;
    }
    let abgebrochen = false;
    const abbruch: Abbruch = () => abgebrochen;
    setGeladen(s => ({ ...s, laden: true }));
    void (async () => {
      let waechter: WaechterJeVerbund = LEER.waechter;
      let unbewertet = 0;
      let bewertungen: ReadonlyMap<string, VerbundMeilensteine> = LEER.bewertungen;
      let knoten: readonly MeilensteinKnoten[] = [];
      let ohneBedingung = 0;

      // Eine Hälfte, die nicht lädt, darf die andere nicht mitnehmen — deshalb
      // zwei eigene `try`, nicht eines um beide.
      if (zieltage) {
        try {
          const r = await sammleWaechter(idb, vorgaenge, stichtag, abbruch);
          waechter = r.je;
          unbewertet = r.unbewertet;
        } catch { /* s.o. */ }
      }
      if (meilensteine) {
        try {
          const r = await sammleBewertungen(idb, new Set(vorgaenge.keys()), stichtag, abbruch);
          bewertungen = r.je;
          knoten = r.knoten;
          ohneBedingung = r.ohneBedingung;
        } catch { /* s.o. */ }
      }

      if (abgebrochen) return;
      setGeladen({ waechter, bewertungen, knoten, unbewertet, ohneBedingung, laden: false });
    })();
    return () => { abgebrochen = true; };
  }, [idb, aktiv, vorgaenge, stichtag]);

  const quellen = useMemo((): VerbundQuelle[] => [...vorgaenge].map(([verbundId, a]) => {
    const w = geladen.waechter.get(verbundId);
    return {
      verbundId,
      akronym: a.acronym ?? a.verbund_titel ?? a.title ?? verbundId,
      fristZustand: a.fristZustand ?? null,
      fristTage: a.fristTage ?? null,
      erledigtLautKuerzeln: a.erledigtLautKuerzeln === true,
      waechter: w?.waechter ?? null,
      stillstandGrund: w?.grund ?? null,
      bewertung: geladen.bewertungen.get(verbundId) ?? null,
    };
  }), [vorgaenge, geladen]);

  return useMemo(() => ({
    zeilen: baueFristenLage(quellen, geladen.knoten, stichtag),
    unbewertet: geladen.unbewertet,
    ohneBedingung: geladen.ohneBedingung,
    ohneLaufendeFrist: zaehleOhneLaufendeFrist(quellen),
    laden: geladen.laden,
  }), [quellen, geladen, stichtag]);
}
