// Status-Filter-Dropdown des Feedback-Boards (Redesign v2.208, nur Listen-Sicht)
// über die kanonische shadcn-`Select`. Werte = Pipeline-Stationen + „Abgelehnt"
// + „Lob" (= Kategorie praise) + „Alle". Labels aus STATUS_LABELS (keine
// Literal-Vergleiche — reine Anzeige-Daten).

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FeedbackStatus } from '@/core/types/feedback';
import { FEEDBACK_PIPELINE } from '@/core/services/feedback';
import { STATUS_LABELS } from './constants';

/** 'alle' = kein Filter · 'lob' = Kategorie praise · sonst ein Pipeline-Status. */
export type FeedbackStatusFilter = FeedbackStatus | 'lob' | 'alle';

const STATUS_FILTER_OPTIONS: ReadonlyArray<{ key: FeedbackStatusFilter; label: string }> = [
  { key: 'alle', label: 'Alle' },
  ...FEEDBACK_PIPELINE.map(s => ({ key: s, label: STATUS_LABELS[s] })),
  { key: 'abgelehnt', label: STATUS_LABELS.abgelehnt },
  { key: 'lob', label: 'Lob' },
];

export function FeedbackStatusSelect({ value, onChange }: {
  value: FeedbackStatusFilter;
  onChange: (v: FeedbackStatusFilter) => void;
}): React.ReactElement {
  return (
    <Select value={value} onValueChange={v => onChange(v as FeedbackStatusFilter)}>
      <SelectTrigger size="sm" className="h-8 text-[12.5px]" aria-label="Status-Filter">
        <span className="text-[var(--tf-text-tertiary)]">Status:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_FILTER_OPTIONS.map(o => (
          <SelectItem key={o.key} value={o.key} className="text-[12.5px]">{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
