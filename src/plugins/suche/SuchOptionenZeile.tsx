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
 * Der Suchbereich steht seit v4.44.0 standardmäßig auf „alle Felder" — vorher
 * hieß derselbe Bereich „Titel, Beschreibung, Dokumente" und las sich damit als
 * Einschränkung, die er nie war. Wer nicht weiß, in welchem Feld sein Wort
 * steht, muss es auch nicht wissen. Seine Optionen tragen die Frage seit v4.44.1
 * selbst („Suche in: …"), siehe `BEREICH_PRAEFIX`.
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

/**
 * Jede Bereichs-Option trägt ihre Frage selbst.
 *
 * Vorher stand „Suchen in:" daneben und die Optionen hießen nur „alle Felder",
 * „nur Dokumente". Aufgeklappt liegt die Liste über der Seite — die Beschriftung
 * daneben ist dann verdeckt oder weit weg, und jede Zeile steht für sich allein.
 * Zugeklappt trägt der Kasten denselben Text und bleibt lesbar, wenn die Zeile
 * umbricht und die Beschriftung in der Zeile darüber landet.
 *
 * Deshalb steht das Wort IN den Optionen und nicht mehr davor: zweimal wäre es
 * „Suchen in: Suche in: alle Felder".
 */
const BEREICH_PRAEFIX = 'Suche in: ';

/**
 * Der Bereich, solange es NICHT alle Felder sind.
 *
 * Ein eingeengter Bereich ist der einzige Schalter dieser Zeile, der Treffer
 * verschwinden lässt, ohne dass am Ergebnis etwas davon steht — 0 Treffer sehen
 * aus wie „gibt es nicht", nicht wie „hier war nicht gesucht". Die Auswahl
 * bekommt deshalb dieselbe Randfarbe, die die Seite sonst für gesetzte Filter
 * verwendet. Kein Chip daneben: die Auswahl trägt ihre Beschriftung selbst, ein
 * zweites Element sagte dasselbe noch einmal.
 */
const SELECT_STYLE_ENG: React.CSSProperties = {
  background: 'var(--tf-sheet)',
  border: '0.5px solid var(--tf-primary)',
  color: 'var(--tf-primary)',
};

/**
 * Was die Wortverknüpfung im Frage-Modus tut, entscheidet der Plan: seine
 * Leitbegriffe sind IMMER Alternativen, sonst misst die Abdeckung nicht mehr,
 * wie viele der gefragten Sachen ein Vorhaben behandelt. Der Regler steht
 * deshalb nicht still daneben und verspricht etwas anderes — er gibt sichtbar ab.
 */
const ABGEGEBEN_STYLE: React.CSSProperties = {
  background: 'var(--tf-desk)',
  border: '0.5px dashed var(--tf-border)',
  color: 'var(--tf-text-tertiary)',
};

const ABGEGEBEN_TITEL = 'Im Frage-Modus bestimmt die KI, wie die Begriffe verknüpft '
  + 'werden — die Leitbegriffe sind Alternativen, damit die Wertung zählen kann, wie '
  + 'viele der gefragten Sachen ein Vorhaben behandelt. Zurück zur Stichwortsuche '
  + 'schalten, um wieder selbst zu bestimmen.';

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
  nlVerfuegbar,
  nlModus,
  onNlModus,
  planAktiv,
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
  /** Bringt dieser Build die natürlichsprachige Suche mit? */
  nlVerfuegbar: boolean;
  nlModus: boolean;
  onNlModus: (an: boolean) => void;
  /** Liegt gerade ein übersetzter Plan vor? Erst dann geben die Regler wirklich ab. */
  planAktiv: boolean;
  indexHinweis: string;
}): React.ReactElement {
  // Abgegeben wird erst, wenn ein Plan da IST. Solange nur der Modus steht, die
  // Frage aber noch nicht übersetzt ist, sucht die Seite weiter nach Stichworten
  // — und dann müssen die Regler auch gelten.
  const uebernommen = nlModus && planAktiv;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {nlVerfuegbar && (
        <select
          value={nlModus ? 'frage' : 'stichwort'}
          onChange={e => onNlModus(e.target.value === 'frage')}
          aria-label="Art der Suche"
          className={SELECT_CLASS}
          style={nlModus ? SELECT_STYLE_ENG : SELECT_STYLE}
          title={nlModus
            ? 'Die interne KI übersetzt die Frage in Suchbegriffe — sie benennt auch '
              + 'Schreibweisen und verwandte Wörter, die im Bestand stehen, aber nicht in '
              + 'der Frage. Was gesucht wurde, steht danach als abwählbare Chips darunter.'
            : 'Gesucht wird nach dem, was im Feld steht. Umschalten auf „mit natürlicher '
              + 'Sprache", um stattdessen eine Frage zu stellen.'}
        >
          <option value="stichwort">mit Stichworten suchen</option>
          <option value="frage">mit natürlicher Sprache suchen</option>
        </select>
      )}

      <label
        className="inline-flex items-center gap-1.5 text-[12px]"
        style={{ color: uebernommen ? 'var(--tf-text-tertiary)' : 'var(--tf-text-secondary)' }}
      >
        Wortverknüpfung:
        <select
          value={uebernommen ? 'oder' : verknuepfung}
          onChange={e => onVerknuepfung(e.target.value as SuchVerknuepfung)}
          disabled={uebernommen}
          className={SELECT_CLASS}
          style={uebernommen ? ABGEGEBEN_STYLE : SELECT_STYLE}
          title={uebernommen
            ? ABGEGEBEN_TITEL
            : 'Gilt für Wortlaut-Treffer. Die Ähnlichkeitssuche vergleicht die Anfrage als Ganzes und bleibt unberührt.'}
        >
          {(Object.keys(VERKNUEPFUNG_LABEL) as SuchVerknuepfung[]).map(v => (
            <option key={v} value={v}>{VERKNUEPFUNG_LABEL[v]}</option>
          ))}
        </select>
      </label>

      {uebernommen && (
        <span className="text-[11px] text-[var(--tf-text-tertiary)]" title={ABGEGEBEN_TITEL}>
          von der KI bestimmt
        </span>
      )}

      <label
        className="inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[12px] cursor-pointer"
        style={uebernommen
          ? { ...ABGEGEBEN_STYLE, cursor: 'default' }
          : { ...SELECT_STYLE, color: 'var(--tf-text-secondary)' }}
        title={uebernommen
          ? 'Im Frage-Modus benennt die KI die Wortformen selbst — sie stehen als Chips '
            + 'in der Zeile darunter und lassen sich dort einzeln abwählen.'
          : 'Dasselbe Wort in anderer Form: „Normen“ findet dann auch „Normung“. Rein sprachlich — kostet nichts und lädt nichts nach. (Nicht zu verwechseln mit der Ähnlichkeitssuche rechts, die nach dem Thema geht.)'}
      >
        <input
          type="checkbox"
          checked={stammSuche}
          onChange={e => onStammSuche(e.target.checked)}
          disabled={uebernommen}
          className="h-3.5 w-3.5 cursor-pointer accent-[var(--tf-primary)] disabled:cursor-default"
        />
        Wortformen mitsuchen
      </label>

      <select
        value={bereich}
        onChange={e => onBereich(e.target.value as Suchbereich)}
        aria-label="Suche in"
        className={SELECT_CLASS}
        style={bereich === 'alles' ? SELECT_STYLE : SELECT_STYLE_ENG}
        title={
          bereich === 'alles'
            ? 'Sucht in allen Feldern: Titel, Kurzbeschreibung, Deskriptoren, '
              + 'Akronym, Aktenzeichen, Einrichtung, Web-Adresse, Ort und '
              + 'Bundesland — dazu in den Dokumenten. Der Standard, wenn man '
              + 'nicht weiß, wo das Wort steht.'
            : `Eingeschränkt auf „${SUCHBEREICH_LABEL[bereich]}“. Was außerhalb `
              + 'steht, erscheint nicht — auch dann nicht, wenn es das Wort '
              + 'enthält. „alle Felder" nimmt die Einschränkung zurück.'
        }
      >
        {(Object.keys(SUCHBEREICH_LABEL) as Suchbereich[]).map(b => (
          <option key={b} value={b}>{BEREICH_PRAEFIX}{SUCHBEREICH_LABEL[b]}</option>
        ))}
      </select>

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
