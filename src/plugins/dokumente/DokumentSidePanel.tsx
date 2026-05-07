import { useState } from 'react';
import { X, FolderOpen, FileText, Pin, ExternalLink, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useDokumenteStore } from './store';

const PANEL_WIDTH = 480;

export function DokumentSidePanel(): React.ReactElement | null {
  const { documents, selectedId, setSelectedId, pinned, togglePin, setViewingFullDoc } = useDokumenteStore();
  const [toast, setToast] = useState<string | null>(null);
  const meta = documents.find(d => d.id === selectedId);

  if (!meta) return null;

  const isPinned = pinned.has(meta.id);
  const showToast = (msg: string): void => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2400);
  };

  // Mockup: zeige bis zu 2 andere Docs als „verknüpft" (heuristisch — kommt
  // mit Phase-2 echt). Hier einfach die ersten anderen aus der Liste.
  const linkedMockup = documents.filter(d => d.id !== meta.id).slice(0, 2);

  return (
    <aside
      className="shrink-0 h-full overflow-y-auto"
      style={{ width: PANEL_WIDTH, borderLeft: '0.5px solid var(--tf-border)' }}
    >
      {/* Header */}
      <div
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-[var(--tf-bg)]"
        style={{ borderBottom: '0.5px solid var(--tf-border)' }}
      >
        <span className="text-[11px] uppercase tracking-wider text-[var(--tf-text-tertiary)]">
          Vorschau
        </span>
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer"
          aria-label="Vorschau schließen"
        >
          <X size={18} />
        </button>
      </div>

      <div className="px-5 py-5">
        {/* Title */}
        <h2 className="text-[16px] font-medium text-[var(--tf-text)] leading-snug">
          {meta.filename}
        </h2>

        {/* Pills: Format · vorgangId · Datum */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {meta.vorgangId ? <Pill text={meta.vorgangId} mono /> : null}
          <Pill text={meta.format.toUpperCase()} />
          <Pill text={new Date(meta.created).toLocaleDateString('de-DE')} />
        </div>

        {/* Action-Buttons */}
        <div className="flex flex-wrap gap-2 mt-5">
          <Button
            size="sm"
            onClick={() => setViewingFullDoc(true)}
          >
            <FolderOpen size={13} /> Öffnen
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!meta.vorgangId}
            onClick={() => showToast('Vorgangs-Verknüpfung kommt mit Phase-2-Doc-Index')}
            title={meta.vorgangId ? `Zum Vorgang ${meta.vorgangId}` : 'Kein Vorgang verknüpft'}
          >
            <ExternalLink size={13} /> Im Vorgang
          </Button>
          <Button
            size="sm"
            variant={isPinned ? 'default' : 'outline'}
            onClick={() => togglePin(meta.id)}
          >
            <Pin size={13} /> {isPinned ? 'Lösen' : 'Anheften'}
          </Button>
        </div>

        {/* KI-Zusammenfassung — Platzhalter */}
        <Section icon={<Sparkles size={11} />} label="Dokumentauffassung (KI)">
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)] italic leading-relaxed">
            Wird beim Dokumenten-Scan automatisch erstellt — Phase 2.
          </p>
        </Section>

        {/* Verknüpfte Dokumente — Mockup */}
        <Section icon={<FileText size={11} />} label="Verknüpfte Dokumente">
          {linkedMockup.length === 0 ? (
            <p className="text-[12.5px] text-[var(--tf-text-tertiary)] italic">
              Keine verknüpften Dokumente.
            </p>
          ) : (
            <div className="flex flex-col">
              {linkedMockup.map(d => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => showToast('Verknüpfungs-Logik folgt mit Phase-2')}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--tf-radius)] hover:bg-[var(--tf-hover)] cursor-pointer text-left"
                >
                  <FileText size={12} className="text-[var(--tf-text-tertiary)] shrink-0" />
                  <span className="text-[12.5px] text-[var(--tf-text)] truncate flex-1">{d.filename}</span>
                </button>
              ))}
              <p className="mt-2 text-[10.5px] text-[var(--tf-text-tertiary)] italic">
                Mockup — echte Verknüpfung folgt mit dem Dokumenten-Scan.
              </p>
            </div>
          )}
        </Section>
      </div>

      {toast ? (
        <div
          className="fixed bottom-4 right-4 z-[60] max-w-[320px] px-3 py-2 rounded-[var(--tf-radius-lg)] bg-[var(--tf-bg)] text-[12px] text-[var(--tf-text)] shadow-lg"
          style={{ border: '0.5px solid var(--tf-border)' }}
          role="status"
        >
          {toast}
        </div>
      ) : null}
    </aside>
  );
}

function Pill({ text, mono = false }: { text: string; mono?: boolean }): React.ReactElement {
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)] ${mono ? 'font-mono' : ''}`}
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      {text}
    </span>
  );
}

function Section({ icon, label, children }: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <div className="mt-6 pt-5" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
      <h3 className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider text-[var(--tf-text-secondary)] font-medium mb-2">
        <span className="text-[var(--tf-text-tertiary)]">{icon}</span>
        {label}
      </h3>
      {children}
    </div>
  );
}
