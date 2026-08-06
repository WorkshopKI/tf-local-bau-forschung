// Sortier-Dropdown des Feedback-Boards über die kanonische shadcn-`Select`.
//
// Acht Ordnungen in zwei Blöcken: erst die vier des Redesigns (v3.12, Handoff
// feedback-redesign) — sie beantworten „woran wird gerade gearbeitet" —, dann
// die vier Sponsoring-Ordnungen, die es seit v2.208 gibt. Bewusst keine Trennung
// in zwei Bedienelemente: es ist EINE Frage („in welcher Reihenfolge?"), nur mit
// mehr Antworten als in den Handoff passten.

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type FeedbackSort = 'bewegt' | 'neu' | 'stimmen' | 'aufwand' | 'pkt' | 'naht' | 'sup' | 'kmt';

/** Alle gültigen Werte — Single Source für die Validierung des localStorage-Werts. */
export const FEEDBACK_SORT_VALUES: readonly FeedbackSort[] = [
  'bewegt', 'neu', 'stimmen', 'aufwand', 'pkt', 'naht', 'sup', 'kmt',
];

const SORT_OPTIONS: ReadonlyArray<{ key: FeedbackSort; label: string }> = [
  { key: 'bewegt', label: 'Zuletzt bewegt' },
  { key: 'neu', label: 'Neueste zuerst' },
  { key: 'stimmen', label: 'Meiste Unterstützer' },
  { key: 'aufwand', label: 'Kleinster Aufwand' },
  { key: 'pkt', label: 'Meiste Punkte' },
  { key: 'naht', label: 'Kurz vor dem Ziel' },
  { key: 'sup', label: 'Meiste Sponsoren' },
  { key: 'kmt', label: 'Meiste Kommentare' },
];

export function FeedbackSortSelect({ value, onChange }: {
  value: FeedbackSort;
  onChange: (v: FeedbackSort) => void;
}): React.ReactElement {
  return (
    <Select value={value} onValueChange={v => onChange(v as FeedbackSort)}>
      <SelectTrigger size="sm" className="h-8 w-[176px] text-[12.5px]" aria-label="Sortierung">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {SORT_OPTIONS.map(o => (
          <SelectItem key={o.key} value={o.key} className="text-[12.5px]">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
