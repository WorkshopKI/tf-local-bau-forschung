/**
 * Der Block **Bestand** — Aggregate über den Bestandslauf, für die Fragen der
 * Projektleitung und den Liegezeit-Vergleich eines Vorgangs.
 *
 * Nur Zählungen nach Rolle, Verfahrensschritt, Status und Frist — nie nach
 * Bearbeiter-Kürzel (vorgangssystem.md §12.6). Die Besetzung zählt
 * `besetzteRollen`; die Kürzel selbst verlassen `bearbeiterFilter.ts` nicht.
 *
 * **Die Grundlage steht dabei**: welche Richtlinien gerechnet sind und wie viele
 * Vorgänge älterer Richtlinien fehlen. Eine Zahl ohne ihren Nenner liest sich als
 * der ganze Bestand.
 *
 * Rein: kein React, kein IDB.
 */
import { findeStatusCode } from '@/core/status/status-codes';
import { medianLiegezeit } from '@/core/status/waechter';
import { ROLLE_LABEL } from '@/core/status/rollen';
import type { Rolle } from '@/core/status/typen';
import type { BestandZeile } from '@/core/status/bestands-lauf';
import { isTerminalStatus } from '@/core/utils/status-canonical';
import { statusLabel } from '@/core/utils/status-wert-labels';
import { besetzteRollen } from '@/plugins/antraege/bearbeiterFilter';
import type { ZusatzBlock } from './zusatzBloecke';

/** Wie viele Einträge eine Liste im Block höchstens nennt. */
export const BESTAND_MAX_LISTE = 15;
/** Das Fenster der Frage „Welche Fristen laufen bald ab?". */
export const FRIST_FENSTER_TAGE = 14;
/** Wie viele Verfahrensschritte bzw. Status die Verteilungen nennen. */
const MAX_VERTEILUNG = 12;

/** Ein Verbund, dessen Bearbeitungsplan gefährdet oder nicht haltbar ist. */
export interface PlanRisiko {
  verbundId: string;
  titel: string;
  prognose: 'gefährdet' | 'nicht haltbar';
  /** Tage bis zur Gesamtfrist; negativ = überschritten. */
  restTage: number | null;
}

export interface BestandEingabe {
  zeilen: readonly BestandZeile[];
  /** Teilvorhaben im Bereich, aber älterer Richtlinien — nicht gerechnet. */
  nichtGerechnet: number;
  /** Jahre der Richtlinien des Laufs, z. B. `[2020, 2025]`. */
  jahre: readonly number[];
  /** Der gesehene Vorgang — für den Liegezeit-Vergleich. */
  fokus?: { titel: string; statusRoh: string; tage: number | null } | null;
  /** Verbünde mit gefährdetem oder nicht haltbarem Plan; fehlend/`null` = nicht geladen. */
  planRisiken?: readonly PlanRisiko[] | null;
}

type StauRolle = Rolle | 'ast' | 'offen';

function stauLabel(r: StauRolle): string {
  if (r === 'ast') return 'Antragsteller';
  if (r === 'offen') return 'ohne ableitbare Rolle';
  return ROLLE_LABEL[r];
}

function zaehle<K>(werte: Iterable<K>): [K, number][] {
  const m = new Map<K, number>();
  for (const w of werte) m.set(w, (m.get(w) ?? 0) + 1);
  return [...m].sort((a, b) => b[1] - a[1]);
}

/** „noch 5 Tage" — Akkusativ. */
const tage = (n: number): string => `${n} ${n === 1 ? 'Tag' : 'Tage'}`;
/** „seit 4 Tagen", „vor 40 Tagen" — Dativ. */
const tagenDativ = (n: number): string => `${n} ${n === 1 ? 'Tag' : 'Tagen'}`;

/** Stau je Rolle — dieselbe Zählung wie im Vorgangs-Board (`useVorgangsBoard`). */
function stauZeilen(offen: readonly BestandZeile[]): string[] {
  let unbewertet = 0;
  const haengt: StauRolle[] = [];
  for (const z of offen) {
    if (z.waechter.urteil === 'unbewertet') { unbewertet += 1; continue; }
    if (z.waechter.urteil === 'haengt') haengt.push(z.waechter.rolle ?? 'offen');
  }
  const teile = zaehle(haengt).map(([r, n]) => `${stauLabel(r)} ${n}`);
  return [
    `Stau je Rolle (hängende Teilvorhaben laut Stillstands-Wächter): ${teile.length > 0 ? teile.join(' · ') : 'keiner'}`
    + (unbewertet > 0 ? `; ${unbewertet} nicht bewertbar (für ihren Status sind keine Zieltage gepflegt)` : ''),
  ];
}

function phasenZeilen(offen: readonly BestandZeile[]): string[] {
  const teile = zaehle(offen.map(z => z.zahPhaseText || 'ohne Verfahrensschritt'))
    .slice(0, MAX_VERTEILUNG)
    .map(([p, n]) => `${p} ${n}`);
  return teile.length > 0 ? [`Verfahrensschritte (offene Teilvorhaben): ${teile.join(' · ')}`] : [];
}

