/**
 * „Änderungen der letzten Nacht" — was der jüngste Export gebracht hat.
 *
 * Die Frage, mit der ein Arbeitstag anfängt: *was ist über Nacht passiert?* Der
 * Export selbst kann sie nicht beantworten, er zeigt nur den Endzustand; das
 * Import-Diff-Journal kann es.
 *
 * **Keine Personen-Achse.** Keine Zeile sagt, WER etwas gesetzt hat — das
 * Journal führt keine Kürzel, und diese Ansicht darf auch keine erfinden. Ein
 * „wer hat heute Nacht was gesetzt" wäre ein Aktivitätsprotokoll und damit
 * mitbestimmungspflichtig; das ist eine bewusste Gestaltungsentscheidung
 * (Pitfall #48).
 *
 * **Der Bearbeiter-Ausschnitt ist davon unberührt** (v4.134): er wählt aus, an
 * WELCHEN Vorgängen Änderungen gezeigt werden — dieselbe Sicht wie in „Meine
 * Anträge", im Kanban und in der Liste, umschaltbar über den Chip im Seitenkopf.
 * Das ist eine Aussage über Anträge, keine über Personen: wer in der eigenen
 * Sicht sitzt, sieht auch, was AB, QS oder Juristen an seinen Vorgängen geändert
 * haben. Ohne diesen Ausschnitt standen hier 400 Zeilen, von denen 7 den Leser
 * angingen (gemessen 20.08.2026).
 *
 * Opt-in: der Katalog liefert das Widget mit, `reconcileVerfuegbareWidgets`
 * ergänzt es mit `sichtbar: false`. Wer es sehen will, schaltet es ein.
 */
