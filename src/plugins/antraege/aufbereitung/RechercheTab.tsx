/**
 * Recherche-Tab (Paket 5). Vier Abschnitte:
 *  1. „Deep Research starten": der intern erzeugte, anonyme DR-Auftrag (Leak-geprüft) —
 *     Review-Hinweis + „Kopieren & ChatGPT/Claude/Mistral öffnen". Bei Leak-Degradation
 *     nur einsehbar (kein Copy).
 *  2. „Marktzugang des KMU" (kurator-gated, Default AUS): bewusst identifizierendes,
 *     deterministisches Template aus Stammdaten (kein LLM, kein VB-Inhalt) mit
 *     Bestätigung vor dem Kopieren + Run-Stempel.
 *  3. „Ergebnis zurückbringen": Import der externen DR-Ergebnisse (Phase 2).
 *  4. „Einzel-Suchanfragen": die bisherigen deterministischen Suchanfragen (eingeklappt).
 *
 * DSGVO: externe Dienste erreicht ausschließlich der Nutzer per Zwischenablage +
 * geöffneter Seite — KEIN API-Call. `file://`-tauglich (Anker `target=_blank`).
 */
import { useEffect, useMemo, useState } from 'react';
import { Copy, ExternalLink, Search, AlertTriangle, ChevronDown, Upload, Trash2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useStorage } from '@/core/hooks/useStorage';
import { useAsyncAction, type UseAsyncActionResult } from '@/core/hooks/useAsyncAction';
import { getAufbereitungDrUrls } from '@/config/feature-flags';
import type { SteckbriefDaten } from './steckbrief';
import type { RecherchePromptDaten } from './recherche-prompt';
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
  importDatei: UseAsyncActionResult<[File]>;
  loescheImport: UseAsyncActionResult<[number]>;
}

