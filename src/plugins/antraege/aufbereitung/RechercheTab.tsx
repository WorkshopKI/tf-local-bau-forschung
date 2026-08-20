/**
 * Recherche-Tab (Paket 5). Vier Abschnitte:
 *  1. „Deep Research starten": der intern erzeugte, anonyme DR-Auftrag (Leak-geprüft) —
 *     als gerenderte Markdown-Vorschau, per Stift bearbeitbar, Review-Hinweis +
 *     „Kopieren & ChatGPT/Claude/Mistral öffnen". Bei Leak-Degradation nur einsehbar
 *     (kein Copy) — Bearbeiten bleibt offen, denn genau dort ist es der Rettungspfad:
 *     Angabe entfernen → erneuter Leak-Check → wieder freigegeben.
 *  2. „Marktzugang des KMU" (kurator-gated, Default AUS): bewusst identifizierendes,
 *     deterministisches Template aus Stammdaten (kein LLM, kein VB-Inhalt) mit
 *     Bestätigung vor dem Kopieren + Run-Stempel.
 *  3. „Ergebnis zurückbringen": Import der externen DR-Ergebnisse (Phase 2) — Text
 *     einfügen ODER Dateien ablegen/auswählen (PDF/Word/Markdown/Text, auch mehrere;
 *     Markdown, weil ChatGPT Deep Research den Report inzwischen so herunterlädt).
 *  4. „Einzel-Suchanfragen": die bisherigen deterministischen Suchanfragen (eingeklappt).
 *
 * DSGVO: externe Dienste erreicht ausschließlich der Nutzer per Zwischenablage +
 * geöffneter Seite — KEIN API-Call. Reihenfolge dabei zwingend erst kopieren, dann
 * öffnen (`kopieren.ts`) — sonst kann der Fokuswechsel den Kopier-Aufruf still
 * verwerfen und im Chat landet der alte Inhalt der Zwischenablage.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Prec } from '@codemirror/state';
import { keymap, type EditorView } from '@codemirror/view';
import { Copy, ExternalLink, Search, AlertTriangle, ChevronDown, Trash2, FileText, Pencil, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FileDropZone } from '@/components/ui/FileDropZone';
import { MarkdownRenderer } from '@/components/ui/MarkdownRenderer';
import { MarkdownEditor } from '@/components/ui/MarkdownEditor';
import { markdownLivePreview } from '@/components/ui/markdownLivePreview';
import { WennSichtbar } from '@/components/sichtbarkeit';
import { abschnittId } from '@/core/sichtbarkeit';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { useKopierAktion } from '@/core/hooks/useKopierAktion';
import { getAufbereitungDrUrls } from '@/config/feature-flags';
import type { SteckbriefDaten } from './steckbrief';
import { normalisiereAuftragstext, parseRecherchePrompt, type RecherchePromptDaten } from './recherche-prompt';
import { IMPORT_ACCEPT, teileImportDateien } from './recherche-import';
import { kopiereText } from '@/core/utils/kopieren';
import { StichworteEditor } from './StichworteEditor';
import type { RechercheStichworte } from './recherche-stichworte';
import type { BekannteStammwerte } from './recherche-leak';
import type { AufbereitungRun, ExterneRecherche } from './types';
import type { BausteinUiState } from './useAufbereitung';
import { baueRechercheAnfragen, baueMarktzugangText, type RechercheStammdaten } from './recherche';
import { resolveAufbereitungSettings, type EffektiveAufbereitungSettings } from './aufbereitung-settings';

interface Props {
  recherchePrompt: BausteinUiState<RecherchePromptDaten>;
  run: AufbereitungRun | null;
  steckbrief: BausteinUiState<SteckbriefDaten>;
  stammdaten: RechercheStammdaten;
  bausteine: UseAsyncActionResult<[]>;
  onMarktzugangKopiert: () => void;
  importText: UseAsyncActionResult<[string, string?]>;
  importDatei: UseAsyncActionResult<[File[], ((fertig: number, gesamt: number) => void)?]>;
  loescheImport: UseAsyncActionResult<[number]>;
  speichereDrPrompt: UseAsyncActionResult<[string]>;
  speichereDrStichworte: UseAsyncActionResult<[RechercheStichworte]>;
  verwerfeDrPromptEdit: UseAsyncActionResult<[]>;
  /** Identifizierende Stammwerte — der Chip-Editor prüft Eingaben gegen dieselbe Regel. */
  bekannteWerte: BekannteStammwerte;
}

