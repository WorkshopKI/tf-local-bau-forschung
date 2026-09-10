/**
 * Die **Vorgangsakte** bauen — rein, aus Daten, die die App ohnehin rechnet.
 *
 * Kein neuer Rechenweg: jede Aussage kommt aus der Funktion, die auch die Karte
 * daneben speist — die To-do-Kaskade (`ermittleTodosAlleRollen` → `baueAufgabe`
 * je Rolle), der Stillstands-Wächter, die Chronik, die Frist-Engine, die
 * Meilenstein-Bewertung, die Karten der Artefakt-Leiste. Zwei Stellen, die
 * denselben Vorgang verschieden beschreiben, lesen sich wie zwei Sachverhalte;
 * genau das passierte, als der Faktenblock noch die alte Status-Formel sprach
 * (assistent-panel.md).
 *
 * **Ein Antrag schneidet auf sein Teilvorhaben**, ein Verbund zeigt alle —
 * dieselbe Auswahl wie `useZeilenTodo` für Verbund- und TV-Zeilen.
 *
 * **Keine Bearbeiter-Kürzel.** Die Zuweisung wird gezählt (`besetzteRollen`),
 * der Wert verlässt `bearbeiterFilter.ts` nie (Guard `assistent-ohne-personen`).
 *
 * Rein: kein React, kein IDB — `stichtag` kommt vom Aufrufer.
 */
import { ROLLEN, ROLLE_LABEL, rollenLabel } from '@/core/status/rollen';
import { adressText, adresseFuerWaechter, baueAufgabe, type TvTodo } from '@/core/status/aufgabe';
import { baueChronik, traegerLabel } from '@/core/status/chronik';
import { baueZurueckgenommene } from '@/core/status/chronik-zurueckgenommen';
import { baueTodoKontext, ermittleTodosAlleRollen } from '@/core/status/todo-engine';
import { findeStatusCode } from '@/core/status/status-codes';
import { offenePaareJeTeilvorhaben, pruefeStillstand, tageZwischen, type OffenesPaarJeTv } from '@/core/status/waechter';
import { verlaufKennzahlen } from '@/core/status/verlauf-kennzahlen';
import { zahPhaseFuerStatusText } from '@/core/status/kategorie-ableitung';
import { zahPhaseLabel } from '@/core/status/zah-phasen';
import type { FeldVorkommen } from '@/core/status/feld-aufloesung';
import type { AntragsChronikMitId } from '@/core/status/journal/lesen';
import type { VerlaufsSpur } from '@/core/status/verlauf/typen';
import type { MappingVersion } from '@/core/status/typen';
import type { MeilensteinPlan, Prognose, VerbundMeilensteine } from '@/core/meilensteine/typen';
import { isTerminalStatus } from '@/core/utils/status-canonical';
import { statusLabel } from '@/core/utils/status-wert-labels';
import { parseGermanDate } from '@/core/services/csv/dateParse';
import type { FristBasisFeld, FristErgebnis } from '@/core/services/csv/frist-ergebnis';
import type { AntragListItem } from '@/core/services/csv/types';
import type {
  AkteArtefakte, AkteAufgabe, AkteFrist, AkteJournal, AkteMeilensteine, AkteOffenesPaar,
  AkteTeilvorhaben, AkteVerlauf, VorgangsAkte,
} from '@/core/services/assistent/kontext';
import { fristErgebnisVon } from '@/plugins/antraege/fristAnzeige';
import { criticalFristErgebnis } from '@/plugins/antraege/groupAggregates';
import { besetzteRollen } from '@/plugins/antraege/bearbeiterFilter';
import { findAbgelehnteVorgaenger } from '@/plugins/antraege/vorgaengerAntraege';
import { nullpunktText } from '@/plugins/antraege/status/journalTexte';
import type { GutachtenKarte, NachforderungKarte } from '@/plugins/antraege/artefakte/artefaktKarten';
import type { StepStatus, WorkflowRun } from '@/plugins/antraege/gutachten/types';
import { relevanteSpuren, zaehleAbschnitte } from './zusatzBloecke';

