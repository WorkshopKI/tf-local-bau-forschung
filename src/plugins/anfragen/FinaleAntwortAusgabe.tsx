/**
 * Phase 8 — Ausgabe der finalen (de-anonymisierten) Antwort: Clipboard (primär) +
 * mailto (sekundär).
 *
 * Die finale Antwort enthält BEWUSST die echten Originaldaten — sie geht als
 * normale Antwort an den ursprünglichen Absender (kein externer Leak), läuft daher
 * NICHT durch pruefeExportSicher. Die clipboard/mailto-Stellen sind deshalb per
 * `// allow-anfrage-export:` von der Export-Guard-Konvention ausgenommen.
 */
import { useMemo } from 'react';
import { Copy, Mail } from 'lucide-react';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { buildMailto, mailtoBodyZuLang } from './services/mailto';
import type { Anfrage } from './types';

interface Props {
  anfrage: Anfrage;
}

export function FinaleAntwortAusgabe({ anfrage }: Props): React.ReactElement {
  const zuLang = useMemo(() => mailtoBodyZuLang(anfrage.finaleAntwort), [anfrage.finaleAntwort]);
  const mailtoUrl = useMemo(
    () => buildMailto(anfrage.absenderEmail, anfrage.betreff, anfrage.finaleAntwort),
    [anfrage.absenderEmail, anfrage.betreff, anfrage.finaleAntwort],
  );
  const kannMailen = !!anfrage.absenderEmail && !zuLang;

  const kopieren = useAsyncAction(async () => {
    await navigator.clipboard.writeText(anfrage.finaleAntwort); // allow-anfrage-export: de-anonymisierte Antwort an Original-Absender (kein externer Leak)
  });

  return (
    <div className="mt-4">
      <h4 className="text-[12px] font-medium text-[var(--tf-text-secondary)] mb-1.5">Finale Antwort</h4>
      <div className="text-[12.5px] text-[var(--tf-text)] whitespace-pre-wrap rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] p-3 max-h-[40vh] overflow-y-auto">
        {anfrage.finaleAntwort || <span className="text-[var(--tf-text-tertiary)]">— leer —</span>}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => kopieren.run()}
          disabled={!anfrage.finaleAntwort || kopieren.busy}
          className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] bg-[var(--tf-text)] text-[var(--tf-bg)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-opacity hover:opacity-90 flex items-center gap-1.5"
        >
          <Copy size={12} /> {kopieren.busy ? 'Kopiere…' : 'Finale Antwort kopieren'}
        </button>

        {kannMailen ? (
          <a
            href={mailtoUrl}
            className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] border border-[var(--tf-border)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer flex items-center gap-1.5 transition-colors"
            title="Öffnet einen Mail-Entwurf an den Original-Absender (Re: …). Hinweis: ohne Thread-Einhängung."
          >
            <Mail size={12} /> Antwort-Mail öffnen
          </a>
        ) : (
          <span className="text-[11.5px] text-[var(--tf-text-tertiary)] flex items-center gap-1.5">
            <Mail size={12} />
            {!anfrage.absenderEmail
              ? 'Keine Absender-Adresse — bitte Antwort kopieren.'
              : 'Antwort zu lang für Direkt-Mail — bitte kopieren und einfügen.'}
          </span>
        )}
      </div>
      {kopieren.error && <p className="mt-1 text-[12px] text-[var(--tf-danger-text)]">Fehler: {kopieren.error}</p>}
    </div>
  );
}
