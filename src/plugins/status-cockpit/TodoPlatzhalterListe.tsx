/**
 * Die **Tagesordnung** eines Nicht-AB-Regelsatzes — nicht „nichts da".
 *
 * „Keine Regeln" wäre wahr und nutzlos. Was der FB-Termin braucht, ist die
 * Liste der Situationen, in denen die AB-Regeln schon heute auf ihn warten: je
 * Zeile die Herkunftsregel, wie oft sie im Bestand auftritt und ein
 * Beispiel-Aktenzeichen zum Nachsehen. Aus jeder Zeile lässt sich die fehlende
 * Regel direkt anlegen — vorbefüllt mit der Bedingung, die schon feststeht.
 *
 * **Steht immer da, nicht nur im Leerzustand.** Die erste angelegte Regel darf
 * die Arbeitsgrundlage nicht wegnehmen: im Termin entstehen die Regeln nach und
 * nach, und die übrigen Platzhalter (samt Export) werden bis zum Schluss
 * gebraucht. Sichtbar ist sie, solange keine Regel geöffnet ist — in der
 * schmalen Auswahl-Spalte hätte diese Auswertung keinen Platz.
 */
import { Button } from '@/components/ui/button';
import { ROLLE_LABEL, type PlatzhalterGruppe, type Rolle } from '@/core/status';
import { zaehlwort } from '@/core/utils/zaehlwort';
import { feldStil } from './labels';
import type { PlatzhalterLauf } from './usePlatzhalterErhebung';

