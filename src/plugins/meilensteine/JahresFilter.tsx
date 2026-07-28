/**
 * Jahrgangs-Leiste im Seitenkopf — der bereichsweite Vorfilter über den
 * Antragseingang. Gilt für Übersicht, „Diese Woche" und Auswertung samt ihrer
 * Tab-Zähler; die Konfiguration zeigt keine Zeilendaten und blendet sie aus.
 *
 * Ein Zustand, zwei Bedienwege: die Chips sind Kurzwahl auf ein einzelnes Jahr,
 * die beiden Listen die allgemeine Von-Bis-Form. Die Listen zeigen deshalb immer
 * den tatsächlichen Bereich — auch wenn er über einen Chip zustande kam.
 */
import { ToggleChip } from '@/components/ui/ToggleChip';
import { jahrChips, setzeBis, setzeVon, type JahrBereich } from './monitoringLogic';
import { feldStil } from './labels';

const SELECT_CLS =
  'text-[12px] rounded px-1.5 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] cursor-pointer';

/** Jahre von `bis` abwärts bis `von` — neueste zuerst, wie in den Chips. */
function jahresListe({ von, bis }: JahrBereich): number[] {
  return Array.from({ length: bis - von + 1 }, (_, i) => bis - i);
}

export function JahresFilter({ bereich, currentYear, spanne, ohneDatum, onChange }: {
  /** Gewählter Bereich; `null` = alle Jahrgänge. */
  bereich: JahrBereich | null;
  currentYear: number;
  /** Umfang der Auswahllisten (aus den Daten abgeleitet). */
  spanne: JahrBereich;
  /** Verbünde ohne verwertbares Antragsdatum — Hinweis nur bei aktivem Bereich. */
  ohneDatum: number;
  onChange: (bereich: JahrBereich | null) => void;
}): React.ReactElement {
  const jahre = jahresListe(spanne);
  // Bei „Alle Jahre" zeigen die Listen die volle Spanne — jede Änderung daran
  // macht daraus einen echten Bereich.
  const offen = bereich ?? spanne;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[11.5px] text-[var(--tf-text-tertiary)] mr-0.5">Jahrgang</span>

      {jahrChips(currentYear).map(j => (
        <ToggleChip
          key={j}
          label={String(j)}
          selected={bereich?.von === j && bereich.bis === j}
          onToggle={() => onChange({ von: j, bis: j })}
          title={`Nur Antragseingang ${j}`}
        />
      ))}

      <label className="flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)] ml-1.5">
        von
        <select
          value={offen.von}
          onChange={e => onChange(setzeVon(offen, Number(e.target.value)))}
          aria-label="Jahrgang von"
          className={SELECT_CLS}
          style={feldStil}
        >
          {jahre.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
        bis
        <select
          value={offen.bis}
          onChange={e => onChange(setzeBis(offen, Number(e.target.value)))}
          aria-label="Jahrgang bis"
          className={SELECT_CLS}
          style={feldStil}
        >
          {jahre.map(j => <option key={j} value={j}>{j}</option>)}
        </select>
      </label>

      <ToggleChip
        label="Alle Jahre"
        selected={bereich === null}
        onToggle={() => onChange(null)}
        title="Jahrgangs-Filter aufheben"
        className="ml-1.5"
      />

      {bereich !== null && ohneDatum > 0 && (
        <span
          className="text-[11.5px] text-[var(--tf-text-tertiary)]"
          title="Ohne Antragsdatum gibt es keinen Jahrgang — unter „Alle Jahre“ sind sie wieder dabei."
        >
          · {ohneDatum} ohne Antragsdatum ausgeblendet
        </span>
      )}
    </div>
  );
}
