// Geteilte UI-Helfer für die Feedback-Komponenten.
// Beide Funktionen lagen zuvor dupliziert in MyFeedbackList.tsx und
// FeedbackBoardCard.tsx — hier zentralisiert (DRY).

import * as Icons from 'lucide-react';

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
