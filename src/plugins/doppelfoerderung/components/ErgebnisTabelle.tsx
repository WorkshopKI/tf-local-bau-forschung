/**
 * Phase 3: eine Karte je Meldungszeile — Urteil, Schlagworte, Trefferliste.
 *
 * **Die Schlagworte sind editierbar, und jedes trägt seine Trefferzahl.** Am
 * echten Bestand trifft ein zu weites Wort wie „KI" 36 % aller Vorhaben; die
 * Zahl neben dem Chip zeigt genau das, statt den Nutzer raten zu lassen, welches
 * der drei Wörter die Liste aufgerissen hat. Ein geändertes Schlagwort rechnet
 * nur die Wortlaut-Stufe dieser Zeile neu — Millisekunden, kein neuer KI-Lauf.
 *
 * Ab einem Prozent des Betrachtungsbereichs steht zusätzlich „zu weit" am Chip.
 * Der Grund steht bei {@link WORT_ZU_WEIT_ANTEIL}: das Urteil zählt Schlagworte,
 * es wiegt sie nicht — ohne diese Marke liest sich eine Übereinstimmung, die
 * allein an „Automatisierung" (852 Vorhaben) hängt, wie ein Fund.
 */
import { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, Pencil } from 'lucide-react';
import { istZuWeit } from '../services/abgleich';
import { TrefferListe } from './TrefferListe';
import type { ZeilenErgebnis } from '../types';

export interface ErgebnisTabelleProps {
  ergebnisse: readonly ZeilenErgebnis[];
  onSchlagworte: (zeilenNr: number, schlagworte: readonly string[]) => void;
  /** Bezugsgrösse für „zu weit" — ohne sie bleibt die Marke aus. */
  bereichsGroesse: number | null;
}

const EURO = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const PROZENT = new Intl.NumberFormat('de-DE', { style: 'percent', maximumFractionDigits: 1 });

function UrteilsMarke(props: { e: ZeilenErgebnis }): React.ReactElement {
  const { e } = props;
  if (e.fehler) {
    return (
      <span
        className="inline-flex shrink-0 items-center gap-1 rounded-[6px] px-2 py-0.5 text-[11.5px] font-medium"
        style={{ background: 'var(--tf-bg-secondary)', color: 'var(--tf-text-secondary)' }}
      >
        <AlertTriangle size={12} /> nicht geprüft
      </span>
    );
  }
  const ja = e.uebereinstimmung;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-[6px] px-2 py-0.5 text-[11.5px] font-medium"
      style={{
        background: ja ? 'var(--tf-warn-bg, #fef3c7)' : 'var(--tf-bg-secondary)',
        color: ja ? 'var(--tf-warn-text, #92400e)' : 'var(--tf-text-secondary)',
      }}
      title={e.grund === 'aehnlichkeit'
        ? 'Kein Schlagwort traf oft genug — ausgelöst hat die inhaltliche Ähnlichkeit.'
        : undefined}
    >
      {ja ? <AlertTriangle size={12} /> : <Check size={12} />}
      {ja ? 'Übereinstimmung' : 'keine Übereinstimmung'}
      {ja && e.grund === 'aehnlichkeit' && <span className="font-normal">(inhaltlich)</span>}
    </span>
  );
}

