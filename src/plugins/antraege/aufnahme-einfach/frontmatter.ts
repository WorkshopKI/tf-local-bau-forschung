import type { AufnahmeTyp } from './dateiTyp';

/**
 * Frontmatter-Metadaten jeder aufgenommenen `.md`. Information bleibt
 * dateibasiert — kein Zusatz-Store. `konvertiert_am` ist ISO.
 */
export interface DokumentMeta {
  fkz: string;
  typ: AufnahmeTyp;
  quelle: string; // Originaldateiname
  konvertiert_am: string;
}

const KEYS: (keyof DokumentMeta)[] = ['fkz', 'typ', 'quelle', 'konvertiert_am'];

/** Minimal-YAML: nur quoten, wenn nötig (führende/anhängende Spaces, : # "). */
function quote(v: string): string {
  return /[:#"]|^\s|\s$/.test(v) ? JSON.stringify(v) : v;
}
function unquote(v: string): string {
  const t = v.trim();
  return t.startsWith('"') && t.endsWith('"') ? (JSON.parse(t) as string) : t;
}

export function buildMarkdownMitFrontmatter(meta: DokumentMeta, body: string): string {
  const lines = ['---'];
  for (const k of KEYS) lines.push(`${k}: ${quote(String(meta[k]))}`);
  lines.push('---', '');
  return `${lines.join('\n')}${body}`;
}

export interface ParsedDokument {
  meta: DokumentMeta;
  body: string;
}

export function parseFrontmatter(md: string): ParsedDokument | null {
  if (!md.startsWith('---\n')) return null;
  const end = md.indexOf('\n---', 4);
  if (end < 0) return null;
  const block = md.slice(4, end);
  const body = md.slice(end + 4).replace(/^\n/, '');
  const meta: Partial<DokumentMeta> = {};
  for (const line of block.split('\n')) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const key = line.slice(0, i).trim() as keyof DokumentMeta;
    if ((KEYS as string[]).includes(key)) meta[key] = unquote(line.slice(i + 1)) as never;
  }
  if (!meta.fkz || !meta.typ || !meta.quelle || !meta.konvertiert_am) return null;
  return { meta: meta as DokumentMeta, body };
}
