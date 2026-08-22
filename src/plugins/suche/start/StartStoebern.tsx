/**
 * Reiter „Top Ten" — der Bestand als Liste zum Durchblättern.
 *
 * (Die Datei heißt weiter `StartStoebern`, und der Reiter trägt intern die Id
 * `stoebern`: sie steht im `localStorage` jedes Nutzers als „zuletzt offener
 * Reiter". Eine Umbenennung schickte jeden auf „Alle" zurück, ohne dass etwas
 * besser würde.)
 *
 * Vor v4.73 stand an dieser Stelle die Spalte „Aus dem Index": zwei Zahlen, die
 * seit v4.69 ohnehin in der Optionszeile stehen. Eine Statusmeldung ist kein
 * Einstieg — wer nicht weiß, was im Bestand steht, kann auch nichts danach
 * fragen.
 *
 * **Sieben Achsen** ([stoebern.ts](src/plugins/suche/start/stoebern.ts)): die
 * fünf Felder mit abzählbarem Wertevorrat plus die Stichwörter aus Titel und
 * Kurzbeschreibung und die Zukunftsthemen. Zwei davon errät niemand: die
 * Deskriptoren sind ein festes Vokabular, das nirgends sonst in der App steht,
 * und ein Netzwerk heißt im Export `"ProAnimalLife" 16KN062302_KR`.
 *
 * **Zehn je Achse, zehn im Nachschlag** (v6.10; vorher fünf ohne Nachschlag).
 * Der Nachschlag lädt seine Trefferzahlen erst beim Aufklappen — ein Probelauf
 * kostet 11 ms, und 140 Zahlen im Voraus wären anderthalb Sekunden für Zeilen,
 * die niemand aufgeklappt hat.
 *
 * **Die Liste hier ist die kurze Fassung, nicht die einzige.** Seit v4.71 zeigt
 * das Suchfeld unter `deskriptor:` den vollen Katalog (seit v4.88 ohne Deckel,
 * alphabetisch). Dieser Reiter zeigt die häufigsten und NENNT diesen Weg — er
 * ersetzt ihn nicht. Zehn Werte mit „alle 2.055 ansehen" zu beschriften wäre
 * ein Versprechen, das kein Panel einlöst.
 *
 * **Beide Zahlen kommen aus verschiedenen Quellen, und das ist Absicht.** WELCHE
 * Werte hier stehen, entscheidet die Häufigkeit im Werte-Index
 * (`haeufigsteWerte`); WAS rechts daneben steht, kommt aus einem echten
 * Probelauf — die Suchstufe vergleicht anders, als der Index zählt, und die Zahl
 * muss die sein, die nach dem Klick auch dasteht.
 */
import { useMemo, useState } from 'react';
import { Filter } from 'lucide-react';
import { useProbeZahlen, type ProbeAnfrage } from '../useProbeZahlen';
import {
  FussSatz, GruppenTitel, MehrZeile, Spalte, trefferText, vorhabenText, Zeile,
} from './StartBausteine';
import {
  stoeberAnfrage, stoeberKey, stoeberLabel, WERTE_JE_FELD, WERTE_NACHSCHLAG,
  type StoeberAchse, type StoeberSpalte,
} from './stoebern';

