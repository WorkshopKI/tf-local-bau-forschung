/**
 * StatistikVergleichControl — kompaktes Dropdown „Vergleichen mit" oben in der
 * Statistik-Uebersicht. Waehlt der User ein vergangenes Quartal des aktuellen
 * Jahres, blenden HeadlineInsight + KpiGrid das Delta-Overlay ein.
 *
 * `null` = „Kein Vergleich" (Default). Radix-Select reserviert den Leerstring
 * fuer den Placeholder, daher der Sentinel `KEIN_VERGLEICH` fuer die Aus-Option.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const KEIN_VERGLEICH = '__none__';

interface Props {
  /** Aktuell gewaehltes Vergleichsquartal (`null` = kein Vergleich). */
  value: string | null;
  /** Vergangene Quartale des aktuellen Jahres, absteigend. */
  optionen: string[];
  onChange: (quartal: string | null) => void;
}

export function StatistikVergleichControl({ value, optionen, onChange }: Props): React.ReactElement {
  return (
    <div className="flex items-center gap-2">
      <span
        className="uppercase text-[var(--tf-text-tertiary)] shrink-0"
        style={{ fontSize: 10.5, fontWeight: 500, letterSpacing: 'var(--tf-tracking-caps)' }}
      >
        Vergleichen mit
      </span>
      <Select
        value={value ?? KEIN_VERGLEICH}
        onValueChange={v => onChange(v === KEIN_VERGLEICH ? null : v)}
      >
        <SelectTrigger size="sm" className="w-[9.5rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={KEIN_VERGLEICH}>Kein Vergleich</SelectItem>
          {optionen.map(q => (
            <SelectItem key={q} value={q}>
              {q}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
