// Sortier-Dropdown des Feedback-Boards (Redesign v2.208): 5 Ordnungen über die
// kanonische shadcn-`Select`. Ersetzt den früheren 2-fach-Toggle.

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export type FeedbackSort = 'neu' | 'pkt' | 'naht' | 'sup' | 'kmt';

const SORT_OPTIONS: ReadonlyArray<{ key: FeedbackSort; label: string }> = [
  { key: 'neu', label: 'Neueste zuerst' },
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
      <SelectTrigger size="sm" className="h-8 w-[164px] text-[12.5px]" aria-label="Sortierung">
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
