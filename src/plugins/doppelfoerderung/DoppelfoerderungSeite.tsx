/**
 * Die Doppelförderungs-Prüfung: gemeldete Liste hochladen, gegen den Bestand
 * halten, Ergebnis exportieren.
 *
 * Eigene Seite ausserhalb der Navigation — erreichbar über den ⋯-Menüpunkt im
 * Kopf der Suchseite. Sie braucht die volle Blattbreite: eine Meldungszeile
 * bringt bis zu zehn gefundene Vorhaben mit Titel und Kurzbeschreibung mit, und
 * das ist in einem Dialog nicht lesbar.
 *
 * Doku: docs/architecture/doppelfoerderung.md
 */
import { useState } from 'react';
import { ArrowLeft, Download, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageHeader } from '@/components/ui/PageHeader';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { SeitenHilfeButton } from '@/components/help/SeitenHilfeButton';
import { SCHWELLE_VORGABE as SCHLAGWORT_SCHWELLE } from './services/abgleich';
import { BEREICH_VORGABE } from './services/bereich';
import { exportiereErgebnis } from './services/export';
import { ListeAufnehmen } from './components/ListeAufnehmen';
import { ErgebnisTabelle } from './components/ErgebnisTabelle';
import { useDoppelfoerderung } from './useDoppelfoerderung';
import type { BereichsWahl } from './types';

const ZAHL = new Intl.NumberFormat('de-DE');

/** Die drei Stufen des Reglers. „1 von 3" ist das reine ODER der Anforderung. */
const SCHWELLEN: readonly { wert: number; label: string; hilfe: string }[] = [
  { wert: 1, label: '1 von 3', hilfe: 'Reines ODER — ein Schlagwort genügt. Bei weit gefassten Schlagworten trifft das ein Viertel des Bestands (gemessen: 1.150 von 4.327).' },
  { wert: 2, label: '2 von 3', hilfe: 'Vorbelegung: mindestens zwei der drei Schlagworte. Gemessen 103 statt 1.150 Treffer.' },
  { wert: 3, label: '3 von 3', hilfe: 'Alle drei Schlagworte. Sehr streng — beim weiten Beispiel-Trio blieb ein einziges Vorhaben übrig.' },
];

export function DoppelfoerderungSeite(): React.ReactElement {
  const [schwelle, setSchwelle] = useState(SCHLAGWORT_SCHWELLE);
  const [bereich, setBereich] = useState<BereichsWahl>(BEREICH_VORGABE);
  const d = useDoppelfoerderung(schwelle);

  const treffer = d.ergebnisse.filter(e => e.uebereinstimmung).length;
  const geprueft = d.ergebnisse.filter(e => !e.fehler).length;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="px-8 pt-4 pb-8">
        <PageHeader
          title="Doppelförderung"
          subtitle={d.bereichsGroesse !== null && d.bestandsGroesse !== null
            ? `Verglichen gegen ${ZAHL.format(d.bereichsGroesse)} von ${ZAHL.format(d.bestandsGroesse)} Anträgen`
            : 'Gemeldete Vorhaben der Frühkoordinierung gegen den ZIM-Bestand halten'}
          className="mb-4 w-full"
          actions={(
            <div className="flex items-center gap-1">
              {d.phase === 'ergebnis' && (
                <>
                  <Button
                    variant="ghost" size="sm" icon={Download}
                    onClick={() => exportiereErgebnis(d.ergebnisse)}
                  >
                    Als Excel
                  </Button>
                  <Button variant="ghost" size="sm" icon={RotateCcw} onClick={d.zuruecksetzen}>
                    Neue Liste
                  </Button>
                </>
              )}
              <a
                href="#/suche"
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2.5 text-[12.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)]"
              >
                <ArrowLeft size={13} /> Zur Suche
              </a>
              <SeitenHilfeButton pluginId="doppelfoerderung" />
            </div>
          )}
        />

        {d.fehler && (
          <div
            className="mb-4 max-w-4xl rounded-[var(--tf-radius)] px-3 py-2 text-[12.5px] text-[var(--tf-text)]"
            style={{ border: '0.5px solid var(--tf-border)', background: 'var(--tf-bg-secondary)' }}
          >
            {d.fehler}
          </div>
        )}

        {d.phase === 'aufnehmen' && (
          <ListeAufnehmen
            bereich={bereich}
            onBereich={setBereich}
            laeuft={d.laeuft}
            onStart={zeilen => d.starte(zeilen, bereich)}
          />
        )}

        {d.phase === 'pruefen' && d.fortschritt && (
          <div className="flex max-w-4xl flex-col gap-3">
            <ProgressBar
              value={d.fortschritt.gesamt === 0 ? 0 : d.fortschritt.fertig / d.fortschritt.gesamt}
              label={`${d.fortschritt.fertig} von ${d.fortschritt.gesamt}`}
            />
            <p className="truncate text-[12.5px] text-[var(--tf-text-secondary)]">
              {d.fortschritt.zeile}
            </p>
            <p className="text-[12px] text-[var(--tf-text-tertiary)]">
              Je Zeile fragt die interne KI einmal nach drei Schlagworten — das dauert
              einige Sekunden pro Zeile. Fertige Zeilen bleiben stehen, wenn Sie abbrechen.
            </p>
            <Button variant="ghost" size="sm" icon={X} onClick={d.brichAb} className="self-start">
              Abbrechen
            </Button>
          </div>
        )}

        {d.phase === 'ergebnis' && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-[13px] text-[var(--tf-text)]">
                <span className="tabular-nums font-medium">{treffer}</span> von{' '}
                <span className="tabular-nums">{geprueft}</span> geprüften Meldungen mit Übereinstimmung
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] text-[var(--tf-text-secondary)]">Übereinstimmung ab</span>
                {SCHWELLEN.map(s => (
                  <button
                    key={s.wert}
                    type="button"
                    onClick={() => setSchwelle(s.wert)}
                    title={s.hilfe}
                    className="h-7 rounded-[8px] px-2 text-[12px] cursor-pointer"
                    style={{
                      border: '0.5px solid var(--tf-border)',
                      background: schwelle === s.wert ? 'var(--tf-bg-secondary)' : 'transparent',
                      color: schwelle === s.wert ? 'var(--tf-text)' : 'var(--tf-text-secondary)',
                    }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
              {!d.mitAehnlichkeit && (
                <span className="text-[12px] text-[var(--tf-text-tertiary)]">
                  Ohne Ähnlichkeitsstufe gelaufen — das Embedding-Modell war nicht geladen.
                  Geurteilt wurde allein nach Wortlaut.
                </span>
              )}
            </div>
            <ErgebnisTabelle ergebnisse={d.ergebnisse} onSchlagworte={d.ersetzeSchlagworte} />
          </div>
        )}
      </div>
    </div>
  );
}