export function RechercheTab({ recherchePrompt, run, steckbrief, stammdaten, bausteine, onMarktzugangKopiert, importText, importDatei, loescheImport }: Props): React.ReactElement {
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
      <DeepResearchStart recherchePrompt={recherchePrompt} bausteine={bausteine} drUrls={settings.drUrls} />
      {settings.marktzugangAktiv ? (
        <Marktzugang stammdaten={stammdaten} run={run} mistralUrl={settings.drUrls.mistral} onKopiert={onMarktzugangKopiert} />
      ) : null}
      <ErgebnisZurueckbringen run={run} importText={importText} importDatei={importDatei} loescheImport={loescheImport} />
      <EinzelSuchanfragen steckbrief={steckbrief} stammdaten={stammdaten} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// 1 — Deep Research starten
// ---------------------------------------------------------------------------

function DeepResearchStart({
  recherchePrompt, bausteine, drUrls,
}: {
  recherchePrompt: BausteinUiState<RecherchePromptDaten>;
  bausteine: UseAsyncActionResult<[]>;
  drUrls: { chatgpt: string; claude: string; mistral: string };
}): React.ReactElement {
  const s = recherchePrompt.status;

  const kopf = (
    <div className="mb-1">
      <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Deep Research starten</h3>
      <p className="mt-1 text-[12.5px] text-[var(--tf-text-tertiary)]">
        Anonymer Recherche-Auftrag zum Themengebiet — für ChatGPT, Claude oder Mistral (5–10 Min externe Recherche, parallel zur internen Aufbereitung).
      </p>
    </div>
  );

  if (s === 'fehlt') {
    return (
      <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        {kopf}
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
        {kopf}
        <p className="mt-3 text-[12.5px] text-[var(--tf-text-tertiary)]">Recherche-Auftrag wird erzeugt …</p>
      </section>
    );
  }
  if (s === 'fehler') {
    return (
      <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        {kopf}
        <p className="mt-3 text-[12.5px] text-[var(--tf-text-tertiary)]">Der interne KI-Dienst ist derzeit nicht erreichbar.</p>
        <Button variant="secondary" size="sm" loading={bausteine.busy} onClick={() => bausteine.run()} className="mt-2">Erneut versuchen</Button>
      </section>
    );
  }
  // degradiert (z. B. Leak-Check) → nur Einsicht, kein Copy.
  if (s === 'degradiert') {
    return (
      <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
        {kopf}
        <div className="mt-3 flex items-start gap-2 rounded-lg px-3 py-2 text-[12.5px] bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{recherchePrompt.begruendung ?? 'Der erzeugte Auftrag ist nicht zum Export freigegeben.'} — der Text wird nur zur Einsicht gezeigt und NICHT zum Kopieren angeboten.</span>
        </div>
        <PromptEinsicht text={recherchePrompt.rohtext ?? ''} />
      </section>
    );
  }
  // ok
  const prompt = recherchePrompt.daten?.prompt ?? '';
  return (
    <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      {kopf}
      <PromptEinsicht text={prompt} standardOffen />
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

function PromptEinsicht({ text, standardOffen }: { text: string; standardOffen?: boolean }): React.ReactElement {
  return (
    <details className="mt-3 group" open={standardOffen}>
      <summary className="cursor-pointer list-none inline-flex items-center gap-1 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
        <ChevronDown size={13} className="transition-transform group-open:rotate-180" /> Auftragstext {standardOffen ? 'einklappen' : 'anzeigen'}
      </summary>
      <pre className="mt-2 max-h-[340px] overflow-auto whitespace-pre-wrap rounded-lg p-3 text-[12px] leading-relaxed text-[var(--tf-text)] bg-[var(--tf-bg-secondary)]" style={{ border: '0.5px solid var(--tf-border)' }}>
        {text}
      </pre>
    </details>
  );
}

function KopierUndOeffnen({ prompt, url, label }: { prompt: string; url: string; label: string }): React.ReactElement {
  const kopieren = useAsyncAction(async () => { await navigator.clipboard.writeText(prompt); });
  return (
    <Button asChild variant="secondary" size="sm">
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => kopieren.run()}>
        <ExternalLink size={13} /> Kopieren &amp; {label} öffnen
      </a>
    </Button>
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
  const kopieren = useAsyncAction(async () => { await navigator.clipboard.writeText(text ?? ''); }, {
    onSuccess: () => { onKopiert(); setBestaetigt(false); },
  });
  if (!text) return null;
  const stempel = run?.marktzugangKopiert?.am;

  return (
    <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Marktzugang des KMU</h3>
      <p className="mt-1 text-[12.5px] text-[var(--tf-text-tertiary)]">
        Bewusst <strong>identifizierende</strong> Recherche (nennt den Firmennamen) — deterministisch aus Stammdaten, kein Antragsinhalt. Vor dem Kopieren bestätigen.
      </p>
      <PromptEinsicht text={text} />
      {!bestaetigt ? (
        <Button variant="secondary" size="sm" onClick={() => setBestaetigt(true)} className="mt-3">Kopieren vorbereiten …</Button>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[12px] text-[var(--tf-warning-text)]">Firmenname wird mitkopiert — fortfahren?</span>
          <Button asChild variant="secondary" size="sm">
            <a href={mistralUrl} target="_blank" rel="noopener noreferrer" onClick={() => kopieren.run()}>
              <ExternalLink size={13} /> Kopieren &amp; Mistral öffnen
            </a>
          </Button>
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
  importDatei: UseAsyncActionResult<[File]>;
  loescheImport: UseAsyncActionResult<[number]>;
}): React.ReactElement {
  const [text, setText] = useState('');
  const [label, setLabel] = useState('');
  const importe = run?.extern ?? [];
  const kannImportieren = !!run;

  const uebernehmen = useAsyncAction(async () => {
    await importText.run(text.trim(), label.trim() || undefined);
    setText('');
  });
  const dateiWaehlen = useAsyncAction(async (file: File) => { await importDatei.run(file); });

  return (
    <section className="rounded-xl p-4" style={{ border: '0.5px solid var(--tf-border)' }}>
      <h3 className="text-[13px] font-medium text-[var(--tf-text)]">Ergebnis zurückbringen</h3>
      <p className="mt-1 text-[12.5px] text-[var(--tf-text-tertiary)]">
        Externen Recherche-Report einfügen oder als PDF/Word hochladen. Ein enthaltener JSON-Block wird direkt übernommen, sonst strukturiert die interne KI den Text (sonst unstrukturiert als Rohtext). Externe Quellen fließen NICHT in den Antrags-Korpus.
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
              <Button variant="primary" size="sm" loading={uebernehmen.busy} disabled={!text.trim()} onClick={() => uebernehmen.run()}>
                Text übernehmen
              </Button>
              <label className="inline-flex items-center gap-1.5 cursor-pointer text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]">
                <Upload size={13} /> {dateiWaehlen.busy ? 'Datei wird gelesen …' : 'PDF/Word hochladen'}
                <input
                  type="file"
                  accept=".pdf,.docx"
                  className="hidden"
                  onChange={e => { const f = e.target.files?.[0]; if (f) { void dateiWaehlen.run(f); } e.target.value = ''; }}
                />
              </label>
              {(uebernehmen.error || dateiWaehlen.error) ? (
                <span className="text-[11.5px] text-[var(--tf-danger-text)]">{uebernehmen.error || dateiWaehlen.error}</span>
              ) : null}
            </div>
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
  const kopieren = useAsyncAction(async () => { await navigator.clipboard.writeText(text); });
  return (
    <button
      type="button"
      onClick={() => kopieren.run()}
      disabled={kopieren.busy}
      title="In die Zwischenablage kopieren"
      className="group flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left hover:bg-[var(--tf-hover)]"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <span className="min-w-0 truncate text-[12.5px] text-[var(--tf-text)]">{text}</span>
      <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-[var(--tf-text-tertiary)] group-hover:text-[var(--tf-primary)]">
        <Copy size={12} /> {kopieren.error ? 'Fehler' : 'kopieren'}
      </span>
    </button>
  );
}

function KopierAlle({ texte }: { texte: string[] }): React.ReactElement {
  const kopieren = useAsyncAction(async () => { await navigator.clipboard.writeText(texte.join('\n')); });
  return (
    <button
      type="button"
      onClick={() => kopieren.run()}
      disabled={kopieren.busy}
      className="inline-flex items-center gap-1 text-[11.5px] text-[var(--tf-primary)] hover:underline disabled:opacity-50"
    >
      <Copy size={12} /> {kopieren.error ? 'Fehler' : 'Alle kopieren'}
    </button>
  );
}
