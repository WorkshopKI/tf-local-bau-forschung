// Geteilte UI-Helfer für die Feedback-Komponenten.
// Beide Funktionen lagen zuvor dupliziert in MyFeedbackList.tsx und
// FeedbackBoardCard.tsx — hier zentralisiert (DRY).

import * as Icons from 'lucide-react';
import type { FeedbackItem } from '@/core/types/feedback';
import { FEEDBACK_TYPES } from './constants';

export type IconComponent = React.ComponentType<{ size?: number; className?: string }>;

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

/** Relative deutsche Zeitangabe („gerade eben", „vor 3 Std.", „gestern", …). */
export function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'gerade eben';
  if (diffMin < 60) return `vor ${diffMin} Min.`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `vor ${diffH} Std.`;
  const diffD = Math.floor(diffH / 24);
  if (diffD === 1) return 'gestern';
  if (diffD < 7) return `vor ${diffD} Tagen`;
  if (diffD < 30) return `vor ${Math.floor(diffD / 7)} Woche${diffD < 14 ? '' : 'n'}`;
  return date.toLocaleDateString('de-DE');
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
 *  bei Ein-Feld-Typen (Lob/Frage) und LLM-Zusammenfassungen — dann nur `antwort`. */
export interface FeedbackQaSegment {
  frage?: string;
  antwort: string;
}

// Alle bekannten Formular-Labels (= Fragen) für den Text-Fallback bei Alt-Tickets
// ohne `structured`. composeFeedbackText joint `Label\nWert` mit `\n\n`.
const KNOWN_FEEDBACK_LABELS = new Set(FEEDBACK_TYPES.flatMap(t => t.fields.map(f => f.label)));

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
        antwort: (ticket.structured?.[f.key] ?? '').trim(),
      }))
      .filter(s => s.antwort.length > 0);
    if (segs.length > 0) return segs;
  }

  return parseComposedFeedbackText(ticket.text);
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
        if (KNOWN_FEEDBACK_LABELS.has(first) && rest) return { frage: first, antwort: rest };
      }
      return { antwort: block.trim() };
    })
    .filter(s => s.antwort.length > 0);
}
