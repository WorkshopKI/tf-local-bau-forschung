/**
 * Frist-Anlässe beider Systeme laden — die **eine** Quelle für alle, die sie
 * zeigen.
 *
 * Hier stand bis v6.45 der Ladeeffekt des Fristen-Widgets. Mit dem Tagesbrief
 * bekam er einen zweiten Leser, und zwei Flächen, die dieselbe Zahl unabhängig
 * herleiten, laufen genau dann auseinander, wenn es darauf ankommt (v4.131). Der
 * Effekt ist deshalb **gehoben, nicht kopiert**; das Widget rendert weiter, was
 * es vorher rechnete.
 *
 * Zusammen geladen, **nicht** zusammen gerechnet: die beiden Evaluatoren laufen
 * unverändert (`pruefeStillstand`, die Meilenstein-Projektion), das Ergebnis
 * kommt als eine sortierte Liste zurück, in der jede Zeile ihre Herkunft trägt
 * (`FristAnlass.art`).
 */
import { useEffect, useState } from 'react';
import type { IDBStore } from '@/core/services/storage/idb-store';
import { useStorage } from '@/core/hooks/useStorage';
import { isMeilensteinMonitoringEnabled, isVorgangssystemEnabled } from '@/config/feature-flags';
import {
  getVerbund, listAntraegeByVerbund, listProgramme, listSchemasByProgramm,
} from '@/core/services/csv/idb-csv';
import {
  baueFeldAufloesung, findeStatusCode, getAktiveVersion, kuerzelIndex, ladeAktiveVersion,
  pruefeStillstand, sammleVorkommen,
} from '@/core/status';
import {
  freigegebeneFassung, holeProjektion, knotenOhneBedingung, ladePlan,
} from '@/core/meilensteine';
import { meilensteinAnlaesse, sortiereAnlaesse, zieltagAnlass, type FristAnlass } from './fristAnlaesse';

export interface FristAnlaesse {
  /** Sortiert (`sortiereAnlaesse`), beide Arten gemischt. */
  anlaesse: FristAnlass[];
  /** Verbünde ohne auswertbaren Zieltag — eine Aussage über die Belastbarkeit. */
  unbewertet: number;
  /** Knoten des Meilenstein-Plans ohne Bedingung — eine Aussage über den PLAN. */
  ohneBedingung: number;
  laden: boolean;
}

const LEER: FristAnlaesse = { anlaesse: [], unbewertet: 0, ohneBedingung: 0, laden: false };

/** Abbruch-Signal des Effekts — beide Sammler prüfen es nach jedem await. */
type Abbruch = () => boolean;

/**
 * Stillstand je Verbund (Zieltage). Eigene Funktion statt eines Blocks im
 * Effekt: verschachtelt lag sie sieben Ebenen tief, und ab dort hält niemand
 * mehr im Kopf, unter welcher Bedingung eine Zeile entsteht.
 */
async function sammleZieltage(
  idb: IDBStore,
  meineVerbuende: ReadonlyMap<string, string>,
  stichtag: string,
  abgebrochen: Abbruch,
): Promise<{ anlaesse: FristAnlass[]; unbewertet: number }> {
  const anlaesse: FristAnlass[] = [];
  let unbewertet = 0;
  const version = getAktiveVersion() ?? await ladeAktiveVersion(idb);
  // Einmal je Lauf — trägt das Kürzel-Paar eines Anlasses zu seinen Feldern.
  const kuerzel = kuerzelIndex(version.felder);
  const schemaCache = new Map<string, Awaited<ReturnType<typeof listSchemasByProgramm>>>();

  for (const [verbundId, akronym] of meineVerbuende) {
    const [verbund, antraege] = await Promise.all([
      getVerbund(idb, verbundId), listAntraegeByVerbund(idb, verbundId),
    ]);
    if (abgebrochen()) return { anlaesse, unbewertet };
    const programmId = verbund?.programm_id ?? antraege[0]?.programm_id ?? null;
    if (!programmId) continue;

    let schemas = schemaCache.get(programmId);
    if (!schemas) {
      schemas = await listSchemasByProgramm(idb, programmId);
      schemaCache.set(programmId, schemas);
    }
    if (abgebrochen()) return { anlaesse, unbewertet };

    const aufloesung = baueFeldAufloesung(schemas, version.felder);
    const vbRecord = (verbund ?? {}) as unknown as Record<string, unknown>;
    const statusRoh = typeof verbund?.status === 'string' ? verbund.status : '';
    const waechter = pruefeStillstand({
      version,
      vorkommen: sammleVorkommen(version.felder, vbRecord, antraege.map(a => ({
        aktenzeichen: a.aktenzeichen, record: a as unknown as Record<string, unknown>,
      })), aufloesung),
      statusCode: findeStatusCode(statusRoh)?.eintrag.code ?? null,
      stichtag,
    });
    if (waechter.urteil === 'unbewertet') { unbewertet += 1; continue; }
    if (waechter.urteil !== 'haengt') continue;
    anlaesse.push(zieltagAnlass(verbundId, akronym, statusRoh, waechter, kuerzel));
  }
  return { anlaesse, unbewertet };
}

