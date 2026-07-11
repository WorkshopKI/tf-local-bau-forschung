/**
 * Einstellungs-Sektion „Assistent & Gedächtnis" (Assistent Phase 0, nur dev —
 * gegated via `isAssistentProtokollEnabled`).
 *
 * Steuert das gerätelokale, opt-in Arbeitsprotokoll: Opt-in-Toggle mit Klartext-
 * Erklärung, „Meine Daten"-Transparenzansicht (Zusammenfassung + letzte 100
 * Ereignisse + JSON-Export) und vollständige Löschung. KEIN LLM, kein Chat —
 * nur die Datengrundlage für den späteren persönlichen Assistenten.
 *
 * Alle Daten bleiben in der IndexedDB dieses Geräts (siehe
 * docs/architecture/assistent-protokoll.md). Die einzige Schreib-Gate-Stelle
 * liegt im Recorder — dieser Tab liest/löscht/exportiert nur.
 */
import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Download, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import {
  exportiereProtokoll,
  istProtokollAktiv,
  ladeLetzteEreignisse,
  ladeStatistik,
  loescheProtokollVollstaendig,
  protokolliereEreignis,
  RETENTION_TAGE,
  setzeProtokollAktiv,
  type AssistentEreignis,
  type ProtokollStatistik,
} from '@/core/services/assistent/protokoll';
import { isAssistentGedaechtnisEnabled } from '@/config/feature-flags';
import { SettingsSectionHeader } from './_shared/settings-primitives';
import { fmtDatum, fmtZeit, typLabel } from './_shared/assistent-format';
import { GedaechtnisSektion } from './GedaechtnisSektion';

