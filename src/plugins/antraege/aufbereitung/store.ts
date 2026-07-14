/**
 * Storage + Orchestrierung der Antrag-Aufbereitung. Der Run wird im IDB-`kv`-Store
 * unter `aufbereitung:<antragKey>` gehalten (raw `idb.get`/`idb.set`, Muster
 * `relevanz-map.ts` — KEIN neuer Object-Store, Pitfall #29). `baueRun` ist die
 * reine, deterministische Assemblierung (testbar); `computeAufbereitung` löst die
 * Quellen auf, ruft `baueRun` und persistiert.
 */
import type { IDBStore } from '@/core/services/storage';
import { hashText } from '@/plugins/antraege/gutachten/runner';
import { parseVbGliederung, type VbSektion } from './gliederung';
import {
  ernteTabellen, normalisiereAnlage5, normalisiereZeitplanText, verglichZeitplaene, pruefeKapazitaet,
  summePm, type ApZeile, type Befund,
} from './tabellen';
import { resolveAnlage5, resolveKorpus, baueKorpus } from './quellen';
import { ernteRisiken } from './risiken';
import type { AufbereitungRun, QuelleRef, RunTabelle, TvPlan } from './types';

export const aufbereitungKey = (antragKey: string): string => `aufbereitung:${antragKey}`;

/** Kontext, den `computeAufbereitung` braucht (Teil von KurzfassungContext). */
export interface AufbereitungContext {
  key: string;
  knownIds: string[];
}

/** Eine aufgelöste Quelle als Eingang für die reine Assemblierung. */
export interface QuellEingang {
  markdown: string;
  name: string;
}

/** Stabiler Schlüssel eines Befunds (für `offenePunkte` — Befunde haben keine ID). */
export function befundKey(b: Befund): string {
  return `${b.typ}::${b.text}`;
}

/** Aggregierte Verbund-Kennzahlen über alle TV-Pläne (rein, für die Summenzeile). */
export interface VerbundSummary {
  summePm: number;
  /** Summe der TV-LOKALEN Distinct-MA-Zahlen (MA-Nummern sind je TV eigen, kein globales Dedup). */
  maAnzahl: number;
  horizont: number;
  tvMitAnlage: number;
  tvGesamt: number;
}

export function verbundZeitplanSummary(teilplaene: TvPlan[]): VerbundSummary {
  let pm = 0;
  let ma = 0;
  let horizont = 0;
  let mitAnlage = 0;
  for (const tp of teilplaene) {
    if (!tp.zeitplan) continue;
    mitAnlage += 1;
    pm += summePm(tp.zeitplan.zeilen);
    ma += new Set(tp.zeitplan.zeilen.map(z => z.maNr?.trim()).filter((m): m is string => !!m)).size;
    horizont = Math.max(horizont, tp.zeitplan.achseMax);
  }
  return { summePm: pm, maAnzahl: ma, horizont, tvMitAnlage: mitAnlage, tvGesamt: teilplaene.length };
}

/**
 * Übernimmt die vom Nutzer markierten offenen Punkte in einen frisch berechneten
 * Run und verwirft verwaiste Keys. Behalten wird ein Key, wenn er (a) einem Befund
 * des neuen Runs entspricht (deterministische Zeitplan-Befunde) ODER (b) ein
 * `aspekt-fehlt:`-/`risiko-fehlt:`-/`zahl-widerspruch:`-Kandidat ist — Letztere hängen
 * an einem LLM-Baustein (Aspekt-/Zahlen-Lauf) bzw. an der (UI-seitigen) Risiko-Zuordnung,
 * nicht am deterministischen Run, und werden erst beim Rendern validiert. Alles andere
 * (Befund existiert nicht mehr) wird verworfen.
 */
const KANDIDAT_PRAEFIXE = [
  'aspekt-fehlt:', 'risiko-fehlt:', 'risiko-unzugeordnet:', 'zahl-widerspruch:', 'aspekt-leer:',
] as const;

/** Behält Keys, die einem aktuellen `befundKey` entsprechen ODER ein Render-Kandidat sind. */
function behaltePunkte(run: AufbereitungRun, vorher: readonly string[]): string[] {
  const gueltigeBefunde = new Set(run.befunde.map(befundKey));
  return vorher.filter(k => gueltigeBefunde.has(k) || KANDIDAT_PRAEFIXE.some(p => k.startsWith(p)));
}

export function uebernehmeOffenePunkte(run: AufbereitungRun, vorher: readonly string[]): AufbereitungRun {
  if (vorher.length === 0) return run;
  const behalten = behaltePunkte(run, vorher);
  return behalten.length ? { ...run, offenePunkte: behalten } : run;
}

/**
 * Spiegel von `uebernehmeOffenePunkte` für die „erledigt"-Achse des Fragen-Tabs
 * (Paket 4). Gleiches Persist-&-Survive-Muster (befundKey-basiert), eigenes Feld —
 * so kollidiert ein in der Abdeckung als offen markierter Punkt nicht mit „erledigt".
 */
