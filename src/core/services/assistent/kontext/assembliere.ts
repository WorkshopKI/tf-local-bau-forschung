/**
 * Deterministischer Kontext-Assembler des Assistenten-Panels (Phase 1).
 *
 * Baut aus Route, selektierter Entität, Nutzerfrage, bisherigen Turns und
 * (optional) bereits ausgeführten Orama-Treffern EINEN vollständigen Prompt in
 * FESTER Blockreihenfolge (analog zur fixen Skill-Komposition). Rein & testbar:
 * keine `Date.now()`, kein Netzwerk, keine Plugin-Importe. Die Ableitungen
 * (Status-Label, nächster Schritt) stammen aus bestehenden reinen Core-Funktionen
 * — der Assembler erfindet keine neuen.
 */
import { getStatusCategory } from '@/core/utils/status-canonical';
import { getStatusLabel } from '@/core/utils/status-mappings';
import { naechsterSchritt } from '@/core/utils/naechsterSchritt';
import { GRUNDSATZ_REGELN } from '@/core/services/skills/registry/grundsatz';
import type { OramaSearchResult } from '@/core/services/search/orama-store';
import type { ArbeitsvorratUebersicht, AssistentKontextEingabe, AssistentPrompt, AssistentTurn, KontextEntitaet, VorhabenDokument } from './types';

// ── Deterministische Budget-Konstanten (mit Begründung, keine Magie) ─────────
/** Top-k Retrieval-Chunks im Prompt (bevorzugt die stärksten Treffer). */
export const RETRIEVAL_K = 5;
/** Treffer unter dieser Score-Schwelle werden verworfen → lieber KEIN Block als
 *  ein schwacher (analog „unzugeordnet statt falsch zugeordnet"). Orama-Hybrid-
 *  Scores sind auf 0..1 normalisiert; Wert konservativ, ggf. an Echtdaten kalibrieren. */
export const RETRIEVAL_MIN_SCORE = 0.2;
/** Zeichen-Cap je Chunk-Auszug (Prompt-Explosion vermeiden). */
export const RETRIEVAL_CHUNK_MAX_CHARS = 600;
/** Zeichen-Cap je Vorhaben-Dokument-Auszug im „Dokumente zum Vorhaben"-Block. */
export const VORHABEN_DOK_AUSZUG_MAX_CHARS = 500;
/** Zeichen-Cap je Historien-Turn. */
export const HISTORIE_TURN_MAX_CHARS = 1200;
/** Gesamt-Zeichen-Budget der Historie (ältester Turn zuerst gekürzt). */
export const HISTORIE_MAX_CHARS = 6000;
/** Hartes Gesamt-Budget. Bei Überschreitung wird in fester Reihenfolge gekürzt:
 *  erst Historie (älteste zuerst), dann Retrieval-k — der Faktenblock NIE. */
export const GESAMT_MAX_CHARS = 24_000;

function collapse(s: string): string {
  return s.replace(/\s+/g, ' ').trim();
}

function trimTo(s: string, max: number): string {
  const c = collapse(s);
  return c.length <= max ? c : `${c.slice(0, max - 1)}…`;
}

// ── Block 1: Systemblock (inkl. geteiltem Grundsatz-Block) ───────────────────
const SYSTEM_BLOCK = [
  'Du bist der Assistent in TeamFlow Local — einer lokalen App für ZIM-Förderanträge.',
  'Du unterstützt Gutachter und Projektleitung bei ihrer aktuellen Arbeit.',
  '',
  'Grenzen:',
  '- Nutze AUSSCHLIESSLICH die unten bereitgestellten Fakten und Auszüge. Kennst du etwas nicht, sage das offen — rate nicht.',
  '- Triff keine Rechts- oder Förderentscheidungen; du unterstützt die Arbeit, entscheidest sie nicht.',
  '- Du kennst nur die aktuelle Ansicht und die bereitgestellten Dokumente, keine früheren Sitzungen.',
  '- Antworte auf Deutsch, kurz und konkret.',
  '',
  'Für Aussagen über den Antrag / die Vorhabensbeschreibung (VB) gelten zusätzlich:',
  GRUNDSATZ_REGELN,
].join('\n');

