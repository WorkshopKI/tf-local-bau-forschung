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
  /** Nur im Bearbeiten-Modus editierbar (sonst read-only). */
  editable: boolean;
  onChange: (raw: string) => void;
  ariaLabel: string;
}

export function CapCell({ value, editable, onChange, ariaLabel }: Props): React.ReactElement {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value ?? ''}
      readOnly={!editable}
      tabIndex={editable ? undefined : -1}
      aria-label={ariaLabel}
      onChange={e => onChange(e.target.value)}
    />
  );
}