export function uebernehmeErledigtePunkte(run: AufbereitungRun, vorher: readonly string[]): AufbereitungRun {
  if (vorher.length === 0) return run;
  const behalten = behaltePunkte(run, vorher);
  return behalten.length ? { ...run, erledigtePunkte: behalten } : run;
}

/** Nummer/Label der Gliederungs-Sektion, in der `offset` liegt (für „§ x"-Chips). */
function sektionAnOffset(gliederung: VbSektion[], offset: number): string | undefined {
  const s = gliederung.find(x => offset >= x.start && offset < x.end);
  return s?.nummer ?? s?.id;
}

/**
 * Reine, deterministische Assemblierung eines Runs aus den aufgelösten Quellen.
 * Anlage 5 gewinnt für den angezeigten Zeitplan; die VB-Text-Tabelle dient als
 * Vergleichsquelle für die Befunde. Kein IO.
 */
export function baueRun(
  antragKey: string, vb: QuellEingang | null, anlage: QuellEingang | null,
  narrativeDocs: QuellEingang[], now: string,
): AufbereitungRun {
  const quellen: QuelleRef[] = [];
  if (vb) quellen.push({ name: vb.name, hash: hashText(vb.markdown), gelesenAm: now, rolle: 'vb' });
  if (anlage) quellen.push({ name: anlage.name, hash: hashText(anlage.markdown), gelesenAm: now, rolle: 'anlage5' });
  for (const d of narrativeDocs) quellen.push({ name: d.name, hash: hashText(d.markdown), gelesenAm: now, rolle: 'verwertung' });

  // Gliederung + Fundstellen + Lesemodus arbeiten auf dem KORPUS (VB-Präfix +
  // narrative Zusatzdokumente) — dadurch ist die Aufbereitung unabhängig davon, ob
  // ein Inhalt in der VB oder in einem Extra-Dokument steht. Weil die VB der Präfix
  // ist, bleiben alle VB-Sektions-Offsets/-IDs identisch (deterministische Tabellen/
  // Zeitplan/Risiken unten bleiben VB/Anlage-5-spezifisch und gültig).
  const korpus = vb ? baueKorpus(vb, narrativeDocs) : '';
  const gliederung = korpus ? parseVbGliederung(korpus) : [];

  const vbTabellen: RunTabelle[] = vb ? ernteTabellen(vb.markdown).map(t => ({ ...t, rolle: 'vb' as const })) : [];
  const anlageTabellen: RunTabelle[] = anlage
    ? ernteTabellen(anlage.markdown).map(t => ({ ...t, rolle: 'anlage5' as const })) : [];
  const tabellen = [...vbTabellen, ...anlageTabellen];

  // Zeitplan-Zeilen: Anlage 5 gewinnt; VB-Text-Tabelle als Vergleichsquelle.
  const anlageZeilen: ApZeile[] = anlageTabellen
    .filter(t => t.klasse === 'anlage5')
    .flatMap(t => normalisiereAnlage5(t));
  const ersteTextTabelle = vbTabellen.find(t => t.klasse === 'ap-zeitplan-text');
  const textZeilen: ApZeile[] = vbTabellen
    .filter(t => t.klasse === 'ap-zeitplan-text')
    .flatMap(t => normalisiereZeitplanText(t));

  const hatAnlage = anlageZeilen.length > 0;
  const hatText = textZeilen.length > 0;
  // Achsen-Horizont über BEIDE Quellen — auch wenn Anlage 5 gewinnt, bleibt die
  // (längere) Text-Laufzeit als Leerfläche sichtbar (Annotation im Gantt).
  const maxMonat = (zs: ApZeile[]): number => zs.reduce((m, z) => Math.max(m, z.monatEnde ?? z.monatStart ?? 0), 0);
  const achseMax = Math.max(maxMonat(anlageZeilen), maxMonat(textZeilen), 1);
  const zeitplan = hatAnlage
    ? { zeilen: anlageZeilen, herkunft: (hatText ? 'beide' : 'anlage5') as 'beide' | 'anlage5', achseMax }
    : hatText
      ? { zeilen: textZeilen, herkunft: 'vb' as const, achseMax }
      : null;

  // Text↔Anlage-5-Abgleich nur, wenn beide Quellen einen Zeitplan tragen.
  let befunde: Befund[] = [];
  if (hatAnlage && hatText) {
    const vbSektionId = ersteTextTabelle ? sektionAnOffset(gliederung, ersteTextTabelle.start) : undefined;
    befunde = verglichZeitplaene(textZeilen, anlageZeilen).map(b => ({
      ...b,
      quellen: b.quellen.map(q => (q.rolle === 'vb' && vbSektionId ? { ...q, sektionId: vbSektionId } : q)),
    }));
  }
  // Kapazitäts-Befund unabhängig vom Text-Vergleich: MA-Auslastung liegt allein in
  // den Anlage-5-Zeilen (nur die tragen MA-Nr + PM). Bei reinem Text-Zeitplan (keine
  // MA-Nr) liefert `pruefeKapazitaet` ohnehin nichts.
  if (zeitplan) befunde = [...befunde, ...pruefeKapazitaet(zeitplan.zeilen)];

  // Technische Risiken deterministisch ernten (Zuordnung zum Lösungsweg passiert erst
  // im UI, sie braucht das Aspekt-Mapping). Feld nur setzen, wenn etwas geerntet wurde.
  const risiken = ernteRisiken(tabellen, gliederung);

  return {
    version: 1,
    antragKey,
    erzeugtAm: now,
    quellen,
    gliederung,
    tabellen,
    zeitplan,
    befunde,
    offenePunkte: [],
    ...(risiken.length ? { risiken } : {}),
    ...(vb ? {} : { hinweis: 'Keine Vorhabensbeschreibung gefunden — bitte VB zum Antrag aufnehmen, dann neu aufbereiten.' }),
  };
}

