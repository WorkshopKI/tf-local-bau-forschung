/**
 * Lesemodus-Tab der Antrag-Aufbereitung: liest die VB als navigierbares Dokument
 * (Gliederung links, Lesepane rechts). Jeder Abschnitt trägt seine `sektionId` als
 * `data-sek`-Anker → eine Fundstelle aus einem anderen Tab („Im Antrag öffnen") scrollt
 * hierher und hebt die Stelle kurz hervor. Rendering über den geteilten
 * `MarkdownRenderer` (sanitized, mit Tabellen-Support). Slicing = reine `sliceLesemodus`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import type { AufbereitungRun } from './types';
import { sliceLesemodus } from './lesemodus';

export function LesemodusTab({
  run, vbMarkdown, sprungZiel, onVerbraucht,
}: {
  run: AufbereitungRun | null;
  vbMarkdown: string | null;
  /** Sektions-ID, zu der beim Öffnen gesprungen werden soll (aus einer Fundstelle). */
  sprungZiel: string | null;
  /** Meldet dem Seitenrahmen, dass das Sprungziel verbraucht ist (State zurücksetzen). */
  onVerbraucht: () => void;
}): React.ReactElement {
  const abschnitte = useMemo(
    () => (run && vbMarkdown ? sliceLesemodus(vbMarkdown, run.gliederung) : []),
    [run, vbMarkdown],
  );
  const readerRef = useRef<HTMLDivElement>(null);
  const [flashId, setFlashId] = useState<string | null>(null);

  const scrolleZu = (id: string): void => {
    const el = readerRef.current?.querySelector(`[data-sek="${CSS.escape(id)}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFlashId(id);
  };

  // Sprung aus einer Fundstelle (anderer Tab → Lesemodus): scrollen + kurz hervorheben.
  // Danach das Ziel verbrauchen, damit ein erneuter Klick auf dieselbe Stelle wieder feuert.
  useEffect(() => {
    if (!sprungZiel) return;
    scrolleZu(sprungZiel);
    onVerbraucht();
  }, [sprungZiel, onVerbraucht]);

  // Hervorhebung nach ~1,4 s wieder entfernen.
  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 1400);
    return () => clearTimeout(t);
  }, [flashId]);

  if (!vbMarkdown || !run) {
    return (
      <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">
        Keine Vorhabensbeschreibung geladen — „Neu aufbereiten".
      </div>
    );
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Gliederungs-Navigation */}
      {abschnitte.length > 0 ? (
        <nav className="hidden md:block w-56 shrink-0 sticky top-4 max-h-[74vh] overflow-y-auto pr-2">
          <div className="mb-2 text-[10.5px] uppercase tracking-wide text-[var(--tf-text-tertiary)]">Gliederung</div>
          <ul className="space-y-0.5">
            {abschnitte.map(a => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => scrolleZu(a.id)}
                  className="block w-full truncate rounded px-1.5 py-1 text-left text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]"
                  style={{ paddingLeft: `${(a.ebene - 1) * 12 + 6}px` }}
                  title={`${a.nummer ? `${a.nummer} ` : ''}${a.titel}`}
                >
                  {a.nummer ? <span className="text-[var(--tf-text-tertiary)]">{a.nummer} </span> : null}
                  {a.titel}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      {/* Lesepane */}
      <div ref={readerRef} className="min-w-0 flex-1 max-h-[74vh] overflow-y-auto pr-1">
        {abschnitte.length === 0 ? (
          <MarkdownRenderer content={vbMarkdown} />
        ) : (
          abschnitte.map(a => (
            <section
              key={a.id}
              data-sek={a.id}
              className="mb-4 scroll-mt-4 rounded-md px-2 -mx-2 transition-colors duration-500"
              style={flashId === a.id ? { backgroundColor: 'var(--tf-beleg-highlight)' } : undefined}
            >
              <MarkdownRenderer content={a.text || '*(kein Text erfasst)*'} />
            </section>
          ))
        )}
      </div>
    </div>
  );
}
