/**
 * XswSuffix — rendert den T_XSW-Wiedereinreicher-Hinweis rot/fett als Suffix
 * hinter einem VB-Titel. Liefert `null`, wenn kein Hinweis vorliegt.
 *
 * `value` darf entweder der rohe `t_xsw`-String sein oder ein Record
 * (`Antrag` / `AntragListItem` / `AntragVorgang`), aus dem das Feld via
 * `readXsw` gelesen wird. Führendes Space-Textnode = Abstand zum Titel.
 *
 * In dichten Zeilen `className="shrink-0 max-w-[…] truncate"` mitgeben, damit
 * der Hinweis das Layout nicht sprengt; der volle Text steht im `title`.
 */
import { readXsw, XSW_SUFFIX_CLASS } from './xsw';

interface Props {
  value: unknown;
  className?: string;
}

export function XswSuffix({ value, className }: Props): React.ReactElement | null {
  const text = typeof value === 'string' ? (value.trim() || null) : readXsw(value);
  if (!text) return null;
  return (
    <span className={`${XSW_SUFFIX_CLASS}${className ? ` ${className}` : ''}`} title={text}>
      {' '}{text}
    </span>
  );
}