/** Meilensteine (Sollwoche ab Eingang) über alle Programme. */
async function sammleMeilensteine(
  idb: IDBStore,
  meineVerbuende: ReadonlyMap<string, string>,
  stichtag: string,
  abgebrochen: Abbruch,
): Promise<{ anlaesse: FristAnlass[]; ohneBedingung: number }> {
  const geladen = await ladePlan(idb);
  const plan = freigegebeneFassung(geladen.plan);
  if (!plan) return { anlaesse: [], ohneBedingung: 0 };

  // Seit v4.134 zaehlen Knoten ohne Bedingung nicht mehr als gerissen — aber sie
  // verschweigen sich auch nicht.
  const ohneBedingung = knotenOhneBedingung(plan.knoten).length;
  const anlaesse: FristAnlass[] = [];
  const jetzt = new Date(stichtag).getTime();

  for (const p of await listProgramme(idb)) {
    const schemas = await listSchemasByProgramm(idb, p.id);
    const projektion = await holeProjektion(idb, p.id, plan, schemas, stichtag);
    if (abgebrochen()) return { anlaesse, ohneBedingung };
    anlaesse.push(...meilensteinAnlaesse(
      projektion.verbuende.filter(b => meineVerbuende.has(b.verbundId)),
      plan.knoten,
      id => meineVerbuende.get(id) ?? id,
      jetzt,
    ));
  }
  return { anlaesse, ohneBedingung };
}

/**
 * @param aktiv Nur laden, wenn die Fläche das Ergebnis auch zeigt (eingeklappte
 *   Karten rechnen nicht — Lazy-Zusage der `WidgetShell`).
 * @param meineVerbuende `verbund_id` → Akronym, aus dem bereits berechneten
 *   Dashboard-Aggregat. **Kein zweiter Bearbeiter-Filter.**
 * @param stichtag ISO, einmal je Aufrufer gestempelt.
 * @param mitMeilensteinen `false` = nur Zieltage. Der Tagesbrief führt keine
 *   Meilensteine und spart sich damit die Plan-Projektion über alle Programme.
 */
export function useFristAnlaesse(
  aktiv: boolean,
  meineVerbuende: ReadonlyMap<string, string>,
  stichtag: string,
  mitMeilensteinen = true,
): FristAnlaesse {
  const idb = useStorage().idb;
  const [stand, setStand] = useState<FristAnlaesse>(LEER);

  useEffect(() => {
    const zieltage = isVorgangssystemEnabled();
    const meilensteine = mitMeilensteinen && isMeilensteinMonitoringEnabled();
    if (!aktiv || (!zieltage && !meilensteine) || meineVerbuende.size === 0) {
      setStand(LEER);
      return;
    }
    let abgebrochen = false;
    const abbruch: Abbruch = () => abgebrochen;
    setStand(s => ({ ...s, laden: true }));
    void (async () => {
      const gesammelt: FristAnlass[] = [];
      let ohneZiel = 0;
      let planLuecken = 0;

      // Eine Hälfte, die nicht lädt, darf die andere nicht mitnehmen — deshalb
      // zwei eigene `try`, nicht eines um beide.
      if (zieltage) {
        try {
          const r = await sammleZieltage(idb, meineVerbuende, stichtag, abbruch);
          gesammelt.push(...r.anlaesse);
          ohneZiel = r.unbewertet;
        } catch { /* s.o. */ }
      }
      if (meilensteine) {
        try {
          const r = await sammleMeilensteine(idb, meineVerbuende, stichtag, abbruch);
          gesammelt.push(...r.anlaesse);
          planLuecken = r.ohneBedingung;
        } catch { /* s.o. */ }
      }

      if (abgebrochen) return;
      setStand({
        anlaesse: sortiereAnlaesse(gesammelt),
        unbewertet: ohneZiel,
        ohneBedingung: planLuecken,
        laden: false,
      });
    })();
    return () => { abgebrochen = true; };
  }, [idb, aktiv, meineVerbuende, stichtag, mitMeilensteinen]);

  return stand;
}
