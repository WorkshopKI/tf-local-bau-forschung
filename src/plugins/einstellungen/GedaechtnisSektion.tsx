/**
 * Einstellungs-Sektion „Persönliches Gedächtnis" (Assistent Phase 2 —
 * gegated via `isAssistentGedaechtnisEnabled`).
 *
 * Doppeltes Opt-in: aktivierbar nur, wenn das Arbeitsprotokoll-Opt-in aktiv ist.
 * Zeigt die konsolidierten Memory-Blocks transparent (aktive + optional
 * invalidierte Einträge mit Belegen/Zeitstempeln/Vorgänger-Kette), erlaubt
 * Einzel-/Komplettlöschung und einen manuellen Konsolidierungslauf. Alle Daten
 * bleiben in der IndexedDB dieses Geräts; Auswertung ausschließlich über das
 * INTERNE Modell.
 */
import { useCallback, useEffect, useState } from 'react';
import { Brain, ChevronDown, ChevronRight, RefreshCw, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useAIBridge } from '@/core/hooks/useAIBridge';
import {
  BLOCK_LABELS,
  GEDAECHTNIS_BLOECKE,
  istGedaechtnisAktiv,
  ladeAlleEintraege,
  ladeLaufMeta,
  loescheAllesGedaechtnis,
  loescheGedaechtnisEintrag,
  setzeGedaechtnisAktiv,
  starteKonsolidierungManuell,
  type GedaechtnisBlock,
  type GedaechtnisEintrag,
  type KonsolidierungsResultat,
  type LaufMeta,
} from '@/core/services/assistent/gedaechtnis';
import { ladeAlleEreignisse, protokolliereEreignis, type AssistentEreignis } from '@/core/services/assistent/protokoll';
import { SettingsSectionHeader } from './_shared/settings-primitives';
import { fmtZeit, typLabel } from './_shared/assistent-format';

const STATUS_TEXT: Record<KonsolidierungsResultat['status'], string> = {
  ok: 'Konsolidierung abgeschlossen.',
  'alles-verworfen': 'Die KI lieferte nur unbrauchbare Angaben — nichts übernommen.',
  'nichts-zu-tun': 'Keine neuen Ereignisse — nichts zu tun.',
  'bridge-belegt': 'Die interne KI ist gerade durch einen anderen Lauf belegt. Bitte später erneut.',
  'ki-nicht-erreichbar': 'Die interne KI ist nicht erreichbar. Bitte die KI-Verbindung prüfen.',
  abgebrochen: 'Lauf abgebrochen (ein KI-Lauf hatte Vorrang).',
  'transport-fehler': 'Die Konsolidierung ist fehlgeschlagen.',
  'parse-fehler': 'Die Antwort der KI war unbrauchbar — nichts geändert.',
  deaktiviert: 'Gedächtnis oder Protokoll ist nicht aktiv.',
};

