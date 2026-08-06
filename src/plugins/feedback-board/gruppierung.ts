/**
 * Gruppierung in Swimlanes (v3.18): dieselbe Menge, aufgeteilt in klappbare
 * Bänder — je Band ein eigenes Board bzw. eine eigene Liste.
 *
 * Der Zweck ist Triage nach einer ZWEITEN Achse: das Board ordnet nach Status,
 * die Gruppierung schneidet quer dazu („welcher Bereich frisst gerade die
 * meiste Zeit?", „wer hat wie viel offen?").
 *
 * Rein: kein React, kein Storage.
 */
import type { FeedbackItem } from '@/core/types/feedback';
import { EFFORT_ORDER } from '@/core/types/feedback';
import { bereichLabel, feedbackAuthorLabel, ticketBereich } from '@/components/feedback/feedbackUi';

export type GruppierAchse = 'keine' | 'bereich' | 'aufwand' | 'ersteller';

export const GRUPPIER_ACHSEN: ReadonlyArray<{ key: GruppierAchse; label: string }> = [
  { key: 'keine', label: 'Keine' },
  { key: 'bereich', label: 'Bereich' },
  { key: 'aufwand', label: 'Aufwand' },
  { key: 'ersteller', label: 'Ersteller' },
];

export function istGruppierAchse(v: unknown): v is GruppierAchse {
  return v === 'keine' || v === 'bereich' || v === 'aufwand' || v === 'ersteller';
}

export function achsenLabel(a: GruppierAchse): string {
  return GRUPPIER_ACHSEN.find(g => g.key === a)?.label ?? 'Keine';
}

export interface Gruppe {
  /** Stabiler Schlüssel — Bänder werden darüber gekeyt, nie über den Anzeigenamen. */
  key: string;
  label: string;
  tickets: FeedbackItem[];
}

const UNGESCHAETZT = 'ungeschaetzt';
const OHNE_AUTOR = 'ohne-autor';

/** Schlüssel + Beschriftung je Achse. Getrennt, weil der Schlüssel stabil sein
 *  muss (Reihenfolge, Aufklapp-Zustand) und die Beschriftung übersetzt wird. */
function schluessel(t: FeedbackItem, achse: GruppierAchse): { key: string; label: string } {
  switch (achse) {
    case 'bereich': {
      const ref = ticketBereich(t);
      return { key: ref, label: bereichLabel(ref) };
    }
    case 'aufwand':
      return t.effort_estimate
        ? { key: t.effort_estimate, label: t.effort_estimate }
        : { key: UNGESCHAETZT, label: 'Ungeschätzt' };
    case 'ersteller': {
      const autor = feedbackAuthorLabel(t);
      return autor ? { key: autor, label: autor } : { key: OHNE_AUTOR, label: 'Ohne Angabe' };
    }
    default:
      return { key: 'alle', label: 'Alle' };
  }
}

/**
 * Reihenfolge der Bänder. Beim Aufwand ist das die FACHLICHE Ordnung (XS → Epic,
 * Ungeschätztes ans Ende) — nach Häufigkeit sortiert stünde „L" womöglich vor
 * „XS", und die Leiste verlöre ihren Sinn als Größenachse. Sonst: das größte
 * Band zuerst, das ist die Triage-Frage.
 */
function sortiereGruppen(gruppen: Gruppe[], achse: GruppierAchse): Gruppe[] {
  if (achse === 'aufwand') {
    const rang = new Map<string, number>(EFFORT_ORDER.map((e, i) => [e as string, i]));
    return gruppen.sort(
      (a, b) => (rang.get(a.key) ?? 999) - (rang.get(b.key) ?? 999),
    );
  }
  return gruppen.sort(
    (a, b) => b.tickets.length - a.tickets.length || a.label.localeCompare(b.label, 'de'),
  );
}

/**
 * Teilt die (bereits gefilterte und sortierte) Liste in Bänder. Die Reihenfolge
 * INNERHALB eines Bandes bleibt die der Eingabe — sortiert hat die Toolbar.
 * `achse: 'keine'` liefert eine leere Liste; der Aufrufer rendert dann ungruppiert.
 */
export function gruppiere(
  tickets: readonly FeedbackItem[],
  achse: GruppierAchse,
): Gruppe[] {
  if (achse === 'keine') return [];
  const map = new Map<string, Gruppe>();
  for (const t of tickets) {
    const { key, label } = schluessel(t, achse);
    const g = map.get(key);
    if (g) g.tickets.push(t);
    else map.set(key, { key, label, tickets: [t] });
  }
  return sortiereGruppen([...map.values()], achse);
}
