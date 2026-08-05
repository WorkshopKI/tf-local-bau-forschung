// Geteilte UI-Helfer für die Feedback-Komponenten — hier zentralisiert (DRY),
// statt in jedem Karten-/Listen-Baustein erneut ausgeschrieben.

import * as Icons from 'lucide-react';
import type { FeedbackComment, FeedbackItem } from '@/core/types/feedback';
import { FEEDBACK_TYPES } from './constants';

export type IconComponent = React.ComponentType<{ size?: number; className?: string; strokeWidth?: number; style?: React.CSSProperties }>;

/** Lucide-Icon per Namen auflösen; Fallback auf HelpCircle bei unbekanntem Namen. */
export function getLucideIcon(name: string): IconComponent {
  const icon = (Icons as Record<string, unknown>)[name];
  if (typeof icon === 'object' && icon !== null) return icon as IconComponent;
  return Icons.HelpCircle;
}

/** Kompaktes absolutes Datum mit Jahr (Tag.Monat.Jahr 2-stellig, z.B. „8.6.26").
 *  Geteilte Quelle für alle Feedback-Listen/-Karten/-Detail — eindeutig als
 *  Datum lesbar (statt „8.6", das wie eine Version wirkt). */
export function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: '2-digit' });
}

/**
 * Anzeigename des Einreichers für das Board. Leere/Platzhalter-Werte
 * (`anonymous`) → `undefined`, damit die UI sie als „—" bzw. gar nicht rendert.
 */
export function feedbackAuthorLabel(item: { user_display_name?: string; user_id?: string }): string | undefined {
  const raw = (item.user_display_name || item.user_id || '').trim();
  if (!raw || raw.toLowerCase() === 'anonymous') return undefined;
  return raw;
}

/** Ein Frage-/Antwort-Paar eines Feedbacks für die Listen-Vorschau. `frage` fehlt
 *  bei Ein-Feld-Typen (Lob/Frage) und LLM-Zusammenfassungen — dann nur `antwort`.
 *  `shortFrage` ist das Kurz-Label (Redesign, für die kompakte Karte); fehlt es,
 *  fällt die Karte auf `frage` zurück. */
export interface FeedbackQaSegment {
  frage?: string;
  shortFrage?: string;
  antwort: string;
}

// Labels des mit v2.289 entfallenen UX-Typs — nur noch für den Text-Fallback bei
// Alt-Tickets ohne `structured` (der Typ selbst ist aus FEEDBACK_TYPES entfernt).
const LEGACY_UX_LABELS: ReadonlyArray<readonly [string, string]> = [
  ['Was ist gerade umständlich?', 'Umständlich'],
  ['Was würde es leichter machen?', 'Leichter'],
];

// Alle bekannten Formular-Labels (= Fragen) für den Text-Fallback bei Alt-Tickets
// ohne `structured`. composeFeedbackText joint `Label\nWert` mit `\n\n`.
const KNOWN_FEEDBACK_LABELS = new Set([
  ...FEEDBACK_TYPES.flatMap(t => t.fields.map(f => f.label)),
  ...LEGACY_UX_LABELS.map(([label]) => label),
]);
// Volles Label → Kurz-Label (für den Text-Fallback bei Alt-Tickets).
const LABEL_TO_SHORT = new Map<string, string | undefined>([
  ...FEEDBACK_TYPES.flatMap(t => t.fields.map(f => [f.label, f.shortLabel] as const)),
  ...LEGACY_UX_LABELS,
]);

/**
 * Zerlegt ein Feedback in Frage-/Antwort-Paare für die kompakte Listen-Vorschau
 * (Frage fett, Antwort normal, je Paar eine Zeile).
 *
 * Reihenfolge der Quellen:
 * 1. `llm_summary` (falls vorhanden) → ein synthetischer Ein-Zeiler, kein Q&A.
 * 2. `structured` + Labels aus dem Typ-Schema (Ground Truth, robust gegen
 *    mehrzeilige Antworten — anders als das Parsen von `text`).
 * 3. Fallback: den komponierten `text` an bekannten Frage-Labels zerlegen
 *    (Alt-Tickets ohne `structured`).
 */
