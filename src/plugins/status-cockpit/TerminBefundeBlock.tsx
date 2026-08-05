/**
 * Die Befunde für die AB-Runde, an einer Stelle lesbar.
 *
 * Vier Zahlen, die im Termin sonst geschätzt würden. Sie beantworten keine
 * Fachfrage — sie machen sie beantwortbar, und ihre dauerhafte Heimat ist die
 * Klärung („Zu klären"), nicht diese Anzeige.
 *
 * **Jede Zahl trägt ihre Grundgesamtheit.** Drei der vier laufen über den
 * Betrachtungsbereich auf Teilvorhaben-Ebene; die Zieltage kommen aus der
 * bestehenden Cockpit-Rechnung und meinen den Gesamtbestand auf Verbund-Ebene.
 * Das steht dran, statt eine zweite Zahl für dieselbe Frage zu erfinden.
 *
 * Reine Anzeige — gerechnet wird in `termin-erhebung.ts` und `useTerminErhebung`.
 */
import { Button } from '@/components/ui/button';
import { zaehlwort } from '@/core/utils/zaehlwort';
import type { BefundGruppe } from '@/core/status';
import { feldStil } from './labels';
import { BEFUND_REGEL_ID, BEFUND_STATUS_CODE, type TerminLauf } from './useTerminErhebung';

const leise = 'text-[11.5px] text-[var(--tf-text-tertiary)]';
const zahl = (n: number): string => n.toLocaleString('de-DE');

function Gruppen({ gruppen }: { gruppen: readonly BefundGruppe[] }): React.ReactElement | null {
  if (gruppen.length === 0) return null;
  return (
    <ul className="flex flex-col gap-0.5 pl-3">
      {gruppen.map(g => (
        <li key={g.schluessel} className="flex items-baseline gap-2 flex-wrap text-[11.5px]">
          <span className="font-mono tabular-nums text-[var(--tf-text)] w-[46px] shrink-0">
            {zahl(g.anzahl)}×
          </span>
          <span className="text-[var(--tf-text-secondary)]">{g.label}</span>
          <span className={`font-mono ${leise}`}>{g.beispiele.join(', ')}</span>
        </li>
      ))}
    </ul>
  );
}

