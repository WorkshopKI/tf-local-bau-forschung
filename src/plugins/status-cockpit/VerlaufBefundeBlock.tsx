/**
 * Der Bestandslauf der **Verlaufsableitung**, an einer Stelle lesbar.
 *
 * Er beantwortet eine Frage: trägt eine Verlaufs-Bahn über diesen Bestand? Dafür
 * braucht es keine Bahn, sondern Zahlen — wie viele Spuren einen Verlauf haben,
 * wie viele Termine einen Statuswechsel belegen, wie oft die Ableitung dem
 * Export widerspricht.
 *
 * **Jede Zahl trägt ihre Grundgesamtheit**: Spuren, Termine und Abschnitte sind
 * drei verschiedene Einheiten. Und der Betrachtungsbereich steht dabei — ohne
 * ihn ist keine der Zahlen einzuordnen (Pitfall #46).
 *
 * Reine Anzeige; gerechnet wird in `verlauf/erhebung.ts` und `useVerlaufErhebung`.
 */
import { Button } from '@/components/ui/button';
import {
  anteil, histogrammSumme, histogrammUeber, quantilAusHistogramm,
  type VerlaufsBefunde,
} from '@/core/status/verlauf';
import { feldStil } from './labels';
import type { VerlaufLauf } from './useVerlaufErhebung';

const leise = 'text-[11.5px] text-[var(--tf-text-tertiary)]';
const zahl = (n: number): string => n.toLocaleString('de-DE');
const tage = (n: number | null): string => (n === null ? '—' : `${zahl(n)} T`);

function Zeile({ label, wert, hinweis }: {
  label: string; wert: string; hinweis?: string;
}): React.ReactElement {
  return (
    <li className="flex items-baseline gap-2 flex-wrap text-[12px]">
      <span className="font-mono tabular-nums text-[var(--tf-text)] w-[92px] shrink-0 text-right">
        {wert}
      </span>
      <span className="text-[var(--tf-text-secondary)]">{label}</span>
      {hinweis !== undefined && <span className={leise}>{hinweis}</span>}
    </li>
  );
}

/**
 * Die Verteilung der **messbaren** Dauern — die Grundgesamtheit ist hier eine
 * andere als bei „Segmente": nur Abschnitte mit zwei gesetzten Grenzen tragen
 * eine Zahl bei. Steht die Zahl nicht daneben, liest sich der Median als Aussage
 * über alle Abschnitte, und das wäre er nicht.
 */
function Verweildauern({ b }: { b: VerlaufsBefunde }): React.ReactElement {
  const n = histogrammSumme(b.dauerHistogramm);
  const ueber30 = histogrammUeber(b.dauerHistogramm, 30);
  return (
    <div className="flex flex-col gap-0.5">
      <p className={`uppercase tracking-wider ${leise}`}>Verweildauern (messbar)</p>
      <ul className="flex flex-col gap-0.5">
        <Zeile
          label="Abschnitte mit zwei Grenzen"
          wert={zahl(n)}
          hinweis={`${anteil(n, b.segmente)} aller Abschnitte`}
        />
        <Zeile
          label="Median · Quartile"
          wert={tage(quantilAusHistogramm(b.dauerHistogramm, 0.5))}
          hinweis={`p25 ${tage(quantilAusHistogramm(b.dauerHistogramm, 0.25))} · `
            + `p75 ${tage(quantilAusHistogramm(b.dauerHistogramm, 0.75))} · `
            + `p90 ${tage(quantilAusHistogramm(b.dauerHistogramm, 0.9))}`}
        />
        <Zeile label="länger als 30 Tage" wert={zahl(ueber30)} hinweis={anteil(ueber30, n)} />
        {b.segmenteRueckwaerts > 0 && (
          <Zeile
            label="Dauer negativ"
            wert={zahl(b.segmenteRueckwaerts)}
            hinweis="Termin nach dem Bezugszeitpunkt — nicht in der Verteilung"
          />
        )}
      </ul>
    </div>
  );
}

