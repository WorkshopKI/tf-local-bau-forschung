/**
 * Die **Kurzlabel-Pflegeliste** — offene Kurzformen, nach Vorkommen im Bestand.
 *
 * Der Zweck ist die Reihenfolge: der Kurator soll oben anfangen können. In der
 * Katalog-Tabelle daneben steht dieselbe Angabe je Zeile, aber alphabetisch
 * bzw. nach der gewählten Sortierung — dort findet man einen bestimmten Wert,
 * hier arbeitet man einen Rückstand ab.
 *
 * **Eingeklappt, solange nichts offen ist.** Ein Block, der „alles gepflegt"
 * meldet, kostet dauerhaft Platz über der Tabelle; die Zahl bleibt in der
 * Kopfzeile stehen, damit man sieht, dass gemessen wurde.
 *
 * Rechnung und Sortierung liegen in `kurzLabelBilanz.ts` (rein, node-testbar);
 * diese Datei rendert nur.
 */
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { KURZLABEL_MAX } from '@/core/status';
import { zaehlwort } from '@/core/utils/zaehlwort';
import type { StatusCockpitApi } from './useStatusCockpit';
import { baueKurzLabelBilanz, type KurzLabelZeile } from './kurzLabelBilanz';
import { feldKlasseSchmal, feldStil } from './labels';

/** Wie viele Zeilen die Deckungsangabe zusammenfasst („die 20 häufigsten"). */
const SPITZE = 20;

function prozent(anteil: number): string {
  return `${Math.round(anteil * 100)} %`;
}

function Zeile({ z, setKurzLabel }: {
  z: KurzLabelZeile;
  setKurzLabel: (code: number, kurz: string) => void;
}): React.ReactElement {
  return (
    <li className="flex items-baseline gap-2 flex-wrap">
      <span className="w-[92px] shrink-0 text-right text-[12px] font-mono text-[var(--tf-text-tertiary)]">
        {z.vorkommen.toLocaleString('de-DE')}×
      </span>
      <span className="w-[36px] shrink-0 text-[11px] font-mono text-[var(--tf-text-tertiary)]">
        {z.code}
      </span>
      <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--tf-text)]" title={z.voll}>
        {z.voll}
      </span>
      {/* Der KURATIERTE Wert im Feld, die Auslieferung als Platzhalter — sonst
          lässt sich eine Kuration nicht zurücknehmen: das Feld füllte sich beim
          Leeren sofort wieder mit dem Auslieferungstext. Dieselbe Aufteilung wie
          in der Katalog-Spalte nebenan (`katalogSpalten.tsx`). */}
      <input
        value={z.kuratiert}
        placeholder={z.ausKatalog || `max. ${KURZLABEL_MAX} Zeichen`}
        aria-label={`Kurzform für ${z.voll}`}
        className={`${feldKlasseSchmal} w-[180px] shrink-0`}
        style={feldStil}
        onChange={e => setKurzLabel(z.code, e.target.value)}
      />
      <span
        className={`w-[124px] shrink-0 text-[11px] ${z.zuLang
          ? 'text-[var(--tf-warning-text)]'
          : 'text-[var(--tf-text-tertiary)]'}`}
      >
        {z.zuLang
          ? `${z.laenge} Zeichen — bricht um`
          : z.herkunft === 'ohne' ? 'nicht gepflegt' : `${z.laenge} Zeichen`}
      </span>
    </li>
  );
}

export function KurzLabelPflege({ api }: { api: StatusCockpitApi }): React.ReactElement | null {
  const entwurf = api.entwurf;
  const [offen, setOffen] = useState(false);
  /**
   * **Welche Zeilen die eingeklappte Sicht führt, wird festgehalten** — sonst
   * verschwindet die Zeile unter der tippenden Hand.
   *
   * Die Filterbedingung („noch nicht gepflegt", „zu lang") kippt mit dem ersten
   * Zeichen; `key={z.code}` unmountete die Zeile dann mitten im Wort.
   * Gespeichert war das eine Zeichen, der Fokus weg, der Rest ging ins Leere —
   * im Katalog stand am Ende „S" statt „Stelln. zur RNE". Beim Aufräumen des
   * LETZTEN Rückstands klappte sogar der ganze Block weg.
   *
   * Bewusst kein `onFocus`: die Zeile soll auch dann stehen bleiben, wenn der
   * Fokus schon weiter ist, und ein Fokus-Ereignis ist der falsche Träger für
   * eine Aussage über die Liste. Neu offene Zeilen kommen dazu, erledigte
   * verschwinden erst beim nächsten Umschalten — also auf Ansage.
   */
  const behalten = useRef<Set<number>>(new Set());
  if (!entwurf) return null;

  const p = baueKurzLabelBilanz(entwurf.werte, api.vorkommen);
  if (p.zeilen.length === 0) return null;

  for (const z of p.zeilen) {
    if (z.herkunft === 'ohne' || z.zuLang) behalten.current.add(z.code);
  }
  // Nur die offenen zuerst — und dahinter das schon Gepflegte, damit man eine
  // Formulierung nachbessern kann, ohne die Tabelle zu bemühen.
  const sichtbar = offen ? p.zeilen : p.zeilen.filter(z => behalten.current.has(z.code));
  const nichts = sichtbar.length === 0;
  const umschalten = (): void => {
    // Beim Umschalten neu bemessen: eingeklappt soll wieder der RÜCKSTAND
    // stehen, nicht die Historie der Sitzung.
    behalten.current = new Set();
    setOffen(v => !v);
  };

  return (
    <div className="flex flex-col gap-2 rounded px-2.5 py-2" style={feldStil}>
      <div className="flex items-baseline justify-between gap-2 flex-wrap">
        <span className="text-[12.5px] text-[var(--tf-text)]">
          {p.ohneKurz.anzahl === 0 ? (
            <>Alle {p.zeilen.length} Statuscodes tragen eine Kurzform.</>
          ) : (
            <>
              Kurzlabel fehlt bei{' '}
              <strong>{zaehlwort(p.ohneKurz.anzahl, 'Statuscode', 'Statuscodes')}</strong>
              {p.ohneKurz.anzahl > SPITZE && (
                <>
                  {'; '}die {SPITZE} häufigsten decken {prozent(p.abdeckung(SPITZE))} der offenen
                  {' '}Vorkommen
                </>
              )}
              . Ohne Kurzform zeigt die App den gekürzten Bezeichner mit „…".
            </>
          )}
          {p.zuLang > 0 && (
            <span className="text-[var(--tf-warning-text)]">
              {' '}{zaehlwort(p.zuLang, 'Kurzform', 'Kurzformen')} über {KURZLABEL_MAX} Zeichen.
            </span>
          )}
        </span>
        <Button variant="secondary" size="sm" onClick={umschalten}>
          {offen ? 'Nur offene zeigen' : `Alle ${p.zeilen.length} zeigen`}
        </Button>
      </div>

      {nichts && !offen ? null : (
        <>
          {/* Die Einheit gehört an die Zahl: `vorkommen` zählt Verbünde je
              (Feld, Wert) und summiert TV- und Verbund-Feld — nicht Anträge. */}
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Nach Vorkommen im Bestand, häufigste zuerst
            {' '}({p.gesamtVorkommen.toLocaleString('de-DE')} Vorkommen gesamt; gezählt werden
            {' '}Verbünde je Statusfeld, TV- und Verbund-Status zusammen).
          </p>
          <ul className="flex flex-col gap-1">
            {sichtbar.map(z => (
              <Zeile key={z.code} z={z} setKurzLabel={api.setKurzLabel} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