export function AssistentTab(): React.ReactElement {
  const [aktiv, setAktiv] = useState<boolean>(istProtokollAktiv());
  const [stats, setStats] = useState<ProtokollStatistik | null>(null);
  const [letzte, setLetzte] = useState<AssistentEreignis[]>([]);
  const [tabelleOffen, setTabelleOffen] = useState(false);
  const [loeschBestaetigung, setLoeschBestaetigung] = useState(false);

  const laden = useCallback(async () => {
    setStats(await ladeStatistik());
    setLetzte(await ladeLetzteEreignisse(100));
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  const umschalten = useAsyncAction<[boolean]>(async (next) => {
    await setzeProtokollAktiv(next);
    setAktiv(next);
    // `einstellung_geaendert` nur beim Einschalten sinnvoll (danach greift das
    // Gate; beim Ausschalten wird ohnehin nichts mehr geschrieben).
    if (next) {
      void protokolliereEreignis({
        typ: 'einstellung_geaendert',
        detail: { schluessel: 'protokoll-optin', wert: true },
      });
    }
    await laden();
  });

  const exportieren = useAsyncAction(async () => {
    await exportiereProtokoll();
  });

  const loeschen = useAsyncAction(async () => {
    await loescheProtokollVollstaendig();
    setLoeschBestaetigung(false);
    await laden();
  });

  const gesamt = stats?.gesamt ?? 0;
  const jeTyp = Object.entries(stats?.jeTyp ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-10">
      {/* ── Arbeitsprotokoll (Opt-in) ── */}
      <section id="sec-assistent-protokoll" className="scroll-mt-20 space-y-4">
        <SettingsSectionHeader label="Arbeitsprotokoll" />
        <div className="flex items-start gap-3">
          <Switch
            checked={aktiv}
            onCheckedChange={(v) => umschalten.run(v)}
            disabled={umschalten.busy}
            aria-label="Arbeitsprotokoll für den persönlichen Assistenten"
          />
          <div className="min-w-0 space-y-2">
            <p className="text-[13.5px] font-medium text-[var(--tf-text)]">
              Arbeitsprotokoll für den persönlichen Assistenten
            </p>
            <p className="text-[12.5px] leading-relaxed text-[var(--tf-text-secondary)] max-w-prose">
              Zeichnet auf, was du in der App tust (welche Anträge und Dokumente du
              öffnest, was du suchst, welche KI-Läufe du startest) — als Grundlage für
              einen späteren persönlichen Assistenten. Die Daten bleiben{' '}
              <span className="text-[var(--tf-text)]">ausschließlich auf diesem Gerät in
              diesem Browser</span>. Niemand sonst — auch keine Administratorin und kein
              Kurator — kann sie einsehen; sie werden nie über das Internet übertragen.{' '}
              {isAssistentGedaechtnisEnabled() ? (
                <>Solange das <span className="text-[var(--tf-text)]">persönliche Gedächtnis</span> (unten)
                aus ist, werden sie gar nicht an eine KI übertragen; ist es an, wertet sie
                ausschließlich das interne Modell vor Ort aus — nie ein externer Dienst.</>
              ) : (
                <>In dieser Version werden sie gar nicht an eine KI übertragen.</>
              )}{' '}
              Du kannst sie jederzeit vollständig löschen; ältere Einträge werden nach {RETENTION_TAGE}{' '}
              Tagen automatisch entfernt.
            </p>
          </div>
        </div>
        {umschalten.error && (
          <p className="text-[12px] text-[var(--tf-danger-text)]">
            Konnte die Einstellung nicht speichern: {umschalten.error}
          </p>
        )}
        {!aktiv && gesamt > 0 && (
          <div
            className="rounded-[var(--tf-radius)] px-3.5 py-3 text-[12.5px] text-[var(--tf-text-secondary)] flex items-center gap-2 flex-wrap"
            style={{ border: '0.5px solid var(--tf-border)' }}
          >
            <span>
              Aufzeichnung ist aus; es sind noch{' '}
              <span className="text-[var(--tf-text)] tabular-nums">{gesamt.toLocaleString('de-DE')}</span>{' '}
              {gesamt === 1 ? 'Ereignis' : 'Ereignisse'} gespeichert.
            </span>
            <button
              type="button"
              className="text-[var(--tf-primary)] hover:underline"
              onClick={() => setLoeschBestaetigung(true)}
            >
              Jetzt löschen
            </button>
          </div>
        )}
      </section>

      {/* ── Meine Daten ── */}
      <section id="sec-assistent-daten" className="scroll-mt-20 space-y-4">
        <SettingsSectionHeader label="Meine Daten" count={gesamt} />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Kennzahl label="Ereignisse" wert={gesamt.toLocaleString('de-DE')} />
          <Kennzahl label="Ereignistypen" wert={String(jeTyp.length)} />
          <Kennzahl label="Ältestes" wert={fmtDatum(stats?.aeltester ?? null)} />
          <Kennzahl label="Neuestes" wert={fmtDatum(stats?.neuester ?? null)} />
        </div>

        {jeTyp.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {jeTyp.map(([typ, n]) => (
              <li
                key={typ}
                className="text-[12px] rounded-full px-2.5 py-1 bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]"
              >
                {typLabel(typ)} · <span className="tabular-nums text-[var(--tf-text)]">{n}</span>
              </li>
            ))}
          </ul>
        )}

        {gesamt > 0 && (
          <div className="space-y-3">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)]"
              onClick={() => setTabelleOffen((o) => !o)}
              aria-expanded={tabelleOffen}
            >
              {tabelleOffen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              Letzte {letzte.length} Ereignisse anzeigen
            </button>
            {tabelleOffen && (
              <div
                className="rounded-[var(--tf-radius)] overflow-hidden max-h-80 overflow-y-auto"
                style={{ border: '0.5px solid var(--tf-border)' }}
              >
                <table className="w-full text-[12px]">
                  <thead className="sticky top-0 bg-[var(--tf-bg-secondary)] text-[var(--tf-text-tertiary)]">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Zeit</th>
                      <th className="text-left font-medium px-3 py-2">Typ</th>
                      <th className="text-left font-medium px-3 py-2">Entität</th>
                    </tr>
                  </thead>
                  <tbody>
                    {letzte.map((e, i) => (
                      <tr
                        key={e.id}
                        style={{ borderTop: i === 0 ? 'none' : '0.5px solid var(--tf-border)' }}
                      >
                        <td className="px-3 py-1.5 text-[var(--tf-text-secondary)] tabular-nums whitespace-nowrap">
                          {fmtZeit(e.zeitstempel)}
                        </td>
                        <td className="px-3 py-1.5 text-[var(--tf-text)]">{typLabel(e.typ)}</td>
                        <td className="px-3 py-1.5 text-[var(--tf-text-secondary)] truncate max-w-[16rem]">
                          {e.entitaet ? `${e.entitaet.art}: ${e.entitaet.id}` : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap pt-1">
          <Button
            variant="secondary"
            size="sm"
            icon={Download}
            loading={exportieren.busy}
            disabled={gesamt === 0}
            onClick={() => exportieren.run()}
          >
            Als JSON exportieren
          </Button>
          {!loeschBestaetigung ? (
            <Button
              variant="danger"
              size="sm"
              icon={Trash2}
              disabled={gesamt === 0}
              onClick={() => setLoeschBestaetigung(true)}
            >
              Alle Protokolldaten löschen
            </Button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12.5px] text-[var(--tf-text-secondary)]">
                Wirklich alle {gesamt.toLocaleString('de-DE')} Einträge löschen?
              </span>
              <Button variant="danger" size="sm" loading={loeschen.busy} onClick={() => loeschen.run()}>
                Ja, alles löschen
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setLoeschBestaetigung(false)}>
                Abbrechen
              </Button>
            </div>
          )}
        </div>
        {(exportieren.error || loeschen.error) && (
          <p className="text-[12px] text-[var(--tf-danger-text)]">
            {exportieren.error ?? loeschen.error}
          </p>
        )}
      </section>

      {/* ── Persönliches Gedächtnis (Phase 2, nur dev) ── */}
      {isAssistentGedaechtnisEnabled() && <GedaechtnisSektion protokollAktiv={aktiv} />}
    </div>
  );
}

function Kennzahl({ label, wert }: { label: string; wert: string }): React.ReactElement {
  return (
    <div
      className="rounded-[var(--tf-radius)] px-3 py-2.5 bg-[var(--tf-bg-secondary)]"
    >
      <div className="text-[11px] text-[var(--tf-text-tertiary)] uppercase tracking-[0.06em]">{label}</div>
      <div className="text-[15px] font-medium text-[var(--tf-text)] tabular-nums mt-0.5">{wert}</div>
    </div>
  );
}
