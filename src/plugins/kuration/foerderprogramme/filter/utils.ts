import type { FilterTyp } from '@/core/services/csv';

export function humanizeFilterTyp(t: FilterTyp): string {
  switch (t) {
    case 'single_select': return 'Einfach-Auswahl';
    case 'multi_select': return 'Mehrfach-Auswahl';
    case 'boolean_ja_nein': return 'Ja / Nein';
    case 'date_range': return 'Datum-Bereich';
    case 'number_range': return 'Zahl-Bereich';
    case 'text_contains': return 'Text enthält';
    default: return String(t);
  }
}
