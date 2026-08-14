/**
 * Die Kennzahlen-Zeile über dem Verlauf — dieselbe in beiden Wirten
 * (Verbund-Detailseite und Tabellen-Ausklapp) und über beiden Ansichten.
 *
 * Sie löst „28 Termine aus den Datumsfeldern" ab. Die Zeile war nicht falsch,
 * aber sie beantwortete zwei Fragen mit einer Zahl: wie viele **Schritte** es
 * gibt und wie viele **Datumsangaben** darüber stehen. Vier Teilvorhaben mit
 * demselben Eingang sind ein Schritt und vier Angaben — und erst beide Zahlen
 * zusammen sagen, wie groß dieser Vorgang ist.
 *
 * Gerechnet wird in `verlauf-kennzahlen.ts`; hier steht nur der Satz.
 */
import { type VerlaufKennzahlen } from '@/core/status';

const LEISE = 'text-[var(--tf-text-tertiary)]';

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

export function VerlaufKennzahlenZeile({ kennzahlen, gesamt, onLuecken }: {
  kennzahlen: VerlaufKennzahlen;
  /**
   * Der ungefilterte Stand. Steht er da, liest sich die Zeile als „8 von 57
   * Datumsangaben" — der Nenner gehört dazu, sonst sieht ein gefilterter
   * Vorgang aus wie ein kleiner.
   */
  gesamt?: VerlaufKennzahlen;
  /**
   * Klick auf „N Kürzel nicht gesetzt". Fehlt der Handler, steht die Zahl als
   * Text da — im Ausklapp gibt es keine Filterleiste, die sie setzen könnte,
   * und ein toter Link wäre ein gebrochenes Versprechen.
   */
  onLuecken?: () => void;
}): React.ReactElement {
  const k = kennzahlen;
  const spanne = spanneText(k);
  // Die zweite Zahl steht nur da, wo sie etwas hinzufügt. Gibt es genau **einen**
  // Träger, ist jede Datumsangabe ein Schritt — im Tabellen-Ausklapp einer
  // TV-Zeile las sich „16 Schritte · 16 Datumsangaben (Verbund + 1 TV)" als
  // Aussage über eine Verbund-Achse, die dort gar nicht gezeigt wird.
  // Bei aktivem Filter bleibt sie stehen: dort trägt sie den Nenner.
  const mehrereTraeger = k.tvAnzahl >= 2;
  const zeigeAngaben = gesamt !== undefined || (mehrereTraeger && k.datumsangaben !== k.schritte);

  return (
    <div className={`flex flex-wrap items-baseline gap-x-2 text-[11.5px] ${LEISE}`}>
      <span className="text-[var(--tf-text-secondary)]">
        {k.schritte} {k.schritte === 1 ? 'Schritt' : 'Schritte'}
      </span>
      {zeigeAngaben && (
        <>
          <span aria-hidden="true">·</span>
          <span className="text-[var(--tf-text-secondary)]">
            {gesamt === undefined
              ? k.datumsangaben
              : `${k.datumsangaben} von ${gesamt.datumsangaben}`}
            {' Datumsangaben'}
          </span>
          {mehrereTraeger && <span>(Verbund + {k.tvAnzahl} TV)</span>}
        </>
      )}
      {spanne !== null && (
        <>
          <span aria-hidden="true">·</span>
          <span>{spanne}</span>
        </>
      )}
      {k.nichtGesetzt > 0 && (
        <>
          <span aria-hidden="true">·</span>
          {onLuecken === undefined ? (
            <span style={{ color: 'var(--tf-danger-text)' }}>
              {k.nichtGesetzt} Kürzel nicht gesetzt
            </span>
          ) : (
            <button
              type="button"
              onClick={onLuecken}
              className="cursor-pointer underline-offset-2 hover:underline"
              style={{ color: 'var(--tf-danger-text)' }}
            >
              {k.nichtGesetzt} Kürzel nicht gesetzt
            </button>
          )}
        </>
      )}
    </div>
  );
}
