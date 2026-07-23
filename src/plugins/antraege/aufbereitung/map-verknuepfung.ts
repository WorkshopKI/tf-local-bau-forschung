/**
 * Verknüpfung Aufbereitung ↔ MAP-Einreichung — die einzige Stelle, an der die
 * Aufbereitung an strukturierte Anlage-5-Daten kommt.
 *
 * Warum rückwärts gesucht wird: eine `MapEinreichung` trägt KEIN Aktenzeichen und kein
 * Förderkennzeichen (nur Titel + Akronym) — vom Vorgang aus gibt es also keinen
 * Vorwärts-Schlüssel. Was es gibt, ist die Zuordnung der Vorhabensbeschreibung:
 * `map-vb:<einreichungId>` → `{ docId, zusatz[] }`. Genau darüber läuft der Bezug —
 * dieselbe VB-Datei, also derselbe Vorgang.
 *
 * Bewusst eine schmale LESE-Schicht: nur `kv`-Keys und **Typ-Importe** aus dem
 * MAP-Plugin (Typ-Importe zählen im Zyklen-Wächter nicht als Kante — die Laufzeit-
 * Richtung bleibt map → antraege). Es wird nichts geschrieben und nichts gespiegelt;
 * fehlt die Zuordnung, ist das Ergebnis schlicht `null`.
 *
 * Der abgeleitete Zeitplan ist die ehrliche Gegen-Quelle zur pausierten PDF-Ernte
 * (`pausierte-module.ts`): Arbeitspakete aus deklarierten Feldern statt aus einer bei
 * der Extraktion zerfallenen Tabelle.
 */
import type { IDBStore } from '@/core/services/storage';
import type { MapEinreichung } from '@/plugins/map-foerderfaehig/types';
import type { VbZuordnung } from '@/plugins/map-foerderfaehig/store';
import type { KurzfassungContext } from '../kurzfassung/types';
import { resolveVb } from './quellen';
import { datumAbsolut, monatslaenge, type ApZeile } from './tabellen';

/** kv-Präfix der VB-Zuordnung (Quelle: `map-foerderfaehig/store.ts`). */
const VB_PRAEFIX = 'map-vb:';
/** kv-Präfix der Einreichung selbst. */
const EINREICHUNG_PRAEFIX = 'map-einreichung:';

/** Aus einer Einreichungs-JSON abgeleiteter Projektplan (Gantt-tauglich). */
export interface EinreichungsZeitplan {
  zeilen: ApZeile[];
  /** Monat, bis zu dem die X-Achse reicht (max über Zeilen und Laufzeit). */
  achseMax: number;
  /** Laufzeit laut Einreichung — Kopfzeile der Kennzahlen. */
  laufzeit: { start: string | null; ende: string | null; monate: number | null };
}

/** Die zum Vorgang gefundene Einreichung samt abgeleitetem Plan. */
export interface EinreichungsBezug {
  einreichungId: string;
  /** Dateiname der importierten JSON — macht die Herkunft im Tab benennbar. */
  dateiname: string;
  /** `null`, wenn die Einreichung keine datierten Arbeitspakete führt. */
  zeitplan: EinreichungsZeitplan | null;
}

/* -------------------------------------------------------------------------- */
/* Reine Teile (testbar ohne IDB)                                              */
/* -------------------------------------------------------------------------- */

/** Ein `map-vb:`-Eintrag, tolerant gelesen (fremde Datei, fremdes Schema). */
function alsZuordnung(wert: unknown): VbZuordnung | null {
  if (typeof wert !== 'object' || wert === null) return null;
  const z = wert as Partial<VbZuordnung>;
  return typeof z.docId === 'string' && z.docId ? (z as VbZuordnung) : null;
}

/**
 * Sucht in den `map-vb:`-Einträgen die Einreichung, der `docId` zugeordnet ist —
 * als Haupt- ODER als Zusatzdokument (die VB ist in der Praxis oft auf mehrere
 * Dateien verteilt). Rein; erster Treffer in Eintrags-Reihenfolge gewinnt.
 */
export function findeEinreichungIdFuerDoc(
  eintraege: ReadonlyArray<readonly [string, unknown]>, docId: string,
): string | null {
  if (!docId) return null;
  for (const [key, wert] of eintraege) {
    if (!key.startsWith(VB_PRAEFIX)) continue;
    const z = alsZuordnung(wert);
    if (!z) continue;
    const treffer = z.docId === docId || (z.zusatz ?? []).some(d => d.docId === docId);
    if (treffer) return key.slice(VB_PRAEFIX.length);
  }
  return null;
}

/** `YYYY-MM-DD` → Kalenderdatum. Rein; `null` bei allem anderen. */
function parseIsoDatum(wert: string | null): { y: number; m: number; d: number } | null {
  if (!wert) return null;
  const t = /^(\d{4})-(\d{2})-(\d{2})/.exec(wert.trim());
  if (!t) return null;
  const m = Number(t[2]);
  const d = Number(t[3]);
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y: Number(t[1]), m, d };
}