/** Menschliches Ampel-/Frist-Wording liegt beim Controller (Plugin-Helfer). */

// ── Block 1b: Gedächtnis (optional, Assistent Phase 2, ZUERST reduzierbar) ───
/**
 * Hintergrundwissen aus den konsolidierten Memory-Blocks. Klar als „kann veraltet
 * sein" markiert und deutlich vom deterministischen Faktenblock getrennt. Leer =
 * kein Block (self-omittet über `.filter`).
 */
function gedaechtnisBlock(eintraege: ReadonlyArray<{ text: string }>): string {
  if (eintraege.length === 0) return '';
  const zeilen = ['=== Hintergrundwissen über die Arbeit des Nutzers (kann veraltet sein) ==='];
  for (const e of eintraege) zeilen.push(`- ${collapse(e.text)}`);
  zeilen.push('=== Ende Hintergrundwissen ===');
  return zeilen.join('\n');
}

// ── Block 2: Faktenblock (deterministisch, wird NIE gekürzt) ─────────────────
function entitaetZeilen(e: KontextEntitaet): string[] {
  const zeilen: string[] = [];
  const artLabel = e.art === 'verbund' ? 'Verbund' : 'Antrag';
  zeilen.push(`${artLabel}: ${e.titel} (${e.id})`);

  const status = typeof e.status === 'string' ? e.status.trim() : '';
  if (status.length > 0) {
    zeilen.push(`Status: ${getStatusLabel(status)} (${getStatusCategory(status)})`);
  }
  if (e.phaseLabel) zeilen.push(`Phase: ${e.phaseLabel}`);

  const schritt = naechsterSchritt(e.status, e.precheckLabel);
  if (schritt) {
    zeilen.push(`Nächster Schritt: ${schritt.aktion ? `${schritt.phase} — ${schritt.aktion}` : schritt.phase}`);
  }
  if (e.fristHinweis) zeilen.push(`Frist: ${e.fristHinweis}`);

  if (e.stammdaten && e.stammdaten.length > 0) {
    zeilen.push('Stammdaten:');
    for (const z of e.stammdaten) zeilen.push(`- ${z.label}: ${collapse(z.wert)}`);
  }
  return zeilen;
}

function faktenBlock(eingabe: AssistentKontextEingabe): string {
  const zeilen = ['=== Kontext (deterministisch aus der App) ===', `Ansicht: ${eingabe.routeBeschreibung}`];
  if (eingabe.entitaet) {
    zeilen.push(...entitaetZeilen(eingabe.entitaet));
  } else {
    zeilen.push('Keine Entität ausgewählt — es liegen nur die Ansicht und ggf. Suchtreffer vor.');
  }
  zeilen.push('=== Ende Kontext ===');
  return zeilen.join('\n');
}

// ── Block 2a: Arbeitsvorrat-Übersicht (Kein-Entität-Fall, deterministisch) ────
/**
 * Kompakte Übersicht des Arbeitsvorrats für Liste/Startseite ohne selektierte
 * Entität — trägt „Fristen"/„Was ist heute dran?". Self-omittet bei fehlender
 * Übersicht oder leerem Arbeitsvorrat. Deterministisch (gecappt) → wird im
 * Budget NIE gekürzt, analog zum Faktenblock.
 */