export function feedbackQaSegments(ticket: FeedbackItem): FeedbackQaSegment[] {
  const summary = ticket.llm_summary?.trim();
  if (summary) return [{ antwort: summary }];

  const typeDef = ticket.category ? FEEDBACK_TYPES.find(t => t.category === ticket.category) : undefined;
  if (ticket.structured && typeDef) {
    const segs = typeDef.fields
      .map(f => ({
        // Ein-Feld-Typen (Lob/Frage) speichern unter `text` ohne Frage-Präfix.
        frage: f.key === 'text' ? undefined : f.label,
        shortFrage: f.key === 'text' ? undefined : f.shortLabel,
        antwort: (ticket.structured?.[f.key] ?? '').trim(),
      }))
      .filter(s => s.antwort.length > 0);
    if (segs.length > 0) return segs;
  }

  return parseComposedFeedbackText(ticket.text);
}

// Primäres Antwort-Feld je Kategorie — Quelle für die Titel-Ableitung.
const PRIMARY_FIELD_KEY: Record<string, string> = {
  problem: 'actual', idea: 'goal', question: 'text', praise: 'text',
};

/**
 * Scannbarer Titel eines Feedbacks (Redesign v2.199). Bevorzugt den expliziten
 * `title`; fehlt er (Bestands-Feedback), wird aus der Hauptantwort abgeleitet
 * (Problem→„Was ist passiert?", Idee→„Was möchtest du tun können?", Lob/Frage→Text),
 * sonst `llm_summary` / erste Textzeile. Auf `maxLen` Zeichen gekürzt.
 *
 * `maxLen = Infinity` → NICHT kürzen (Whitespace wird weiterhin normalisiert).
 * Das nutzen die Stellen, die den vollen Titel umbrechend rendern (Board-Liste +
 * -Detail, Kurator-Liste + -Detail); die platzknappen Aufrufer (Kanban-Karten,
 * Home-Widgets) bleiben bei einer festen Grenze.
 */
export function feedbackTitle(item: FeedbackItem, maxLen = 90): string {
  const explicit = item.title?.trim();
  if (explicit) return truncate(explicit, maxLen);
  const key = item.category ? PRIMARY_FIELD_KEY[item.category] : undefined;
  const primary = key ? item.structured?.[key]?.trim() : undefined;
  const raw =
    primary || item.llm_summary?.trim() || item.text?.split('\n').find(l => l.trim())?.trim() || '–';
  return truncate(raw, maxLen);
}

function truncate(s: string, maxLen: number): string {
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > maxLen ? `${clean.slice(0, maxLen - 1).trimEnd()}…` : clean;
}

/** Ein Kommentar, wie ihn die geteilte Kommentar-Liste rendert. `text` ist die
 *  (ggf. gekürzte) Fassung, `neu` markiert ihn als seit dem letzten Ansehen
 *  hinzugekommen. */
export interface KommentarVorschauEintrag {
  comment: FeedbackComment;
  text: string;
  neu: boolean;
}

/** Ausgewählte Kommentare + wieviele davor ausgelassen wurden. */
export interface KommentarVorschau {
  eintraege: KommentarVorschauEintrag[];
  /** Ältere, nicht gezeigte Kommentare (0 im Thread, der alle zeigt). */
  aeltereAnzahl: number;
}

/**
 * Kommentartext für eine platzknappe Vorschau. Kürzt an der letzten Wortgrenze
 * ab 60 % der Grenze (sonst hart), und zieht Leerzeilen-Kaskaden zusammen —
 * drei Absätze Abstand kosten in einer 280-px-Karte den halben Platz.
 *
 * `maxZeichen = Infinity` gibt den Text **unverändert** zurück, Whitespace
 * eingeschlossen: der Thread im Detail-Panel zeigt den Originalwortlaut, und
 * eine stille Normalisierung dort wäre eine Textänderung ohne Anlass.
 */
export function kuerzeKommentarText(text: string, maxZeichen: number): string {
  if (!Number.isFinite(maxZeichen)) return text;
  const kompakt = text.replace(/\n{3,}/g, '\n\n');
  if (kompakt.length <= maxZeichen) return kompakt;
  const roh = kompakt.slice(0, maxZeichen);
  const wortGrenze = Math.max(roh.lastIndexOf(' '), roh.lastIndexOf('\n'));
  const schnitt = wortGrenze >= maxZeichen * 0.6 ? wortGrenze : maxZeichen;
  return `${kompakt.slice(0, schnitt).trimEnd()}…`;
}

