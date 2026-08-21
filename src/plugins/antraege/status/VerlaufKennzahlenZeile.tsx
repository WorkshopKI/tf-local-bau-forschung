/**
 * Die Kennzahlen des Verlaufs — dieselben Segmente in drei Wirten.
 *
 * Sie löst „28 Termine aus den Datumsfeldern" ab. Die Zeile war nicht falsch,
 * aber sie beantwortete zwei Fragen mit einer Zahl: wie viele **Schritte** es
 * gibt und wie viele **Datumsangaben** darüber stehen. Vier Teilvorhaben mit
 * demselben Eingang sind ein Schritt und vier Angaben — und erst beide Zahlen
 * zusammen sagen, wie groß dieser Vorgang ist.
 *
 * **Ein Wirt nimmt einen Schnitt, keine eigene Formulierung** ({@link teil}).
 * Auf der Detailseite steht der Umfang seit v4.13x im ⓘ-Popover und der Rest in
 * der Titelzeile; im Tabellen-Ausklapp steht weiter alles in einer Zeile. Wären
 * das drei Bauteile, gäbe es drei Wortlaute für „(Verbund + 3 TV)" und „8 von
 * 57", und beim nächsten Patch liefen sie auseinander.
 *
 * Gerechnet wird in `verlauf-kennzahlen.ts`; hier steht nur der Satz.
 */
import { Fragment } from 'react';
import { type VerlaufKennzahlen } from '@/core/status';

const LEISE = 'text-[var(--tf-text-tertiary)]';

/**
 * Welcher Ausschnitt der Segmente gezeigt wird.
 *
 * - `alles` — wie gehabt (Tabellen-Ausklapp).
 * - `umfang` — nur die Größe des Vorgangs: Schritte, Datumsangaben, Träger.
 * - `ohneUmfang` — nur, was darüber hinaus zu sagen ist: Zeitraum,
 *   Zurückgenommenes, fehlende Kürzel-Angaben.
 */
export type KennzahlenTeil = 'alles' | 'umfang' | 'ohneUmfang';

/** `2026-03-10` → „März 2026" in der Kurzform. */
function monatLabel(tag: string): string {
  const d = new Date(`${tag.slice(0, 7)}-01T00:00:00`);
  if (Number.isNaN(d.getTime())) return tag.slice(0, 7);
  return d.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
}

function spanneText(k: VerlaufKennzahlen): string | null {
  if (k.von === null || k.bis === null) return null;
  const a = monatLabel(k.von);
  const b = monatLabel(k.bis);
  return a === b ? a : `${a} – ${b}`;
}

