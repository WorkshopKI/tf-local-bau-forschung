/**
 * Assistent-Panel (Phase 1) — shell-weites, rechts angedocktes Dock.
 *
 * Evolution des angedockten Chat-Panels: EINMAL im ShellLayout hinter
 * `isAssistentPanelEnabled()` gemountet, auf JEDER Route verfügbar (Suche wie
 * Antrag-/Verbund-Detail). Wiederverwendete Präsentation aus dem Chat
 * (`MessageList` inkl. [n]-Zitate + Quellen-Chips + „Verwendeter Kontext",
 * `SourcePanel`, chat.css). Historie ist session-only; Transport intern-only;
 * pro Turn resetChat; deterministischer Kontext (Chips = „nur das geht ins Modell").
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useStore } from 'zustand';
import { AlertTriangle, Brain, Loader2, RefreshCw, Send, Sparkles, SquarePen, X } from 'lucide-react';
import { useAntraegeStore } from '@/plugins/antraege/store';
import { getOramaDB } from '@/core/services/search/orama-store';
import { beschreibeKontext } from '@/core/services/assistent/kontext';
import { MessageList, type ActivePanel } from '../components/MessageList';
import { SourcePanel } from '../components/SourcePanel';
import { useAssistentController, ladeAssistentGedaechtnis } from './useAssistentController';
import { baueKontextSnapshot } from './kontextSnapshot';
import { quickActionsFuer } from './quickActions';
import { assistentPanelUiStore, clampPanelWidth, SPINE_WIDTH } from './panelUiStore';
import { AssistentSpine } from './AssistentSpine';
import '../chat.css';

export function AssistentPanelHost(): React.ReactElement | null {
  const open = useStore(assistentPanelUiStore, s => s.open);
  const width = useStore(assistentPanelUiStore, s => s.width);
  const setOpen = assistentPanelUiStore.getState().setOpen;

  const c = useAssistentController();
  const location = useLocation();
  // Selektion abonnieren → Chips + Beispiele reagieren auf Navigation/Auswahl.
  const sel = useAntraegeStore(s => `${s.selectedAktenzeichen ?? ''}|${s.selectedVerbundId ?? ''}`);

  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);
  const [input, setInput] = useState('');
  // Live-Zähler aktiver Gedächtnis-Einträge (Phase 2) für den Kontext-Chip.
  // Aktualisiert bei Öffnen/Navigation und nach jedem Turn (Konsolidierung kann
  // zwischenzeitlich Einträge geändert haben).
  const [gedAnzahl, setGedAnzahl] = useState(0);

  const snapshot = useMemo(() => baueKontextSnapshot(), [location.key, sel, open]);
  const chips = beschreibeKontext(snapshot.entitaet, snapshot.routeBeschreibung);
  // Routen-sensitive Quick Actions (Topf 1) statt statischer Beispielfragen: reiner
  // Katalog, die (unreine) Orama-Index-Präsenz wird hereingereicht. Index-Präsenz ist
  // wie bisher unreaktiv (kein Memo-Dep) — „Zusammenfassen" kann nach Index-Load leicht
  // verzögert erscheinen; Verhalten bewusst identisch zum bisherigen Beispiel-Memo. Die
  // Leiste ist nie leer (Katalog hält „Fristen" überall sichtbar).
  const aktionen = useMemo(
    () => quickActionsFuer({ ...snapshot, hatIndex: getOramaDB() !== null }),
    [snapshot],
  );

  // Gedächtnis-Zähler laden (nur bei aktivem Flag + beiden Opt-ins → sonst 0).
  useEffect(() => {
    if (!open) return;
    let abbruch = false;
    void ladeAssistentGedaechtnis().then(es => { if (!abbruch) setGedAnzahl(es.length); });
    return () => { abbruch = true; };
  }, [open, location.key, sel, c.messages.length]);

  // Fehler → die betroffene Frage zurück ins Eingabefeld (Historie bleibt leer).
  useEffect(() => { if (c.letzteFehlerFrage) setInput(c.letzteFehlerFrage); }, [c.letzteFehlerFrage]);
  // Quellen-Overlay beim Leeren der Unterhaltung schließen.
  useEffect(() => { if (c.messages.length === 0) setActivePanel(null); }, [c.messages.length]);

  const activeSrc = useMemo(() => {
    if (!activePanel) return null;
    const m = c.messages.find(x => x.id === activePanel.mid);
    return m?.sources?.find(s => s.n === activePanel.n) ?? null;
  }, [activePanel, c.messages]);

  const onCite = (mid: string, n: number): void => {
    setActivePanel(prev => (prev && prev.mid === mid && prev.n === n ? null : { mid, n }));
  };

  const absenden = useCallback((text: string): void => {
    const t = text.trim();
    if (!t || c.busy) return;
    setInput('');
    void c.send(t);
  }, [c]);

  const onRetry = useCallback((): void => {
    const q = c.letzteFehlerFrage;
    c.clearError();
    if (q) void c.send(q);
  }, [c]);

  const onRegenerate = useCallback((): void => {
    const lastUser = [...c.messages].reverse().find(m => m.role === 'user');
    if (lastUser) void c.send(lastUser.content);
  }, [c]);

  // Breite per Drag am linken Rand. Das Panel öffnet als Overlay LINKS neben der
  // Spine (Rechtskante bei innerWidth − SPINE_WIDTH), daher die Spine-Breite
  // abziehen — sonst driftet die gezogene Breite um SPINE_WIDTH.
  const onResize = useCallback((e: React.MouseEvent): void => {
    e.preventDefault();
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (ev: MouseEvent): void => {
      assistentPanelUiStore.getState().setWidth(clampPanelWidth(window.innerWidth - SPINE_WIDTH - ev.clientX));
    };
    const onUp = (): void => {
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  }, []);

  const composerRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (open) composerRef.current?.focus(); }, [open]);

  const empty = c.messages.length === 0 && !c.busy;

  // Die Spine (28px, rechter Blattrand) ist ein eigenes Bauteil — die Suche
  // trägt denselben Streifen für ihren Voll-Chat. Sie bleibt auch bei offenem
  // Panel stehen; das Panel legt sich als Overlay LINKS daneben
  // (right: SPINE_WIDTH). Das Blatt reserviert die SPINE_WIDTH (ShellLayout
  // `spineAktiv`) → keine Überlappung.
  return (
    <>
      <AssistentSpine open={open} onToggle={() => setOpen(!open)} />
      {open && (
      <div className="fixed top-0 z-[45] h-screen flex" style={{ width, right: SPINE_WIDTH }}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Assistent-Panel-Breite ändern"
        onMouseDown={onResize}
        className="shrink-0 w-[4px] h-full cursor-col-resize hover:bg-[var(--tf-border-hover)] transition-colors"
        style={{ borderLeft: '0.5px solid var(--tf-border)' }}
      />
      <div
        className="flex-1 min-w-0 h-full bg-[var(--tf-sheet)]"
        style={{ borderLeft: '0.5px solid var(--tf-border)', boxShadow: 'var(--tf-sheet-shadow)' }}
      >
        <div className="chat-app assistant-panel" style={{ height: '100%' }}>
          <div className="convo" style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div className="convo-head">
              <span className="assistant-badge">Assistent</span>
              <div className="head-spacer" />
              <div className="head-actions">
                <button className="icon-btn" title="Neue Unterhaltung" aria-label="Neue Unterhaltung"
                  onClick={() => c.neueUnterhaltung()}>
                  <SquarePen size={16} />
                </button>
                <button className="icon-btn" title="Assistent schließen" aria-label="Assistent schließen"
                  onClick={() => setOpen(false)}>
                  <X size={17} />
                </button>
              </div>
            </div>

            {/* Kontext-Chips: was der Assistent gerade „sieht" (Transparenz). */}
            <div className="assistant-ctxchip" title="Nur dieser Kontext geht ins Modell.">
              <Sparkles size={12} />
              <span>{chips}</span>
              {gedAnzahl > 0 && (
                <span
                  className="inline-flex items-center gap-1 ml-1 pl-2"
                  style={{ borderLeft: '0.5px solid var(--tf-border)' }}
                  title="Hintergrundwissen aus deinem Arbeitsgedächtnis (kann veraltet sein)."
                >
                  <Brain size={12} />
                  Gedächtnis: {gedAnzahl} {gedAnzahl === 1 ? 'Eintrag' : 'Einträge'}
                </span>
              )}
            </div>

            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
              {empty ? (
                <div className="empty">
                  <div className="empty-mark"><Sparkles size={22} /></div>
                  <h1 className="empty-title">Wie kann ich unterstützen?</h1>
                  <div className="empty-sub">
                    Ich kenne die aktuelle Ansicht und die dazugehörigen Dokumente — aber keine früheren Sitzungen.
                  </div>
                  <div className="suggest-row">
                    {aktionen.map(a => (
                      <button key={a.id} className="suggest" title={a.frage} onClick={() => absenden(a.frage)}>
                        {a.label}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <MessageList
                  messages={c.messages}
                  busy={c.busy}
                  error={null}
                  activePanel={activePanel}
                  onCite={onCite}
                  onRetry={onRetry}
                  onRegenerate={onRegenerate}
                  onFeedback={(mid, fb) => c.setFeedback(mid, fb)}
                />
              )}
            </div>

            {c.busy && (
              <div className="flex items-center gap-2 px-4 py-2 text-[13px] text-[var(--tf-text-tertiary)]">
                <Loader2 size={14} className="animate-spin" />Assistent denkt …
                {/* Auf der Bridge gibt es weder maxTokens noch Timeout — ohne diesen
                    Knopf ist eine lange Denkphase gar nicht zu beenden. */}
                <button
                  type="button"
                  className="ml-auto underline underline-offset-2 hover:text-[var(--tf-text)]"
                  onClick={() => c.abbrechen()}
                >
                  Abbrechen
                </button>
              </div>
            )}

            {c.resetWarnung && (
              <div className="flex items-start gap-2 mx-3 mb-1 px-3 py-2 text-[12px] rounded-[var(--tf-radius)] text-[var(--tf-warning-text)]"
                style={{ background: 'var(--tf-warning-bg, transparent)', border: '0.5px solid var(--tf-warning-text)' }}>
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <span>Frischer Chat nicht bestätigt — die Antwort könnte Kontext aus einem vorherigen KI-Chat enthalten.</span>
              </div>
            )}

            {c.error && (
              <div className="chat-error" style={{ margin: '0 12px 8px' }}>
                {c.error}
                <button onClick={onRetry}>
                  <RefreshCw size={13} style={{ verticalAlign: '-2px', marginRight: 4 }} />Erneut versuchen
                </button>
              </div>
            )}

            <div className="composer-wrap">
              <div className="flex items-end gap-2 rounded-[var(--tf-radius)] px-2 py-1.5"
                style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg)' }}>
                <textarea
                  ref={composerRef}
                  rows={2}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); absenden(input); }
                  }}
                  placeholder="Frag zu deiner aktuellen Arbeit …"
                  aria-label="Frage an den Assistenten"
                  className="flex-1 min-w-0 resize-none bg-transparent text-[length:var(--tf-text-base)] text-[var(--tf-text)] outline-none placeholder:text-[var(--tf-text-tertiary)]"
                />
                <button
                  type="button"
                  onClick={() => absenden(input)}
                  disabled={c.busy || input.trim().length === 0}
                  title="Senden (Enter)"
                  aria-label="Senden"
                  className="shrink-0 p-2 rounded-[var(--tf-radius)] bg-[var(--tf-primary)] text-white disabled:opacity-40 cursor-pointer disabled:cursor-default"
                >
                  <Send size={15} />
                </button>
              </div>
            </div>

            {activeSrc && <SourcePanel src={activeSrc} onClose={() => setActivePanel(null)} />}
          </div>
        </div>
      </div>
    </div>
      )}
    </>
  );
}
