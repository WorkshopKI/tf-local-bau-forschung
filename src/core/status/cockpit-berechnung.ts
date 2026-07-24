/**
 * Reine Berechnungen fürs Cockpit: Feld-Extraktion je Verbund, Vorkommen,
 * Simulation (abgeleitete Phasen-Verteilung), Vorher/Nachher-Diff, „zuletzt
 * gesehen". Alles ohne IO — die Daten reicht der Hook rein (testbar).
 */
import type { MappingVersion, SpinePhase } from './typen';
import { wertId } from './typen';
import { leseFeldWert } from './feld-zugriff';
import { leiteStatusAb } from './ableitung';
import type { StatusEvent } from './event-typen';

export interface VerbundFelder {
  verbundId: string;
  felder: Record<string, string>;
  tvFelder: Record<string, Record<string, string>>;
}

/** Baut die Engine-Eingabe eines Verbunds aus Verbund- + Antrag-Records
 *  (ebene-korrekt via `quelleKey`). Rein. */
export function baueVerbundFelder(
  version: MappingVersion,
  verbundId: string,
  verbundRecord: Record<string, unknown>,
  antraege: { aktenzeichen: string; record: Record<string, unknown> }[],
): VerbundFelder {
  const felder: Record<string, string> = {};
  for (const feld of version.felder) {
    if (feld.ebene !== 'verbund') continue;
    const w = leseFeldWert(verbundRecord, feld);
    if (w) felder[feld.feldId] = w;
  }
  const tvFelder: Record<string, Record<string, string>> = {};
  for (const a of antraege) {
    const rec: Record<string, string> = {};
    for (const feld of version.felder) {
      if (feld.ebene !== 'tv') continue;
      const w = leseFeldWert(a.record, feld);
      if (w) rec[feld.feldId] = w;
    }
    if (Object.keys(rec).length > 0) tvFelder[a.aktenzeichen] = rec;
  }
  return { verbundId, felder, tvFelder };
}

/** Zählt, in wie vielen Verbünden ein (feldId, wert) aktuell vorkommt.
 *  Schlüssel = `wertId(feldId, wert)`. Rein. */
export function zaehleVorkommen(alle: readonly VerbundFelder[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const vf of alle) {
    const gesehen = new Set<string>();
    const add = (feldId: string, wert: string): void => {
      const id = wertId(feldId, wert);
      if (gesehen.has(id)) return;
      gesehen.add(id);
      m.set(id, (m.get(id) ?? 0) + 1);
    };
    for (const [f, w] of Object.entries(vf.felder)) add(f, w);
    for (const rec of Object.values(vf.tvFelder)) for (const [f, w] of Object.entries(rec)) add(f, w);
  }
  return m;
}

export interface SimErgebnis {
  verbundId: string;
  spinePhase: SpinePhase;
  konflikt: boolean;
}

/** Leitet für jeden Verbund die Phase + Konflikt ab (Entwurf oder aktiv). Rein. */
export function simuliere(
  version: MappingVersion, alle: readonly VerbundFelder[], heute?: string,
): SimErgebnis[] {
  return alle.map(vf => {
    const r = leiteStatusAb(version, vf.felder, vf.tvFelder, heute);
    return { verbundId: vf.verbundId, spinePhase: r.spinePhase, konflikt: r.konflikt };
  });
}

export const SPINE_REIHENFOLGE: readonly SpinePhase[] = [
  'eingang', 'vollstaendigkeit', 'fachpruefung', 'bewilligung', 'schluss', 'keine',
];

/** Zählt Ergebnisse je Spine-Phase. Rein. */
export function verteilung(ergebnisse: readonly SimErgebnis[]): Record<SpinePhase, number> {
  const v: Record<SpinePhase, number> = {
    eingang: 0, vollstaendigkeit: 0, fachpruefung: 0, bewilligung: 0, schluss: 0, keine: 0,
  };
  for (const e of ergebnisse) v[e.spinePhase]++;
  return v;
}

export interface PhasenWechsel {
  verbundId: string;
  vorher: SpinePhase;
  nachher: SpinePhase;
}

/** Verbünde, die zwischen aktiv und Entwurf die Phase wechseln. Rein. */
export function diffPhasen(
  aktiv: readonly SimErgebnis[], entwurf: readonly SimErgebnis[],
): PhasenWechsel[] {
  const aMap = new Map(aktiv.map(e => [e.verbundId, e.spinePhase]));
  const out: PhasenWechsel[] = [];
  for (const e of entwurf) {
    const vorher = aMap.get(e.verbundId);
    if (vorher !== undefined && vorher !== e.spinePhase) {
      out.push({ verbundId: e.verbundId, vorher, nachher: e.spinePhase });
    }
  }
  return out;
}

/** Jüngstes `erfasstAm` je (feldId, wert) aus dem Event-Log. Rein. */
export function zuletztGesehen(events: readonly StatusEvent[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const e of events) {
    const id = wertId(e.feldId, e.wert);
    const bisher = m.get(id);
    if (!bisher || e.erfasstAm > bisher) m.set(id, e.erfasstAm);
  }
  return m;
}