export function TodoPlatzhalterListe({
  satz, anzahlRegeln, lauf, onRegelErzeugen, onExportieren, schonAngelegt,
}: {
  satz: Rolle;
  /** Wie viele eigene Regeln der Satz schon führt — bestimmt nur den Text. */
  anzahlRegeln: number;
  lauf: PlatzhalterLauf;
  onRegelErzeugen: (g: PlatzhalterGruppe) => void;
  onExportieren: (rolle: Rolle) => void;
  /**
   * Steht die Regel zu dieser Zeile schon? Die Zeile bleibt nach dem Anlegen
   * stehen (die Erhebung rechnet nicht nach), und ein zweiter Klick legte
   * wortlos nichts an — `fuegeTodoRegelHinzu` steigt bei bekannter Id aus.
   */
  schonAngelegt: (g: PlatzhalterGruppe) => boolean;
}): React.ReactElement {
  const gruppen = (lauf.erhebung?.platzhalter.gruppen ?? []).filter(g => g.rolle === satz);
  return (
    <div className="flex flex-col gap-2 rounded px-2.5 py-2" style={feldStil}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[12.5px] text-[var(--tf-text)]">
          {anzahlRegeln === 0 && <>Für <strong>{ROLLE_LABEL[satz]}</strong> ist noch keine Regel gepflegt.</>}
          {anzahlRegeln === 1 && <>Für <strong>{ROLLE_LABEL[satz]}</strong> ist eine Regel gepflegt.</>}
          {anzahlRegeln > 1 && <>Für <strong>{ROLLE_LABEL[satz]}</strong> sind {anzahlRegeln} Regeln gepflegt.</>}
          {' '}
          Wo keine davon greift, übernimmt das Board die Aussage der Regel, die auf{' '}
          {ROLLE_LABEL[satz]} wartet — dort als „abgeleitet" markiert.
        </span>
        <Button
          variant="secondary" size="sm" disabled={lauf.aktion.busy}
          onClick={() => lauf.aktion.run()}
        >
          {lauf.aktion.busy ? 'Zählt …' : 'Platzhalter im Bestand zählen'}
        </Button>
      </div>
      {lauf.aktion.error !== null && (
        <p className="text-[12px] text-[var(--tf-danger-text)]">⚠ {lauf.aktion.error}</p>
      )}
      {lauf.erhebung !== null && (
        <>
          {/* Der Jahrgang gehört dazu: das Board zeigt vorbelegt die letzten
              drei, diese Erhebung alle. Ohne den Satz rechnet jemand die 43
              hier gegen die 38 dort und sucht einen Fehler, der keiner ist. */}
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            {zaehlwort(lauf.erhebung.platzhalter.gesamt, 'Vorgang', 'Vorgänge')} ausgewertet
            {lauf.bereichText !== null && <> · Betrachtungsbereich: {lauf.bereichText}</>}
            {' '}· <strong>alle Jahrgänge</strong> (das Board zeigt vorbelegt die letzten drei und
            kommt deshalb auf kleinere Zahlen)
          </p>
          {/* Gemessen: aus 38 Platzhaltern wurden 153 Treffer, als die Regel
              wirklich stand. Der Platzhalter zählt nur, wo die AB-Regel ihre
              Kaskade GEWINNT; die neue Regel steht in ihrem eigenen Satz allein
              und greift überall, wo ihre Bedingung gilt. Deshalb stehen beide
              Zahlen an jeder Zeile — die zweite ist die, mit der man plant. */}
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Je Zeile zwei Zahlen: <strong>sichtbar</strong> zählt die Vorgänge, in denen die
            AB-Regel die Kaskade gewinnt; <strong>trifft</strong> zählt alle, auf die ihre Bedingung
            zutrifft. Die zweite ist die Reichweite einer eigenen Regel — sie stünde in ihrem Satz
            allein.
          </p>
          {/* Die blinden Flecken stehen im Export ausführlich; hier die eine
              Zahl, die zählt. Sie nur in die Datei zu schreiben hieße, die
              ergiebigste Auswertung vor dem zu verstecken, der sie auslöst. */}
          <p className="text-[12px] text-[var(--tf-text)]">
            <strong>{lauf.erhebung.flecken.ohneTodo.toLocaleString('de-DE')}</strong> Vorgänge tragen
            in <em>keinem</em> Regelsatz ein To-do.
            {lauf.erhebung.flecken.paare.length > 0 ? (
              <> Bei {lauf.erhebung.flecken.paare.reduce((n, p) => n + p.anzahl, 0).toLocaleString('de-DE')}
                {' '}davon steht ein Kürzel-Paar einseitig offen —{' '}
                {lauf.erhebung.flecken.paare.slice(0, 3).map(p => (
                  `${p.gesetzt} ohne ${p.fehlt} (${p.anzahl}×, Median ${p.medianTage} T)`
                )).join(' · ')}
                {lauf.erhebung.flecken.paare.length > 3 && ` · +${lauf.erhebung.flecken.paare.length - 3} weitere`}.
                {' '}Das sind die rein fachlichen Lagen, für die die AB-Kaskade blind ist.
              </>
            ) : (
              <> Kein Kürzel-Paar steht dabei einseitig offen.</>
            )}
          </p>

          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11.5px] text-[var(--tf-text-secondary)]">
              Für den Termin: drei Auswertungen als Arbeitsmappe (Platzhalter, blinde Flecken,
              Kürzel-Landkarte) plus eine Kurzfassung für die Einladung.
            </span>
            <Button variant="secondary" size="sm" onClick={() => onExportieren(satz)}>
              Erhebung exportieren
            </Button>
          </div>
          {gruppen.length === 0 ? (
            <p className="text-[12px] text-[var(--tf-text-secondary)]">
              Keine Platzhalter für {ROLLE_LABEL[satz]} — keine AB-Regel wartet im aktuellen Bestand
              auf diese Rolle.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {gruppen.map(g => (
                <li key={g.quellRegelId} className="flex items-baseline gap-2 flex-wrap">
                  <span
                    className="text-[12px] font-mono text-[var(--tf-text-tertiary)] w-[228px] shrink-0"
                    title={'Sieht das To-do heute abgeleitet: '
                      + `${zaehlwort(g.alsPlatzhalter, 'Vorgang', 'Vorgänge')} · `
                      + 'erfüllt die Bedingung der Herkunftsregel: '
                      + `${zaehlwort(g.bedingungTrifft, 'Vorgang', 'Vorgänge')}`}
                  >
                    {g.alsPlatzhalter.toLocaleString('de-DE')}× sichtbar
                    <span className="text-[var(--tf-text)]">
                      {' · '}{g.bedingungTrifft.toLocaleString('de-DE')}× trifft
                    </span>
                  </span>
                  <span className="text-[12.5px] text-[var(--tf-text)]">„{g.todo}"</span>
                  <span className="text-[11.5px] text-[var(--tf-text-secondary)]">{g.beschreibung}</span>
                  <span className="text-[11px] font-mono text-[var(--tf-text-tertiary)]">
                    {g.beispiele.join(', ')}
                  </span>
                  {schonAngelegt(g) ? (
                    <span className="ml-auto text-[11.5px] text-[var(--tf-text-tertiary)]">
                      Regel angelegt — sie steht in der Kaskade unten
                    </span>
                  ) : (
                    <Button
                      variant="secondary" size="sm" className="ml-auto"
                      onClick={() => onRegelErzeugen(g)}
                    >
                      Regel erzeugen
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
