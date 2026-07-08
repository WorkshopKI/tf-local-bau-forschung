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
  ernteTabellen, normalisiereAnlage5, normalisiereZeitplanText, verglichZeitplaene,
  type ApZeile, type Befund,
} from './tabellen';
import { resolveVb, resolveAnlage5 } from './quellen';
import type { AufbereitungRun, QuelleRef, RunTabelle } from './types';

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
  antragKey: string, vb: QuellEingang | null, anlage: QuellEingang | null, now: string,
): AufbereitungRun {
  const quellen: QuelleRef[] = [];
  if (vb) quellen.push({ name: vb.name, hash: hashText(vb.markdown), gelesenAm: now, rolle: 'vb' });
  if (anlage) quellen.push({ name: anlage.name, hash: hashText(anlage.markdown), gelesenAm: now, rolle: 'anlage5' });

  const gliederung = vb ? parseVbGliederung(vb.markdown) : [];

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

  // Befunde nur, wenn beide Quellen einen Zeitplan tragen (sonst wäre eine Seite leer).
  let befunde: Befund[] = [];
  if (hatAnlage && hatText) {
    const vbSektionId = ersteTextTabelle ? sektionAnOffset(gliederung, ersteTextTabelle.start) : undefined;
    befunde = verglichZeitplaene(textZeilen, anlageZeilen).map(b => ({
      ...b,
      quellen: b.quellen.map(q => (q.rolle === 'vb' && vbSektionId ? { ...q, sektionId: vbSektionId } : q)),
    }));
  }

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
    ...(vb ? {} : { hinweis: 'Keine Vorhabensbeschreibung gefunden — bitte VB zum Antrag aufnehmen, dann neu aufbereiten.' }),
  };
}

/**
 * Löst VB + Anlage 5 auf, baut den Run und persistiert ihn. IO-Fehler
 * propagieren (der Aufrufer fängt sie via `useAsyncAction` → Banner); eine
 * fehlende VB ist KEIN Fehler, sondern führt zu einem definierten leeren Run.
 */
export async function computeAufbereitung(idb: IDBStore, ctx: AufbereitungContext): Promise<AufbereitungRun> {
  const now = new Date().toISOString();
  const vbA = await resolveVb(idb, ctx);
  const anlageA = await resolveAnlage5(idb, ctx).catch(() => null);

  const vb: QuellEingang | null = vbA
    ? { markdown: vbA.markdown, name: vbA.quelleName ?? vbA.dokument?.filename ?? 'Vorhabensbeschreibung' }
    : null;
  const anlage: QuellEingang | null = anlageA ? { markdown: anlageA.markdown, name: anlageA.quelleName } : null;

  const run = baueRun(ctx.key, vb, anlage, now);
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
export function istVeraltet(run: AufbereitungRun, aktuell: { vbHash?: string; anlage5Hash?: string }): boolean {
  const gestempelt = (rolle: 'vb' | 'anlage5'): string | undefined => run.quellen.find(q => q.rolle === rolle)?.hash;
  return gestempelt('vb') !== aktuell.vbHash || gestempelt('anlage5') !== aktuell.anlage5Hash;
}

/** Einen Befund als offenen Punkt an-/abwählen (persistierbarer neuer Run). */
export function toggleOffenerPunkt(run: AufbereitungRun, key: string): AufbereitungRun {
  const drin = run.offenePunkte.includes(key);
  return {
    ...run,
    offenePunkte: drin ? run.offenePunkte.filter(k => k !== key) : [...run.offenePunkte, key],
  };
}
