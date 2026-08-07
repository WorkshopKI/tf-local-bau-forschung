// Sortier-Dropdown des Feedback-Boards über die kanonische shadcn-`Select`.
//
// Acht Ordnungen in zwei Blöcken: erst die vier des Redesigns (v3.12, Handoff
// feedback-redesign) — sie beantworten „woran wird gerade gearbeitet" —, dann
// die vier Sponsoring-Ordnungen, die es seit v2.208 gibt. Bewusst keine Trennung
// in zwei Bedienelemente: es ist EINE Frage („in welcher Reihenfolge?"), nur mit
// mehr Antworten als in den Handoff passten.
//
// Der Trigger trägt seit v3.24 die Beschriftung „Sortiert nach:" — dieselbe wie
// auf den Förderanträgen. Ohne sie stand dort „Zuletzt bewegt" als Rätsel: ein
// Wert ohne Frage. Aus demselben Grund heißt der Wert jetzt „Letzte Änderung";
// der Schlüssel `bewegt` bleibt, damit gemerkte Vorlieben mitziehen.
//
// KEINE feste Breite am Trigger: er ist `justify-between`, eine feste Breite
// schöbe den Chevron an den rechten Rand und ließe zwischen Wert und Pfeil ein
// Loch.

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type FeedbackSort = 'bewegt' | 'neu' | 'stimmen' | 'aufwand' | 'pkt' | 'naht' | 'sup' | 'kmt';

/** Alle gültigen Werte — Single Source für die Validierung des localStorage-Werts. */
export const FEEDBACK_SORT_VALUES: readonly FeedbackSort[] = [
  'bewegt', 'neu', 'stimmen', 'aufwand', 'pkt', 'naht', 'sup', 'kmt',
];

const SORT_OPTIONS: ReadonlyArray<{ key: FeedbackSort; label: string }> = [
  { key: 'bewegt', label: 'Letzte Änderung' },
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
      {/* `size="default"` und nicht `sm`: die sm-Variante ist 28px hoch und
          stünde als einziges Element der Leiste tiefer als die 32px daneben
          (`data-[size=sm]:h-7` schlägt jedes `h-8` in className). */}
      <SelectTrigger className="text-[12.5px]" aria-label="Sortierung">
        <span className="text-[var(--tf-text-tertiary)]">Sortiert nach:</span>
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
