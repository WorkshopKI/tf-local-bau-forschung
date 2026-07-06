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
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { Button } from '@/components/ui/button';
import { pruefePlatzhalter, finalisiere, wiedereinsetzenSegmente } from './services/finalisierung';
import { buildMailtoLeer } from './services/mailto';
import { copyAntwortReich } from './services/clipboard';
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

/** Weicher inhaltlicher Längen-Hinweis (≈ 0,5 A4) — reiner Hinweis, kein Blocker. */
const MAX_ANTWORT_ZEICHEN = 1800;

function ResizerGrip(): React.ReactElement {
  return (
    <svg viewBox="0 0 26 9" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path d="M4 3h18M4 6h18" />
    </svg>
  );
}

export function AntwortView({ anfrage, highlight, onToggleHighlight }: Props): React.ReactElement {
  const storage = useStorage();
  const upsert = useAnfragenStore(s => s.upsert);

  const [pasteText, setPasteText] = useState(anfrage.externeAntwortAnon);
  const [kopiert, setKopiert] = useState(false);
  const [stacked, setStacked] = useState(false);
  const { height, onResizerPointerDown } = useSyncedPaneHeight('anfragen-pane-h-answer');

  useEffect(() => { setPasteText(anfrage.externeAntwortAnon); }, [anfrage.id, anfrage.externeAntwortAnon]);

  const exportFrei = statusErreicht(anfrage.status, 'export_freigegeben');
  const istFinalisiert = statusErreicht(anfrage.status, 'finalisiert');

  const validierung = useMemo(() => pruefePlatzhalter(pasteText, anfrage.mapping), [pasteText, anfrage.mapping]);
  const liveSegs = useMemo(() => wiedereinsetzenSegmente(pasteText, anfrage.mapping), [pasteText, anfrage.mapping]);
  const liveText = useMemo(() => liveSegs.map(s => s.text).join(''), [liveSegs]);

  // Kopieren/Mailto: persistierte Fassung wenn finalisiert, sonst Live-Einsetzung.
  const finalText = istFinalisiert && anfrage.finaleAntwort ? anfrage.finaleAntwort : liveText;
  const kannMailen = !!anfrage.absenderEmail && !!finalText;

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
    const finaleAntwort = await finalisiere(pasteText, anfrage.mapping);
    await upsert({ ...anfrage, externeAntwortAnon: pasteText, finaleAntwort, status: 'finalisiert' }, storage);
  });

  const kopierenFinal = useAsyncAction(async () => {
    await copyAntwortReich(finalText);
    setKopiert(true);
    setTimeout(() => setKopiert(false), 1500);
  });

  const kopierenUndMail = useAsyncAction(async () => {
    await copyAntwortReich(finalText);
    setKopiert(true);
    setTimeout(() => setKopiert(false), 1500);
    window.location.href = buildMailtoLeer(anfrage.absenderEmail, anfrage.betreff);
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

        {pasteText.trim() && validierung.fehlend.length > 0 && (
          <div className="awd-warnrow awd-warnrow-strong">
            <strong>⚠ {validierung.fehlend.length} Platzhalter fehlen in der Antwort</strong> — vermutlich von der
            externen KI aufgelöst statt erhalten. Diese Originaldaten werden <strong>NICHT</strong> eingesetzt.
            Antwort erneut anfordern und auf Platzhalter-Erhalt achten: <code>{validierung.fehlend.join(' · ')}</code>
          </div>
        )}
        {pasteText.trim() && validierung.unbekannt.length > 0 && (
          <div className="awd-warnrow">
            Unbekannte Platzhalter (bleiben im Text stehen): <code>{validierung.unbekannt.join(' · ')}</code>
          </div>
        )}

        {finalText.length > MAX_ANTWORT_ZEICHEN && (
          <div className="awd-lenhint">
            Antwort länger als ~0,5 A4 ({finalText.length} Zeichen) — ggf. kürzer anfordern.
          </div>
        )}

        {finalisieren.error && (
          <p className="px-[var(--awd-px)] pt-2 text-[11.5px] text-[var(--tf-danger-text)]">Fehler: {finalisieren.error}</p>
        )}
      </div>

      <div className="awd-actbar">
        <Button variant="primary" icon={Check} loading={finalisieren.busy} disabled={!pasteText.trim()} onClick={() => finalisieren.run()}>
          Finalisieren (Originaldaten einsetzen)
        </Button>
        <span className="awd-sp" />
        <Button variant="secondary" icon={kopiert ? Check : Copy} loading={kopierenFinal.busy} disabled={!finalText} onClick={() => kopierenFinal.run()}>
          {kopiert ? 'Kopiert!' : 'Finale Antwort kopieren'}
        </Button>
        {kannMailen ? (
          <Button variant="secondary" icon={Mail} loading={kopierenUndMail.busy} disabled={!finalText} onClick={() => kopierenUndMail.run()} title="Kopiert die formatierte Antwort und öffnet einen adressierten Mail-Entwurf (Re: …) — dann mit Strg+V einfügen.">
            Kopieren & Mail öffnen
          </Button>
        ) : (
          <span className="awd-note">
            <Mail size={12} /> Keine Absender-Adresse — bitte kopieren.
          </span>
        )}
        {(kopierenFinal.error || kopierenUndMail.error) && (
          <span className="awd-note" style={{ color: 'var(--tf-danger-text)' }}>Fehler: {kopierenFinal.error || kopierenUndMail.error}</span>
        )}
      </div>
    </div>
  );
}
