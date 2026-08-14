/**
 * Die zwei kleinen Marken, die in Chronik **und** Matrix dieselbe Auskunft
 * geben: **wer** hat gesetzt (Rolle) und **wo** steht der Eintrag (Träger).
 *
 * Sie liegen zusammen in einer Datei, weil sie zusammen gelesen werden — eine
 * Zeile beantwortet mit beiden die Leitfrage der Ansicht. Getrennt wären es
 * zwei Dateien mit je einem Dutzend Zeilen und derselben Größenkonvention, die
 * dann zweimal gepflegt würde.
 *
 * **Träger: einzeln benennen, nicht zusammenfassen.** Bis v4.47 stand hier
 * `traegerLabel` — „3 Teilvorhaben". Das ist genau die Auskunft, wegen der man
 * im Fachsystem jedes Teilvorhaben einzeln aufruft: *welche* drei? Die Angabe
 * liegt in `ChronikEintrag.tvIds` längst vor. `traegerLabel` bleibt für den
 * Tooltip und für Aufrufer, die eine Zeichenkette brauchen.
 *
 * Zusammengefasst wird erst, wo Einzelnennung nichts mehr trägt: tragen **alle**
 * Teilvorhaben denselben Termin, sagt „alle 6" mehr als sechs gleiche Marken.
 */
import { ROLLE_LABEL, ROLLE_LANG, ROLLE_GEDIMMT, rollenFarbe, sortiereRollen, type Rolle } from '@/core/status';

/** Ab wie vielen Trägern eine vollständige Liste zu „alle N" zusammenfällt. */
const ALLE_AB = 4;
/** Wie viele Träger einzeln stehen, bevor der Rest zu „+n" wird. */
const EINZELN_MAX = 4;
/**
 * Wie viele Marken eine Rollenspalte hält. **Drei**, weil die Spalte auf drei
 * bemessen ist: 31 der 506 Codes tragen drei Rollen, genau einer vier (`IP`,
 * „Kenntnisnahme von Insolvenz des Partners" — AB/FB/QS/Jur). Eine Spalte für
 * diesen einen zu bemessen, kostete auf jeder Zeile jedes Vorgangs Breite; ihn
 * überlaufen zu lassen, schöbe die Marken in den Ereignistext (bis v4.48.1 zu
 * sehen). Der Rest fällt darum zu „+n" zusammen, dessen Titel alle nennt.
 */
const ROLLEN_MAX = 3;

/** Polster und Höhe einer Marke — beide Marken tragen dasselbe Maß. */
const MARKE = 'inline-flex items-center rounded-[4px] px-1 h-[17px] text-[10.5px] leading-none';
/** Abstand zwischen zwei Marken derselben Zeile. */
const ABSTAND = 'gap-[3px]';

/**
 * Die Rollen einer Zeile als getönte Marken.
 *
 * **Neutral bleibt leer.** 144 der 505 Codes lässt das Fachsystem von jedem
 * setzen; „alle" an jeder dritten Zeile wäre Rauschen ohne Information
 * (dieselbe Regel wie in der Ordner-Liste). Der Tooltip der Zeile sagt es.
 *
 * `gedimmt` = die Zeile gehört nicht zur aktiven Rollenwahl, bleibt aber stehen:
 * dann verliert die Marke ihre Tönung, nicht ihren Platz.
 */
export function RollenBadges({ rollen, gedimmt = false }: {
  rollen: readonly Rolle[];
  gedimmt?: boolean;
}): React.ReactElement | null {
  const sortiert = sortiereRollen(rollen);
  if (sortiert.length === 0) return null;
  const zuViele = sortiert.length > ROLLEN_MAX;
  const sichtbar = zuViele ? sortiert.slice(0, ROLLEN_MAX - 1) : sortiert;
  const rest = sortiert.length - sichtbar.length;
  return (
    <span className={`inline-flex items-center ${ABSTAND}`}>
      {sichtbar.map(r => {
        const farbe = gedimmt ? ROLLE_GEDIMMT : rollenFarbe(r);
        return (
          <span
            key={r}
            className={MARKE}
            style={{
              background: farbe.flaeche,
              color: farbe.text,
              ...(gedimmt ? { border: '0.5px solid var(--tf-border)' } : {}),
            }}
            title={ROLLE_LANG[r]}
          >
            {ROLLE_LABEL[r]}
          </span>
        );
      })}
      {rest > 0 && (
        <span
          className={MARKE}
          style={{
            background: ROLLE_GEDIMMT.flaeche,
            color: ROLLE_GEDIMMT.text,
            border: '0.5px solid var(--tf-border)',
          }}
          title={sortiert.map(r => ROLLE_LANG[r]).join('\n')}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

/** Eine Träger-Marke — bewusst monospace, damit die Aktenzeichen untereinander stehen. */
function Traeger({ text, titel }: { text: string; titel?: string }): React.ReactElement {
  return (
    <span
      className={`${MARKE} font-mono`}
      style={{
        background: 'var(--tf-bg-secondary)',
        color: 'var(--tf-text-secondary)',
        border: '0.5px solid var(--tf-border)',
      }}
      title={titel}
    >
      {text}
    </span>
  );
}

/**
 * Die Träger eines Eintrags: der Verbund oder die einzelnen Teilvorhaben.
 *
 * Leere `tvIds` heißen **Verbund**, nicht „niemand" — Verbund-Felder liefern
 * bewusst genau einen Eintrag ohne `tvId`.
 */
export function TraegerBadges({ tvIds, nummern, gesamt }: {
  tvIds: readonly string[];
  /** Aktenzeichen → laufende Nummer („TV 3"). Fehlt sie, steht das Aktenzeichen. */
  nummern?: ReadonlyMap<string, number>;
  /** Wie viele Teilvorhaben der Verbund hat — für „alle N". */
  gesamt?: number;
}): React.ReactElement {
  if (tvIds.length === 0) return <Traeger text="Verbund" />;

  // Ohne Nummernkarte steht die **Endung** des Aktenzeichens statt einer Nummer.
  // Eine hier selbst vergebene Nummer wäre die Nummer dieser Liste, nicht die
  // des Verbunds — und „TV 2" in der Zeile, das ein anderes Teilvorhaben meint
  // als „TV 2" in der Filterleiste, ist schlimmer als ein Kürzel ohne Nummer.
  const beschriftung = (id: string): string => {
    const n = nummern?.get(id);
    if (n !== undefined) return `TV${n}`;
    return id.length > 3 ? `…${id.slice(-3)}` : id;
  };
  const alleTitel = tvIds.join('\n');

  if (gesamt !== undefined && gesamt >= ALLE_AB && tvIds.length === gesamt) {
    return <Traeger text={`alle ${gesamt}`} titel={alleTitel} />;
  }

  const sichtbar = tvIds.slice(0, EINZELN_MAX);
  const rest = tvIds.length - sichtbar.length;
  return (
    <span className={`inline-flex items-center ${ABSTAND}`}>
      {sichtbar.map(id => <Traeger key={id} text={beschriftung(id)} titel={id} />)}
      {rest > 0 && <Traeger text={`+${rest}`} titel={alleTitel} />}
    </span>
  );
}
