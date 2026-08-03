/**
 * „Änderungen der letzten Nacht" — was der jüngste Export gebracht hat.
 *
 * Die Frage, mit der ein Arbeitstag anfängt: *was ist über Nacht passiert?* Der
 * Export selbst kann sie nicht beantworten, er zeigt nur den Endzustand; das
 * Import-Diff-Journal kann es.
 *
 * **Keine Personen-Achse.** Gruppiert wird nach Feld, nie nach Bearbeiter — das
 * Journal führt keine Kürzel, und diese Ansicht darf auch keine erfinden. Ein
 * „wer hat heute Nacht was gesetzt" wäre ein Aktivitätsprotokoll und damit
 * mitbestimmungspflichtig; das ist eine bewusste Gestaltungsentscheidung.
 *
 * Opt-in: der Katalog liefert das Widget mit, `reconcileVerfuegbareWidgets`
 * ergänzt es mit `sichtbar: false`. Wer es sehen will, schaltet es ein.
 */
import { useEffect, useState } from 'react';
import { useStorage } from '@/core/hooks/useStorage';
import { isVorgangssystemEnabled } from '@/config/feature-flags';
import { letzterNachtLauf, type JournalEintrag, type NachtLauf } from '@/core/status';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const MAX_ZEILEN = 12;

const ART_TEXT: Record<JournalEintrag['art'], string> = {
  gesetzt: 'gesetzt',
  geaendert: 'geändert',
  geleert: 'zurückgenommen',
  'antrag-neu': 'neu im Export',
  'antrag-fehlt': 'nicht mehr im Export',
};

function tagDe(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso;
}

interface Gruppe {
  /** Feldname bzw. die Eintragsart, wo es kein Feld gibt. */
  titel: string;
  art: JournalEintrag['art'];
  anzahl: number;
  beispiele: string[];
}

/** Nach Feld gruppieren — ausdrücklich NICHT nach Bearbeiter (siehe Modulkopf). */
function gruppiere(eintraege: readonly JournalEintrag[]): Gruppe[] {
  const proSchluessel = new Map<string, Gruppe>();
  for (const e of eintraege) {
    const titel = e.feld ?? ART_TEXT[e.art];
    const key = `${titel}|${e.art}`;
    const g = proSchluessel.get(key);
    if (g) {
      g.anzahl += 1;
      if (g.beispiele.length < 3) g.beispiele.push(e.antragId);
    } else {
      proSchluessel.set(key, { titel, art: e.art, anzahl: 1, beispiele: [e.antragId] });
    }
  }
  return [...proSchluessel.values()]
    .sort((a, b) => b.anzahl - a.anzahl || a.titel.localeCompare(b.titel));
}

export function NachtlaufWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement | null {
  const idb = useStorage().idb;
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

  if (!isVorgangssystemEnabled()) return null;

  const gruppen = lauf ? gruppiere(lauf.eintraege) : [];

  return (
    <WidgetShell
      instanz={instanz}
      titel="Änderungen der letzten Nacht"
      meta={lauf ? `Export vom ${tagDe(lauf.datum)}` : undefined}
      variante={instanz.bereich === 'seite' ? 'seite' : 'haupt'}
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
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
              Teil-Historie als vollständige gelesen. */}
          <p className="text-[11px] text-[var(--tf-text-tertiary)] mb-1.5">
            Historie ab {tagDe(lauf.journalAb)}
          </p>
          {gruppen.length === 0 ? (
            <p className="text-[12px] text-[var(--tf-text-secondary)]">
              Der letzte Export hat an den erfassten Kürzeln nichts geändert.
            </p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {gruppen.slice(0, MAX_ZEILEN).map(g => (
                <li key={`${g.titel}-${g.art}`} className="flex items-baseline gap-2">
                  <span className="w-[46px] shrink-0 text-right font-mono text-[11.5px] text-[var(--tf-text)]">
                    {g.anzahl.toLocaleString('de-DE')}
                  </span>
                  <span className="font-mono text-[11.5px] text-[var(--tf-text-secondary)]">{g.titel}</span>
                  <span className="text-[11px] text-[var(--tf-text-tertiary)]">{ART_TEXT[g.art]}</span>
                  <span className="truncate text-[11px] text-[var(--tf-text-tertiary)]">
                    {g.beispiele.join(', ')}
                  </span>
                </li>
              ))}
              {gruppen.length > MAX_ZEILEN && (
                <li className="text-[11px] text-[var(--tf-text-tertiary)]">
                  … und {gruppen.length - MAX_ZEILEN} weitere Felder
                </li>
              )}
            </ul>
          )}
        </>
      )}
    </WidgetShell>
  );
}
