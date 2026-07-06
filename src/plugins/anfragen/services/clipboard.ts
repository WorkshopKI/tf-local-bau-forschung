/**
 * Rich-Text-Kopie der finalen (de-anonymisierten) Antwort.
 *
 * Die externe ZIM-FAQ-Antwort kommt als Markdown (fette Überschriften, Absätze).
 * `writeText` würde die rohen `**`-Marker in Outlook zeigen → hier Markdown → HTML
 * (marked + sanitizeHtml, Reuse aus MarkdownRenderer) und als `text/html` +
 * `text/plain` in die Zwischenablage, damit Outlook/Word die Formatierung
 * übernehmen. Fällt bei fehlendem `ClipboardItem`-Support auf reinen Text zurück
 * (nie schlechter als das bisherige Verhalten).
 *
 * Die Finale ist BEWUSST de-anonymisiert (echte Originaldaten an den Original-
 * Absender, kein externer Leak) → die Clipboard-Zeilen sind per
 * `// allow-anfrage-export:` von der Export-Guard-Konvention ausgenommen.
 */
import { marked } from 'marked';
import { sanitizeHtml } from '@/components/ui/MarkdownRenderer';

export async function copyAntwortReich(text: string): Promise<void> {
  const inner = sanitizeHtml(marked.parse(text, { async: false }) as string);
  const html = `<div style="font-family:Aptos,Calibri,'Segoe UI',Arial,sans-serif;font-size:11pt">${inner}</div>`;
  try {
    const item = new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }), // allow-anfrage-export: de-anonym. Antwort an Original-Absender (kein Leak)
      'text/plain': new Blob([text], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
  } catch {
    await navigator.clipboard.writeText(text); // allow-anfrage-export: Fallback ohne ClipboardItem (de-anonym. Antwort an Original-Absender)
  }
}