export function GedaechtnisSektion({ protokollAktiv }: { protokollAktiv: boolean }): React.ReactElement {
  const bridge = useAIBridge();
  const [aktiv, setAktiv] = useState<boolean>(istGedaechtnisAktiv());
  const [eintraege, setEintraege] = useState<GedaechtnisEintrag[]>([]);
  const [meta, setMeta] = useState<LaufMeta | null>(null);
  const [ereignisse, setEreignisse] = useState<Map<string, AssistentEreignis>>(new Map());
  const [invalidierteZeigen, setInvalidierteZeigen] = useState(false);
  const [vergessenBestaetigung, setVergessenBestaetigung] = useState(false);
  const [laufMeldung, setLaufMeldung] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const [alle, m, evs] = await Promise.all([ladeAlleEintraege(), ladeLaufMeta(), ladeAlleEreignisse()]);
    setEintraege(alle);
    setMeta(m);
    setEreignisse(new Map(evs.map(e => [e.id, e])));
  }, []);

  useEffect(() => { void laden(); }, [laden]);

  const umschalten = useAsyncAction<[boolean]>(async (next) => {
    if (next && !protokollAktiv) return; // doppeltes Opt-in — Guard (UI-seitig zusätzlich deaktiviert)
    await setzeGedaechtnisAktiv(next);
    setAktiv(next);
    if (next) {
      void protokolliereEreignis({ typ: 'einstellung_geaendert', detail: { schluessel: 'gedaechtnis-optin', wert: true } });
    }
  });

  const konsolidieren = useAsyncAction(async () => {
    setLaufMeldung(null);
    const res: KonsolidierungsResultat = await starteKonsolidierungManuell(bridge);
    // Bei „alles verworfen" ist die Folge für den Nutzer wichtiger als der Grund:
    // kommen die Ereignisse wieder, oder sind sie übersprungen?
    const nachsatz = res.status !== 'alles-verworfen' ? ''
      : res.fortschrittGehalten
        ? ' Die Ereignisse bleiben offen und werden beim nächsten Lauf erneut versucht.'
        : ' Nach mehreren Fehlversuchen übersprungen — diese Ereignisse werden nicht erneut angeboten.';
    setLaufMeldung(STATUS_TEXT[res.status] + nachsatz);
    await laden();
  });

  const vergessen = useAsyncAction(async () => {
    await loescheAllesGedaechtnis();
    setVergessenBestaetigung(false);
    await laden();
  });

  const aktive = eintraege.filter(e => e.status === 'aktiv');
  const sichtbar = invalidierteZeigen ? eintraege : aktive;

  return (
    <section id="sec-assistent-gedaechtnis" className="scroll-mt-20 space-y-4">
      <SettingsSectionHeader label="Persönliches Gedächtnis" count={aktive.length} />

      {/* ── Opt-in-Toggle (doppeltes Opt-in) ── */}
      <div className="flex items-start gap-3">
        <Switch
          checked={aktiv}
          onCheckedChange={(v) => umschalten.run(v)}
          disabled={umschalten.busy || (!aktiv && !protokollAktiv)}
          aria-label="Persönliches Gedächtnis (KI-Auswertung des Arbeitsprotokolls)"
        />
        <div className="min-w-0 space-y-2">
          <p className="text-[13.5px] font-medium text-[var(--tf-text)]">
            Persönliches Gedächtnis (KI-Auswertung des Arbeitsprotokolls)
          </p>
          <p className="text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)] max-w-prose">
            Ein Hintergrundlauf fasst dein Arbeitsprotokoll gelegentlich zu wenigen, knappen
            Notizen über deine Arbeit zusammen (woran du arbeitest, bevorzugte Abläufe, offene
            Fäden). Dabei gehen Protokolldaten an das{' '}
            <span className="text-[var(--tf-text)]">interne Modell</span> — es läuft vor Ort,
            nichts verlässt dieses Gerät ins Internet, kein externer Dienst. Die Notizen sind
            unten einsehbar, einzeln oder komplett löschbar; du kannst das Gedächtnis jederzeit
            wieder abschalten.
          </p>
          {!protokollAktiv && (
            <p className="text-[12px] text-[var(--tf-text-tertiary)]">
              Aktiviere zuerst das Arbeitsprotokoll oben — ohne Protokoll gibt es nichts auszuwerten.
            </p>
          )}
        </div>
      </div>
      {umschalten.error && (
        <p className="text-[12px] text-[var(--tf-danger-text)]">Konnte die Einstellung nicht speichern: {umschalten.error}</p>
      )}

      {aktiv && (
        <>
          {/* ── Lauf-Status + manueller Lauf ── */}
          <div
            className="rounded-[var(--tf-radius)] px-3.5 py-3 space-y-2"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <div className="flex items-center gap-2 flex-wrap justify-between">
              <span className="text-[12.5px] text-[var(--tf-text-secondary)]">
                {meta
                  ? <>Letzter Lauf: <span className="text-[var(--tf-text)]">{fmtZeit(meta.letzterLauf)}</span>
                      {' · '}{meta.fehler ? <span className="text-[var(--tf-danger-text)]">Fehler</span>
                        : <>{meta.angewandt} angewandt, {meta.verworfen} verworfen</>}</>
                  : 'Noch kein Konsolidierungslauf.'}
              </span>
              <Button
                variant="secondary"
                size="sm"
                icon={RefreshCw}
                loading={konsolidieren.busy}
                onClick={() => konsolidieren.run()}
              >
                Jetzt konsolidieren
              </Button>
            </div>
            {laufMeldung && <p className="text-[12px] text-[var(--tf-text-secondary)]">{laufMeldung}</p>}
            {konsolidieren.error && <p className="text-[12px] text-[var(--tf-danger-text)]">{konsolidieren.error}</p>}
          </div>

          {/* ── Blocks ── */}
          <div className="space-y-5">
            {GEDAECHTNIS_BLOECKE.map((block) => (
              <BlockAnsicht
                key={block}
                block={block}
                eintraege={sichtbar.filter(e => e.block === block)}
                ereignisse={ereignisse}
                onLoeschen={async (id) => { await loescheGedaechtnisEintrag(id); await laden(); }}
              />
            ))}
          </div>

          {/* ── Steuerung ── */}
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <label className="flex items-center gap-2 text-[12.5px] text-[var(--tf-text-secondary)] cursor-pointer">
              <input
                type="checkbox"
                checked={invalidierteZeigen}
                onChange={(e) => setInvalidierteZeigen(e.target.checked)}
              />
              Invalidierte anzeigen
            </label>
            <div className="flex-1" />
            {!vergessenBestaetigung ? (
              <Button
                variant="danger"
                size="sm"
                icon={Trash2}
                disabled={eintraege.length === 0}
                onClick={() => setVergessenBestaetigung(true)}
              >
                Alles vergessen
              </Button>
            ) : (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[12.5px] text-[var(--tf-text-secondary)]">Wirklich das gesamte Gedächtnis löschen?</span>
                <Button variant="danger" size="sm" loading={vergessen.busy} onClick={() => vergessen.run()}>Ja, alles vergessen</Button>
                <Button variant="ghost" size="sm" onClick={() => setVergessenBestaetigung(false)}>Abbrechen</Button>
              </div>
            )}
          </div>
          {vergessen.error && <p className="text-[12px] text-[var(--tf-danger-text)]">{vergessen.error}</p>}
        </>
      )}
    </section>
  );
}