export function VerlaufKennzahlenZeile({ kennzahlen, gesamt, onLuecken, teil = 'alles' }: {
  kennzahlen: VerlaufKennzahlen;
  /**
   * Der ungefilterte Stand. Steht er da, liest sich die Zeile als „8 von 57
   * Datumsangaben" — der Nenner gehört dazu, sonst sieht ein gefilterter
   * Vorgang aus wie ein kleiner.
   */
  gesamt?: VerlaufKennzahlen;
  /**
   * Klick auf „N fehlende Kürzel-Angaben". Fehlt der Handler, steht die Zahl als
   * Text da — im Ausklapp gibt es keine Filterleiste, die sie setzen könnte,
   * und ein toter Link wäre ein gebrochenes Versprechen.
   *
   * **Die Einheit ist die ANGABE, nicht das Kürzel** (v4.124): `offenePaare`
   * führt je Teilvorhaben einen Eintrag pro offenem Paar — dieselbe Einheit wie
   * „Datumsangaben" daneben und genau die Zahl der roten Zellen in der Matrix.
   * „N Kürzel nicht gesetzt" las sich neben „19 Schritte" (= Kürzel), als läge
   * fast der ganze Vorgang offen, obwohl ein einziges Kürzel in vier Spalten
   * fehlte.
   */
  onLuecken?: () => void;
  /** Siehe {@link KennzahlenTeil}; fehlend = alles (der bisherige Aufruf). */
  teil?: KennzahlenTeil;
}): React.ReactElement | null {
  const k = kennzahlen;
  const spanne = spanneText(k);
  // Die zweite Zahl steht nur da, wo sie etwas hinzufügt. Gibt es genau **einen**
  // Träger, ist jede Datumsangabe ein Schritt — im Tabellen-Ausklapp einer
  // TV-Zeile las sich „16 Schritte · 16 Datumsangaben (Verbund + 1 TV)" als
  // Aussage über eine Verbund-Achse, die dort gar nicht gezeigt wird.
  // Bei aktivem Filter bleibt sie stehen: dort trägt sie den Nenner.
  const mehrereTraeger = k.tvAnzahl >= 2;
  const zeigeAngaben = gesamt !== undefined || (mehrereTraeger && k.datumsangaben !== k.schritte);

  // Erst sammeln, dann mit „·" verbinden. Das Trennzeichen gehört zwischen zwei
  // Segmente, nicht vor eines — fest an die Segmente geschrieben (wie bis
  // v4.12x) stünde es im Schnitt `ohneUmfang` als führendes „·" da.
  const segmente: { id: string; el: React.ReactNode }[] = [];

  if (teil !== 'ohneUmfang') {
    segmente.push({
      id: 'schritte',
      el: (
        <span className="text-[var(--tf-text-secondary)]">
          {k.schritte} {k.schritte === 1 ? 'Schritt' : 'Schritte'}
        </span>
      ),
    });
    if (zeigeAngaben) {
      segmente.push({
        id: 'angaben',
        // Die Träger-Klammer ist kein eigenes „·"-Segment, sondern eine
        // Fußnote zur Zahl davor — deshalb im selben Segment, mit demselben
        // Abstand wie außen (`gap-x-2`).
        el: (
          <span className="flex items-baseline gap-x-2">
            <span className="text-[var(--tf-text-secondary)]">
              {gesamt === undefined
                ? k.datumsangaben
                : `${k.datumsangaben} von ${gesamt.datumsangaben}`}
              {' Datumsangaben'}
            </span>
            {mehrereTraeger && <span>(Verbund + {k.tvAnzahl} TV)</span>}
          </span>
        ),
      });
    }
  }

  if (teil !== 'umfang') {
    if (spanne !== null) segmente.push({ id: 'spanne', el: <span>{spanne}</span> });
    // Zurückgenommenes steht in derselben Reihe, aber in Normalfarbe: es ist
    // eine Auskunft über die Vergangenheit, keine offene Aufgabe.
    if (k.zurueckgenommen > 0) {
      segmente.push({
        id: 'storno',
        el: (
          <span title="Termine, die ein früherer Export trug und der heutige nicht mehr — belegt aus dem Änderungs-Journal">
            {k.zurueckgenommen} zurückgenommen
          </span>
        ),
      });
    }
    if (k.nichtGesetzt > 0) {
      segmente.push({
        id: 'luecken',
        el: onLuecken === undefined ? (
          <span style={{ color: 'var(--tf-danger-text)' }}>
            {k.nichtGesetzt} fehlende Kürzel-Angaben
          </span>
        ) : (
          <button
            type="button"
            onClick={onLuecken}
            className="cursor-pointer underline-offset-2 hover:underline"
            style={{ color: 'var(--tf-danger-text)' }}
          >
            {k.nichtGesetzt} fehlende Kürzel-Angaben
          </button>
        ),
      });
    }
  }

  // Kein leeres `<div>`: in der Titelzeile ist die Zeile ein Flex-Kind, und ein
  // leeres Kind risse dort trotzdem seine `gap` auf (dasselbe, was
  // `Sektionsrahmen` mit `empty:hidden` löst). Als `null` ist es keins.
  if (segmente.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 text-[11.5px] ${LEISE}`}>
      {segmente.map((s, i) => (
        <Fragment key={s.id}>
          {i > 0 && <span aria-hidden="true">·</span>}
          {s.el}
        </Fragment>
      ))}
    </div>
  );
}
