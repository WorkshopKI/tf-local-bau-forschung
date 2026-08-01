/**
 * Referenzdaten des Vorgangssystems: Status-Code-Katalog und Trigger-Tabelle aus
 * dem Fachsystem importieren — mit Diff-Vorschau **vor** der Übernahme.
 *
 * Zwei Importe, nicht drei: der Kürzel-Katalog kommt weiter über
 * `npm run gen:status-codes` in den Build (Fremddaten getrennt von unserer
 * Kuration, Pitfall #43). Damit dieser Verzicht nicht stumm bleibt, meldet der
 * Kürzel-Tab, wenn im Export Kürzel auftauchen, die der Katalog nicht kennt.
 *
 * Die Übernahme schreibt in den **Entwurf** — gespeichert (und damit für das Team
 * gültig) wird erst über die Speicherleiste, wie bei jeder anderen Änderung.
 * Ohne Schreibrecht sind die Buttons aus; lesen darf jeder.
 */
import { useState } from 'react';
import { FileSpreadsheet, GitCompare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import { pickXlsxFile } from '@/plugins/csv-sources-kuration/csv-file-picker';
import {
  importiereStatusKatalog, importiereTriggerTabelle, diffZusammenfassung,
  aktuellerStatusCodeKatalog, STATUS_CODE_KATALOG,
  type Diff, type StatusCodeEintrag, type TriggerZeile,
} from '@/core/status';
import type { StatusCockpitApi } from './useStatusCockpit';
import { feldStil } from './labels';

/** Was der Nutzer nach dem Lesen der Datei sieht, bevor er übernimmt. */
interface Vorschau {
  art: 'status' | 'trigger';
  titel: string;
  zusammenfassung: string;
  zeilen: string[];
  warnungen: string[];
  /** Beschriftung des Übernehmen-Knopfes — der Katalog geht in den Entwurf,
   *  die Trigger-Tabelle wird als eigene Datei sofort veröffentlicht. */
  aktion: string;
  uebernehmen: () => void | Promise<void>;
}

const HERKUNFT_LABEL: Record<string, string> = {
  share: 'vom Daten-Share',
  cache: 'aus dem lokalen Zwischenspeicher (Share nicht erreichbar)',
  leer: 'noch nicht importiert',
};

const MAX_DIFF_ZEILEN = 40;

function diffZeilen<T>(d: Diff<T>, beschreibe: (e: T) => string): string[] {
  const out: string[] = [];
  for (const e of d.neu) out.push(`+ ${e.schluessel} · ${beschreibe(e.nachher!)}`);
  for (const e of d.geaendert) {
    out.push(`~ ${e.schluessel} · ${beschreibe(e.vorher!)} → ${beschreibe(e.nachher!)} (${e.felder?.join(', ')})`);
  }
  for (const e of d.entfallen) out.push(`− ${e.schluessel} · ${beschreibe(e.vorher!)}`);
  return out;
}

function VorschauKarte({ v, onVerwerfen, darfSchreiben }: {
  v: Vorschau;
  onVerwerfen: () => void;
  darfSchreiben: boolean;
}): React.ReactElement {
  const sichtbar = v.zeilen.slice(0, MAX_DIFF_ZEILEN);
  return (
    <div className="flex flex-col gap-2 rounded px-3 py-2.5" style={feldStil}>
      <div className="flex items-center gap-2 flex-wrap">
        <GitCompare size={14} className="text-[var(--tf-text-tertiary)]" />
        <span className="text-[12.5px] font-medium text-[var(--tf-text)]">{v.titel}</span>
        <span className="text-[12px] text-[var(--tf-text-secondary)]">{v.zusammenfassung}</span>
      </div>

      {v.warnungen.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {v.warnungen.map((w, i) => (
            <li key={i} className="text-[11.5px] text-[var(--tf-warning-text)]">⚠ {w}</li>
          ))}
        </ul>
      )}

      {sichtbar.length > 0 && (
        <div className="max-h-[240px] overflow-y-auto rounded bg-[var(--tf-bg)] px-2 py-1.5">
          <ul className="flex flex-col gap-0.5">
            {sichtbar.map((z, i) => (
              <li key={i} className="text-[11.5px] font-mono text-[var(--tf-text-secondary)] whitespace-pre-wrap">
                {z}
              </li>
            ))}
            {v.zeilen.length > sichtbar.length && (
              <li className="text-[11.5px] text-[var(--tf-text-tertiary)]">
                … {v.zeilen.length - sichtbar.length} weitere Änderungen
              </li>
            )}
          </ul>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          variant="primary" size="sm" disabled={!darfSchreiben}
          title={darfSchreiben ? undefined : 'Nur mit Schreibrecht auf den Daten-Share'}
          onClick={() => { void v.uebernehmen(); }}
        >
          {v.aktion}
        </Button>
        <Button variant="ghost" size="sm" onClick={onVerwerfen}>Verwerfen</Button>
      </div>
    </div>
  );
}

export function ReferenzdatenSektion({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const [offen, toggleOffen] = useCollapsedSection(
    'status-cockpit:referenzdaten', { defaultOpen: false },
  );
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const entwurf = api.entwurf;

  // WICHTIG: `pickXlsxFile` ist der erste `await` — kein weiterer davor, sonst
  // verwirft der Browser die Klick-Geste (recurring-bug-classes Bug-Klasse 2).
  const statusImport = useAsyncAction(async () => {
    const datei = await pickXlsxFile();
    if (!datei || !entwurf) return;
    setFehler(null);
    const bestand = aktuellerStatusCodeKatalog(entwurf, STATUS_CODE_KATALOG);
    const e = await importiereStatusKatalog(datei, bestand);
    if (e.fehler || !e.diff) { setFehler(e.fehler ?? 'Import fehlgeschlagen.'); return; }
    setVorschau({
      art: 'status',
      titel: `Status-Katalog · ${datei.name}`,
      zusammenfassung: diffZusammenfassung(e.diff),
      zeilen: diffZeilen<StatusCodeEintrag>(e.diff, x => x.text),
      warnungen: e.warnungen,
      aktion: 'In den Entwurf übernehmen',
      uebernehmen: () => { api.statusCodesUebernehmen(e.eintraege); setVorschau(null); },
    });
  });

  const triggerImport = useAsyncAction(async () => {
    const datei = await pickXlsxFile();
    if (!datei || !entwurf) return;
    setFehler(null);
    const kuerzel = entwurf.felder.map(f => f.code).filter((c): c is string => !!c);
    const e = await importiereTriggerTabelle(datei, api.trigger.datei?.trigger ?? [], kuerzel);
    if (e.fehler || !e.diff) { setFehler(e.fehler ?? 'Import fehlgeschlagen.'); return; }
    const warnungen = [...e.warnungen];
    if (e.nichtInterpretiert > 0) {
      warnungen.push(
        `${e.nichtInterpretiert} von ${e.zeilen.length} Zeilen konnte der Parser nicht deuten — `
        + 'sie werden mit Rohtext übernommen und in der Erklärung als „nicht interpretiert" gezeigt.',
      );
    }
    if (e.unbekannteKuerzel.length > 0) {
      warnungen.push(
        `${e.unbekannteKuerzel.length} referenzierte Kürzel stehen nicht im Katalog `
        + `(${e.unbekannteKuerzel.slice(0, 12).join(', ')}${e.unbekannteKuerzel.length > 12 ? ' …' : ''}). `
        + 'Die Trigger können trotzdem übernommen werden; die Erklärung zeigt dann „unbekanntes Kürzel".',
      );
    }
    setVorschau({
      art: 'trigger',
      titel: `Trigger-Tabelle · ${datei.name}`,
      zusammenfassung: diffZusammenfassung(e.diff),
      zeilen: diffZeilen<TriggerZeile>(e.diff, x => `${x.prozedur} ${x.parameterRoh}`),
      warnungen,
      // Eigene Datei, eigener Stand: die Trigger gehen nicht über die
      // Speicherleiste des Katalogs, sondern werden direkt veröffentlicht.
      aktion: 'Übernehmen und veröffentlichen',
      uebernehmen: async () => {
        const aufShare = await api.triggerUebernehmen(e.zeilen);
        setVorschau(null);
        if (!aufShare) {
          setFehler(
            'Die Trigger-Tabelle wurde nur lokal gespeichert — der Daten-Share war nicht '
            + 'erreichbar oder es fehlt das Schreibrecht. Sie gilt damit noch nicht für das Team.',
          );
        }
      },
    });
  });

  if (!entwurf) return null;

  const mitCode = entwurf.werte.filter(w => w.code !== undefined).length;
  const ohneCode = entwurf.werte.filter(w => w.aktiv && w.code === undefined).length;
  const trigger = api.trigger.datei?.trigger ?? [];
  const triggerOffen = trigger.filter(t => t.geparst === null).length;
  const busy = statusImport.busy || triggerImport.busy;

  return (
    <section className="mt-6 rounded" style={feldStil}>
      <button
        type="button" onClick={toggleOffen} aria-expanded={offen}
        className="w-full flex items-center gap-2 px-3 py-2 text-[13px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
      >
        <FileSpreadsheet size={15} />
        Referenzdaten (Vorgangssystem)
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">
          {mitCode} Statuswerte mit Code · {trigger.length} Trigger
        </span>
        <span className="ml-auto text-[11px] text-[var(--tf-text-tertiary)]">
          {offen ? 'einklappen' : 'ausklappen'}
        </span>
      </button>

      {offen && (
        <div className="flex flex-col gap-3 border-t border-[var(--tf-border)] px-3 py-3">
          <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
            Der Export liefert den Status nur als Text. Diese beiden Zuarbeiten aus dem Fachsystem
            geben ihm einen Code und sagen, was ein gesetztes Kürzel auslöst. Sie kommen alle paar
            Monate neu — vor jeder Übernahme steht die Vorschau.
          </p>

          {/* Eine Fassung, die vor dem Vorgangssystem gespeichert wurde, hat den
              Seed nie gesehen: sie führt Statuswerte ohne Code und keine
              ZAH-Phasen. Ohne diesen Weg bliebe die ganze Schicht dort
              wirkungslos — dasselbe Muster wie beim Feld-Nachzug im Kürzel-Tab. */}
          {(api.vorgangssystemLuecke.werteOhneCode > 0 || api.vorgangssystemLuecke.phasenFehlen
            || api.vorgangssystemLuecke.doppelteCodes > 0) && (
            <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
              <span className="text-[12.5px] text-[var(--tf-text)]">
                Diese Fassung stammt aus der Zeit vor dem Vorgangssystem:
                {api.vorgangssystemLuecke.werteOhneCode > 0
                  && ` ${api.vorgangssystemLuecke.werteOhneCode} Statuswerte ohne Code`}
                {api.vorgangssystemLuecke.werteOhneCode > 0 && api.vorgangssystemLuecke.phasenFehlen && ','}
                {api.vorgangssystemLuecke.phasenFehlen && ' keine ZAH-Phasen'}.
                Kuratiertes bleibt unangetastet.
                {/* Die Dubletten sind kein „fehlt noch", sondern ein Fehlstand:
                    das Aufräumen ENTFERNT ein Feld. Das gehört ausgesprochen. */}
                {api.vorgangssystemLuecke.doppelteCodes > 0 && (
                  <>
                    {' '}
                    <span className="text-[var(--tf-warning-text)]">
                      {api.vorgangssystemLuecke.doppelteCodes} Kürzel werden doppelt geführt
                      (kanonisches Feld und eigene Spalte) — das Nachziehen entfernt die
                      überzählige Spalte, sonst gilt das Kürzel überall als nie gesetzt.
                    </span>
                  </>
                )}
              </span>
              <Button
                variant="secondary" size="sm" disabled={!api.darfSchreiben}
                title={api.darfSchreiben ? undefined : 'Nur mit Schreibrecht auf den Daten-Share'}
                onClick={api.vorgangssystemNachziehen}
              >
                Nachziehen
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary" size="sm" icon={FileSpreadsheet} disabled={busy}
                onClick={() => statusImport.run()}
              >
                {statusImport.busy ? 'Liest …' : 'Status-Katalog (XLSX)'}
              </Button>
              <span className="text-[12px] text-[var(--tf-text-tertiary)]">
                {mitCode} Werte zugeordnet
                {ohneCode > 0 && (
                  <> · <span className="text-[var(--tf-warning-text)]">{ohneCode} ohne Code</span></>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="secondary" size="sm" icon={FileSpreadsheet} disabled={busy}
                onClick={() => triggerImport.run()}
              >
                {triggerImport.busy ? 'Liest …' : 'Trigger-Tabelle (XLSX)'}
              </Button>
              <span className="text-[12px] text-[var(--tf-text-tertiary)]">
                {trigger.length === 0
                  ? HERKUNFT_LABEL[api.trigger.herkunft]
                  : `Stand v${api.trigger.datei?.version} · ${trigger.length} Zeilen · ${HERKUNFT_LABEL[api.trigger.herkunft]}`}
                {triggerOffen > 0 && (
                  <> · <span className="text-[var(--tf-warning-text)]">{triggerOffen} nicht interpretiert</span></>
                )}
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="default">Kürzel-Katalog</Badge>
              <span className="text-[12px] text-[var(--tf-text-tertiary)]">
                kommt aus der Zuarbeit-CSV in den Build (<code>npm run gen:status-codes</code>) —
                Abweichungen meldet der Kürzel-Tab.
              </span>
            </div>
          </div>

          {(fehler ?? statusImport.error ?? triggerImport.error) != null && (
            <p className="text-[11.5px] text-[var(--tf-danger-text)]">
              ⚠ {fehler ?? statusImport.error ?? triggerImport.error}
            </p>
          )}

          {vorschau && (
            <VorschauKarte
              v={vorschau} onVerwerfen={() => setVorschau(null)} darfSchreiben={api.darfSchreiben}
            />
          )}
        </div>
      )}
    </section>
  );
}
