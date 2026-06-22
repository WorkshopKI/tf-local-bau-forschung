/**
 * Dialog zum Prüfen einer Dokument-Konvertierung (docx/pdf → Markdown).
 * Zeigt die Konvertierungs-Warnungen + das tatsächlich extrahierte Markdown,
 * das die KI verarbeitet. Damit erkennt der Bearbeiter verlorene Tabellen/
 * Grafiken oder ein gescanntes (textloses) PDF und kann extern korrigieren.
 */
import { Dialog } from '@/components/ui/dialog';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { parseMarkdown } from '@/plugins/dokumente/markdownMeta';
import type { ConversionReport, ConversionWarning } from '@/core/services/converter';

interface Props {
  open: boolean;
  filename: string;
  format: string;
  pages?: number;
  markdown: string;
  report?: ConversionReport;
  onClose: () => void;
}

export function KonvertierungReviewDialog({ open, filename, format, pages, markdown, report, onClose }: Props): React.ReactElement | null {
  const body = parseMarkdown(markdown).body;
  const charCount = report?.charCount ?? body.trim().length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      size="lg"
      align="top"
      title="Konvertierung prüfen"
      footer={
        <button onClick={onClose} className="text-[13px] px-4 py-2 rounded-[8px] border-[0.5px] border-[var(--tf-border-hover)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)]">
          Schließen
        </button>
      }
    >
      <div className="text-[12px] text-[var(--tf-text-secondary)] font-mono truncate" title={filename}>{filename}</div>
      <div className="text-[11px] text-[var(--tf-text-tertiary)] mt-0.5">
        {format.toUpperCase()}{pages ? ` · ${pages} ${pages === 1 ? 'Seite' : 'Seiten'}` : ''} · {charCount.toLocaleString('de-DE')} Zeichen
      </div>

      {report && report.warnings.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {report.warnings.map((w, i) => <WarnLine key={i} w={w} />)}
        </div>
      )}

      <p className="mt-4 text-[12px] leading-[1.5] text-[var(--tf-text-secondary)]">
        Die KI verarbeitet ausschließlich den Text unten. Tabellen und Grafiken werden nur berücksichtigt,
        soweit sie als Text übernommen wurden — bei Problemen die Datei extern korrigieren
        (z. B. im PDF-Tool nach DOCX), kontrollieren und erneut hochladen.
      </p>

      <div className="mt-4 overflow-auto rounded-[8px] border-[0.5px] border-[var(--tf-border)] bg-[var(--tf-bg-secondary)] px-4 py-3">
        {body.trim()
          ? <MarkdownRenderer content={body} />
          : <p className="text-[13px] text-[var(--tf-text-tertiary)]">Kein Text extrahiert — die KI hätte keine Grundlage für die Kurzfassung.</p>}
      </div>
    </Dialog>
  );
}

function WarnLine({ w }: { w: ConversionWarning }): React.ReactElement {
  const danger = w.level === 'warnung';
  return (
    <div className="flex items-start gap-2.5 text-[12.5px]">
      <span className="w-3.5 text-center shrink-0 mt-0.5" style={{ color: danger ? 'var(--tf-danger-text)' : 'var(--tf-warning-text)' }}>
        {danger ? '✕' : '!'}
      </span>
      <span className={danger ? 'text-[var(--tf-text)]' : 'text-[var(--tf-text-secondary)]'}>{w.message}</span>
    </div>
  );
}