/**
 * Löst VB + Anlage 5 auf, baut den Run und persistiert ihn. IO-Fehler
 * propagieren (der Aufrufer fängt sie via `useAsyncAction` → Banner); eine
 * fehlende VB ist KEIN Fehler, sondern führt zu einem definierten leeren Run.
 * Die vom Nutzer markierten offenen Punkte des Vorlaufs werden übernommen
 * (verwaiste Keys verworfen) — „Neu aufbereiten" löscht sie NICHT.
 */
export async function computeAufbereitung(idb: IDBStore, ctx: AufbereitungContext): Promise<AufbereitungRun> {
  const now = new Date().toISOString();
  const vorher = await loadAufbereitung(idb, ctx.key);
  const korpus = await resolveKorpus(idb, ctx);
  const anlageA = await resolveAnlage5(idb, ctx).catch(() => null);

  // `KorpusDok` (name+markdown) ist strukturell `QuellEingang`.
  const vb: QuellEingang | null = korpus?.vb ?? null;
  const narrative: QuellEingang[] = korpus?.narrative ?? [];
  const anlage: QuellEingang | null = anlageA ? { markdown: anlageA.markdown, name: anlageA.quelleName } : null;

  const mitOffen = uebernehmeOffenePunkte(baueRun(ctx.key, vb, anlage, narrative, now), vorher?.offenePunkte ?? []);
  const run = uebernehmeErledigtePunkte(mitOffen, vorher?.erledigtePunkte ?? []);
  await idb.set(aufbereitungKey(ctx.key), run);
  return run;
}

/** Gespeicherten Run lesen (oder null). */
export async function loadAufbereitung(idb: IDBStore, antragKey: string): Promise<AufbereitungRun | null> {
  return idb.get<AufbereitungRun>(aufbereitungKey(antragKey));
}

/**
 * Sind die gestempelten Quell-Hashes gegenüber dem aktuellen Stand veraltet?
 * Nur UI-Hinweis — KEINE Auto-Neuberechnung.
 */
export function istVeraltet(
  run: AufbereitungRun,
  aktuell: { vbHash?: string; anlage5Hash?: string; verwertungHashes?: string[] },
): boolean {
  const gestempelt = (rolle: 'vb' | 'anlage5'): string | undefined => run.quellen.find(q => q.rolle === rolle)?.hash;
  if (gestempelt('vb') !== aktuell.vbHash || gestempelt('anlage5') !== aktuell.anlage5Hash) return true;
  // Narrative Zusatzdokumente: veraltet, sobald sich die Menge der Hashes ändert
  // (neu/geändert/entfernt). Reihenfolge-unabhängig verglichen.
  const gestempelteVw = run.quellen.filter(q => q.rolle === 'verwertung').map(q => q.hash).sort();
  const aktuelleVw = (aktuell.verwertungHashes ?? []).slice().sort();
  return gestempelteVw.length !== aktuelleVw.length || gestempelteVw.some((h, i) => h !== aktuelleVw[i]);
}

/** Einen Befund als offenen Punkt an-/abwählen (persistierbarer neuer Run). */
export function toggleOffenerPunkt(run: AufbereitungRun, key: string): AufbereitungRun {
  const drin = run.offenePunkte.includes(key);
  return {
    ...run,
    offenePunkte: drin ? run.offenePunkte.filter(k => k !== key) : [...run.offenePunkte, key],
  };
}

/** Eine Prüffrage im Fragen-Tab als erledigt an-/abhaken (persistierbarer neuer Run). */
export function toggleErledigterPunkt(run: AufbereitungRun, key: string): AufbereitungRun {
  const aktuell = run.erledigtePunkte ?? [];
  const drin = aktuell.includes(key);
  return {
    ...run,
    erledigtePunkte: drin ? aktuell.filter(k => k !== key) : [...aktuell, key],
  };
}
