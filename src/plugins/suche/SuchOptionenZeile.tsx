/**
 * Die Optionszeile unter dem Suchfeld.
 *
 * Vorher standen hier zwei Dropdowns in Fachsprache: „Ohne Ähnlichkeitssuche"
 * und „Irgendein Wort". Beide beschreiben die Mechanik, keines die Frage, die
 * jemand hat. Jetzt sagen drei benannte Optionen, WIE die Wörter verknüpft
 * werden, WOMIT zusätzlich gesucht wird und WORIN.
 *
 * Die Ähnlichkeitssuche (Embedding) bleibt daneben ihr eigener Schalter: sie
 * lädt ein Modell von ~200 MB nach, und das darf nicht hinter einer harmlosen
 * Beschriftung passieren.
 *
 * Die beiden Schalter hießen bis v4.15.0 „Ähnliche Begriffe mitsuchen" und
 * „Ähnlichkeitssuche" — zwei Namen, die dasselbe versprachen und Verschiedenes
 * taten. Sie trennt jetzt die Achse, auf der sie wirken: der eine sucht dasselbe
 * WORT in anderer Form (rein sprachlich, kostenlos), der andere dasselbe THEMA
 * in anderen Worten (Sprachmodell, Nachladen).
 */
import {
  VERKNUEPFUNG_LABEL,
  type SuchVerknuepfung,
} from '@/core/hooks/useSuchVerknuepfung';
import { SUCHBEREICH_LABEL, type Suchbereich } from '@/core/services/search/suchbereich';

const SELECT_CLASS = 'h-7 rounded-[8px] px-2 text-[12px] text-[var(--tf-text)] cursor-pointer '
  + 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tf-primary)]/40';

const SELECT_STYLE: React.CSSProperties = {
  background: 'var(--tf-sheet)',
  border: '0.5px solid var(--tf-border)',
};

export function SuchOptionenZeile({
  verknuepfung,
  onVerknuepfung,
  stammSuche,
  onStammSuche,
  bereich,
  onBereich,
  semantischAn,
  onSemantisch,
  semantischLaedt,
  indexHinweis,
}: {
  verknuepfung: SuchVerknuepfung;
  onVerknuepfung: (v: SuchVerknuepfung) => void;
  stammSuche: boolean;
  onStammSuche: (an: boolean) => void;
  bereich: Suchbereich;
  onBereich: (b: Suchbereich) => void;
  semantischAn: boolean;
  onSemantisch: (an: boolean) => void;
  semantischLaedt: boolean;
  indexHinweis: string;
}): React.ReactElement {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)]">
        Wortverknüpfung:
        <select
          value={verknuepfung}
          onChange={e => onVerknuepfung(e.target.value as SuchVerknuepfung)}
          className={SELECT_CLASS}
          style={SELECT_STYLE}
          title="Gilt für Wortlaut-Treffer. Die Ähnlichkeitssuche vergleicht die Anfrage als Ganzes und bleibt unberührt."
        >
          {(Object.keys(VERKNUEPFUNG_LABEL) as SuchVerknuepfung[]).map(v => (
            <option key={v} value={v}>{VERKNUEPFUNG_LABEL[v]}</option>
          ))}
        </select>
      </label>

      <label
        className="inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[12px] text-[var(--tf-text-secondary)] cursor-pointer"
        style={SELECT_STYLE}
        title="Dasselbe Wort in anderer Form: „Normen“ findet dann auch „Normung“. Rein sprachlich — kostet nichts und lädt nichts nach. (Nicht zu verwechseln mit der Ähnlichkeitssuche rechts, die nach dem Thema geht.)"
      >
        <input
          type="checkbox"
          checked={stammSuche}
          onChange={e => onStammSuche(e.target.checked)}
          className="h-3.5 w-3.5 cursor-pointer accent-[var(--tf-primary)]"
        />
        Wortformen mitsuchen
      </label>

      <label className="inline-flex items-center gap-1.5 text-[12px] text-[var(--tf-text-secondary)]">
        Suchen in:
        <select
          value={bereich}
          onChange={e => onBereich(e.target.value as Suchbereich)}
          className={SELECT_CLASS}
          style={SELECT_STYLE}
          title="Begrenzt die durchsuchten Felder."
        >
          {(Object.keys(SUCHBEREICH_LABEL) as Suchbereich[]).map(b => (
            <option key={b} value={b}>{SUCHBEREICH_LABEL[b]}</option>
          ))}
        </select>
      </label>

      <label
        className="inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[12px] text-[var(--tf-text-secondary)] cursor-pointer"
        style={SELECT_STYLE}
        title="Dasselbe Thema in anderen Worten: findet verwandte Vorhaben auch ohne gemeinsames Wort. Lädt beim ersten Mal ein Sprachmodell (~200 MB) nach — anders als „Wortformen mitsuchen“ links, das rein sprachlich arbeitet."
      >
        <input
          type="checkbox"
          checked={semantischAn}
          onChange={e => onSemantisch(e.target.checked)}
          className="h-3.5 w-3.5 cursor-pointer accent-[var(--tf-primary)]"
        />
        Ähnlichkeitssuche
        {semantischLaedt && (
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">lädt …</span>
        )}
      </label>

      <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">{indexHinweis}</span>
    </div>
  );
}
