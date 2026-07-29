/**
 * Eingangs-Leiste im Seitenkopf — der bereichsweite Vorfilter über den
 * Antragseingang. Gilt für Übersicht, „Diese Woche" und Auswertung samt ihrer
 * Tab-Zähler; die Konfiguration zeigt keine Zeilendaten und blendet sie aus.
 *
 * Ein Zustand, zwei Bedienwege: die Chips sind Kurzwahl auf ein ganzes Jahr, die
 * beiden Datumsfelder die taggenaue Form. Die Felder zeigen deshalb immer den
 * tatsächlichen Zeitraum — auch wenn er über einen Chip zustande kam.
 *
 * `<input type="date">` statt eigenem Kalender: liefert die Landes-Schreibweise
 * (tt.mm.jjjj) geschenkt, gibt den Wert immer als ISO zurück und läuft unter
 * `file://` ohne jede Abhängigkeit.
 */
import { ToggleChip } from '@/components/ui/ToggleChip';
import {
  JAHR_CHIPS, jahrAlsBereich, jahrChips, setzeBis, setzeVon, standardBereich,
  type DatumBereich,
} from './monitoringLogic';
import { feldStil } from './labels';

const gleich = (a: DatumBereich | null, b: DatumBereich): boolean =>
  a !== null && a.von === b.von && a.bis === b.bis;

const DATUM_CLS =
  'text-[12px] rounded px-1.5 py-1 bg-[var(--tf-bg)] text-[var(--tf-text)] cursor-pointer';

export function JahresFilter({ bereich, currentYear, spanne, ohneDatum, onChange }: {
  /** Gewählter Zeitraum; `null` = alle Eingänge. */
  bereich: DatumBereich | null;
  currentYear: number;
  /** Grenzen der Datumsfelder (aus den Daten abgeleitet). */
  spanne: DatumBereich;
  /** Verbünde ohne verwertbares Antragsdatum — Hinweis nur bei aktivem Bereich. */
  ohneDatum: number;
  onChange: (bereich: DatumBereich | null) => void;
}): React.ReactElement {
  // Bei „Alle Eingänge" zeigen die Felder die volle Spanne — jede Änderung daran
  // macht daraus einen echten Zeitraum.
  const offen = bereich ?? spanne;

  /** Geleertes Feld heißt „bis an den Rand der Daten", nicht „ungültig". */
  const datumOder = (wert: string, ersatz: string): string => wert || ersatz;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[11.5px] text-[var(--tf-text-tertiary)] mr-0.5">Eingang</span>

      {jahrChips(currentYear).map(j => {
        const jahr = jahrAlsBereich(j);
        return (
          <ToggleChip
            key={j}
            label={String(j)}
            selected={gleich(bereich, jahr)}
            onToggle={() => onChange(jahr)}
            title={`Antragseingang im ganzen Jahr ${j}`}
          />
        );
      })}

      {/* Der Rückweg zur Vorbelegung — sonst käme man von einem einzelnen Jahr nur
          über die Datumsfelder oder „Alle Eingänge" wieder heraus. */}
      <ToggleChip
        label={`Letzte ${JAHR_CHIPS} Jahre`}
        selected={gleich(bereich, standardBereich(currentYear))}
        onToggle={() => onChange(standardBereich(currentYear))}
        title={`Antragseingang ab ${currentYear - (JAHR_CHIPS - 1)} — die Vorbelegung`}
      />

      <label className="flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)] ml-1.5">
        von
        <input
          type="date"
          value={offen.von}
          min={spanne.von}
          max={spanne.bis}
          onChange={e => onChange(setzeVon(offen, datumOder(e.target.value, spanne.von)))}
          aria-label="Antragseingang von"
          className={DATUM_CLS}
          style={feldStil}
        />
      </label>
      <label className="flex items-center gap-1 text-[11.5px] text-[var(--tf-text-tertiary)]">
        bis
        <input
          type="date"
          value={offen.bis}
          min={spanne.von}
          max={spanne.bis}
          onChange={e => onChange(setzeBis(offen, datumOder(e.target.value, spanne.bis)))}
          aria-label="Antragseingang bis"
          className={DATUM_CLS}
          style={feldStil}
        />
      </label>

      <ToggleChip
        label="Alle Eingänge"
        selected={bereich === null}
        onToggle={() => onChange(null)}
        title="Zeitraum-Filter aufheben"
        className="ml-1.5"
      />

      {bereich !== null && ohneDatum > 0 && (
        <span
          className="text-[11.5px] text-[var(--tf-text-tertiary)]"
          title="Ohne Antragsdatum lässt sich kein Eingang einordnen — unter „Alle Eingänge“ sind sie wieder dabei."
        >
          · {ohneDatum} ohne Antragsdatum ausgeblendet
        </span>
      )}
    </div>
  );
}
