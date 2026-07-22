/**
 * Lesemodus-Tab der Antrag-Aufbereitung: liest die VB als navigierbares Dokument
 * (ziehbare Gliederungsspalte links, Lesepane rechts). Jeder Abschnitt trägt
 * seine `sektionId` als `data-sek`-Anker → eine Fundstelle aus einem anderen Tab
 * („Im Antrag öffnen") scrollt hierher und hebt die Stelle kurz hervor. Ein
 * IntersectionObserver hält den aktuellen Viewport-Abschnitt fest (Aktiv-Zeile der
 * Gliederung). Fundstellen-Marginalien zeigen je Abschnitt, welche Bausteine ihn
 * referenzieren (Popover). Rendering über den geteilten `MarkdownRenderer`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import type { AufbereitungRun } from './types';
import { sliceLesemodus } from './lesemodus';
import { useTocBreite, TOC_DEFAULT_BREITE } from './useTocBreite';
import type { FundstelleReferenz } from './lesemodus-fundstellen';

export function LesemodusTab({
  run, vbMarkdown, sprungZiel, onVerbraucht, fundstellen,
}: {
  run: AufbereitungRun | null;
  vbMarkdown: string | null;
  /** Sektions-ID, zu der beim Öffnen gesprungen werden soll (aus einer Fundstelle). */
  sprungZiel: string | null;
  /** Meldet dem Seitenrahmen, dass das Sprungziel verbraucht ist (State zurücksetzen). */
  onVerbraucht: () => void;
  /** Fundstellen je Sektions-ID (Baustein-Referenzen) — Marginalien-Marker. */
  fundstellen: Map<string, FundstelleReferenz[]>;
}): React.ReactElement {
  const abschnitte = useMemo(
    () => (run && vbMarkdown ? sliceLesemodus(vbMarkdown, run.gliederung) : []),
    [run, vbMarkdown],
  );
  const readerRef = useRef<HTMLDivElement>(null);
  const { breite: tocBreite, rowRef, griffProps } = useTocBreite();
  const [flashId, setFlashId] = useState<string | null>(null);
  const [aktiveSektionId, setAktiveSektionId] = useState<string | null>(null);
  const [fundstellenOffen, setFundstellenOffen] = useState<string | null>(null);

  const scrolleZu = (id: string): void => {
    const el = readerRef.current?.querySelector(`[data-sek="${CSS.escape(id)}"]`);
    if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFlashId(id);
  };

  // Sprung aus einer Fundstelle (anderer Tab → Lesemodus): scrollen + kurz hervorheben.
  useEffect(() => {
    if (!sprungZiel) return;
    scrolleZu(sprungZiel);
    onVerbraucht();
  }, [sprungZiel, onVerbraucht]);

  useEffect(() => {
    if (!flashId) return;
    const t = setTimeout(() => setFlashId(null), 1400);
    return () => clearTimeout(t);
  }, [flashId]);

  // Aktueller Viewport-Abschnitt (für die Silhouette-Hervorhebung + Gliederungs-Aktiv-Zeile).
  const sichtbarRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const root = readerRef.current;
    if (!root || abschnitte.length === 0) return;
    sichtbarRef.current = new Set();
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const id = (e.target as HTMLElement).dataset.sek;
          if (!id) continue;
          if (e.isIntersecting) sichtbarRef.current.add(id); else sichtbarRef.current.delete(id);
        }
        const oberste = abschnitte.find(a => sichtbarRef.current.has(a.id));
        if (oberste) setAktiveSektionId(oberste.id);
      },
      { root, rootMargin: '0px 0px -60% 0px', threshold: 0 },
    );
    root.querySelectorAll('[data-sek]').forEach(el => obs.observe(el));
    return () => obs.disconnect();
  }, [abschnitte]);

  if (!vbMarkdown || !run) {
    return (
      <div className="py-16 text-center text-[13px] text-[var(--tf-text-tertiary)]">
        Keine Vorhabensbeschreibung geladen — „Neu aufbereiten".
      </div>
    );
  }

  return (
    <div
      ref={rowRef}
      className="flex gap-2 items-start"
      style={{ '--lm-toc-breite': `${tocBreite}px` } as React.CSSProperties}
    >
      {/* Gliederungs-Navigation (Breite ziehbar, gerätelokal gemerkt) */}
      {abschnitte.length > 0 ? (
        <nav
          className="hidden md:block shrink-0 sticky top-4 max-h-[74vh] overflow-y-auto pr-2"
          style={{ width: `var(--lm-toc-breite, ${TOC_DEFAULT_BREITE}px)` }}
        >
          <div className="mb-2 text-[10.5px] uppercase tracking-wide text-[var(--tf-text-tertiary)]">Gliederung</div>
          <ul className="space-y-0.5">
            {abschnitte.map(a => (
              <li key={a.id}>
                <button
                  type="button"
                  onClick={() => scrolleZu(a.id)}
                  className={cn(
                    'block w-full truncate rounded px-1.5 py-1 text-left text-[12px] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]',
                    a.id === aktiveSektionId ? 'bg-[var(--tf-hover)] text-[var(--tf-text)] font-medium' : 'text-[var(--tf-text-secondary)]',
                  )}
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

      {/* Trenn-Griff: zieht die rechte Kante der Gliederung. */}
      {abschnitte.length > 0 ? (
        <div
          {...griffProps}
          className="group hidden md:flex self-stretch w-2 shrink-0 cursor-col-resize items-start justify-center focus:outline-none"
        >
          <span className="mt-8 h-10 w-[3px] rounded-full bg-[var(--tf-border)] transition-colors group-hover:bg-[var(--tf-primary)] group-focus-visible:bg-[var(--tf-primary)]" />
        </div>
      ) : null}

      {/* Lesepane */}
      <div ref={readerRef} className="min-w-0 flex-1 max-h-[74vh] overflow-y-auto pr-1">
        {abschnitte.length === 0 ? (
          <MarkdownRenderer content={vbMarkdown} />
        ) : (
          abschnitte.map(a => {
            const refs = fundstellen.get(a.id) ?? [];
            return (
              <section
                key={a.id}
                data-sek={a.id}
                className="relative mb-4 scroll-mt-4 rounded-md px-2 -mx-2 transition-colors duration-500"
                style={flashId === a.id ? { backgroundColor: 'var(--tf-beleg-highlight)' } : undefined}
              >
                {refs.length > 0 ? (
                  <FundstellenMarker
                    refs={refs}
                    offen={fundstellenOffen === a.id}
                    onToggle={() => setFundstellenOffen(prev => (prev === a.id ? null : a.id))}
                  />
                ) : null}
                <MarkdownRenderer content={a.text || '*(kein Text erfasst)*'} />
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}

/** Marginalien-Marker: Zähler-Badge am Abschnittskopf; Klick → Popover mit den Referenzen. */
function FundstellenMarker({ refs, offen, onToggle }: { refs: FundstelleReferenz[]; offen: boolean; onToggle: () => void }): React.ReactElement {
  return (
    <div className="absolute right-1 top-1 z-10">
      <button
        type="button"
        onClick={onToggle}
        title={`${refs.length} Baustein-Fundstelle(n)`}
        aria-label={`${refs.length} Fundstellen anzeigen`}
        className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10.5px] text-[var(--tf-text-secondary)] bg-[var(--tf-bg-secondary)] hover:text-[var(--tf-text)]"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        ⌖ {refs.length}
      </button>
      {offen ? (
        <div
          className="absolute right-0 mt-1 w-64 max-h-64 overflow-auto rounded-lg p-2 text-[12px] shadow-lg z-20 bg-[var(--tf-bg)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        >
          <div className="mb-1 text-[10.5px] uppercase tracking-wide text-[var(--tf-text-tertiary)]">Fundstellen in diesem Abschnitt</div>
          <ul className="flex flex-col gap-1">
            {refs.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5">
                <span className="shrink-0 rounded px-1 py-0.5 text-[10px] text-[var(--tf-text-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>{r.label}</span>
                <span className="min-w-0 text-[var(--tf-text-secondary)]">{r.kurztext}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