function Bilanz({ b, c16Vorhanden }: {
  b: VerlaufsBefunde; c16Vorhanden: boolean;
}): React.ReactElement {
  const spurenTv = b.teilvorhaben;
  const mitVerlauf = b.zustaendeTv.verlauf;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <p className={`uppercase tracking-wider ${leise}`}>Spuren</p>
        <ul className="flex flex-col gap-0.5">
          <Zeile
            label="Teilvorhaben mit Verlauf"
            wert={`${zahl(mitVerlauf)} / ${zahl(spurenTv)}`}
            hinweis={anteil(mitVerlauf, spurenTv)}
          />
          <Zeile
            label="Teilvorhaben ohne erklärten Statuswechsel"
            wert={zahl(b.zustaendeTv.nicht_beobachtet)}
            hinweis="Termine da, Statuswechsel unbekannt"
          />
          <Zeile label="ohne Bearbeitungsstand" wert={zahl(b.zustaendeTv.kein_bearbeitungsstand)} />
          <Zeile label="ohne Statuswert im Export" wert={zahl(b.zustaendeTv.kein_wert_im_csv)} />
          <Zeile
            label="Verbünde mit abgeleitetem Statuswechsel"
            wert={`${zahl(b.verbuendeMitStatuswechsel)} / ${zahl(b.verbuende)}`}
            hinweis={anteil(b.verbuendeMitStatuswechsel, b.verbuende)}
          />
          <Zeile
            label="Verbünde mit Terminen auf der Bahn"
            wert={zahl(b.verbuendeMitTermin)}
            hinweis="Obermenge: Ereignis ≠ Abschnittswechsel"
          />
        </ul>
      </div>

      <div className="flex flex-col gap-0.5">
        <p className={`uppercase tracking-wider ${leise}`}>Übergänge (Termine)</p>
        <ul className="flex flex-col gap-0.5">
          <Zeile label="gesetzte Termine" wert={zahl(b.uebergaenge)} />
          <Zeile
            label="mit belegtem Statuswechsel"
            wert={zahl(b.konfidenz.trigger_bestaetigt)}
            hinweis={anteil(b.konfidenz.trigger_bestaetigt, b.uebergaenge)}
          />
          <Zeile
            label="ohne bekannten Statuswechsel"
            wert={zahl(b.konfidenz.kein_kuerzel)}
            hinweis={anteil(b.konfidenz.kein_kuerzel, b.uebergaenge)}
          />
          <Zeile label="Zielstatus nicht auflösbar" wert={zahl(b.ohneZielcode)} />
          <Zeile label="Regel ohne Ebenen-Angabe" wert={zahl(b.scopeUnbestimmt)} />
          <Zeile label="umbenannte Kürzel" wert={zahl(b.historischeKuerzel)} />
          <Zeile
            label="Aggregation nicht erfüllt / nicht prüfbar"
            wert={`${zahl(b.aggregationNichtErfuellt)} / ${zahl(b.aggregationNichtPruefbar)}`}
          />
        </ul>
      </div>

      <div className="flex flex-col gap-0.5">
        <p className={`uppercase tracking-wider ${leise}`}>Abschnitte</p>
        <ul className="flex flex-col gap-0.5">
          <Zeile label="Segmente" wert={zahl(b.segmente)} />
          <Zeile
            label="Dauer unsicher"
            wert={zahl(b.segmenteUnsicher)}
            hinweis={anteil(b.segmenteUnsicher, b.segmente)}
          />
          {/* Die Aufteilung ist der eigentliche Befund: eine offene Grenze
              heisst „wir wissen nicht, wann es anfing", nicht „es dauerte
              einen Tag". Nur der letzte Fall misst wirklich Verweildauer. */}
          <Zeile
            label="… davon: Anfang unbekannt"
            wert={zahl(b.unsicher.ohneAnfang)}
            hinweis={anteil(b.unsicher.ohneAnfang, b.segmenteUnsicher)}
          />
          <Zeile
            label="… davon: Ende offen (Abweichung)"
            wert={zahl(b.unsicher.ohneEnde)}
            hinweis={anteil(b.unsicher.ohneEnde, b.segmenteUnsicher)}
          />
          <Zeile
            label="… davon: Datum unlesbar"
            wert={zahl(b.unsicher.unlesbar)}
            hinweis={anteil(b.unsicher.unlesbar, b.segmenteUnsicher)}
          />
          <Zeile
            label="… davon: gemessen ≤ 1 Tag"
            wert={zahl(b.unsicher.kurz)}
            hinweis={anteil(b.unsicher.kurz, b.segmenteUnsicher)}
          />
          <Zeile label="mehrdeutig (gleichtägig)" wert={zahl(b.segmenteMehrdeutig)} />
          <Zeile
            label="Abweichung: Ziel gar nicht ableitbar"
            wert={zahl(b.abweichungNichtAbleitbar)}
            hinweis="keine Regel führt dorthin — Lücke, kein Widerspruch"
          />
          <Zeile
            label="Abweichung: Widerspruch"
            wert={zahl(b.abweichungWiderspruch)}
            hinweis="es gäbe eine Regel, sie ist nicht belegt"
          />
          {b.laengsteSpur !== null && (
            <Zeile
              label="längste Spur"
              wert={`${zahl(b.laengsteSpur.uebergaenge)} Ü.`}
              hinweis={`${b.laengsteSpur.id} · ${zahl(b.laengsteSpur.segmente)} Segmente`}
            />
          )}
        </ul>
      </div>

      <Verweildauern b={b} />

      <div className="flex flex-col gap-0.5">
        <p className={`uppercase tracking-wider ${leise}`}>Projektform der Verbünde</p>
        <ul className="flex flex-col gap-0.5">
          {[...b.projektform.entries()].sort((x, y) => y[1] - x[1]).map(([k, n]) => (
            <Zeile key={k} label={k} wert={zahl(n)} hinweis={anteil(n, b.verbuende)} />
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-0.5">
        <p className={`uppercase tracking-wider ${leise}`}>Vergleich: C16-Trigger-Tabelle</p>
        {c16Vorhanden ? (
          <>
            <ul className="flex flex-col gap-0.5">
              <Zeile
                label="Termine, die sie erklären würde"
                wert={zahl(b.c16TvUebergaenge)}
                hinweis={anteil(b.c16TvUebergaenge, b.uebergaenge)}
              />
              <Zeile
                label="Verbünde mit VB-Wechsel"
                wert={`${zahl(b.c16VerbuendeMitVbUebergang)} / ${zahl(b.verbuende)}`}
                hinweis={anteil(b.c16VerbuendeMitVbUebergang, b.verbuende)}
              />
            </ul>
            <p className={leise}>
              Nur gezählt, nicht abgeleitet: die Ableitung nutzt allein die Kürzel-Zuarbeit
              (eine Quelle). Diese Zeilen sagen, was ein zweiter Weg brächte.
            </p>
          </>
        ) : (
          <p className={leise}>
            Keine Trigger-Tabelle importiert — ohne sie fehlt die Vergleichszahl.
          </p>
        )}
      </div>
    </div>
  );
}

export function VerlaufBefundeBlock({ lauf }: { lauf: VerlaufLauf }): React.ReactElement {
  const b = lauf.befunde;
  return (
    <div className="flex flex-col gap-2 rounded px-2.5 py-2" style={feldStil}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[12.5px] text-[var(--tf-text)]">
          {b === null
            ? <>Trägt eine Verlaufs-Bahn über diesen Bestand? Ein Durchgang zählt es aus.</>
            : <>{zahl(b.teilvorhaben)} Teilvorhaben in {zahl(b.verbuende)} Vorhaben
              {lauf.bereichText !== null && <> · {lauf.bereichText}</>}
              {lauf.dauerMs !== null && <> · {(lauf.dauerMs / 1000).toFixed(1)} s</>}</>}
        </span>
        <Button
          variant="secondary" size="sm" disabled={lauf.aktion.busy}
          onClick={() => lauf.aktion.run()}
        >
          {lauf.aktion.busy ? 'Rechnet …' : b === null ? 'Verlauf am Bestand messen' : 'Erneut rechnen'}
        </Button>
      </div>

      {lauf.aktion.error !== null && (
        <p className="text-[12px] text-[var(--tf-danger-text)]">⚠ {lauf.aktion.error}</p>
      )}

      {b !== null && <Bilanz b={b} c16Vorhanden={lauf.c16Vorhanden} />}
    </div>
  );
}