function arbeitsvorratBlock(u: ArbeitsvorratUebersicht | null | undefined): string {
  if (!u || u.gesamtInArbeit === 0) return '';
  const zeilen = ['=== Arbeitsvorrat (Übersicht, deterministisch) ==='];
  const detail: string[] = [];
  if (u.ueberfaellig > 0) detail.push(`${u.ueberfaellig} überfällig`);
  if (u.dringend > 0) detail.push(`${u.dringend} dringend`);
  const suffix = detail.length > 0 ? ` (${detail.join(', ')})` : '';
  zeilen.push(`In Arbeit: ${u.gesamtInArbeit} ${u.gesamtInArbeit === 1 ? 'Antrag' : 'Anträge'}${suffix}.`);
  if (u.naechsteFristen.length > 0) {
    zeilen.push('Nächste Fristen:');
    for (const f of u.naechsteFristen) {
      zeilen.push(`- ${f.titel}: ${f.hinweis}${f.aktion ? ` — nächster Schritt: ${f.aktion}` : ''}`);
    }
  }
  zeilen.push('=== Ende Arbeitsvorrat ===');
  return zeilen.join('\n');
}

// ── Block 2b: Dokumente zum Vorhaben (entitäts-scoped, deterministisch) ───────
/**
 * Liste der dem Vorhaben zugeordneten Dokumente (VB/Anlage 5/Marketing/…), jeweils
 * Typ-Label + Name + gekappter Auszug. Entitäts-scoped (Tag-Relation) — anders als
 * das globale Volltext-Retrieval. Leer = kein Block (self-omittet über `.filter`).
 */
function vorhabenDokumenteBlock(docs: ReadonlyArray<VorhabenDokument>): string {
  if (docs.length === 0) return '';
  const zeilen = ['=== Dokumente zum Vorhaben (dem Vorhaben zugeordnet) ==='];
  docs.forEach((d, i) => {
    const auszug = d.auszug ? ` — ${trimTo(d.auszug, VORHABEN_DOK_AUSZUG_MAX_CHARS)}` : '';
    zeilen.push(`[D${i + 1}] ${d.typLabel}: ${d.name}${auszug}`);
  });
  zeilen.push('=== Ende Dokumente ===');
  return zeilen.join('\n');
}

// ── Block 3: Retrieval (optional, reduzierbar) ───────────────────────────────
function retrievalKandidaten(treffer: ReadonlyArray<OramaSearchResult> | null): OramaSearchResult[] {
  if (!treffer || treffer.length === 0) return [];
  return treffer.filter(t => t.score >= RETRIEVAL_MIN_SCORE).slice(0, RETRIEVAL_K);
}

function retrievalBlock(chunks: OramaSearchResult[]): string {
  if (chunks.length === 0) return '';
  const zeilen = ['=== Auszüge aus den Dokumenten (wörtlich) ==='];
  chunks.forEach((c, i) => {
    zeilen.push(`[${i + 1}] ${c.title || c.source}: ${trimTo(c.text, RETRIEVAL_CHUNK_MAX_CHARS)}`);
  });
  zeilen.push('=== Ende Auszüge ===');
  return zeilen.join('\n');
}

// ── Block 4: Historie (optional, reduzierbar, ältester zuerst) ───────────────
function historieZeilen(turns: ReadonlyArray<AssistentTurn>): string[] {
  return turns.map(t => `${t.rolle === 'nutzer' ? 'Nutzer' : 'Assistent'}: ${trimTo(t.text, HISTORIE_TURN_MAX_CHARS)}`);
}

function kappeHistorieAufBudget(zeilen: string[]): string[] {
  let out = [...zeilen];
  while (out.length > 0 && out.join('\n').length > HISTORIE_MAX_CHARS) out = out.slice(1);
  return out;
}

function historieBlock(zeilen: string[]): string {
  if (zeilen.length === 0) return '';
  return ['=== Bisheriger Gesprächsverlauf ===', ...zeilen, '=== Ende Verlauf ==='].join('\n');
}

// ── Block 5: Frage + Ausgabeanweisung (wird NIE gekürzt) ─────────────────────
function frageBlock(frage: string, hatAuszuege: boolean): string {
  const anweisung = hatAuszuege
    ? 'Antworte auf Basis der obigen Fakten und Auszüge. Stützt du dich auf einen Auszug, verweise mit seiner Nummer in eckigen Klammern (z. B. [1]). Fehlt die Information oben, sage das klar.'
    : 'Antworte auf Basis der obigen Fakten. Fehlt die Information oben, sage das klar.';
  return ['=== Frage ===', frage.trim(), '', anweisung].join('\n');
}