function BlockAnsicht({
  block, eintraege, ereignisse, onLoeschen,
}: {
  block: GedaechtnisBlock;
  eintraege: GedaechtnisEintrag[];
  ereignisse: Map<string, AssistentEreignis>;
  onLoeschen: (id: string) => Promise<void>;
}): React.ReactElement {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline gap-2">
        <Brain size={13} className="text-[var(--tf-text-tertiary)] translate-y-0.5" />
        <h4 className="text-[12.5px] font-medium text-[var(--tf-text)]">{BLOCK_LABELS[block]}</h4>
        <span className="text-[11px] text-[var(--tf-text-tertiary)] tabular-nums">{eintraege.length}</span>
      </div>
      {eintraege.length === 0 ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)] pl-5">Keine Einträge.</p>
      ) : (
        <ul className="space-y-1.5">
          {eintraege.map((e) => (
            <EintragKarte key={e.id} eintrag={e} ereignisse={ereignisse} onLoeschen={onLoeschen} />
          ))}
        </ul>
      )}
    </div>
  );
}

function EintragKarte({
  eintrag, ereignisse, onLoeschen,
}: {
  eintrag: GedaechtnisEintrag;
  ereignisse: Map<string, AssistentEreignis>;
  onLoeschen: (id: string) => Promise<void>;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const loeschen = useAsyncAction(async () => { await onLoeschen(eintrag.id); });
  const invalid = eintrag.status === 'invalidiert';

  return (
    <li
      className="rounded-[var(--tf-radius)] px-3 py-2"
      style={{ border: '0.5px solid var(--tf-border)', opacity: invalid ? 0.55 : 1 }}
    >
      <div className="flex items-start gap-2">
        <button
          type="button"
          className="mt-0.5 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] shrink-0"
          onClick={() => setOffen((o) => !o)}
          aria-expanded={offen}
          aria-label="Details"
        >
          {offen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <p className={`flex-1 text-[13px] ${invalid ? 'line-through text-[var(--tf-text-secondary)]' : 'text-[var(--tf-text)]'}`}>
          {eintrag.text}
          {invalid && <span className="ml-1.5 text-[11px] no-underline">(invalidiert)</span>}
        </p>
        <button
          type="button"
          className="shrink-0 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-danger-text)] disabled:opacity-40"
          onClick={() => loeschen.run()}
          disabled={loeschen.busy}
          title="Eintrag löschen"
          aria-label="Eintrag löschen"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {offen && (
        <div className="mt-2 pl-6 space-y-1.5 text-[11.5px] text-[var(--tf-text-secondary)]">
          <div>Aktualisiert: <span className="tabular-nums">{fmtZeit(eintrag.aktualisiert)}</span></div>
          {eintrag.vorgaengerId && <div>Ersetzt einen früheren Eintrag (Vorgänger vorhanden).</div>}
          <div>
            Belege:
            <ul className="mt-1 space-y-0.5">
              {eintrag.belege.map((bid) => {
                const ev = ereignisse.get(bid);
                return (
                  <li key={bid} className="pl-2">
                    {ev ? <>{typLabel(ev.typ)} · <span className="tabular-nums">{fmtZeit(ev.zeitstempel)}</span>
                      {ev.entitaet ? ` · ${ev.entitaet.art} ${ev.entitaet.id}` : ''}</>
                      : <span className="text-[var(--tf-text-tertiary)]">Ereignis {bid} (nicht mehr im Protokoll)</span>}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}
      {loeschen.error && <p className="mt-1 text-[11px] text-[var(--tf-danger-text)]">{loeschen.error}</p>}
    </li>
  );
}