/** Was `useStatusVerlauf` für einen Verbund liefert — nur die gelesenen Felder. */
export interface AkteVerlaufQuelle {
  version: MappingVersion | null;
  /** Alle Einträge des Verbunds in einem Topf — Grundlage der Chronik. */
  vorkommen: readonly FeldVorkommen[];
  /** Dieselben Einträge je Teilvorhaben — Grundlage von Kaskade und Wächter. */
  jeTeilvorhaben: readonly { aktenzeichen: string; vorkommen: readonly FeldVorkommen[] }[];
}

/** Die Karten der Artefakt-Leiste plus der Gutachten-Lauf (für die Prüfer-Hinweise). */
export interface AkteArtefaktQuelle {
  gutachten: GutachtenKarte | null;
  nachforderung: NachforderungKarte | null;
  gaRun: WorkflowRun | null;
}

export interface AkteEingabe {
  entitaet: { art: 'antrag' | 'verbund'; id: string };
  /**
   * Die Teilvorhaben aus der Listen-Projektion: beim Verbund alle, beim Antrag
   * mindestens er selbst.
   */
  antraege: readonly AntragListItem[];
  /** `STATUS_VB` — nur beim Verbund. */
  verbundStatus?: string | null;
  verlauf: AkteVerlaufQuelle | null;
  meilensteine: { plan: MeilensteinPlan; bewertung: VerbundMeilensteine } | null;
  /** Ist das Vorgangssystem gebaut? Ohne es gibt es keine Kaskade und keinen Wächter. */
  vorgangssystem: boolean;
  /** ISO — der Tag, gegen den alle Liegezeiten und Fristen gerechnet werden. */
  stichtag: string;
  /** Die Verlaufsspuren (`baueVerlaufFuerVorgang`) — Signal „Statusabschnitte ableitbar". */
  spuren?: readonly VerlaufsSpur[] | null;
  /**
   * Die Journal-Chroniken — nur, wenn eine Anzeige der Seite sie schon geladen
   * hat. `undefined` = nicht geladen (dann schweigt die Akte zum Journal).
   */
  journal?: readonly AntragsChronikMitId[] | null;
  artefakte?: AkteArtefaktQuelle | null;
  /** Der ganze Bestand der Projektion — für abgelehnte Vorgänger desselben Projekts. */
  alleAntraege?: readonly AntragListItem[];
  /** Kurzname des Verbunds (`VB_KURZNAM`). */
  akronym?: string | null;
}

/** Wie viele Prüfer-Hinweise die Akte höchstens nennt. */
export const AKTE_MAX_PRUEF_HINWEISE = 8;

/** ISO-Tag (`YYYY-MM-DD…`) → deutsches Datum; alles andere → `undefined`. */
function deDatum(iso: string | null | undefined): string | undefined {
  if (!iso) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : undefined;
}

/** Ein Datum, wie es im Export steht (deutsch oder ISO), als deutsches Datum. */
function exportDatum(roh: unknown): string | undefined {
  if (typeof roh !== 'string' || !roh.trim()) return undefined;
  return deDatum(parseGermanDate(roh) ?? roh);
}