// ── Kontext-Chips ────────────────────────────────────────────────────────────
/**
 * Kurzbeschreibung der aktuellen Ansicht/Entität für die Panel-Chips
 * („Verbund X · Begutachtung · 2 Fristen"). Exportiert, damit das Panel dieselbe
 * Beschreibung LIVE zeigen kann (vor dem ersten Turn), ohne einen Prompt zu bauen.
 */
export function beschreibeKontext(entitaet: KontextEntitaet | null, routeBeschreibung: string): string {
  if (!entitaet) return routeBeschreibung;
  const artLabel = entitaet.art === 'verbund' ? 'Verbund' : 'Antrag';
  const teile: string[] = [`${artLabel} ${entitaet.titel}`];
  const status = typeof entitaet.status === 'string' ? entitaet.status.trim() : '';
  const lage = entitaet.phaseLabel ?? (status ? getStatusLabel(status) : undefined);
  if (lage) teile.push(lage);
  if (entitaet.fristenAnzahl && entitaet.fristenAnzahl > 0) {
    teile.push(`${entitaet.fristenAnzahl} ${entitaet.fristenAnzahl === 1 ? 'Frist' : 'Fristen'}`);
  }
  return teile.join(' · ');
}

/**
 * Assembliert den vollständigen Assistenten-Prompt deterministisch.
 *
 * Reihenfolge fix: System → Fakten → Retrieval → Historie → Frage.
 * Budget: übersteigt das Ganze `GESAMT_MAX_CHARS`, wird zuerst die Historie
 * (ältester Turn zuerst) und danach das Retrieval (schwächster Treffer zuerst)
 * gekürzt — der Faktenblock und die Frage bleiben unangetastet.
 */
export function assembliereAssistentKontext(eingabe: AssistentKontextEingabe): AssistentPrompt {
  const fakten = faktenBlock(eingabe);

  let gedEintraege: ReadonlyArray<{ text: string }> = eingabe.gedaechtnis ?? [];
  let doks: ReadonlyArray<VorhabenDokument> = eingabe.vorhabenDokumente ?? [];
  let chunks = retrievalKandidaten(eingabe.treffer);
  let histZeilen = kappeHistorieAufBudget(historieZeilen(eingabe.turns));

  const baue = (): string =>
    [
      SYSTEM_BLOCK,
      gedaechtnisBlock(gedEintraege),
      fakten,
      arbeitsvorratBlock(eingabe.arbeitsvorratUebersicht),
      vorhabenDokumenteBlock(doks),
      retrievalBlock(chunks),
      historieBlock(histZeilen),
      frageBlock(eingabe.frage, chunks.length > 0),
    ]
      .filter(b => b.length > 0)
      .join('\n\n');

  // Gesamt-Budget in fester Reihenfolge kürzen: ZUERST Gedächtnis (Hintergrundwissen,
  // kann veraltet sein), dann Historie (älteste zuerst), dann Retrieval (schwächste
  // zuerst), ZULETZT die Vorhaben-Dokumente (entitäts-scoped = am wertvollsten). Fakten
  // + Frage bleiben IMMER unangetastet.
  while (
    baue().length > GESAMT_MAX_CHARS
    && (gedEintraege.length > 0 || histZeilen.length > 0 || chunks.length > 0 || doks.length > 0)
  ) {
    if (gedEintraege.length > 0) gedEintraege = gedEintraege.slice(0, -1);
    else if (histZeilen.length > 0) histZeilen = histZeilen.slice(1);
    else if (chunks.length > 0) chunks = chunks.slice(0, -1);
    else doks = doks.slice(0, -1);
  }

  return {
    promptText: baue(),
    verwendeteTreffer: chunks,
    kontextBeschreibung: beschreibeKontext(eingabe.entitaet, eingabe.routeBeschreibung),
    gedaechtnisAnzahl: gedEintraege.length,
  };
}
