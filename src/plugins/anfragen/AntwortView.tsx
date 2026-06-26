/**
 * View 2 „Antwort einsetzen" (Layout A) — anonyme Antwort ↔ finale Antwort
 * nebeneinander. Absorbiert die frühere `RueckimportFinalisierung` (Textarea +
 * Finalisieren) und `FinaleAntwortAusgabe` (Kopieren/Mailto).
 *
 * Die Finale ist BEWUSST de-anonymisiert (echte Originaldaten, kein externer
 * Leak) → läuft NICHT durch pruefeExportSicher; die Clipboard-Zeile ist per
 * `// allow-anfrage-export:` von der Export-Guard-Konvention ausgenommen.
 */
import { useEffect, useMemo, useState } from 'react';
import { Eye, Rows, ArrowRight, Check, Copy, Mail } from 'lucide-react';
import { useStorage } from '@/core/hooks/useStorage';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { pruefePlatzhalter, finalisiere, polishAntwort, wiedereinsetzenSegmente } from './services/finalisierung';
import { buildMailto, mailtoBodyZuLang } from './services/mailto';
import { MARK_CLASS } from './highlight';
import { AwdToggle } from './AwdToggle';
import { useSyncedPaneHeight } from './useSyncedPaneHeight';
import { useAnfragenStore } from './store';
import { statusErreicht, statusIndex } from './status';
import type { Anfrage } from './types';

interface Props {
  anfrage: Anfrage;
  highlight: boolean;
  onToggleHighlight: () => void;
}

function ResizerGrip(): React.ReactElement {
  return (
    <svg viewBox="0 0 26 9" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path d="M4 3h18M4 6h18" />
    </svg>
  );
}