import { useEffect, useMemo, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import { letzterNachtLauf, type JournalEintrag, type NachtLauf } from '@/core/status';
import { useAntraegeStore } from '@/plugins/antraege/store';
import {
  antragMatchesBearbeiter, bearbeiterScopeLabel,
} from '@/plugins/antraege/bearbeiterFilter';
import { gruppiereNachAntrag, nachtlaufBilanz } from './nachtlaufGruppen';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const MAX_ZEILEN = 10;

function tagDe(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

export function NachtlaufWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement | null {
  const idb = useStorage().idb;
  const { navigate } = useNavigation();
  const { mode } = useBearbeiterSicht();
  const antraege = useAntraegeStore(s => s.antraege);
  const aktiv = !instanz.eingeklappt;
  const [lauf, setLauf] = useState<NachtLauf | null>(null);
  const [laden, setLaden] = useState(false);
  const [geladen, setGeladen] = useState(false);

  useEffect(() => {
    if (!aktiv || geladen) return;
    let abgebrochen = false;
    setLaden(true);
    void (async () => {
      try {
        const l = await letzterNachtLauf(idb);
        if (!abgebrochen) setLauf(l);
      } finally {
        if (!abgebrochen) { setLaden(false); setGeladen(true); }
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, aktiv, geladen]);

  // Aktenzeichen → Antrag. Das Journal keyt auf `aktenzeichen` (im Export die
  // FKZ-Spalte), der Store also direkt der Join-Partner.
  const index = useMemo(
    () => new Map(antraege.map(a => [a.aktenzeichen, a])),
    [antraege],
  );

  const alle: readonly JournalEintrag[] = lauf?.eintraege ?? [];
  const eigene = useMemo(
    () => (mode.active
      ? alle.filter(e => {
        const a = index.get(e.antragId);
        return a !== undefined && antragMatchesBearbeiter(a, mode);
      })
      : alle),
    [alle, index, mode],
  );
  const zeilen = useMemo(
    () => gruppiereNachAntrag(eigene, id => index.get(id)?.akronym),
    [eigene, index],
  );

  if (!isVorgangssystemEnabled()) return null;

  const sichtbar = zeilen.slice(0, MAX_ZEILEN);
  const rest = zeilen.length - sichtbar.length;
  // Wie viel der Lauf INSGESAMT brachte — sonst liest sich eine leere eigene
  // Liste als „der Import hat nichts gebracht".
  const fremde = alle.length - eigene.length;

  return (
    <WidgetShell
      instanz={instanz}
      titel="Änderungen der letzten Nacht"
      meta={lauf
        ? `Export vom ${tagDe(lauf.datum)} · ${bearbeiterScopeLabel(mode)}`
        : bearbeiterScopeLabel(mode)}
      variante={instanz.bereich === 'seite' ? 'seite' : 'haupt'}
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      zaehler={
        // Eingeklappt wird nicht gelesen — dann steht hier „—", keine 0
        // (dieselbe Regel wie im Fristen-Widget, v4.131).
        <span
          className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]"
          title={!aktiv ? 'Zum Zählen aufklappen — eingeklappt wird das Journal nicht gelesen.' : undefined}
        >
          {!aktiv ? '—' : laden ? '…' : nachtlaufBilanz(zeilen)}
        </span>
      }
    >
      {laden && <p className="text-[12px] text-[var(--tf-text-tertiary)]">Lädt …</p>}
      {!laden && lauf === null && (
        // Kein Journal ⇒ das sagen, statt eine leere Liste zu zeigen.
        <p className="text-[12px] text-[var(--tf-text-secondary)]">
          Es wird noch kein Änderungs-Journal geführt. Es entsteht mit dem nächsten Import auf einem
          Gerät mit Schreibrecht.
        </p>
      )}
      {!laden && lauf !== null && (
        <>
          {/* Das Export-Datum steht in der Kopfzeile der Shell; hier nur der
              Nullpunkt — er gehört an jede Journal-Anzeige, sonst wird eine
              Teil-Historie als vollständige gelesen. Dazu, falls der jüngste
              Export nichts brachte, WELCHER Lauf hier steht (v4.134). */}
          <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-1.5">
            Historie ab {tagDe(lauf.journalAb)}
            {lauf.ersatzFuer
              ? ` · der Export vom ${tagDe(lauf.ersatzFuer.datum)} hat nichts geändert — gezeigt ist der letzte Lauf mit Änderungen`
              : ''}
          </p>
          {zeilen.length === 0 ? (
            <p className="text-[12px] text-[var(--tf-text-secondary)]">
              {fremde > 0
                ? `An Ihren Vorgängen hat sich nichts geändert — ${fremde.toLocaleString('de-DE')} Änderungen betrafen andere.`
                : 'Der letzte Export hat an den erfassten Kürzeln nichts geändert.'}
            </p>
          ) : (
            <ul className="flex flex-col">
              {sichtbar.map(z => (
                <li key={z.antragId}>
                  <button
                    type="button"
                    onClick={() => navigate('antraege', { selectedId: z.antragId })}
                    title={`${z.antragId}${z.unscharf ? ' · als Zeitraum belegt (zwischen zwei Exporten lag mehr als ein Tag)' : ''}`}
                    className="flex w-full items-baseline gap-2 rounded-[6px] px-1 py-[3px] text-left hover:bg-[var(--tf-hover)] cursor-pointer"
                  >
                    <span className="w-[24px] shrink-0 text-right font-mono text-[11.5px] tabular-nums text-[var(--tf-text)]">
                      {z.anzahl.toLocaleString('de-DE')}
                    </span>
                    <span className="max-w-[34%] shrink-0 truncate text-[12.5px] font-medium text-[var(--tf-text)]">
                      {z.label}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-[var(--tf-text-tertiary)]">
                      {z.text}
                    </span>
                    {z.unscharf && (
                      <span aria-hidden className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">~</span>
                    )}
                  </button>
                </li>
              ))}
              {rest > 0 && (
                <li className="pt-0.5 text-[11px] text-[var(--tf-text-tertiary)]">
                  … und {rest.toLocaleString('de-DE')} weitere {rest === 1 ? 'Vorgang' : 'Vorgänge'}
                </li>
              )}
            </ul>
          )}
          {zeilen.length > 0 && fremde > 0 && (
            // Der Ausschnitt nennt seinen Rest (v4.131-Regel): ohne das läse
            // sich die eigene Liste als der ganze Lauf.
            <p className="pt-1 text-[11px] text-[var(--tf-text-tertiary)]">
              {fremde.toLocaleString('de-DE')} weitere Änderungen betrafen Vorgänge außerhalb
              Ihres Ausschnitts.
            </p>
          )}
        </>
      )}
    </WidgetShell>
  );
}
