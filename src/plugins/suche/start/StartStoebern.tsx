/**
 * Reiter „Stöbern" — der Bestand als Liste zum Durchblättern.
 *
 * Vor v4.73 stand an dieser Stelle die Spalte „Aus dem Index": zwei Zahlen, die
 * seit v4.69 ohnehin in der Optionszeile stehen. Eine Statusmeldung ist kein
 * Einstieg — wer nicht weiß, was im Bestand steht, kann auch nichts danach
 * fragen.
 *
 * **Vier Felder, weil nur sie einen abzählbaren Wertevorrat haben**
 * ([stoebern.ts](src/plugins/suche/start/stoebern.ts)). Zwei davon errät
 * niemand: die Deskriptoren sind ein festes Vokabular, das nirgends sonst in
 * der App steht, und ein Netzwerk heißt im Export `"ProAnimalLife"
 * 16KN062302_KR`. Bundesland und Ort liegen im selben Topf (`standort`), ein
 * Antragsjahr führt der Index gar nicht — die drei Facetten des Handoffs gibt
 * es so nicht.
 *
 * **Die Liste hier ist die kurze Fassung, nicht die einzige.** Seit v4.71 zeigt
 * das Suchfeld unter `deskriptor:` den vollen Katalog (bis 50 Werte, mit
 * Restangabe). Dieser Reiter zeigt die häufigsten fünf und NENNT diesen Weg —
 * er ersetzt ihn nicht. Fünf Werte mit „alle 2.039 ansehen" zu beschriften wäre
 * ein Versprechen, das kein Panel einlöst.
 *
 * **Die Zahl rechts kommt aus dem Probelauf, nicht aus dem Werte-Index.** Der
 * Index zählt 485 Anträge mit dem Ort „Dresden", `ort:Dresden` findet 451 — die
 * Suchstufe vergleicht anders, als der Index zählt. Was hier steht, ist die
 * Zahl, die nach dem Klick auch dasteht.
 */
import { useMemo } from 'react';
import { Filter } from 'lucide-react';
import type { WertIndex } from '@/plugins/antraege/services/wert-index';
import { useProbeZahlen, type ProbeAnfrage } from '../useProbeZahlen';
import { FussSatz, GruppenTitel, MehrZeile, Spalte, trefferText, Zeile } from './StartBausteine';
import {
  baueStoeberSpalten, stoeberAnfrage, stoeberKey, stoeberLabel, stoeberPraefix,
} from './stoebern';

export function StartStoebern({ index, zaehle, onSuche, kurz, onMehr }: {
  /** Der Wertevorrat des Bestands. `null` = noch nicht geladen. */
  index: WertIndex | null;
  zaehle?: (anfrage: string) => number | null;
  onSuche: (query: string) => void;
  /** Kurzformat für den Reiter „Alle" — nur die Felder, keine Werte, keine Probeläufe. */
  kurz?: boolean;
  onMehr?: () => void;
}): React.ReactElement {
  const spalten = useMemo(() => baueStoeberSpalten(index), [index]);

  // Im Kurzformat wird nichts gerechnet: „Alle" ist der Standard-Reiter und
  // soll nicht 20 Probeläufe kosten, nur weil er offen ist.
  const anfragen = useMemo<ProbeAnfrage[]>(
    () => (kurz ? [] : spalten.flatMap(s => s.werte.map(w => ({
      key: stoeberKey(s.feld, w.wert),
      anfrage: stoeberAnfrage(s.feld, w.wert),
    })))),
    [spalten, kurz],
  );
  // Hier tippt niemand — der erste Schub darf sofort laufen.
  const zahlen = useProbeZahlen(anfragen, kurz ? undefined : zaehle, 0);

  if (spalten.length === 0) {
    return (
      <p className="px-2 py-1.5 text-[12.5px] text-[var(--tf-text-tertiary)]">
        Der Bestand wird noch geladen.
      </p>
    );
  }

  if (kurz) {
    return (
      <div className="flex flex-col">
        <GruppenTitel>Stöbern im Bestand</GruppenTitel>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1 text-[12.5px] text-[var(--tf-text-secondary)]">
          {spalten.map(s => (
            <span key={s.feld}>
              {stoeberLabel(s.feld)}{' '}
              <span className="tabular-nums text-[var(--tf-text-tertiary)]">
                {s.gesamt.toLocaleString('de-DE')} Werte
              </span>
            </span>
          ))}
        </div>
        {onMehr && <MehrZeile text="im Bestand stöbern" onClick={onMehr} />}
      </div>
    );
  }

  return (
    <div>
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
        {spalten.map(s => (
          <Spalte key={s.feld} titel={stoeberLabel(s.feld)}>
            {s.werte.map(w => (
              <Zeile
                key={w.wert}
                icon={<Filter size={12} aria-hidden />}
                text={w.wert}
                rechts={trefferText(zahlen.get(stoeberKey(s.feld, w.wert)) ?? null)}
                onClick={() => onSuche(stoeberAnfrage(s.feld, w.wert))}
                titel={`„${stoeberAnfrage(s.feld, w.wert)}" suchen`}
              />
            ))}
            {s.gesamt > s.werte.length && (
              <p className="px-2 pt-1 text-[11px] text-[var(--tf-text-tertiary)]">
                {s.gesamt.toLocaleString('de-DE')} Werte —{' '}
                <code>{stoeberPraefix(s.feld)}:</code> tippen
              </p>
            )}
          </Spalte>
        ))}
      </div>
      <FussSatz>
        Hier stehen die häufigsten fünf. Die vollständige Liste steht im
        Suchfeld: <code>deskriptor:</code> tippen, und der Katalog erscheint
        darunter.
      </FussSatz>
    </div>
  );
}