export function AntwortView({ anfrage, highlight, onToggleHighlight }: Props): React.ReactElement {
  const storage = useStorage();
  const bridge = useAIBridge();
  const upsert = useAnfragenStore(s => s.upsert);

  const [pasteText, setPasteText] = useState(anfrage.externeAntwortAnon);
  const [polishOn, setPolishOn] = useState(false);
  const [stacked, setStacked] = useState(false);
  const { height, onResizerPointerDown } = useSyncedPaneHeight('anfragen-pane-h-answer');

  useEffect(() => { setPasteText(anfrage.externeAntwortAnon); }, [anfrage.id, anfrage.externeAntwortAnon]);

  const exportFrei = statusErreicht(anfrage.status, 'export_freigegeben');
  const istFinalisiert = statusErreicht(anfrage.status, 'finalisiert');

  const validierung = useMemo(() => pruefePlatzhalter(pasteText, anfrage.mapping), [pasteText, anfrage.mapping]);
  const liveSegs = useMemo(() => wiedereinsetzenSegmente(pasteText, anfrage.mapping), [pasteText, anfrage.mapping]);
  const liveText = useMemo(() => liveSegs.map(s => s.text).join(''), [liveSegs]);

  // Kopieren/Mailto: persistierte (ggf. geglättete) Fassung wenn finalisiert, sonst Live-Einsetzung.
  const finalText = istFinalisiert && anfrage.finaleAntwort ? anfrage.finaleAntwort : liveText;
  const zuLang = useMemo(() => mailtoBodyZuLang(finalText), [finalText]);
  const mailtoUrl = useMemo(() => buildMailto(anfrage.absenderEmail, anfrage.betreff, finalText), [anfrage.absenderEmail, anfrage.betreff, finalText]);
  const kannMailen = !!anfrage.absenderEmail && !zuLang && !!finalText;

  const persistAntwort = (): void => {
    if (pasteText === anfrage.externeAntwortAnon) return;
    const raise = !!pasteText.trim() && statusIndex(anfrage.status) < statusIndex('antwort_importiert');
    void upsert(
      raise
        ? { ...anfrage, externeAntwortAnon: pasteText, status: 'antwort_importiert' }
        : { ...anfrage, externeAntwortAnon: pasteText },
      storage,
    );
  };

  const finalisieren = useAsyncAction(async () => {
    const polish = polishOn ? (anon: string) => polishAntwort(bridge, anon) : undefined;
    const finaleAntwort = await finalisiere(pasteText, anfrage.mapping, polish);
    await upsert({ ...anfrage, externeAntwortAnon: pasteText, finaleAntwort, status: 'finalisiert' }, storage);
  });

  const kopierenFinal = useAsyncAction(async () => {
    await navigator.clipboard.writeText(finalText); // allow-anfrage-export: de-anonymisierte Antwort an Original-Absender (kein externer Leak)
  });

  if (!exportFrei) {
    return (
      <div className="awd-view">
        <div className="awd-view-scroll">
          <p className="px-[var(--awd-px)] pt-6 text-[12.5px] text-[var(--tf-text-tertiary)]">
            Zuerst den anonymisierten Text exportieren (Schritt 3: „Export freigegeben"), danach hier die
            externe Antwort einfügen und finalisieren.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="awd-view">
      <div className="awd-view-scroll">
        <div className="awd-pairhead">
          <span className="awd-label">Antwort einsetzen</span>
          <span className="awd-pairhead-sub">anonyme Antwort ↔ finale Antwort</span>
          <div className="awd-controls">
            <AwdToggle on={highlight} onClick={onToggleHighlight} Icon={Eye} label="Hervorheben" />
            <AwdToggle on={stacked} onClick={() => setStacked(v => !v)} Icon={Rows} label="Untereinander" />
          </div>
        </div>

        <div className={`awd-pair${stacked ? ' stacked' : ''}`}>
          <div className="awd-colside">
            <div className="awd-sh">
              <ArrowRight size={13} /> Anonyme Antwort (aus LLM einfügen)
            </div>
            <textarea
              className="awd-pane mono awd-pane-ta"
              style={{ height }}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
              onBlur={persistAntwort}
              spellCheck={false}
              placeholder="Anonymisierte Antwort aus dem ZIM FAQ-Assistenten hier einfügen (muss die Platzhalter [TYP_N] enthalten) …"
            />
          </div>

          <div className="awd-colside">
            <div className="awd-sh">
              <Check size={13} /> Finale Antwort
              {!!finalText && <span className="awd-badge ok"><span className="awd-bdot" /> Originaldaten eingesetzt</span>}
            </div>
            <div className="awd-pane" style={{ height }}>
              {pasteText.trim()
                ? liveSegs.map((s, i) =>
                    highlight && s.kind
                      ? <mark key={i} className={MARK_CLASS[s.kind]}>{s.text}</mark>
                      : <span key={i}>{s.text}</span>,
                  )
                : <span className="awd-empty">— noch keine Antwort eingefügt —</span>}
            </div>
          </div>
        </div>

        <div className="awd-resizer" onPointerDown={onResizerPointerDown} title="Höhe ziehen (beide Spalten)">
          <ResizerGrip />
        </div>

        {pasteText.trim() && (validierung.fehlend.length > 0 || validierung.unbekannt.length > 0) && (
          <div className="awd-warnrow">
            {validierung.fehlend.length > 0 && (
              <div>⚠ {validierung.fehlend.length} Platzhalter im Mapping, aber nicht in der Antwort verwendet (werden nicht eingesetzt): <code>{validierung.fehlend.join(' · ')}</code></div>
            )}
            {validierung.unbekannt.length > 0 && (
              <div>Unbekannte Platzhalter (bleiben im Text stehen): <code>{validierung.unbekannt.join(' · ')}</code></div>
            )}
          </div>
        )}

        {finalisieren.error && (
          <p className="px-[var(--awd-px)] pt-2 text-[11.5px] text-[var(--tf-danger-text)]">Fehler: {finalisieren.error}</p>
        )}
      </div>

      <div className="awd-actbar">
        <label className="awd-check">
          <input type="checkbox" checked={polishOn} onChange={e => setPolishOn(e.target.checked)} /> Vor dem Einsetzen intern glätten
        </label>
        <button
          type="button"
          onClick={() => finalisieren.run()}
          disabled={!pasteText.trim() || finalisieren.busy}
          className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] bg-[var(--tf-text)] text-[var(--tf-bg)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-opacity hover:opacity-90"
        >
          <Check size={14} /> {finalisieren.busy ? 'Finalisiere…' : 'Finalisieren (Originaldaten einsetzen)'}
        </button>
        <span className="awd-sp" />
        <button
          type="button"
          onClick={() => kopierenFinal.run()}
          disabled={!finalText || kopierenFinal.busy}
          className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] border border-[var(--tf-border)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 transition-colors"
        >
          <Copy size={14} /> {kopierenFinal.busy ? 'Kopiere…' : 'Finale Antwort kopieren'}
        </button>
        {kannMailen ? (
          <a
            href={mailtoUrl}
            className="text-[12px] px-3 py-1.5 rounded-[var(--tf-radius)] border border-[var(--tf-border)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer flex items-center gap-1.5 transition-colors"
            title="Öffnet einen Mail-Entwurf an den Original-Absender (Re: …)."
          >
            <Mail size={14} /> Antwort-Mail öffnen
          </a>
        ) : (
          <span className="awd-note">
            <Mail size={12} />
            {!anfrage.absenderEmail ? 'Keine Absender-Adresse — bitte kopieren.' : 'Antwort zu lang für Direkt-Mail — bitte kopieren & einfügen.'}
          </span>
        )}
        {kopierenFinal.error && <span className="awd-note" style={{ color: 'var(--tf-danger-text)' }}>Fehler: {kopierenFinal.error}</span>}
      </div>
    </div>
  );
}