function text(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

// ── Aufgaben ────────────────────────────────────────────────────────────────

/**
 * Die Aufgabe jedes Regelsatzes, der für sich etwas zu sagen hat.
 *
 * Schweigt der eigene Satz, liest `baueAufgabe` den AB-Satz als „fremd" — der
 * steht hier dann schon unter AB und wird nicht ein zweites Mal geführt.
 */
function aufgabenVon(jeTv: readonly TvTodo[]): AkteAufgabe[] {
  const out: AkteAufgabe[] = [];
  for (const rolle of ROLLEN) {
    const a = baueAufgabe({ jeTv, rolle, ohneRegeln: false });
    if (a.text === null || a.gelesenAls !== rolle) continue;
    const anteil = a.tvGesamt > 1 && a.tv.length < a.tvGesamt ? `${a.tv.length} von ${a.tvGesamt} TV` : null;
    const adresse = a.ergebnis ? adressText(a.ergebnis) : null;
    out.push({
      rolle: ROLLE_LABEL[rolle],
      text: a.text,
      ...(adresse ? { adresse } : {}),
      ...(anteil ? { anteil } : {}),
      abgeleitet: a.ergebnis?.quelle === 'abgeleitet',
    });
    for (const g of a.weitere) {
      out.push({
        rolle: ROLLE_LABEL[rolle], text: g.text,
        anteil: `${g.aktenzeichen.length} von ${a.tvGesamt} TV`, abgeleitet: false,
      });
    }
  }
  return out;
}

function paarVon(p: OffenesPaarJeTv): AkteOffenesPaar {
  return {
    tv: p.tvId, gesetzt: p.gesetzt, fehlt: p.fehlt, fehltLabel: p.fehltLabel,
    seit: deDatum(p.seit) ?? p.seit, tage: p.tage,
    ...(p.rolle ? { rolle: ROLLE_LABEL[p.rolle] } : {}),
  };
}

// ── Frist ───────────────────────────────────────────────────────────────────

const BASIS_TEXT: Record<FristBasisFeld, string> = {
  D_AAE: 'dem Antragseingang (D_AAE)',
  D_XTE: '„alle Anträge da" (D_XTE)',
};

function fristVon(f: FristErgebnis): AkteFrist {
  const basis = f.basisFeld
    ? `${BASIS_TEXT[f.basisFeld]}${f.basisDatum ? ` vom ${deDatum(f.basisDatum) ?? f.basisDatum}` : ''}`
    : undefined;
  const mitBasis = basis ? { basis } : {};
  if (f.zustand === 'laeuft') {
    const n = f.tageRest ?? null;
    const ziel = deDatum(f.zielDatum);
    const t = n === null
      ? 'läuft'
      : n >= 0
        ? `läuft, noch ${n} ${n === 1 ? 'Tag' : 'Tage'}${ziel ? ` (bis ${ziel})` : ''}`
        : `läuft, seit ${-n} ${n === -1 ? 'Tag' : 'Tagen'} überschritten${ziel ? ` (Ziel war ${ziel})` : ''}`;
    return { zustand: 'laeuft', text: t, ...mitBasis };
  }
  if (f.zustand === 'angehalten') {
    const seit = deDatum(f.bezugsZeitpunkt);
    return {
      zustand: 'angehalten',
      text: `angehalten — im aktuellen Verfahrensschritt steht die Uhr${seit ? `, seit ${seit}` : ''}`,
      ...mitBasis,
    };
  }
  return { zustand: 'nicht_berechenbar', text: `nicht berechenbar${f.grund ? ` — ${f.grund}` : ''}` };
}

// ── Meilensteine ────────────────────────────────────────────────────────────

const PROGNOSE_TEXT: Record<Prognose, string> = {
  imPlan: 'im Plan', gefaehrdet: 'gefährdet', nichtHaltbar: 'nicht haltbar',
  abgeschlossen: 'abgeschlossen', unbekannt: 'unbekannt',
};

function meilensteineVon(
  plan: MeilensteinPlan, b: VerbundMeilensteine, stichtag: string,
): AkteMeilensteine {
  // Ein abgeschlossener Plan misst nichts mehr. Die Bewertung rechnet Resttage
  // und gerissene Knoten trotzdem weiter — im Prompt stünde dann bei CALYPSO
  // (gemessen 10.09.2026) „Gesamtfrist seit 303 Tagen überschritten" neben
  // „abgeschlossen", und das Modell meldete einen erledigten Vorgang als überfällig.
  if (b.prognose === 'abgeschlossen') {
    return { prognose: PROGNOSE_TEXT.abgeschlossen, restTage: null, gerissen: [], faellig: [] };
  }
  const knoten = new Map(plan.knoten.map(k => [k.id, k]));
  const name = (id: string): string => {
    const k = knoten.get(id);
    return k ? `${k.nummer} ${k.label}` : id;
  };
  const soll = (s: string | null): string => (s ? ` — Soll ${deDatum(s) ?? s}` : '');
  const gerissen = b.ergebnisse
    .filter(r => r.zustand === 'gerissen')
    .map(r => {
      const ueber = r.sollDatum ? tageZwischen(r.sollDatum, stichtag) : null;
      return `${name(r.knotenId)}${soll(r.sollDatum)}${ueber !== null && ueber > 0 ? `, ${ueber} Tage über` : ''}`;
    });
  const faellig = b.ergebnisse
    .filter(r => r.zustand === 'faellig')
    .map(r => `${name(r.knotenId)}${soll(r.sollDatum)}`);
  const frist = deDatum(b.fristDatum);
  return {
    prognose: PROGNOSE_TEXT[b.prognose], restTage: b.restTage,
    ...(frist ? { fristDatum: frist } : {}),
    gerissen, faellig,
  };
}

// ── Verlauf, Journal, Teilvorhaben ──────────────────────────────────────────

function verlaufVon(
  vorkommen: readonly FeldVorkommen[], offenePaare: readonly OffenesPaarJeTv[], tvAnzahl: number,
): AkteVerlauf | undefined {
  const chronik = baueChronik(vorkommen);
  if (chronik.length === 0) return undefined;
  const k = verlaufKennzahlen(chronik, offenePaare, tvAnzahl);
  return {
    von: deDatum(k.von) ?? null,
    bis: deDatum(k.bis) ?? null,
    schritte: k.schritte,
    datumsangaben: k.datumsangaben,
    nichtGesetzt: k.nichtGesetzt,
    termine: chronik.map(c => ({
      tag: deDatum(c.tag) ?? c.tag,
      ...(c.feld.code ? { kuerzel: c.feld.code } : {}),
      label: c.feld.label,
      rollen: rollenLabel(c.feld),
      traeger: traegerLabel(c.tvIds),
    })),
  };
}

/**
 * Was das Journal über die Entität sagt. `null`-Chroniken heißt „auf diesem
 * Share wird keins geführt" — eine andere Aussage als „nichts geändert".
 */
function journalVon(
  chroniken: readonly AntragsChronikMitId[] | null, azs: ReadonlySet<string>,
  version: MappingVersion | null, aktuell: readonly FeldVorkommen[],
): AkteJournal {
  if (chroniken === null) return { hinweis: nullpunktText(null, false), aenderungen: 0, zurueckgenommen: 0 };
  const eigene = chroniken.filter(c => azs.has(c.antragId));
  const aenderungen = eigene.reduce((s, c) => s + c.felder.reduce((t, f) => t + f.eintraege.length, 0), 0);
  const zurueckgenommen = version
    ? baueZurueckgenommene(eigene, version.felder, baueChronik(aktuell)).length
    : 0;
  return {
    hinweis: nullpunktText(chroniken[0]?.journalAb ?? null, eigene.some(c => c.gefuehrt)),
    aenderungen,
    zurueckgenommen,
  };
}

function teilvorhabenVon(
  tvs: readonly AntragListItem[],
  jeTv: readonly { aktenzeichen: string; vorkommen: readonly FeldVorkommen[] }[],
): AkteTeilvorhaben[] {
  return tvs.map(t => {
    const vk = jeTv.find(x => x.aktenzeichen === t.aktenzeichen)?.vorkommen ?? [];
    // Der Eingang aus dem Katalogfeld, sonst aus der Projektion — dieselbe Spalte.
    const eingang = exportDatum(vk.find(v => v.feld.code === 'AAE')?.wert) ?? exportDatum(t.antragsdatum);
    const status = text(t.status);
    return {
      aktenzeichen: t.aktenzeichen,
      titel: text(t.titel) ?? text(t.akronym) ?? t.aktenzeichen,
      ...(status ? { status: statusLabel(status) } : {}),
      ...(eingang ? { eingang } : {}),
    };
  });
}

function zuweisungVon(tvs: readonly AntragListItem[]): VorgangsAkte['zuweisung'] {
  let ab = 0;
  let fb = 0;
  for (const t of tvs) {
    const besetzt = besetzteRollen(t);
    if (besetzt.includes('ab')) ab += 1;
    if (besetzt.includes('fb')) fb += 1;
  }
  return { ab, fb, von: tvs.length };
}

// ── Artefakte und Vorgänger ─────────────────────────────────────────────────

const SCHRITT_STATUS_TEXT: Record<StepStatus, string> = {
  leer: 'noch nicht erzeugt', entwurf: 'im Entwurf', freigegeben: 'freigegeben',
};

/** Dieselben Karten wie die Artefakt-Leiste, in Worten. */
function artefakteVon(q: AkteArtefaktQuelle): AkteArtefakte | undefined {
  const out: AkteArtefakte = { pruefHinweise: [] };
  const g = q.gutachten;
  if (g?.kind === 'leer') {
    out.gutachten = 'Gutachten: noch nicht begonnen (der Vorgang ist in der Fachprüfung).';
  } else if (g?.kind === 'fortschritt') {
    out.gutachten = `Gutachten: ${g.freigegeben} von ${g.gesamt} Abschnitten freigegeben; offen ist Abschnitt `
      + `${g.aktiverSchritt}${g.aktiverLabel ? ` (${g.aktiverLabel})` : ''}, ${SCHRITT_STATUS_TEXT[g.aktiverStatus]}.`;
  }
  const n = q.nachforderung;
  if (n) {
    out.nachforderung = `Nachforderungen: ${n.versendet} von ${n.tvGesamt} Teilvorhaben versandreif`
      + `${n.naechstesTv ? `; als Nächstes TV ${n.naechstesTv.index} (${n.naechstesTv.aktenzeichen})` : ''}`
      // Die kurze Frist endet selbst auf einen Punkt („12.09.").
      + `${n.fristKurz ? `; Frist ${n.fristKurz}` : '.'}`;
  }
  for (const [id, schritt] of Object.entries(q.gaRun?.schritte ?? {})) {
    for (const h of schritt?.qsHinweise ?? []) {
      if (h.bewertung === 'ok') continue;
      out.pruefHinweise.push(`Abschnitt ${id} · ${h.dimension}${h.bewertung === 'unklar' ? ' (unklar)' : ''}: ${h.text}`);
    }
  }
  out.pruefHinweise = out.pruefHinweise.slice(0, AKTE_MAX_PRUEF_HINWEISE);
  return out.gutachten || out.nachforderung || out.pruefHinweise.length > 0 ? out : undefined;
}

function vorgaengerVon(e: AkteEingabe): string[] {
  if (!e.alleAntraege || !e.akronym) return [];
  return findAbgelehnteVorgaenger({
    currentVerbundId: e.antraege[0]?.verbund_id ?? e.entitaet.id,
    currentAkronym: e.akronym,
    currentAktenzeichen: new Set(e.antraege.map(a => a.aktenzeichen)),
    antraege: e.alleAntraege,
  }).map(v => {
    const entscheid = v.erstentscheidung ? `, Erstentscheidung ${exportDatum(v.erstentscheidung) ?? v.erstentscheidung}` : '';
    return `${v.akronymRaw} (${v.verbundId}) — ${v.tvCount} Teilvorhaben, davon ${v.abgelehntCount} abgelehnt oder zurückgezogen${entscheid}`;
  });
}

// ── Die Akte ────────────────────────────────────────────────────────────────

export function baueVorgangsakte(e: AkteEingabe): VorgangsAkte {
  const istVerbund = e.entitaet.art === 'verbund';
  const tvs = istVerbund
    ? [...e.antraege]
    : e.antraege.filter(a => a.aktenzeichen === e.entitaet.id);
  const azs = new Set(tvs.map(t => t.aktenzeichen));
  const status = istVerbund ? (text(e.verbundStatus) ?? text(tvs[0]?.status)) : text(tvs[0]?.status);
  const terminal = isTerminalStatus(status);
  const version = e.verlauf?.version ?? null;
  const jeTvVorkommen = (e.verlauf?.jeTeilvorhaben ?? []).filter(t => azs.has(t.aktenzeichen));
  const aktuell = istVerbund ? (e.verlauf?.vorkommen ?? []) : jeTvVorkommen.flatMap(t => t.vorkommen);

  const akte: VorgangsAkte = {
    fuer: e.entitaet.id,
    aufgaben: [],
    offenePaare: [],
    teilvorhaben: teilvorhabenVon(tvs, jeTvVorkommen),
  };

  const zah = zahPhaseFuerStatusText(status);
  if (zah) akte.verfahrensschritt = zahPhaseLabel(zah);

  // Kaskade, Paare und Wächter gehören dem Vorgangssystem — ohne Flag gibt es
  // sie in dieser Variante nicht, und eine Aussage aus einer unsichtbaren
  // Rechnung könnte niemand an der Oberfläche nachprüfen.
  let offenePaare: OffenesPaarJeTv[] = [];
  if (e.vorgangssystem && version !== null) {
    const regeln = version.todoRegeln ?? [];
    const jeTv: TvTodo[] = regeln.length === 0 ? [] : jeTvVorkommen.map(tv => ({
      aktenzeichen: tv.aktenzeichen,
      todos: ermittleTodosAlleRollen(regeln, baueTodoKontext(tv.vorkommen), e.stichtag),
    }));
    akte.aufgaben = aufgabenVon(jeTv);
    offenePaare = offenePaareJeTeilvorhaben(version, jeTvVorkommen, e.stichtag);
    akte.offenePaare = offenePaare.map(paarVon);
    if (!terminal && jeTvVorkommen.length > 0) {
      const w = pruefeStillstand({
        version,
        vorkommen: jeTvVorkommen.flatMap(t => t.vorkommen),
        jeTeilvorhaben: jeTvVorkommen,
        statusCode: findeStatusCode(status)?.eintrag.code ?? null,
        todo: adresseFuerWaechter(jeTv).todo,
        // Kein Journal hier: der Wächter rechnet dann die ehrliche Näherung und
        // sagt „mindestens" (Guard `kein-nullpunkt-als-letzte-aenderung`).
        journalAenderung: null,
        stichtag: e.stichtag,
      });
      akte.stillstand = {
        urteil: w.urteil,
        text: w.grund,
        ...(w.rolle ? { liegtBei: w.rolle === 'ast' ? 'Antragsteller' : ROLLE_LABEL[w.rolle] } : {}),
      };
    }
  }

  if (!terminal && tvs.length > 0) {
    const nowMs = Date.parse(e.stichtag);
    akte.frist = fristVon(istVerbund ? criticalFristErgebnis([...tvs], nowMs) : fristErgebnisVon(tvs[0]!, nowMs));
  }

  if (e.meilensteine) {
    akte.meilensteine = meilensteineVon(e.meilensteine.plan, e.meilensteine.bewertung, e.stichtag);
  }

  if (e.verlauf) {
    const verlauf = verlaufVon(aktuell, offenePaare, tvs.length);
    const abschnitte = e.spuren ? zaehleAbschnitte(relevanteSpuren(e.spuren, istVerbund, azs)) : 0;
    if (verlauf) akte.verlauf = abschnitte > 0 ? { ...verlauf, statusAbschnitte: abschnitte } : verlauf;
    if (istVerbund) {
      const xte = exportDatum(e.verlauf.vorkommen.find(v => v.feld.code === 'XTE')?.wert);
      if (xte) akte.vollstaendigAm = xte;
    }
  }

  if (e.journal !== undefined) akte.journal = journalVon(e.journal, azs, version, aktuell);
  if (tvs.length > 0) akte.zuweisung = zuweisungVon(tvs);
  const artefakte = e.artefakte ? artefakteVon(e.artefakte) : undefined;
  if (artefakte) akte.artefakte = artefakte;
  const vorgaenger = vorgaengerVon(e);
  if (vorgaenger.length > 0) akte.vorgaenger = vorgaenger;

  return akte;
}