function SchlagwortChips(props: {
  e: ZeilenErgebnis;
  bereichsGroesse: number | null;
  onSchlagworte: (zeilenNr: number, schlagworte: readonly string[]) => void;
}): React.ReactElement {
  const { e, bereichsGroesse, onSchlagworte } = props;
  const [bearbeiten, setBearbeiten] = useState(false);
  const [entwurf, setEntwurf] = useState(e.schlagworte.join(', '));

  function uebernehmen(): void {
    const worte = entwurf.split(',').map(s => s.trim()).filter(s => s.length > 0);
    onSchlagworte(e.zeile.zeilenNr, worte);
    setBearbeiten(false);
  }

  if (bearbeiten) {
    return (
      <div className="flex flex-wrap items-center gap-1.5">
        <input
          value={entwurf}
          autoFocus
          onChange={ev => setEntwurf(ev.target.value)}
          onKeyDown={ev => {
            if (ev.key === 'Enter') uebernehmen();
            if (ev.key === 'Escape') { setEntwurf(e.schlagworte.join(', ')); setBearbeiten(false); }
          }}
          placeholder="Schlagworte, mit Komma getrennt"
          className="h-7 min-w-[280px] flex-1 rounded-[8px] bg-[var(--tf-bg)] px-2 text-[12.5px] text-[var(--tf-text)]"
          style={{ border: '0.5px solid var(--tf-border)' }}
        />
        <button
          type="button" onClick={uebernehmen}
          className="h-7 rounded-[8px] px-2 text-[12px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
        >
          Übernehmen
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {e.schlagworte.map(w => {
        const treffer = e.befunde.filter(b => b.getroffeneWorte.includes(w)).length;
        const zuWeit = istZuWeit(treffer, bereichsGroesse);
        const anteil = bereichsGroesse ? ` (${PROZENT.format(treffer / bereichsGroesse)})` : '';
        return (
          <span
            key={w}
            className="inline-flex items-center gap-1.5 rounded-[6px] px-2 py-0.5 text-[12px]"
            style={{ background: 'var(--tf-bg-secondary)', color: 'var(--tf-text)' }}
            title={zuWeit
              ? `„${w}" kommt in ${treffer} Vorhaben des Betrachtungsbereichs vor${anteil} — zu viele, um noch etwas zu unterscheiden. Ersetzen Sie es durch den engeren Begriff daneben.`
              : `„${w}" kommt in ${treffer} Vorhaben des Betrachtungsbereichs vor${anteil}`}
          >
            {w}
            <span className="tabular-nums text-[11px] text-[var(--tf-text-tertiary)]">{treffer}</span>
            {zuWeit && (
              <span className="text-[11px] font-medium" style={{ color: 'var(--tf-warn-text, #92400e)' }}>
                zu weit
              </span>
            )}
          </span>
        );
      })}
      {e.schlagworte.length === 0 && (
        <span className="text-[12px] text-[var(--tf-text-tertiary)]">keine Schlagworte</span>
      )}
      <button
        type="button"
        onClick={() => setBearbeiten(true)}
        title="Schlagworte ändern — nur die Wortlaut-Suche läuft neu"
        className="inline-flex h-6 items-center gap-1 rounded-[6px] px-1.5 text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
      >
        <Pencil size={11} /> ändern
      </button>
    </div>
  );
}

function ErgebnisKarte(props: ErgebnisTabelleProps & { e: ZeilenErgebnis }): React.ReactElement {
  const { e, bereichsGroesse, onSchlagworte } = props;
  const [offen, setOffen] = useState(false);
  const Pfeil = offen ? ChevronDown : ChevronRight;

  return (
    <li
      className="flex flex-col gap-2 rounded-[var(--tf-radius-lg)] px-4 py-3"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <div className="flex flex-wrap items-start gap-2">
        <UrteilsMarke e={e} />
        <div className="min-w-0 flex-1">
          <div className="text-[13.5px] font-medium leading-snug text-[var(--tf-text)]">
            {e.zeile.thema || '(ohne Thema)'}
          </div>
          <div className="flex flex-wrap gap-x-3 text-[11.5px] text-[var(--tf-text-tertiary)]">
            {e.zeile.fkz && <span className="tabular-nums">{e.zeile.fkz}</span>}
            {e.zeile.betrag !== null && <span className="tabular-nums">{EURO.format(e.zeile.betrag)}</span>}
            {e.zeile.betrag === null && e.zeile.betragRoh && <span>Betrag: {e.zeile.betragRoh}</span>}
            {e.zeile.zuwendungsempfaenger && <span className="truncate">{e.zeile.zuwendungsempfaenger}</span>}
            <span className="tabular-nums">Zeile {e.zeile.zeilenNr}</span>
          </div>
        </div>
      </div>

      {e.fehler
        ? <p className="text-[12.5px] text-[var(--tf-text-secondary)]">{e.fehler}</p>
        : <SchlagwortChips e={e} bereichsGroesse={bereichsGroesse} onSchlagworte={onSchlagworte} />}

      {!e.fehler && (
        <>
          <button
            type="button"
            onClick={() => setOffen(o => !o)}
            className="inline-flex w-fit items-center gap-1 rounded-[8px] px-1.5 py-0.5 text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
          >
            <Pfeil size={13} />
            <span className="tabular-nums">{e.befunde.length}</span>
            {e.befunde.length === 1 ? ' gefundenes Vorhaben' : ' gefundene Vorhaben'}
          </button>
          {offen && <TrefferListe befunde={e.befunde} schlagworte={e.schlagworte.length} />}
        </>
      )}
    </li>
  );
}

export function ErgebnisTabelle(props: ErgebnisTabelleProps): React.ReactElement {
  const { ergebnisse, bereichsGroesse, onSchlagworte } = props;
  return (
    <ul className="flex flex-col gap-2">
      {ergebnisse.map(e => (
        <ErgebnisKarte
          key={e.zeile.zeilenNr}
          e={e}
          ergebnisse={ergebnisse}
          bereichsGroesse={bereichsGroesse}
          onSchlagworte={onSchlagworte}
        />
      ))}
    </ul>
  );
}
