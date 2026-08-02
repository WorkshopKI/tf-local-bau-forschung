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
  aktuellerStatusCodeKatalog, STATUS_CODE_KATALOG, zeilenOhneProgramm, programmeInTrigger,
  type Diff, type ProgrammStatistik, type StatusCodeEintrag, type TriggerZeile,
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
  /** Zeilen/Kürzel je Programm — steht ÜBER dem Diff, weil ein fehlendes
   *  Programm die wichtigere Nachricht ist als eine geänderte Zeile. */
  jeProgramm?: ProgrammStatistik[];
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

      {v.jeProgramm && v.jeProgramm.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {v.jeProgramm.map(p => (
            <span key={p.programm} className="text-[11.5px] text-[var(--tf-text-secondary)]">
              <span className="font-mono text-[var(--tf-text)]">{p.programm}</span>
              {' '}{p.zeilen} Zeilen · {p.kuerzel} Kürzel
            </span>
          ))}
        </div>
      )}

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

  /** Was der Fassung fehlt — als Liste, damit der Satz immer aufgeht. */
  const l = api.vorgangssystemLuecke;
  const luecken: string[] = [
    ...(l.werteOhneCode > 0 ? [`${l.werteOhneCode} Statuswerte ohne Code`] : []),
    ...(l.phasenFehlen ? ['keine ZAH-Phasen'] : []),
    ...(l.todoRegelnFehlen ? ['keine To-do-Regeln'] : []),
    ...(l.doppelteCodes > 0 ? [`${l.doppelteCodes} doppelt geführte Kürzel`] : []),
  ];

  // WICHTIG: `pickXlsxFile` ist der erste `await` — kein weiterer davor, sonst
  // verwirft der Browser die Klick-Geste (recurring-bug-classes Bug-Klasse 2).
  const statusImport = useAsyncAction(async () => {
    const datei = await pickXlsxFile();
    if (!datei || !entwurf) return;
    setFehler(null);
    const bestand = aktuellerStatusCodeKatalog(entwurf, STATUS_CODE_KATALOG);
    const e = await importiereStatusKatalog(datei, bestand);
    if (e.fehler || !e.diff) { setFehler(e.fehler ?? 'Import fehlgeschlagen.'); return; }
    const warnungen = [...e.warnungen];
    if (e.unbekannteBearbeiter.length > 0) {
      warnungen.push(
        `Bearbeiter-Kürzel aus der Zuarbeit, die die App nicht kennt: `
        + `${e.unbekannteBearbeiter.join(', ')}. Die Mail-Trigger nennen sie dann ohne Rolle.`,
      );
    }
    setVorschau({
      art: 'status',
      titel: `Parametertabelle · ${datei.name}`,
      zusammenfassung: `${diffZusammenfassung(e.diff)}`
        + (e.textbausteine.length > 0 ? ` · ${e.textbausteine.length} Textbausteine` : ''),
      zeilen: diffZeilen<StatusCodeEintrag>(e.diff, x => x.text),
      warnungen,
      aktion: 'In den Entwurf übernehmen',
      uebernehmen: () => {
        api.statusCodesUebernehmen(e.eintraege, e.textbausteine);
        setVorschau(null);
      },
    });
  });

  const triggerImport = useAsyncAction(async () => {
    const datei = await pickXlsxFile();
    if (!datei || !entwurf) return;
    setFehler(null);
    const kuerzel = entwurf.felder.map(f => f.code).filter((c): c is string => !!c);
    const e = await importiereTriggerTabelle(
      datei, api.trigger.datei?.trigger ?? [], kuerzel, api.programmeImBestand,
    );
    if (e.fehler || !e.diff) { setFehler(e.fehler ?? 'Import fehlgeschlagen.'); return; }
    const warnungen = [...e.warnungen];
    if (e.programmeOhneTrigger.length > 0) {
      warnungen.push(
        'Für diese Programme des Bestands führt die Datei keine Trigger: '
        + `${e.programmeOhneTrigger.map(p => `${p.programm} (${p.antraege} Anträge)`).join(', ')}. `
        + 'Dort bleiben Navigator und Erklärung stumm — das ist Absicht, kein Ausfall.',
      );
    }
    if (e.nichtInterpretiert.length > 0) {
      // Konkret statt nur gezählt: eine gestiegene Zahl heißt „Schema geändert",
      // und dann will man die Rohtexte sehen, nicht die Summe.
      const liste = e.nichtInterpretiert
        .slice(0, 8)
        .map(z => `${z.programm}/${z.kuerzel}/${z.folge}: ${z.parameterRoh || '(leer)'}`)
        .join(' · ');
      warnungen.push(
        `${e.nichtInterpretiert.length} von ${e.zeilen.length} Zeilen konnte der Parser nicht `
        + `deuten — sie werden mit Rohtext übernommen. ${liste}`
        + (e.nichtInterpretiert.length > 8 ? ` … und ${e.nichtInterpretiert.length - 8} weitere` : ''),
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
      zusammenfassung: `${e.zeilen.length} Zeilen in ${e.jeProgramm.length} Programmen · `
        + diffZusammenfassung(e.diff),
      zeilen: diffZeilen<TriggerZeile>(e.diff, x => `${x.prozedur} ${x.parameterRoh}`),
      warnungen,
      jeProgramm: e.jeProgramm,
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
  const ohneProgramm = zeilenOhneProgramm(trigger);
  const programme = programmeInTrigger(trigger);
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
            geben ihm einen Code und sagen, was ein gesetztes Kürzel auslöst. Gelesen werden die
            Blätter „Erklärung Parameter" und „Trigger-Prozeduren" — passt der Name nicht, wird die
            ganze Mappe nach passenden Überschriften durchsucht. Die Trigger gelten <b>je
            Richtlinie</b>; welche Menge an einem Antrag gilt, entscheidet dessen FM-Nummer.
            Vor jeder Übernahme steht die Vorschau.
          </p>

          {/* Eine Fassung, die vor dem Vorgangssystem gespeichert wurde, hat den
              Seed nie gesehen: sie führt Statuswerte ohne Code und keine
              ZAH-Phasen. Ohne diesen Weg bliebe die ganze Schicht dort
              wirkungslos — dasselbe Muster wie beim Feld-Nachzug im Kürzel-Tab. */}
          {luecken.length > 0 && (
            <div className="flex items-center justify-between gap-2 rounded px-2.5 py-2" style={feldStil}>
              <span className="text-[12.5px] text-[var(--tf-text)]">
                {/* Als LISTE gebaut und dann verbunden, nicht aus Bedingungen
                    zusammengeklebt: sonst steht bei ausgefallenen Teilen ein
                    Satzzeichen ohne Satz („vor dem Vorgangssystem:, keine
                    To-do-Regeln") — in der laufenden App beobachtet. */}
                Diese Fassung stammt aus der Zeit vor dem Vorgangssystem:
                {' '}{luecken.join(', ')}.
                {' '}Kuratiertes bleibt unangetastet.
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
                {statusImport.busy ? 'Liest …' : 'Parametertabelle (XLSX)'}
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
                  : `Stand v${api.trigger.datei?.version} · ${trigger.length} Zeilen`
                    + ` · ${programme.length} Programme (${programme.join(', ')})`
                    + ` · ${HERKUNFT_LABEL[api.trigger.herkunft]}`}
                {triggerOffen > 0 && (
                  <> · <span className="text-[var(--tf-warning-text)]">{triggerOffen} nicht interpretiert</span></>
                )}
              </span>
            </div>

            {/* Ein Bestand aus der Zeit vor der Programm-Dimension ist nicht
                halb richtig, sondern unbrauchbar: er wurde beim Import auf das
                erste Programm eingedampft. Das gehört ausgesprochen, nicht
                stillschweigend weiterbenutzt. */}
            {ohneProgramm > 0 && (
              <p className="text-[11.5px] text-[var(--tf-warning-text)]">
                ⚠ {ohneProgramm} der {trigger.length} Zeilen tragen keine Programm-Angabe — sie
                stammen aus einem Import vor v2.380, der alle Programme auf das erste eingedampft
                hat. Sie greifen an keinem Antrag. Bitte die Trigger-XLSX neu einlesen.
              </p>
            )}

            {api.antraegeOhneProgramm > 0 && (
              <p className="text-[11.5px] text-[var(--tf-warning-text)]">
                ⚠ {api.antraegeOhneProgramm} Anträge im Bestand tragen keine Programm-Nummer
                (Spalte FM_NUMMER nicht gemappt) — dort kann das Vorgangssystem keine Trigger
                zuordnen.
              </p>
            )}

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
