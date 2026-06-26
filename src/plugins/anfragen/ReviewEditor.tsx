/**
 * Phase 6 — Review/Edit der anonymen Version + guard-gated Export.
 *
 * Der User darf den anonymisierten Text editieren. Der Export-Guard
 * (`pruefeExportSicher`) läuft LIVE bei jeder Änderung UND erneut bei jedem
 * Kopier-Klick auf dem TATSÄCHLICH zu kopierenden Text — sonst pasted der User
 * beim Editieren versehentlich einen echten Namen zurück, den der Guard nie
 * gesehen hat. „Kopieren" ist disabled, solange nicht `sicher`.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Copy, ExternalLink, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { getAnfragenDashboardUrl } from '@/config/feature-flags';
import { resolveAnfragenDashboardUrl } from './settings';
import { pruefeExportSicher } from './services/export-guard';
import { buildSegments } from './highlight';
import { useAnfragenStore } from './store';
import type { Anfrage } from './types';

interface Props {
  anfrage: Anfrage;
}

const BOX = 'w-full h-64 p-3 text-[12.5px] leading-[1.5] font-mono whitespace-pre-wrap break-words';

export function ReviewEditor({ anfrage }: Props): React.ReactElement {
  const storage = useStorage();
  const upsert = useAnfragenStore(s => s.upsert);
  const [text, setText] = useState(anfrage.anonymisiertMd);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  // URL override-aware auflösen (Share → IDB-Cache → Build-Default). Initial der
  // sync Build-Default, damit der Export-Link sofort einen href hat.
  const [dashboardUrl, setDashboardUrl] = useState(getAnfragenDashboardUrl());
  useEffect(() => {
    let cancelled = false;
    void resolveAnfragenDashboardUrl(storage.idb).then(u => { if (!cancelled) setDashboardUrl(u); });
    return () => { cancelled = true; };
  }, [storage]);

  // Reset bei Anfrage-Wechsel oder erneuter Anonymisierung (sonst bleibt alter Text stehen).
  useEffect(() => { setText(anfrage.anonymisiertMd); }, [anfrage.id, anfrage.anonymisiertMd]);

  const pruefung = useMemo(() => pruefeExportSicher(text, anfrage.mapping), [text, anfrage.mapping]);
  const segments = useMemo(() => buildSegments(text, pruefung.treffer), [text, pruefung.treffer]);
  const sicher = pruefung.sicher;

  const persistEdit = (): void => {
    if (text !== anfrage.anonymisiertMd) void upsert({ ...anfrage, anonymisiertMd: text }, storage);
  };

  const syncScroll = (): void => {
    if (backdropRef.current && taRef.current) {
      backdropRef.current.scrollTop = taRef.current.scrollTop;
      backdropRef.current.scrollLeft = taRef.current.scrollLeft;
    }
  };

  // Plain-Kopieren (ohne Dashboard). Guard erneut auf dem aktuellen Text.
  const kopieren = useAsyncAction(async () => {
    const pruef = pruefeExportSicher(text, anfrage.mapping);
    if (!pruef.sicher) throw new Error(`Export blockiert: noch ${pruef.treffer.length} mögliche PII-Treffer im Text.`);
    await navigator.clipboard.writeText(text);
    await upsert({ ...anfrage, anonymisiertMd: text, status: 'export_freigegeben' }, storage);
  });

  // Kombiniert: Guard → Clipboard → Dashboard-Tab (echter Link, Pop-up-Blocker-resistent).
  const onCombinedClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    const pruef = pruefeExportSicher(text, anfrage.mapping);
    if (!pruef.sicher) { e.preventDefault(); return; }
    void navigator.clipboard.writeText(text).catch(() => undefined);
    void upsert({ ...anfrage, anonymisiertMd: text, status: 'export_freigegeben' }, storage);
  };

  const trefferTypen = useMemo(() => Array.from(new Set(pruefung.treffer.map(t => t.typ))).join(', '), [pruefung.treffer]);

  return (
    <div className="mt-3">
      {/* Editor mit Live-Highlight (Backdrop hinter transparenter Textarea). */}
      <div className="relative rounded-[var(--tf-radius)] border border-[var(--tf-border)] overflow-hidden bg-[var(--tf-bg)]">
        <div
          ref={backdropRef}
          aria-hidden
          className={`${BOX} absolute inset-0 overflow-auto pointer-events-none`}
          style={{ color: 'transparent' }}
        >
          {segments.map((s, i) =>
            s.mark
              ? <mark key={i} style={{ background: 'var(--tf-danger-bg)', color: 'transparent', borderRadius: 2 }}>{s.text}</mark>
              : <span key={i}>{s.text}</span>,
          )}
          {/* Schlusszeilen-Umbruch spiegeln, damit Scrollhöhe matcht. */}
          {'\n'}
        </div>
        <textarea
          ref={taRef}
          value={text}
          onChange={e => setText(e.target.value)}
          onScroll={syncScroll}
          onBlur={persistEdit}
          spellCheck={false}
          className={`${BOX} relative resize-none bg-transparent text-[var(--tf-text)] outline-none`}
          style={{ caretColor: 'var(--tf-text)' }}
        />
      </div>

      {/* Leak-Status. */}
      {sicher ? (
        <p className="mt-2 text-[12px] text-[var(--tf-success-text)] flex items-center gap-1.5">
          <ShieldCheck size={13} /> Keine PII erkannt — Export möglich.
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-[var(--tf-danger-text)] flex items-center gap-1.5">
          <ShieldAlert size={13} /> {pruefung.treffer.length} mögliche PII-Treffer ({trefferTypen}) — Export blockiert, bitte im Text entfernen/ersetzen.
        </p>
      )}
      {kopieren.error && (
        <p className="mt-1 text-[12px] text-[var(--tf-danger-text)]">Fehler: {kopieren.error}</p>
      )}

      {/* Export-Buttons (disabled solange nicht sicher). */}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => kopieren.run()}
          disabled={!sicher || kopieren.busy}
          className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] border border-[var(--tf-border)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-colors"
        >
          <Copy size={12} /> {kopieren.busy ? 'Kopiere…' : 'In Zwischenablage kopieren'}
        </button>
        <a
          href={dashboardUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onCombinedClick}
          aria-disabled={!sicher}
          tabIndex={sicher ? 0 : -1}
          title="Öffnet den ZIM FAQ-Assistenten in einem neuen Tab. Voraussetzung: Internetzugang zu claude.ai + eingeloggter Claude-Account, sonst Login-Wall."
          className={`text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] bg-[var(--tf-text)] text-[var(--tf-bg)] flex items-center gap-1.5 transition-opacity ${
            sicher ? 'cursor-pointer hover:opacity-90' : 'opacity-40 cursor-not-allowed pointer-events-none'
          }`}
        >
          <ExternalLink size={12} /> Kopieren &amp; ZIM FAQ-Assistent öffnen
        </a>
      </div>
    </div>
  );
}