export function RechercheTab({ recherchePrompt, run, steckbrief, stammdaten, bausteine, onMarktzugangKopiert, importText, importDatei, loescheImport, speichereDrPrompt, speichereDrStichworte, verwerfeDrPromptEdit, bekannteWerte }: Props): React.ReactElement {
  const storage = useStorage();
  const [settings, setSettings] = useState<EffektiveAufbereitungSettings>(() => ({
    drUrls: getAufbereitungDrUrls(),
    marktzugangAktiv: false,
  }));
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const s = await resolveAufbereitungSettings(storage.idb).catch(() => null);
      if (!cancelled && s) setSettings(s);
    })();
    return () => { cancelled = true; };
  }, [storage.idb]);

  return (
    <div className="flex flex-col gap-5 max-w-[860px]">
      {/* Die vier Karten sind einzeln kennzeichenbar (Beta/Experte). Sie bringen
          ihren eigenen Rahmen mit — deshalb die nackte `WennSichtbar`-Hülle und
          keine Karten-Komponente wie in der Übersicht. */}
      <WennSichtbar id={abschnittId('aufbereitung', 'karte-deep-research')}>
        <DeepResearchStart
          recherchePrompt={recherchePrompt}
          bausteine={bausteine}
          drUrls={settings.drUrls}
          speichern={speichereDrPrompt}
          speichereStichworte={speichereDrStichworte}
          verwerfen={verwerfeDrPromptEdit}
          bekannteWerte={bekannteWerte}
        />
      </WennSichtbar>
      {settings.marktzugangAktiv ? (
        <WennSichtbar id={abschnittId('aufbereitung', 'karte-marktzugang')}>
          <Marktzugang stammdaten={stammdaten} run={run} mistralUrl={settings.drUrls.mistral} onKopiert={onMarktzugangKopiert} />
        </WennSichtbar>
      ) : null}
      <WennSichtbar id={abschnittId('aufbereitung', 'karte-ergebnis-import')}>
        <ErgebnisZurueckbringen run={run} importText={importText} importDatei={importDatei} loescheImport={loescheImport} />
      </WennSichtbar>
      <WennSichtbar id={abschnittId('aufbereitung', 'karte-einzelanfragen')}>
        <EinzelSuchanfragen steckbrief={steckbrief} stammdaten={stammdaten} />
      </WennSichtbar>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1 — Deep Research starten
// ---------------------------------------------------------------------------

/**
 * Der anzuzeigende Auftragstext einer Baustein-Fassung — normalisiert, damit auch
 * VOR dem Patch gecachte Einträge mit literalen `\n` lesbar rendern (die Normalisierung
 * in `parseRecherchePrompt` greift erst für neue Läufe).
 */
function auftragstextVon(z: BausteinUiState<RecherchePromptDaten>): string {
  const roh = z.daten?.prompt
    ?? (z.rohtext ? parseRecherchePrompt(z.rohtext)?.prompt ?? '' : '');
  return normalisiereAuftragstext(roh);
}

function DeepResearchStart({
  recherchePrompt, bausteine, drUrls, speichern, speichereStichworte, verwerfen, bekannteWerte,
}: {
  recherchePrompt: BausteinUiState<RecherchePromptDaten>;
  bausteine: UseAsyncActionResult<[]>;
  drUrls: { chatgpt: string; claude: string; mistral: string };
  speichern: UseAsyncActionResult<[string]>;
  speichereStichworte: UseAsyncActionResult<[RechercheStichworte]>;
  verwerfen: UseAsyncActionResult<[]>;
  bekannteWerte: BekannteStammwerte;
}): React.ReactElement {
  const s = recherchePrompt.status;
  const [editing, setEditing] = useState(false);
  const prompt = useMemo(() => auftragstextVon(recherchePrompt), [recherchePrompt]);
  // Editor erst schliessen, wenn die Übernahme durch ist UND nicht gescheitert ist —
  // `UseAsyncActionResult.run` schluckt Fehler in den `error`-State, ein `await` allein
  // sagt also nichts über Erfolg. Der Leak-Fall gilt als Erfolg (Fassung übernommen,
  // nur gesperrt) und schliesst den Editor bewusst: die Warnung steht darunter.
  const wartetRef = useRef(false);
  useEffect(() => {
    if (!wartetRef.current || speichern.busy) return;
    wartetRef.current = false;
    if (!speichern.error) setEditing(false);
  }, [speichern.busy, speichern.error]);
  const uebernehmen = (text: string): void => { wartetRef.current = true; void speichern.run(text); };

  const kopf = (aktion?: React.ReactNode): React.ReactElement => (
    <div className="mb-1 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Deep Research starten</h3>
        <p className="mt-1 text-[12.5px] text-[var(--tf-text-tertiary)]">
          Anonymer Recherche-Auftrag zum Themengebiet — für ChatGPT, Claude oder Mistral (5–10 Min externe Recherche, parallel zur internen Aufbereitung).
        </p>
      </div>
      {aktion ? <div className="shrink-0">{aktion}</div> : null}
    </div>
  );

  const stiftBtn = (
    <button
      type="button"
      onClick={() => { speichern.clearError(); setEditing(true); }}
      title="Auftragstext bearbeiten"
      aria-label="Auftragstext bearbeiten"
      className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] text-[var(--tf-text-tertiary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)]"
    >
      <Pencil size={13} /> Bearbeiten
    </button>
  );

  if (s === 'fehlt') {
    return (
      <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        {kopf()}
        {bausteine.error ? (
          <div className="mt-2 rounded-lg px-3 py-2 text-[12.5px] text-[var(--tf-danger-text)]" style={{ border: '0.5px solid var(--tf-border)' }}>{bausteine.error}</div>
        ) : null}
        <p className="mt-3 text-[12.5px] text-[var(--tf-text-tertiary)]">Noch nicht erzeugt — die KI-Aufbereitung erstellt den Auftrag als ersten Schritt.</p>
        <Button variant="primary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()} className="mt-2">
          {bausteine.busy ? 'KI-Aufbereitung läuft …' : 'KI-Aufbereitung starten'}
        </Button>
      </section>
    );
  }
  if (s === 'laeuft') {
    return (
      <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        {kopf()}
        <p className="mt-3 text-[12.5px] text-[var(--tf-text-tertiary)]">Recherche-Auftrag wird erzeugt …</p>
      </section>
    );
  }
  if (s === 'fehler') {
    return (
      <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        {kopf()}
        <p className="mt-3 text-[12.5px] text-[var(--tf-text-tertiary)] leading-snug">
          {recherchePrompt.begruendung ?? 'Der interne KI-Dienst war nicht erreichbar.'}
        </p>
        <Button variant="secondary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()} className="mt-2">Erneut versuchen</Button>
      </section>
    );
  }

  if (editing) {
    return (
      <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        {kopf()}
        <AuftragsEditor
          start={prompt || recherchePrompt.rohtext || ''}
          busy={speichern.busy}
          fehler={speichern.error}
          onUebernehmen={uebernehmen}
          onAbbrechen={() => { speichern.clearError(); setEditing(false); }}
        />
      </section>
    );
  }

  const daten = recherchePrompt.daten;
  const bearbeitet = daten?.bearbeitet;
  // Die Stichworte sind die Quelle des Auftrags — der Prüfer korrigiert hier, nicht im
  // Fließtext. Alt-Fassungen ohne Stichworte (Handfassung vor v2.301) zeigen den Block nicht.
  const stichworteBlock = daten?.stichworte ? (
    <StichworteEditor
      stichworte={daten.stichworte}
      bekannteWerte={bekannteWerte}
      entfernt={daten.entfernt}
      busy={speichereStichworte.busy}
      fehler={speichereStichworte.error}
      handfassung={!!bearbeitet}
      onAendern={s => void speichereStichworte.run(s)}
    />
  ) : null;
  const spur = bearbeitet ? (
    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11.5px] text-[var(--tf-text-tertiary)]">
      <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 bg-[var(--tf-bg-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
        <Pencil size={11} /> von Ihnen bearbeitet · {new Date(bearbeitet.am).toLocaleString('de-DE')}
      </span>
      <button
        type="button"
        onClick={() => verwerfen.run()}
        disabled={verwerfen.busy}
        className="inline-flex items-center gap-1 text-[var(--tf-primary)] hover:underline disabled:opacity-50"
      >
        <RotateCcw size={11} /> Zurück zum KI-Text
      </button>
      {verwerfen.error ? <span className="text-[var(--tf-danger-text)]">{verwerfen.error}</span> : null}
    </div>
  ) : null;

  // degradiert (z. B. Leak-Check) → nur Einsicht, kein Copy. Bearbeiten bleibt offen:
  // genau hier ist es der Rettungspfad (Angabe entfernen → erneuter Leak-Check).
  if (s === 'degradiert') {
    const hatFassung = prompt.length > 0;
    return (
      <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        {kopf(stiftBtn)}
        <div className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          {/* Die Abhilfe hängt am GRUND. „Entfernen Sie die Angabe" gilt nur für
              den Leak-Fall; bei „zu wenige Stichworte" bzw. „nicht parsebar"
              wäre das Gegenteil richtig, und der Nutzer suchte eine
              identifizierende Angabe, die es nicht gibt (v4.124). */}
          <span>
            {recherchePrompt.begruendung ?? 'Der erzeugte Auftrag ist nicht zum Export freigegeben.'} — der Text wird nur zur Einsicht gezeigt und NICHT zum Kopieren angeboten.
            {' '}
            {(recherchePrompt.begruendung ?? '').startsWith('Identifizierende Angabe')
              ? 'Entfernen Sie die Angabe über „Bearbeiten"; diese Fassung wird erst gespeichert und freigegeben, wenn sie keine identifizierende Angabe mehr enthält.'
              : 'Ergänzen Sie den Auftrag über „Bearbeiten" oder starten Sie den KI-Lauf erneut; freigegeben wird erst eine Fassung, die den Leak-Check besteht.'}
          </span>
        </div>
        {stichworteBlock}
        {hatFassung
          ? <AuftragsVorschau text={prompt} standardOffen />
          : <TextEinsicht text={recherchePrompt.rohtext ?? ''} label="Roh-Antwort anzeigen" />}
        {spur}
      </section>
    );
  }
  // ok
  return (
    <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      {kopf(stiftBtn)}
      {stichworteBlock}
      <AuftragsVorschau text={prompt} standardOffen />
      {spur}
      <p className="mt-3 text-[11.5px] text-[var(--tf-text-tertiary)]">
        Prüfen Sie den Text — er verlässt mit dem Kopieren den geschützten Bereich.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <KopierUndOeffnen prompt={prompt} url={drUrls.chatgpt} label="ChatGPT" />
        <KopierUndOeffnen prompt={prompt} url={drUrls.claude} label="Claude" />
        <KopierUndOeffnen prompt={prompt} url={drUrls.mistral} label="Mistral" />
      </div>
    </section>
  );
}

/** Gerenderte Markdown-Vorschau des Auftrags (der Auftrag IST Markdown: Gliederung + Listen). */
function AuftragsVorschau({ text, standardOffen }: { text: string; standardOffen?: boolean }): React.ReactElement {
  return (
    <details className="mt-3 group" open={standardOffen}>
      <summary className="cursor-pointer list-none inline-flex items-center gap-1 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
        <ChevronDown size={13} className="transition-transform group-open:rotate-180" /> Auftragstext {standardOffen ? 'einklappen' : 'anzeigen'}
      </summary>
      <div className="mt-2 max-h-[340px] overflow-auto rounded-lg p-3 bg-[var(--tf-bg-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
        <MarkdownRenderer content={text} />
      </div>
    </details>
  );
}

/** Unformatierte Text-Einsicht (Roh-Antwort des Modells / deterministisches Template). */
function TextEinsicht({ text, label }: { text: string; label: string }): React.ReactElement {
  return (
    <details className="mt-3 group">
      <summary className="cursor-pointer list-none inline-flex items-center gap-1 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
        <ChevronDown size={13} className="transition-transform group-open:rotate-180" /> {label}
      </summary>
      <pre className="mt-2 max-h-[340px] overflow-auto whitespace-pre-wrap rounded-lg p-3 text-[12px] leading-relaxed text-[var(--tf-text)] bg-[var(--tf-bg-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
        {text}
      </pre>
    </details>
  );
}

/**
 * Inline-Editor des Auftragstextes (Muster `SectionReviewCard`): CodeMirror mit
 * Live-Vorschau, Mod-Enter übernimmt, Esc bricht ab. Übernehmen liest den LIVE-Doc-Wert
 * über `onCreateEditor` — `MarkdownEditor.onChange` ist 300 ms debounced, der letzte
 * Anschlag ginge sonst verloren.
 */
function AuftragsEditor({
  start, busy, fehler, onUebernehmen, onAbbrechen,
}: {
  start: string;
  busy: boolean;
  fehler: string | null;
  onUebernehmen: (text: string) => void;
  onAbbrechen: () => void;
}): React.ReactElement {
  const [draft, setDraft] = useState(start);
  const viewRef = useRef<EditorView | null>(null);
  const handlersRef = useRef<{ uebernehmen: (text: string) => void; abbrechen: () => void }>({ uebernehmen: () => {}, abbrechen: () => {} });
  handlersRef.current.uebernehmen = onUebernehmen;
  handlersRef.current.abbrechen = onAbbrechen;
  const extensions = useMemo(() => {
    const km = Prec.highest(keymap.of([
      { key: 'Mod-Enter', run: (v: EditorView) => { handlersRef.current.uebernehmen(v.state.doc.toString()); return true; } },
      { key: 'Escape', run: () => { handlersRef.current.abbrechen(); return true; } },
    ]));
    return [markdownLivePreview(), km];
  }, []);
  const jetzt = (): string => viewRef.current?.state.doc.toString() ?? draft;

  return (
    <div className="mt-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <Pencil size={13} className="text-[var(--tf-text-tertiary)]" />
        <span className="text-[12px] text-[var(--tf-text-secondary)]">Auftragstext bearbeiten</span>
        <span className="flex-1" />
        <Button variant="ghost" size="sm" onClick={onAbbrechen}>Abbrechen</Button>
        <Button variant="primary" size="sm" loading={busy} onClick={() => onUebernehmen(jetzt())}>
          {busy ? 'Übernehmen …' : 'Übernehmen'}
        </Button>
      </div>
      <div className="rounded-lg overflow-hidden" style={{ border: '0.5px solid var(--tf-border)' }}>
        <MarkdownEditor
          value={draft}
          onChange={setDraft}
          frame="none"
          minHeight="240px"
          maxHeight="440px"
          onCreateEditor={v => { viewRef.current = v; }}
          extensions={extensions}
        />
      </div>
      <div className="mt-1.5 text-[11px] text-[var(--tf-text-tertiary)]">
        ⌘/Strg + Enter übernimmt · Esc bricht ab. Der Text wird beim Übernehmen erneut auf identifizierende Angaben geprüft.
      </div>
      {fehler ? (
        <div className="mt-2 rounded-lg px-3 py-2 text-[12px] text-[var(--tf-danger-text)] bg-[var(--tf-danger-bg)]">{fehler}</div>
      ) : null}
    </div>
  );
}

/**
 * „Kopieren & <Dienst> öffnen" — erst kopieren, DANN öffnen (siehe `kopieren.ts`).
 * Bewusst ein Button statt eines `<a target="_blank">`: dessen Navigation lief im selben
 * Tick wie der Kopier-Aufruf und konnte ihn still scheitern lassen; im Chat landete dann
 * der ALTE Inhalt der Zwischenablage. Erfolg und Fehler stehen jetzt sichtbar am Knopf.
 */
function KopierUndOeffnen({ prompt, url, label, onKopiert }: {
  prompt: string; url: string; label: string; onKopiert?: () => void;
}): React.ReactElement {
  const [kopiert, setKopiert] = useState(false);
  const kopieren = useAsyncAction(async () => {
    await kopiereText(prompt);
    setKopiert(true);
    onKopiert?.();
    // Popup-Blocker: der Auftrag liegt bereits in der Zwischenablage — das ist der
    // wichtigere Teil, deshalb nur ein Hinweis statt eines Fehlers.
    window.open(url, '_blank', 'noopener,noreferrer');
  });
  // Jede neue Fassung entwertet die Bestätigung — sonst behauptet der Knopf „kopiert",
  // während in der Zwischenablage der Text von vorhin liegt.
  useEffect(() => { setKopiert(false); }, [prompt]);
  return (
    <span className="inline-flex items-center gap-1.5">
      <Button variant="secondary" size="sm" loading={kopieren.busy} onClick={() => kopieren.run()}>
        <ExternalLink size={13} /> Kopieren &amp; {label} öffnen
      </Button>
      {kopieren.error
        ? <span className="text-[11.5px] text-[var(--tf-danger-text)]">{kopieren.error}</span>
        : kopiert ? <span className="text-[11.5px] text-[var(--tf-success-text)]">kopiert</span> : null}
    </span>
  );
}

// ---------------------------------------------------------------------------
// 2 — Marktzugang des KMU (kurator-gated, identifizierend)
// ---------------------------------------------------------------------------

function Marktzugang({
  stammdaten, run, mistralUrl, onKopiert,
}: {
  stammdaten: RechercheStammdaten;
  run: AufbereitungRun | null;
  mistralUrl: string;
  onKopiert: () => void;
}): React.ReactElement | null {
  const text = useMemo(() => baueMarktzugangText({ firmenname: stammdaten.antragsteller }), [stammdaten.antragsteller]);
  const [bestaetigt, setBestaetigt] = useState(false);
  if (!text) return null;
  const stempel = run?.marktzugangKopiert?.am;

  return (
    <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Marktzugang des KMU</h3>
      <p className="mt-1 text-[12.5px] text-[var(--tf-text-tertiary)]">
        Bewusst <strong>identifizierende</strong> Recherche (nennt den Firmennamen) — deterministisch aus Stammdaten, kein Antragsinhalt. Vor dem Kopieren bestätigen.
      </p>
      <TextEinsicht text={text} label="Auftragstext anzeigen" />
      {!bestaetigt ? (
        <Button variant="secondary" size="sm" onClick={() => setBestaetigt(true)} className="mt-3">Kopieren vorbereiten …</Button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-[var(--tf-warning-text)]">Firmenname wird mitkopiert — fortfahren?</span>
          <KopierUndOeffnen
            prompt={text}
            url={mistralUrl}
            label="Mistral"
            onKopiert={() => { onKopiert(); setBestaetigt(false); }}
          />
          <Button variant="ghost" size="sm" onClick={() => setBestaetigt(false)}>Abbrechen</Button>
        </div>
      )}
      {stempel ? (
        <p className="mt-2 text-[11.5px] text-[var(--tf-text-tertiary)]">Zuletzt kopiert: {new Date(stempel).toLocaleString('de-DE')}</p>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// 3 — Ergebnis zurückbringen (Import: Text / Datei; tolerant)
// ---------------------------------------------------------------------------

function ErgebnisZurueckbringen({
  run, importText, importDatei, loescheImport,
}: {
  run: AufbereitungRun | null;
  importText: UseAsyncActionResult<[string, string?]>;
  importDatei: UseAsyncActionResult<[File[], ((fertig: number, gesamt: number) => void)?]>;
  loescheImport: UseAsyncActionResult<[number]>;
}): React.ReactElement {
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  /** Namen der abgelegten Dateien, die keine gelesene Endung haben (z.B. eine ZIP). */
  const [abgelehnt, setAbgelehnt] = useState<string[]>([]);
  const [fortschritt, setFortschritt] = useState<{ fertig: number; gesamt: number } | null>(null);
  const importe = run?.extern ?? [];
  const kannImportieren = !!run;

  // Eingefügten Text erst NACH erfolgreicher Übernahme leeren (Muster `DeepResearchStart`):
  // `UseAsyncActionResult.run` schluckt Fehler in den `error`-State, ein `await` allein sagt
  // also nichts über Erfolg — sonst wäre der Report bei einem Fehlschlag einfach weg.
  const wartetRef = useRef(false);
  useEffect(() => {
    if (!wartetRef.current || importText.busy) return;
    wartetRef.current = false;
    if (!importText.error) setText('');
  }, [importText.busy, importText.error]);
  const uebernehmen = (): void => { wartetRef.current = true; void importText.run(text.trim(), label.trim() || undefined); };

  useEffect(() => { if (!importDatei.busy) setFortschritt(null); }, [importDatei.busy]);
  const dateienAblegen = (dateien: File[]): void => {
    const { akzeptiert, abgelehnt: raus } = teileImportDateien(dateien);
    setAbgelehnt(raus);
    if (akzeptiert.length === 0) return;
    setFortschritt({ fertig: 0, gesamt: akzeptiert.length });
    void importDatei.run(akzeptiert, (fertig, gesamt) => setFortschritt({ fertig, gesamt }));
  };

  return (
    <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Ergebnis zurückbringen</h3>
      <p className="mt-1 text-[12.5px] text-[var(--tf-text-tertiary)]">
        Externen Recherche-Report einfügen oder als Datei ablegen (PDF, Word, Markdown, Text). Ein enthaltener JSON-Block wird direkt übernommen, sonst strukturiert die interne KI den Text (sonst unstrukturiert als Rohtext). Externe Quellen fließen NICHT in den Antrags-Korpus.
      </p>
      {!kannImportieren ? (
        <p className="mt-3 text-[12px] text-[var(--tf-text-tertiary)]">Zuerst „Neu aufbereiten" oder „Mit KI aufbereiten" — dann können Ergebnisse hinterlegt werden.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-col gap-2">
            <input
              type="text"
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder={'Modell-Label (optional, z. B. „ChatGPT Deep Research")'}
              className="w-full px-3 py-2 text-[12px] rounded-[var(--tf-radius)] border border-[var(--tf-border)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-border-hover)]"
            />
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              rows={5}
              placeholder="Report-Text (mit oder ohne JSON-Block) hier einfügen …"
              className="w-full px-3 py-2 text-[12px] rounded-[var(--tf-radius)] border border-[var(--tf-border)] bg-[var(--tf-bg)] text-[var(--tf-text)] outline-none focus:border-[var(--tf-border-hover)] resize-y"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="primary" size="sm" loading={importText.busy} disabled={!text.trim()} onClick={uebernehmen}>
                Text übernehmen
              </Button>
              {importText.error ? (
                <span className="text-[11.5px] text-[var(--tf-danger-text)]">{importText.error}</span>
              ) : null}
            </div>

            <FileDropZone accept={IMPORT_ACCEPT} multiple padding="px-6 py-4" onFiles={dateienAblegen}>
              {importDatei.busy ? (
                <p className="text-[13px] text-[var(--tf-text-secondary)]">
                  {fortschritt && fortschritt.gesamt > 1
                    ? `Datei ${Math.min(fortschritt.fertig + 1, fortschritt.gesamt)} von ${fortschritt.gesamt} wird gelesen …`
                    : 'Datei wird gelesen …'}
                </p>
              ) : (
                <>
                  <p className="text-[13px] text-[var(--tf-text)]">
                    Report-Datei hier ablegen <span className="text-[var(--tf-text-secondary)]">(PDF, Word, Markdown, Text)</span>
                  </p>
                  <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
                    oder <span className="text-[var(--tf-primary)]">Datei auswählen</span> — mehrere ergeben je einen Import.
                  </p>
                </>
              )}
            </FileDropZone>
            {abgelehnt.length ? (
              <span className="text-[11.5px] text-[var(--tf-warning-text)]">
                Nicht gelesen (Dateityp): {abgelehnt.join(', ')}
              </span>
            ) : null}
            {importDatei.error ? (
              <span className="text-[11.5px] text-[var(--tf-danger-text)]">{importDatei.error}</span>
            ) : null}
          </div>

          {importe.length ? (
            <div className="mt-4 flex flex-col gap-2">
              {importe.map((e, i) => <ExternKarte key={`${e.importiertAm}-${i}`} eintrag={e} onLoeschen={() => loescheImport.run(i)} loeschBusy={loescheImport.busy} />)}
            </div>
          ) : (
            <p className="mt-3 text-[11.5px] text-[var(--tf-text-tertiary)]">Noch nichts importiert.</p>
          )}
        </>
      )}
    </section>
  );
}

function ExternKarte({ eintrag, onLoeschen, loeschBusy }: { eintrag: ExterneRecherche; onLoeschen: () => void; loeschBusy: boolean }): React.ReactElement {
  const sdt = eintrag.aussagen.filter(a => a.kategorie === 'sdt');
  const andere = eintrag.aussagen.length - sdt.length;
  const datum = new Date(eintrag.importiertAm).toLocaleDateString('de-DE');
  return (
    <div className="rounded-lg p-3" style={{ border: '0.5px solid var(--tf-border)' }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
            <FileText size={11} /> Extern · {eintrag.modellLabel || eintrag.herkunft} · {datum} · nicht verifiziert
          </span>
          <div className="mt-1.5 text-[12px] text-[var(--tf-text-secondary)]">
            {eintrag.aussagen.length} Aussage(n) · {eintrag.quellen.length} Quelle(n)
            {andere > 0 ? <span className="text-[var(--tf-text-tertiary)]"> · {andere} für die Verwertungs-Gegenüberstellung</span> : null}
          </div>
          {eintrag.identifikation ? (
            <div className="mt-1 text-[11.5px] text-[var(--tf-text-tertiary)]">Untersucht: {eintrag.identifikation}</div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onLoeschen}
          disabled={loeschBusy}
          title="Import entfernen"
          className="shrink-0 inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] disabled:opacity-50"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {sdt.length ? (
        <div className="mt-2">
          <div className="text-[11.5px] font-medium text-[var(--tf-text-secondary)]">Stand der Technik (extern, nicht verifiziert)</div>
          <ul className="mt-1 flex flex-col gap-1">
            {sdt.map((a, j) => (
              <li key={j} className="text-[12px] text-[var(--tf-text)]">
                {a.text}
                {a.quellenUrls?.length ? (
                  <span className="ml-1 inline-flex flex-wrap gap-1">
                    {a.quellenUrls.map((u, k) => (
                      <a key={k} href={u} target="_blank" rel="noopener noreferrer" className="text-[11px] text-[var(--tf-primary)] hover:underline">Quelle</a>
                    ))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {eintrag.rohtext ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-[11.5px] text-[var(--tf-text-tertiary)]">Unstrukturiert übernommen — Rohtext anzeigen</summary>
          <pre className="mt-1 max-h-[220px] overflow-auto whitespace-pre-wrap rounded p-2 text-[11.5px] text-[var(--tf-text)] bg-[var(--tf-bg-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>{eintrag.rohtext}</pre>
        </details>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 4 — Einzel-Suchanfragen (bisherige deterministische Hilfen, eingeklappt)
// ---------------------------------------------------------------------------

function EinzelSuchanfragen({ steckbrief, stammdaten }: { steckbrief: BausteinUiState<SteckbriefDaten>; stammdaten: RechercheStammdaten }): React.ReactElement {
  const gruppen = useMemo(
    () => (steckbrief.status === 'ok' || steckbrief.status === 'degradiert' ? baueRechercheAnfragen(steckbrief.daten ?? null, stammdaten) : []),
    [steckbrief.status, steckbrief.daten, stammdaten],
  );
  return (
    <details className="rounded-xl p-4 group" style={{ border: '0.5px solid var(--tf-border)' }}>
      <summary className="cursor-pointer list-none flex items-center gap-1.5 text-[13px] font-medium text-[var(--tf-text)]">
        <ChevronDown size={14} className="transition-transform group-open:rotate-180" />
        <Search size={13} /> Einzel-Suchanfragen aus dem Steckbrief
        {gruppen.length ? <span className="text-[11.5px] font-normal text-[var(--tf-text-tertiary)]">({gruppen.reduce((n, g) => n + g.anfragen.length, 0)})</span> : null}
      </summary>
      <div className="mt-3">
        {gruppen.length === 0 ? (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">Verfügbar, sobald der Steckbrief aufbereitet ist (Zielmärkte / FuE-Gegenstand).</p>
        ) : (
          <div className="flex flex-col gap-3">
            {gruppen.map(g => (
              <div key={g.id}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-medium text-[var(--tf-text)]">{g.titel}</span>
                  <KopierAlle texte={g.anfragen.map(a => a.text)} />
                </div>
                <div className="flex flex-col gap-1.5">
                  {g.anfragen.map(a => <KopierAnfrage key={a.text} text={a.text} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function KopierAnfrage({ text }: { text: string }): React.ReactElement {
  const kopieren = useKopierAktion(text, 'In die Zwischenablage kopieren');
  return (
    <button
      type="button"
      onClick={() => kopieren.run()}
      disabled={kopieren.busy}
      title={kopieren.titel}
      className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--tf-hover)]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <span className="min-w-0 truncate text-[12.5px] text-[var(--tf-text)]">{text}</span>
      <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[var(--tf-text-tertiary)] group-hover:text-[var(--tf-primary)]">
        {kopieren.fehler
          ? <><AlertTriangle size={12} className="text-[var(--tf-danger-text)]" /> fehlgeschlagen</>
          : <><Copy size={12} /> kopieren</>}
      </span>
    </button>
  );
}

function KopierAlle({ texte }: { texte: string[] }): React.ReactElement {
  const kopieren = useKopierAktion(() => texte.join('\n'), 'Alle in die Zwischenablage kopieren');
  return (
    <button
      type="button"
      onClick={() => kopieren.run()}
      disabled={kopieren.busy}
      title={kopieren.titel}
      className={`inline-flex items-center gap-1 text-[11.5px] hover:underline disabled:opacity-50 ${
        kopieren.fehler ? 'text-[var(--tf-danger-text)]' : 'text-[var(--tf-primary)]'
      }`}
    >
      {kopieren.fehler
        ? <><AlertTriangle size={12} /> Kopieren fehlgeschlagen</>
        : <><Copy size={12} /> Alle kopieren</>}
    </button>
  );
}
