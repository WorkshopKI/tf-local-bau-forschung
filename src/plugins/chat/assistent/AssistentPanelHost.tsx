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
import { useZeilenAufgaben } from '@/core/hooks/useBestandsAufgaben';
import { useProfile } from '@/core/hooks/useProfile';
import { getOramaDB } from '@/core/services/search/orama-store';
import { beschreibeKontext } from '@/core/services/assistent/kontext';
import { useAutoGrow } from '@/core/hooks/useAutoGrow';
import { MessageList, type ActivePanel } from '../components/MessageList';
import { SourcePanel } from '../components/SourcePanel';
import { useAssistentController, ladeAssistentGedaechtnis } from './useAssistentController';
import { baueKontextSnapshot } from './kontextSnapshot';
import { folgefragen, fragenNachGruppe, type FragenKontext } from './fragenKatalog';
import { leseNutzerRolle } from './nutzerRolle';
import { useVorgangsakte } from './useVorgangsakte';
import { assistentPanelUiStore, clampPanelWidth, SPINE_WIDTH } from './panelUiStore';
import { AssistentSpine } from './AssistentSpine';
import '../chat.css';

/** Wie weit das Eingabefeld von selbst wächst; darüber zieht der Nutzer.
 *  Dieselbe Zahl wie im vollen Composer der Suche — ein Feld, das im Dock
 *  anders wächst als in der Suche, wäre eine Unterscheidung ohne Sache. */
const ASSISTENT_MAX_ZEILEN = 5;

