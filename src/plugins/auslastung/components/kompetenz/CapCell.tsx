/**
 * CapCell (v2.16) — Ziffern-Eingabe einer Kapazitäts-Zelle (Kontingent/Abschlag).
 *
 * Nur das innere `<input>`; das `<td>` (sticky-left + Graustufen-bg via
 * `capCellBg`) rendert `MatrixRow`. Akzeptiert deutsche Dezimal-Kommata
 * (`replace(',', '.')` passiert im Modell). `inputMode=numeric` für mobile
 * Tastaturen; Spin-Buttons sind per CSS entfernt.
 */
interface Props {
  value: number | undefined;
  onChange: (raw: string) => void;
  ariaLabel: string;
}

export function CapCell({ value, onChange, ariaLabel }: Props): React.ReactElement {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value ?? ''}
      aria-label={ariaLabel}
      onChange={e => onChange(e.target.value)}
    />
  );
}