export function StartStoebern({ spalten, zaehle, onSuche, kurz, onMehr }: {
  /** Die Achsen mit ihren häufigsten Werten. Leer = Bestand lädt noch. */
  spalten: readonly StoeberSpalte[];
  zaehle?: (anfrage: string) => number | null;
  onSuche: (query: string) => void;
  /** Kurzformat für den Reiter „Alle" — nur die Achsen, keine Werte, keine Probeläufe. */
  kurz?: boolean;
  onMehr?: () => void;
}): React.ReactElement {
  // Welche Spalten ihren Nachschlag zeigen. Je Achse einzeln: wer die
  // Stichwörter aufklappt, will nicht auch 10 weitere Bundesländer.
  const [aufgeklappt, setAufgeklappt] = useState<readonly StoeberAchse[]>([]);

  const sichtbareWerte = useMemo(
    () => spalten.map(s => ({
      spalte: s,
      werte: aufgeklappt.includes(s.achse) ? s.werte : s.werte.slice(0, WERTE_JE_FELD),
    })),
    [spalten, aufgeklappt],
  );

  // Im Kurzformat wird nichts gerechnet: „Alle" ist der Standard-Reiter und
  // soll nicht 60 Probeläufe kosten, nur weil er offen ist. Spalten, die ihre
  // Zahl aus dem Index nehmen, kosten ohnehin keinen Lauf.
  const anfragen = useMemo<ProbeAnfrage[]>(
    () => (kurz ? [] : sichtbareWerte
      .filter(({ spalte }) => spalte.zahlArt === 'treffer')
      .flatMap(({ spalte, werte }) => werte.map(w => ({
        key: stoeberKey(spalte.achse, w.wert),
        anfrage: stoeberAnfrage(spalte.achse, w.wert),
      })))),
    [sichtbareWerte, kurz],
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
        <GruppenTitel>Top Ten im Bestand</GruppenTitel>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1 text-[12.5px] text-[var(--tf-text-secondary)]">
          {spalten.map(s => (
            <span key={s.achse}>
              {stoeberLabel(s.achse)}{' '}
              <span className="tabular-nums text-[var(--tf-text-tertiary)]">
                {s.gesamt.toLocaleString('de-DE')} Werte
              </span>
            </span>
          ))}
        </div>
        {onMehr && <MehrZeile text="die Top Ten ansehen" onClick={onMehr} />}
      </div>
    );
  }

  return (
    <div>
      {/* Vier Spalten, obwohl es sieben Achsen sind: bei fünf nebeneinander
          blieben am xl-Rand (1 280 px) 42 px für die Beschriftung, und
          „Nordrhein-Westfalen" (120 px) stand als „Nordr…" da. Die übrigen
          rutschen lieber in eine zweite Zeile, als dass alle unlesbar werden. */}
      <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
        {sichtbareWerte.map(({ spalte, werte }) => {
          const nachschlag = Math.min(
            WERTE_NACHSCHLAG, spalte.werte.length - werte.length,
          );
          return (
            <Spalte key={spalte.achse} titel={stoeberLabel(spalte.achse)}>
              {werte.map(w => (
                <Zeile
                  key={w.wert}
                  icon={<Filter size={12} aria-hidden />}
                  text={w.wert}
                  rechts={spalte.zahlArt === 'vorhaben'
                    ? vorhabenText(w.anzahl)
                    : trefferText(zahlen.get(stoeberKey(spalte.achse, w.wert)) ?? null)}
                  onClick={() => onSuche(stoeberAnfrage(spalte.achse, w.wert))}
                  titel={spalte.zahlArt === 'vorhaben'
                    ? `„${w.wert}" steht im Titel oder in der Kurzbeschreibung von `
                      + `${w.anzahl.toLocaleString('de-DE')} Vorhaben. Die Suche findet `
                      + 'zusätzlich Fundstellen in allen anderen Feldern.'
                    : `„${stoeberAnfrage(spalte.achse, w.wert)}" suchen`}
                />
              ))}
              {nachschlag > 0 && (
                <button
                  type="button"
                  onClick={() => setAufgeklappt(prev => [...prev, spalte.achse])}
                  className="mt-0.5 self-start rounded-[6px] px-2 py-1 text-left text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] hover:text-[var(--tf-text)] cursor-pointer"
                >
                  +{nachschlag} weitere
                </button>
              )}
              {spalte.gesamt > spalte.werte.length && spalte.praefix !== null && (
                <p className="px-2 pt-1 text-[11px] text-[var(--tf-text-tertiary)]">
                  {spalte.gesamt.toLocaleString('de-DE')} Werte —{' '}
                  <code>{spalte.praefix}:</code> tippen
                </p>
              )}
            </Spalte>
          );
        })}
      </div>
      <FussSatz>
        Hier stehen je Achse die häufigsten zehn. Die Stichwörter kommen aus den
        Titeln und Kurzbeschreibungen der Vorhaben — daher steht dort, in wie
        vielen Vorhaben ein Wort vorkommt; die Suche findet es zusätzlich in
        allen anderen Feldern. Die vollständige Werteliste eines Feldes steht im
        Suchfeld: <code>deskriptor:</code> tippen, und der Katalog erscheint
        darunter.
      </FussSatz>
    </div>
  );
}
