/**
 * Streaming-fähiger CSV-Parser für die gefilterte DMS-CSV.
 *
 * Format: Semikolon-getrennt, optional gequoted, keine Multi-Line-Felder.
 * Encoding wird über die Schnittstelle vom Caller bereitgestellt (UTF-8 nach
 * Vorfilter-Lauf — der Vorfilter normalisiert auf UTF-8).
 */

/**
 * Parser für eine einzelne CSV-Zeile, Semikolon-getrennt, optional gequoted.
 * Doppelte Anführungszeichen innerhalb eines gequoteten Feldes werden zu
 * einem einzelnen `"`. Spec-konform zu RFC 4180 (mit `;` als Separator).
 */
export function parseCsvLine(line: string, sep = ';'): string[] {
  const out: string[] = [];
  let i = 0;
  const n = line.length;
  while (i <= n) {
    let field = '';
    if (i < n && line[i] === '"') {
      i++;
      while (i < n) {
        const c = line[i] ?? '';
        if (c === '"') {
          if (line[i + 1] === '"') {
            field += '"';
            i += 2;
          } else {
            i++;
            break;
          }
        } else {
          field += c;
          i++;
        }
      }
      while (i < n && line[i] !== sep) i++;
    } else {
      while (i < n && line[i] !== sep) {
        field += line[i];
        i++;
      }
    }
    out.push(field);
    if (i < n && line[i] === sep) {
      i++;
      if (i === n) {
        out.push('');
        break;
      }
    } else {
      break;
    }
  }
  return out;
}

/** Parser für den ganzen CSV-Text (Multi-Line-Split via `\r?\n`). */
export function parseCsvText(text: string, sep = ';'): { header: string[]; rows: string[][] } {
  // BOM strippen
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split(/\r?\n/).filter(l => l.length > 0);
  if (lines.length === 0) return { header: [], rows: [] };
  const header = parseCsvLine(lines[0]!, sep);
  const rows = lines.slice(1).map(l => parseCsvLine(l, sep));
  return { header, rows };
}
