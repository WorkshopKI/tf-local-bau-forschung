/**
 * Leichtgewichtiger Markdown-Parser fürs Dokument-Side-Panel:
 * Frontmatter abspalten, Human-Title / Author / Auszug / Gliederung
 * extrahieren. Bewusst ohne `gray-matter` & co. — wir parsen nur ein
 * paar simple Felder und brauchen keinen vollen YAML-Parser.
 */

export interface OutlineEntry {
  /** Hierarchische Nummerierung, z.B. "1", "1.2", "2.1.3". */
  number: string;
  title: string;
  /** 1 = H1, 2 = H2 (H3+ werden ausgeblendet). */
  depth: 1 | 2;
}

export interface ParsedMd {
  frontmatter: Record<string, string>;
  body: string;
  /** Lesefreundlicher Titel — frontmatter.title/titel oder erste H1.
   *  Null wenn nichts gefunden wurde (Caller fällt auf filename zurück). */
  humanTitle: string | null;
  author: string | null;
  /** Erste ~600 Zeichen Fließtext, frontmatter und Markdown-Syntax bereinigt. */
  excerpt: string;
  outline: OutlineEntry[];
}

const EXCERPT_LIMIT = 600;

function stripQuotes(s: string): string {
  return s.replace(/^["']|["']$/g, '').trim();
}

function parseFrontmatter(md: string): { frontmatter: Record<string, string>; body: string } {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m || !m[1]) return { frontmatter: {}, body: md };
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([a-zA-Z_][a-zA-Z0-9_-]*)\s*:\s*(.*)$/);
    if (kv && kv[1] && kv[2] !== undefined) fm[kv[1].toLowerCase()] = stripQuotes(kv[2]);
  }
  return { frontmatter: fm, body: md.slice(m[0].length) };
}

function buildExcerpt(body: string): string {
  const cleaned = body
    .replace(/^#{1,6}\s+.*$/gm, '')              // Überschriften raus
    .replace(/```[\s\S]*?```/g, '')               // Code-Blöcke raus
    .replace(/`([^`]+)`/g, '$1')                  // Inline-Code entrahmen
    .replace(/\*\*([^*]+)\*\*/g, '$1')           // Bold entrahmen
    .replace(/\*([^*]+)\*/g, '$1')                // Italic entrahmen
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')     // Links → Linktext
    .replace(/^\s*[-*+]\s+/gm, '')                // Listen-Marker raus
    .replace(/^\s*\d+\.\s+/gm, '')                // Nummerierte Listen
    .replace(/\n{2,}/g, '\n\n')
    .trim();
  if (cleaned.length <= EXCERPT_LIMIT) return cleaned;
  // An Wortgrenze schneiden, sonst hartes Ende.
  const slice = cleaned.slice(0, EXCERPT_LIMIT);
  const lastSpace = slice.lastIndexOf(' ');
  const cut = lastSpace > EXCERPT_LIMIT - 80 ? slice.slice(0, lastSpace) : slice;
  return cut.trimEnd() + ' …';
}

function buildOutline(body: string): OutlineEntry[] {
  const out: OutlineEntry[] = [];
  let h1 = 0;
  let h2 = 0;
  for (const rawLine of body.split(/\r?\n/)) {
    const m1 = rawLine.match(/^#\s+(.+?)\s*#*\s*$/);
    const m2 = rawLine.match(/^##\s+(.+?)\s*#*\s*$/);
    if (m2 && m2[1]) {
      h2 += 1;
      out.push({ number: `${h1 || 1}.${h2}`, title: m2[1].trim(), depth: 2 });
    } else if (m1 && m1[1]) {
      h1 += 1;
      h2 = 0;
      out.push({ number: `${h1}`, title: m1[1].trim(), depth: 1 });
    }
  }
  return out;
}

export function parseMarkdown(md: string): ParsedMd {
  const { frontmatter, body } = parseFrontmatter(md);
  const fmTitle = frontmatter.title || frontmatter.titel;
  const h1Match = body.match(/^#\s+(.+?)\s*#*\s*$/m);
  const humanTitle = (fmTitle && fmTitle.length > 0)
    ? fmTitle
    : (h1Match && h1Match[1] ? h1Match[1].trim() : null);
  const author = frontmatter.ersteller || frontmatter.author || frontmatter.autor || null;
  const excerpt = buildExcerpt(body);
  const outline = buildOutline(body);
  return { frontmatter, body, humanTitle, author, excerpt, outline };
}