export function TerminBefundeBlock({ lauf, zieltage, gepflegt }: {
  lauf: TerminLauf;
  /** Ist-Median für „beantragt" — aus der Zieltage-Rechnung des Katalog-Reiters. */
  zieltage: { median: number; n: number } | null;
  /** Der im Katalog GEPFLEGTE Wert; `null` = keiner gepflegt (nicht: unauffällig). */
  gepflegt: number | null;
  }): React.ReactElement {
  const b = lauf.befunde;

  return (
    <div className="flex flex-col gap-2 rounded px-2.5 py-2" style={feldStil}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[12.5px] text-[var(--tf-text)]">
          {b === null
            ? <>Befunde für die AB-Runde: PreCheck-Lücke, Feldpflege und wer R8 verdeckt.</>
            : <>{zaehlwort(b.gesamt, 'Vorgang', 'Vorgänge')} ausgewertet
              {lauf.bereichText !== null && <> · {lauf.bereichText}</>}</>}
        </span>
        <Button
          variant="secondary" size="sm" disabled={lauf.aktion.busy}
          onClick={() => lauf.aktion.run()}
        >
          {lauf.aktion.busy ? 'Rechnet …' : b === null ? 'Befunde für den Fachtermin' : 'Erneut rechnen'}
        </Button>
      </div>

      {lauf.aktion.error !== null && (
        <p className="text-[12px] text-[var(--tf-danger-text)]">⚠ {lauf.aktion.error}</p>
      )}

      {b !== null && (
        <div className="flex flex-col gap-2">
          {/* (a) PreCheck-Lücke */}
          <div className="flex flex-col gap-0.5">
            <p className="text-[12px] text-[var(--tf-text)]">
              <strong>{zahl(b.precheck.ohneVermerk)}</strong> von {zahl(b.precheck.auf34)} Vorgängen
              auf Status {BEFUND_STATUS_CODE} tragen weder PC+ noch XPC+.
            </p>
            <p className={leise}>
              Nur FuE und DS haben überhaupt einen PreCheck — für DL und NW ist der Fall
              unauffällig.
            </p>
            <Gruppen gruppen={b.precheck.mitPflicht} />
            {b.precheck.mitPflicht.length === 0 && (
              <p className={`pl-3 ${leise}`}>Kein Fall mit PreCheck-Pflicht — das ist der gute Ausgang.</p>
            )}
            {b.precheck.ohnePflicht.length > 0 && (
              <>
                <p className={`pl-3 ${leise}`}>ohne PreCheck-Pflicht (kein Befund):</p>
                <Gruppen gruppen={b.precheck.ohnePflicht} />
              </>
            )}
          </div>

          {/* (b) Feldpflege */}
          <div className="flex flex-col gap-0.5">
            {b.feldpaare.map(p => (
              <p key={p.feldId} className="text-[12px] text-[var(--tf-text-secondary)]">
                <span className="font-mono text-[11.5px]">{p.feldId}</span> gefüllt bei{' '}
                <strong className="text-[var(--tf-text)]">{zahl(p.gefuellt)}</strong> Vorgängen,
                davon {zahl(p.auchVergleich)} zusätzlich mit{' '}
                <span className="font-mono text-[11.5px]">{p.vergleichFeldId}</span>
                {p.beispieleNurFeld.length > 0 && (
                  <span className={`font-mono ${leise}`}> · {p.beispieleNurFeld.join(', ')}</span>
                )}
              </p>
            ))}
            <p className={leise}>
              Trifft eine Regel auf dieser Lücke nie zu, sind das zwei verschiedene Gründe: das Feld
              wird nicht gepflegt, oder der Zwischenzustand steht nie in einem Nacht-Export.
            </p>
          </div>

          {/* (c) Verdeckung */}
          <div className="flex flex-col gap-0.5">
            <p className="text-[12px] text-[var(--tf-text)]">
              <strong>{BEFUND_REGEL_ID.toUpperCase()}</strong> trifft auf {zahl(b.verdeckung.trifftZu)}{' '}
              Vorgänge zu und gewinnt bei {zahl(b.verdeckung.gewinnt)}. Wer stattdessen gewinnt:
            </p>
            <Gruppen gruppen={b.verdeckung.verdeckerVon} />
            {b.verdeckung.verdeckerVon.length === 0 && (
              <p className={`pl-3 ${leise}`}>Keine Regel verdeckt sie im gemessenen Bestand.</p>
            )}
            <p className={leise}>
              {zahl(b.verdeckung.unterSperre)} Vorgänge stehen unter einer greifenden Sperre — sie
              zählen in keiner der beiden Zahlen mit, weil eine Sperre keine Kaskadenfrage ist.
            </p>
          </div>

          {/* (d) Zieltage */}
          <div className="flex flex-col gap-0.5">
            <p className="text-[12px] text-[var(--tf-text-secondary)]">
              Zieltage „beantragt": {zieltage
                ? <>Ist-Median <strong className="text-[var(--tf-text)]">{zahl(zieltage.median)} Tage</strong>{' '}
                  (n = {zahl(zieltage.n)})</>
                : <>kein Ist-Wert im Bestand</>}
              {/* `typeof`-Prüfung statt `=== null`: „kein Wert gepflegt" darf hier
                  nicht zwischen `null` und `undefined` unterscheiden müssen —
                  eine Zahl ist eine Zahl, alles andere ist keiner. */}
              {' · '}gepflegt: {typeof gepflegt === 'number'
                ? <strong className="text-[var(--tf-text)]">{zahl(gepflegt)} Tage</strong>
                : <em>keiner</em>}
            </p>
            <p className={leise}>
              Faktisch die PreCheck-Frist, weil 34 durch PC+ gesetzt wird. Diese Zahl kommt aus der
              Zieltage-Rechnung des Katalog-Reiters und meint den <strong>Gesamtbestand</strong> auf
              Verbund-Ebene — die drei Zahlen darüber den Betrachtungsbereich auf Teilvorhaben-Ebene.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