/** Fristen: überschritten gezählt, die bald ablaufenden je Verbund mit der knappsten Uhr. */
function fristZeilen(offen: readonly BestandZeile[]): string[] {
  let ueber = 0;
  const knapp = new Map<string, { z: BestandZeile; rest: number }>();
  for (const z of offen) {
    if (!z.fristLaeuft || z.restTage === null) continue;
    const rest = z.restTage;
    if (rest < 0) { ueber += 1; continue; }
    if (rest > FRIST_FENSTER_TAGE) continue;
    const key = z.verbundId ?? z.aktenzeichen;
    const da = knapp.get(key);
    if (!da || rest < da.rest) knapp.set(key, { z, rest });
  }
  const liste = [...knapp.values()].sort((a, b) => a.rest - b.rest);
  const out = [
    `Bearbeitungsfristen (laufende Uhr): ${ueber} Teilvorhaben überschritten; ${liste.length} Vorgänge laufen in den nächsten ${FRIST_FENSTER_TAGE} Tagen ab`,
  ];
  for (const { z, rest } of liste.slice(0, BESTAND_MAX_LISTE)) {
    out.push(`- ${z.titel || z.aktenzeichen} (${z.verbundId ?? z.aktenzeichen}): noch ${tage(rest)}`);
  }
  if (liste.length > BESTAND_MAX_LISTE) out.push(`- … und ${liste.length - BESTAND_MAX_LISTE} weitere`);
  return out;
}

function bearbeiterZeilen(offen: readonly BestandZeile[]): string[] {
  let ohneAb = 0;
  let ohneFb = 0;
  for (const z of offen) {
    const besetzt = besetzteRollen(z.filterRecord);
    if (!besetzt.includes('ab')) ohneAb += 1;
    if (!besetzt.includes('fb')) ohneFb += 1;
  }
  return [`Zuweisung (offene Teilvorhaben, nur gezählt): ohne AB ${ohneAb}, ohne FB ${ohneFb} von ${offen.length}`];
}

function liegezeitZeilen(
  offen: readonly BestandZeile[], fokus: BestandEingabe['fokus'],
): string[] {
  const label = new Map<number, string>();
  const proben = offen.map(z => {
    const code = findeStatusCode(z.statusRoh)?.eintrag.code ?? null;
    if (code !== null && !label.has(code)) label.set(code, statusLabel(z.statusRoh));
    return { statusCode: code, tage: z.waechter.tage };
  });
  const verteilung = medianLiegezeit(proben);
  const out = ['Liegezeit je Status (Tage seit der jüngsten Aktivität — eine Näherung, nicht die Verweildauer im Status):'];
  for (const [code, v] of [...verteilung].sort((a, b) => b[1].n - a[1].n).slice(0, MAX_VERTEILUNG)) {
    out.push(`- ${label.get(code) ?? `Code ${code}`}: Median ${v.median}, p90 ${v.p90}, n = ${v.n}`);
  }
  if (fokus) {
    const code = findeStatusCode(fokus.statusRoh)?.eintrag.code ?? null;
    const v = code !== null ? verteilung.get(code) : undefined;
    const eigen = fokus.tage === null ? 'Liegezeit unbekannt' : `zuletzt vor ${tagenDativ(fokus.tage)} aktiv`;
    out.push(v
      ? `Der gesehene Vorgang ${fokus.titel}: Status ${statusLabel(fokus.statusRoh)}, ${eigen} — für diesen Status im Bestand Median ${v.median}, p90 ${v.p90} Tage (n = ${v.n})`
      : `Der gesehene Vorgang ${fokus.titel}: für seinen Status gibt es im Bestandslauf keine Vergleichswerte.`);
  }
  return out;
}

function planZeilen(risiken: BestandEingabe['planRisiken']): string[] {
  if (!risiken) return [];
  const gefaehrdet = risiken.filter(r => r.prognose === 'gefährdet').length;
  const out = [`Bearbeitungsplan (Meilensteine): ${risiken.length - gefaehrdet} Verbünde nicht haltbar, ${gefaehrdet} gefährdet`];
  const sortiert = [...risiken].sort((a, b) => (a.restTage ?? Infinity) - (b.restTage ?? Infinity));
  for (const r of sortiert.slice(0, BESTAND_MAX_LISTE)) {
    const rest = r.restTage === null
      ? ''
      : r.restTage >= 0 ? `, noch ${tage(r.restTage)} bis zur Gesamtfrist` : `, Gesamtfrist seit ${tagenDativ(-r.restTage)} überschritten`;
    out.push(`- ${r.titel} (${r.verbundId}): ${r.prognose}${rest}`);
  }
  return out;
}

export function bestandBlock(e: BestandEingabe): ZusatzBlock {
  const offen = e.zeilen.filter(z => !isTerminalStatus(z.statusRoh));
  const jahre = e.jahre.join(' und ');
  return {
    id: 'bestand',
    titel: `Bestand (Richtlinien ${jahre})`,
    zeilen: [
      `Grundlage: Bestandslauf über die Richtlinien ${jahre} — ${e.zeilen.length} Teilvorhaben, davon ${offen.length} offen.`
      + (e.nichtGerechnet > 0 ? ` ${e.nichtGerechnet} Teilvorhaben älterer Richtlinien sind nicht gerechnet.` : ''),
      ...stauZeilen(offen),
      ...phasenZeilen(offen),
      ...fristZeilen(offen),
      ...bearbeiterZeilen(offen),
      ...liegezeitZeilen(offen, e.fokus ?? null),
      ...planZeilen(e.planRisiken),
    ],
  };
}