/**
 * Einreichung → Projektplan. **M1 = Monat des Laufzeit-Starts**; fehlt der, gilt wie
 * in `normalisiereAnlage5` der früheste Arbeitspaket-Beginn. Die fraktionalen
 * `pos*`-Werte folgen exakt derselben Herleitung wie dort (Monatsanfang = Kante),
 * damit beide Quellen im selben Gantt identisch aussehen.
 *
 * `maNr` bleibt bewusst leer: die Einsatzplanung führt je Arbeitspaket MEHRERE
 * Personen, `ApZeile` trägt genau eine. Eine Zeile je (AP × Person) würde den
 * AP-Gantt verdoppeln. Der „Nach Person"-Umschalter bleibt dadurch deaktiviert —
 * ehrlicher als eine willkürlich gewählte erste Person.
 */
export function einreichungZuZeitplan(einreichung: MapEinreichung): EinreichungsZeitplan | null {
  const pakete = einreichung.arbeitspakete ?? [];
  if (pakete.length === 0) return null;

  const starts = pakete.map(p => parseIsoDatum(p.start)).filter((d): d is { y: number; m: number; d: number } => d !== null);
  const basis = parseIsoDatum(einreichung.laufzeit?.start ?? null)
    ?? starts.reduce<{ y: number; m: number; d: number } | null>(
      (min, d) => (min === null || datumAbsolut(d) < datumAbsolut(min) ? d : min), null,
    );
  if (!basis) return null;

  const zuMonat = (d: { y: number; m: number } | null): number | undefined =>
    d ? datumAbsolut(d) - datumAbsolut(basis) + 1 : undefined;
  const zuPos = (d: { y: number; m: number; d: number } | null, istEnde: boolean): number | undefined => {
    if (!d) return undefined;
    const ganz = datumAbsolut(d) - datumAbsolut(basis) + 1;
    return ganz + (istEnde ? d.d / monatslaenge(d) : (d.d - 1) / monatslaenge(d));
  };

  const zeilen: ApZeile[] = pakete.map((p, i) => {
    const beginn = parseIsoDatum(p.start);
    const ende = parseIsoDatum(p.ende);
    const zeile: ApZeile = {
      nummer: String(p.laufnummer ?? i + 1),
      bezeichnung: p.name?.trim() ?? '',
      istUnterAp: false,
    };
    const mStart = zuMonat(beginn);
    const mEnde = zuMonat(ende);
    const pStart = zuPos(beginn, false);
    const pEnde = zuPos(ende, true);
    if (mStart !== undefined) zeile.monatStart = mStart;
    if (mEnde !== undefined) zeile.monatEnde = mEnde;
    if (pStart !== undefined) zeile.posStart = pStart;
    if (pEnde !== undefined) zeile.posEnde = pEnde;
    if (typeof p.aufwandPm === 'number' && Number.isFinite(p.aufwandPm)) zeile.pm = p.aufwandPm;
    return zeile;
  });

  const ausZeilen = zeilen.reduce((max, z) => Math.max(max, z.monatEnde ?? z.monatStart ?? 0), 0);
  const achseMax = Math.max(ausZeilen, einreichung.laufzeit?.monate ?? 0, 1);
  return {
    zeilen,
    achseMax,
    laufzeit: {
      start: einreichung.laufzeit?.start ?? null,
      ende: einreichung.laufzeit?.ende ?? null,
      monate: einreichung.laufzeit?.monate ?? null,
    },
  };
}

/* -------------------------------------------------------------------------- */
/* IO                                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Lädt den Einreichungs-Bezug eines Vorgangs. `null`, sobald ein Glied der Kette
 * fehlt: keine VB im IDB-Index (Ordner-Fallback trägt keine `docId`), keine
 * MAP-Zuordnung auf diese Datei, oder die Einreichung selbst ist weg.
 */
export async function ladeEinreichungsBezug(
  idb: IDBStore, ctx: Pick<KurzfassungContext, 'key' | 'knownIds'>,
): Promise<EinreichungsBezug | null> {
  const vb = await resolveVb(idb, ctx);
  const docId = vb?.dokument?.id;
  if (!docId) return null;

  const eintraege = await idb.entries(VB_PRAEFIX);
  const einreichungId = findeEinreichungIdFuerDoc(eintraege, docId);
  if (!einreichungId) return null;

  const einreichung = await idb.get<MapEinreichung>(`${EINREICHUNG_PRAEFIX}${einreichungId}`);
  if (!einreichung) return null;

  return {
    einreichungId,
    dateiname: einreichung.dateiname || 'Einreichung',
    zeitplan: einreichungZuZeitplan(einreichung),
  };
}
