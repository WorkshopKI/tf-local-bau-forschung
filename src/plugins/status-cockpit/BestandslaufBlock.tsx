/**
 * Der Bestandslauf, an **einer** Stelle — Befund oben, Zahlen darunter.
 *
 * Bis v4.51 standen hier zwei Kacheln mit zwei Knöpfen und rund 40 gleichrangigen
 * Zahlen in elf Abschnitten. Beide messen denselben Bestand, also misst sie jetzt
 * ein Knopf, und die Wertung steht vor den Zahlen statt zwischen ihnen:
 *
 * - **Oben, immer sichtbar**: was der Lauf bedeutet — Zusagen, Auffälligkeiten,
 *   Kennzahlen. Gerechnet wird das in `bestandslaufBefund.ts`, nicht hier.
 * - **Darunter, zugeklappt**: die vollständigen Zahlen, Zeile für Zeile
 *   unverändert. Sie bleiben, weil §14.3 der Vorgangssystem-Doku aus ihnen
 *   zitiert und weil sie mit jedem Nacht-Export veralten — der Knopf ist der
 *   einzige Weg an sie heran (`useVerlaufErhebung`).
 *
 * Reine Anzeige und Ablaufsteuerung; keine Zahl entsteht in dieser Datei.
 */
import { ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { useCollapsedSection } from '@/core/hooks/useCollapsedSection';
import type { VerlaufsBeispiel } from '@/core/status/verlauf';
import { baueBefunde, type Befund } from './bestandslaufBefund';
import { FristBefundeBlock } from './FristBefundeBlock';
import { feldStil } from './labels';
import type { FristLauf } from './useFristErhebung';
import type { VerlaufLauf } from './useVerlaufErhebung';
import { VerlaufBefundeBlock } from './VerlaufBefundeBlock';

const leise = 'text-[11.5px] text-[var(--tf-text-tertiary)]';
const zahl = (n: number): string => n.toLocaleString('de-DE');

/**
 * Zeichen und Farbe je Sorte.
 *
 * Eine Kennzahl bekommt **kein** Zeichen — sie beschreibt nur, und ein Symbol
 * daneben behauptete ein Urteil, für das es keinen Schwellwert gibt. Die Spalte
 * bleibt trotzdem stehen, damit die Sätze auf einer Kante beginnen.
 */
function Marke({ befund }: { befund: Befund }): React.ReactElement {
  const [zeichen, farbe] = befund.art === 'kennzahl'
    ? ['', '']
    : befund.art === 'auffaellig'
      ? ['⚠', 'text-[var(--tf-warning-text)]']
      : befund.erfuellt
        ? ['✓', 'text-[var(--tf-success-text)]']
        : ['⚠', 'text-[var(--tf-danger-text)]'];
  return <span className={`w-3.5 shrink-0 text-[12px] ${farbe}`} aria-hidden>{zeichen}</span>;
}

/**
 * Die Belege einer Auffälligkeit.
 *
 * Trägt ein Beleg ein Kürzel, ist er ein Knopf: der Klick filtert die Tabelle
 * unter dem Block auf genau dieses Kürzel. Aktenzeichen bleiben Text — die
 * Tabelle darunter führt Kürzel, kein Vorhaben, und ein Filter, der nichts
 * findet, wäre schlechter als keiner.
 */
function Belege({ beispiele, onKuerzel }: {
  beispiele: readonly VerlaufsBeispiel[];
  onKuerzel: (kuerzel: string) => void;
}): React.ReactElement | null {
  if (beispiele.length === 0) return null;
  return (
    <span className={leise}>
      z. B.{' '}
      {beispiele.map((b, i) => (
        <span key={b.text}>
          {i > 0 && ', '}
          {b.kuerzel === undefined ? (
            <span className="font-mono">{b.text}</span>
          ) : (
            <button
              type="button"
              onClick={() => onKuerzel(b.kuerzel as string)}
              title={`Tabelle auf ${b.kuerzel} filtern`}
              className="font-mono underline decoration-dotted underline-offset-2 cursor-pointer hover:text-[var(--tf-text)]"
            >
              {b.text}
            </button>
          )}
        </span>
      ))}
    </span>
  );
}

function BefundZeile({ befund, onKuerzel }: {
  befund: Befund;
  onKuerzel: (kuerzel: string) => void;
}): React.ReactElement {
  return (
    <li className="flex items-baseline gap-1.5 flex-wrap text-[12px]">
      <Marke befund={befund} />
      <span className={befund.art === 'kennzahl'
        ? 'text-[var(--tf-text-secondary)]'
        : 'text-[var(--tf-text)]'}
      >
        {befund.text}
      </span>
      {befund.hinweis !== undefined && <span className={leise}>{befund.hinweis}</span>}
      {befund.beispiele !== undefined && (
        <Belege beispiele={befund.beispiele} onKuerzel={onKuerzel} />
      )}
    </li>
  );
}

export function BestandslaufBlock({ verlauf, frist, onKuerzelFilter }: {
  verlauf: VerlaufLauf;
  frist: FristLauf;
  /** Setzt die Suche der Kürzel-Tabelle unter dem Block. */
  onKuerzelFilter: (kuerzel: string) => void;
}): React.ReactElement {
  const [zahlenOffen, toggleZahlen] = useCollapsedSection(
    'status-cockpit:bestandslauf-zahlen', { defaultOpen: false },
  );
  // Ein Knopf, zwei Durchgänge: beide lesen denselben Bestand, und getrennt
  // gedrückt stünden zwei Hälften eines Befundes nebeneinander, von denen eine
  // älter ist als die andere. `run()` wirft nie — jeder Lauf hält seinen Fehler
  // selbst, deshalb steht unten auch je einer.
  const messen = useAsyncAction(async () => {
    await verlauf.aktion.run();
    await frist.aktion.run();
  });

  const v = verlauf.befunde;
  const f = frist.befunde;
  const befunde = baueBefunde(v, f);
  const busy = messen.busy || verlauf.aktion.busy || frist.aktion.busy;
  const gemessen = v !== null || f !== null;

  return (
    <div className="flex flex-col gap-2 rounded px-2.5 py-2" style={feldStil}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[12.5px] text-[var(--tf-text)]">
          {v === null
            ? 'Was der Bestand zur Verlaufsableitung und zum Haltedatum sagt — '
              + 'ein Durchgang zählt es aus.'
            : <>{zahl(v.teilvorhaben)} Teilvorhaben in {zahl(v.verbuende)} Vorhaben
              {/* Ohne den Betrachtungsbereich ist keine dieser Zahlen
                  einzuordnen (Pitfall #46). */}
              {verlauf.bereichText !== null && <> · {verlauf.bereichText}</>}</>}
        </span>
        <Button
          variant="secondary" size="sm" disabled={busy}
          onClick={() => messen.run()}
        >
          {busy ? 'Rechnet …' : gemessen ? 'Neu messen' : 'Am Bestand messen'}
        </Button>
      </div>

      {gemessen && (
        <span className={leise}>
          Stichtag {verlauf.stichtag}
          {verlauf.dauerMs !== null && ` · Verlauf ${(verlauf.dauerMs / 1000).toFixed(1)} s`}
          {frist.dauerMs !== null && ` · Haltedatum ${zahl(frist.dauerMs)} ms`}
        </span>
      )}

      {verlauf.aktion.error !== null && (
        <p className="text-[12px] text-[var(--tf-danger-text)]">⚠ Verlauf: {verlauf.aktion.error}</p>
      )}
      {frist.aktion.error !== null && (
        <p className="text-[12px] text-[var(--tf-danger-text)]">⚠ Haltedatum: {frist.aktion.error}</p>
      )}

      {befunde.length > 0 && (
        <ul className="flex flex-col gap-1">
          {befunde.map(b => (
            <BefundZeile key={b.id} befund={b} onKuerzel={onKuerzelFilter} />
          ))}
        </ul>
      )}

      {gemessen && (
        <div>
          <button
            type="button" onClick={toggleZahlen} aria-expanded={zahlenOffen}
            className="flex items-center gap-1.5 cursor-pointer"
          >
            <ChevronRight
              size={13}
              className="text-[var(--tf-text-tertiary)] transition-transform duration-200 shrink-0"
              style={{ transform: zahlenOffen ? 'rotate(90deg)' : 'rotate(0deg)' }}
            />
            <span className="text-[12px] text-[var(--tf-text-secondary)]">Zahlen im Detail</span>
          </button>
          <div className={zahlenOffen ? 'mt-2 flex flex-col gap-3' : 'hidden'}>
            <VerlaufBefundeBlock lauf={verlauf} />
            <FristBefundeBlock lauf={frist} />
          </div>
        </div>
      )}
    </div>
  );
}