export function AssistentPanelHost(): React.ReactElement | null {
  const open = useStore(assistentPanelUiStore, s => s.open);
  const width = useStore(assistentPanelUiStore, s => s.width);
  const setOpen = assistentPanelUiStore.getState().setOpen;

  // Der von aussen mitgegebene Vorgang (Tagesbrief) übersteuert die
  // Store-Selektion — für den Turn UND für den Chip, der ihn anzeigt.
  const vorgabeScope = useStore(assistentPanelUiStore, s => s.vorgabeScope);
  // Die To-do-Kaskade für den Faktenblock — `'nie'` heisst: NUR lesen, was schon
  // gerechnet ist. Das Panel ist auf jeder Route gemountet; einen Bestandslauf
  // (Sekunden, voller Antragsbestand) anzustossen, nur weil das Dock da ist, wäre
  // der falsche Handel. Liegt nichts vor, fällt der Faktenblock auf die alte
  // Status-Formel zurück und sagt das dazu — oder die Vorgangsakte trägt die
  // Aufgaben aller Regelsätze, dann entfällt der Rückfall.
  const heuteRef = useRef(new Date().toISOString());
  const zeilen = useZeilenAufgaben('nie', heuteRef.current);
  const location = useLocation();
  // Selektion abonnieren → Chips + Fragen reagieren auf Navigation/Auswahl.
  const sel = useAntraegeStore(s => `${s.selectedAktenzeichen ?? ''}|${s.selectedVerbundId ?? ''}`);

  const [activePanel, setActivePanel] = useState<ActivePanel | null>(null);
  const [input, setInput] = useState('');

  // Den geliehenen Vorgang beim Routenwechsel loslassen. Ein von der Startseite
  // mitgegebenes CALYPSO, das nach der Navigation zu einem ANDEREN Vorgang
  // weitergälte, ließe den Chip lügen — und der Chip ist die Zusage „nur das geht
  // ins Modell". Ref-Vergleich statt nackter Effekt: beim Mount ist nichts
  // gewechselt, und ein Löschen dort käme dem Öffnen von der Karte zuvor.
  const routeRef = useRef(location.key);
  useEffect(() => {
    if (routeRef.current === location.key) return;
    routeRef.current = location.key;
    assistentPanelUiStore.getState().scopeLoeschen();
  }, [location.key]);
  // Live-Zähler aktiver Gedächtnis-Einträge (Phase 2) für den Kontext-Chip.
  // Aktualisiert bei Öffnen/Navigation und nach jedem Turn (Konsolidierung kann
  // zwischenzeitlich Einträge geändert haben).
  const [gedAnzahl, setGedAnzahl] = useState(0);

  const snapshot = useMemo(
    () => baueKontextSnapshot(Date.now(), vorgabeScope, zeilen),
    [location.key, sel, open, vorgabeScope, zeilen],
  );
  const chips = beschreibeKontext(snapshot.entitaet, snapshot.routeBeschreibung);

  // Wer fragt (Fachrolle + Projektleitung) und was die App über den gesehenen
  // Vorgang weiß. Die Akte lädt nur bei offenem Dock.
  const { profile } = useProfile();
  const statusRolle = profile?.status_rolle;
  const projektleitung = profile?.projektleitung;
  const nutzer = useMemo(
    () => leseNutzerRolle({ status_rolle: statusRolle, projektleitung }),
    [statusRolle, projektleitung],
  );
  const akte = useVorgangsakte(snapshot.entitaet, open, heuteRef.current);
  const zusatz = useMemo(() => ({ akte, nutzer }), [akte, nutzer]);
  const c = useAssistentController(vorgabeScope, zeilen, zusatz);

  // Die Fragen, die der Assistent hier beantworten kann — reiner Katalog, jede
  // an ein Signal der Akte gebunden. Die Index-Präsenz ist wie bisher unreaktiv:
  // „Zusammenfassen" kann nach dem Laden des Index leicht verzögert erscheinen.
  const fragenKontext = useMemo<FragenKontext>(() => ({
    entitaet: snapshot.entitaet,
    routeBeschreibung: snapshot.routeBeschreibung,
    akte,
    nutzer,
    hatIndex: getOramaDB() !== null,
  }), [snapshot, akte, nutzer]);
  const abschnitte = useMemo(() => fragenNachGruppe(fragenKontext), [fragenKontext]);
  const gestellt = useMemo(
    () => c.messages.filter(m => m.role === 'user').map(m => m.content),
    [c.messages],
  );
  const weiter = useMemo(() => folgefragen(fragenKontext, gestellt), [fragenKontext, gestellt]);

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

  // Eine von aussen vorgelegte Frage (Tagesbrief: „dazu nachfragen") wird
  // abgeschickt — der Klick auf die Karte IST die Geste, wie bei den Fragen
  // unten. Erst entnehmen, dann senden: ein zweiter Lauf des Effekts findet den
  // Slot leer und schickt nicht doppelt. Läuft gerade eine Antwort, verwürfe
  // `absenden` die Frage wortlos — dann steht sie im Eingabefeld.
  const vorgabe = useStore(assistentPanelUiStore, s => s.vorgabe);
  useEffect(() => {
    const { vorgabe: frage, vorgabeVerbraucht } = assistentPanelUiStore.getState();
    if (frage === null) return;
    vorgabeVerbraucht();
    if (c.busy) setInput(frage);
    else absenden(frage);
  }, [vorgabe, absenden, c.busy]);

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
  const autoGrow = useAutoGrow(composerRef, input, ASSISTENT_MAX_ZEILEN);

  const empty = c.messages.length === 0 && !c.busy;
  // Folgefragen nur unter einer fertigen Antwort — nicht während sie entsteht,
  // und nicht unter einer Frage, deren Turn gescheitert ist.
  const letzte = c.messages[c.messages.length - 1];
  const zeigeWeiter = !empty && !c.busy && letzte?.role === 'assistant' && weiter.length > 0;

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
          {/* Kein Inline-Stil mehr: `height/minHeight` der Kette stehen seit
              v4.86 an `.convo` in chat.css — eine Quelle für beide Hosts. */}
          <div className="convo">
            <div className="convo-head">
              <span className="assistant-badge">Assistent</span>
              <div className="head-spacer" />
              <div className="head-actions">
                {/* Eine neue Unterhaltung erbt den geliehenen Vorgang nicht —
                    sonst spräche sie stumm weiter über den, nach dem gestern
                    gefragt wurde. */}
                <button className="icon-btn" title="Neue Unterhaltung" aria-label="Neue Unterhaltung"
                  onClick={() => { assistentPanelUiStore.getState().scopeLoeschen(); c.neueUnterhaltung(); }}>
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
                  <div className="fragen-gruppen">
                    {abschnitte.map(g => (
                      <div key={g.gruppe} className="fragen-gruppe">
                        <div className="fragen-titel">{g.titel}</div>
                        <div className="suggest-row">
                          {g.fragen.map(f => (
                            <button key={f.id} className="suggest" title={f.frage} onClick={() => absenden(f.frage)}>
                              {f.label}
                            </button>
                          ))}
                        </div>
                      </div>
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

            {zeigeWeiter && (
              <div className="folgefragen" role="group" aria-label="Weiter fragen">
                <span className="folgefragen-titel">Weiter fragen</span>
                {weiter.map(f => (
                  <button key={f.id} className="suggest" title={f.frage} onClick={() => absenden(f.frage)}>
                    {f.label}
                  </button>
                ))}
              </div>
            )}

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
                {/* `resize-y` + `useAutoGrow`: bis v4.86 stand hier `rows={2}`
                    ohne Mitwachsen — eine dritte Zeile war nur zu erahnen.
                    `max-h` ist die ZIEH-Grenze, der Auto-Deckel steckt in
                    ASSISTENT_MAX_ZEILEN. */}
                <textarea
                  ref={composerRef}
                  rows={2}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); absenden(input); }
                  }}
                  onPointerDown={autoGrow.onPointerDown}
                  placeholder="Frag zu deiner aktuellen Arbeit …"
                  aria-label="Frage an den Assistenten"
                  className="flex-1 min-w-0 max-h-[min(50vh,420px)] resize-y bg-transparent text-[length:var(--tf-text-base)] leading-[1.5] text-[var(--tf-text)] outline-none placeholder:text-[var(--tf-text-tertiary)]"
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