/**
 * Wählt die anzuzeigenden Kommentare — eine Funktion für beide Orte: der Hover
 * ruft mit engen Grenzen, der Thread mit `Infinity` (zeigt alles ungekürzt).
 *
 * Gezeigt werden die **letzten** N in Speicher-Reihenfolge (chronologisch,
 * neueste unten). Nicht umsortieren: der Thread liest so, und zwei Reihenfolgen
 * für dieselben Daten wären zwei Wahrheiten. Weil neue Kommentare hinten
 * anhängen, sind sie damit immer im Ausschnitt.
 */
export function waehleKommentarVorschau(
  comments: readonly FeedbackComment[],
  opts: { maxEintraege: number; maxZeichen: number; neuAnzahl: number },
): KommentarVorschau {
  const gesamt = comments.length;
  const sichtbar = Math.max(0, Math.min(opts.maxEintraege, gesamt));
  const ab = gesamt - sichtbar;
  // Ab diesem absoluten Index gilt „neu". neuAnzahl 0 → gesamt → kein Treffer.
  const abNeu = gesamt - Math.max(0, Math.min(opts.neuAnzahl, gesamt));
  return {
    eintraege: comments.slice(ab).map((comment, i) => ({
      comment,
      text: kuerzeKommentarText(comment.text, opts.maxZeichen),
      neu: ab + i >= abNeu,
    })),
    aeltereAnzahl: ab,
  };
}

/**
 * Gemerkte Mindesthöhe des Kommentarfelds (px) aus dem localStorage-Rohwert.
 * Defekt/leer/NaN → `undefined` = „nichts gemerkt", die Grundhöhe gilt.
 * Der Wert wird auf `[min, max]` geklemmt, damit ein Alt-Eintrag aus einer
 * anderen Fenstergröße das Feld weder verschwinden noch das Panel schlucken lässt.
 */
export function clampKommentarHoehe(roh: string | null, min: number, max: number): number | undefined {
  if (roh === null || roh.trim() === '') return undefined;
  const px = Number(roh);
  if (!Number.isFinite(px)) return undefined;
  return Math.round(Math.max(min, Math.min(max, px)));
}

/**
 * Zielhöhe des Kommentarfelds — reine Arithmetik, kein DOM.
 *
 * Drei Untergrenzen konkurrieren, die größte gewinnt: der geschriebene Inhalt
 * (`scrollHoehe`), die vom Nutzer gezogene Mindesthöhe (`gemerkt`) und die
 * Grundhöhe des leeren Felds (`grundHoehe`, = `rows`). Gedeckelt bei `max`,
 * darüber scrollt das Feld intern.
 *
 * Dass `gemerkt` als MINDESThöhe wirkt (nicht als feste Höhe), ist der Kern:
 * sonst würden Auto-Wachsen und Zieh-Anfasser einander die Höhe überschreiben.
 */
export function berechneKommentarHoehe(
  scrollHoehe: number,
  grundHoehe: number,
  gemerkt: number | undefined,
  max: number,
): number {
  const untergrenzen = [scrollHoehe, grundHoehe, gemerkt ?? 0].filter(n => Number.isFinite(n));
  return Math.round(Math.min(max, Math.max(0, ...untergrenzen)));
}

/** Fallback-Parser für den komponierten `text` (`Label\nWert` je `\n\n`-Block). */
function parseComposedFeedbackText(text: string): FeedbackQaSegment[] {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return [];
  return trimmed
    .split(/\n{2,}/)
    .map((block): FeedbackQaSegment => {
      const nl = block.indexOf('\n');
      if (nl > 0) {
        const first = block.slice(0, nl).trim();
        const rest = block.slice(nl + 1).trim();
        if (KNOWN_FEEDBACK_LABELS.has(first) && rest) {
          return { frage: first, shortFrage: LABEL_TO_SHORT.get(first), antwort: rest };
        }
      }
      return { antwort: block.trim() };
    })
    .filter(s => s.antwort.length > 0);
}
