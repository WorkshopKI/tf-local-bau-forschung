/**
 * Inline-Zitat-Post-Pass: wandelt `[n]` / `[n, m]` im gerenderten Markdown-HTML
 * in klickbare `.cite`-Spans. Läuft NACH marked, damit Tabellen/Code/Links
 * erhalten bleiben. `[n]` in Tags, <code> und <pre> wird bewusst NICHT angefasst.
 */

// Captured groups bleiben beim String.split erhalten → Tags/Code-Blöcke landen
// an ungeraden Indizes und werden unverändert durchgereicht.
const PROTECTED = /(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<[^>]+>)/gi;
const CITE = /\[(\d+(?:\s*,\s*\d+)*)\]/g;

export function renderCitations(html: string, activeN?: number): string {
  return html
    .split(PROTECTED)
    .map((seg, i) => {
      if (i % 2 === 1) return seg; // geschütztes Segment (Tag/Code/Pre)
      return seg.replace(CITE, (_full, group: string) =>
        group
          .split(',')
          .map(s => {
            const n = Number.parseInt(s.trim(), 10);
            const cls = activeN === n ? 'cite active' : 'cite';
            return `<span class="${cls}" data-cite="${n}">${n}</span>`;
          })
          .join(''),
      );
    })
    .join('');
}
