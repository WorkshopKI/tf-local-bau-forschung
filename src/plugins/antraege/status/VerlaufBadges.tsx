/**
 * Die kleinen Marken, die in Chronik, Matrix **und** Zeitstrahl dieselbe Auskunft
 * geben: **wer** hat gesetzt (Rolle) und **wo** steht der Eintrag (Träger).
 *
 * Sie liegen zusammen in einer Datei, weil sie **ein Maß** teilen ({@link MARKE}):
 * getrennt wären es vier Dateien mit derselben Größenkonvention, die dann
 * viermal gepflegt würde und beim fünften Mal auseinanderliefe.
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
import {
  ROLLE_LABEL, ROLLE_LANG, ROLLE_GEDIMMT, rollenFarbe, rollenWahlOffen, sortiereRollen,
  type Rolle,
} from '@/core/status';

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

/**
 * Polster und Höhe einer Marke — beide Marken tragen dasselbe Maß.
 *
 * 3 px Polster (Entwurf: 5, bis v4.48.1: 6): die Marke steht in einer Zeile mit
 * 19 px Höhe zwischen Kürzel und Ereignistext, und dort zählt jeder Millimeter
 * gegen den Text. Weniger geht nicht — bei 2 px berührt die Schrift den Rand.
 */
const MARKE = 'inline-flex items-center rounded-[4px] px-[3px] h-[17px] text-[10.5px] leading-none';
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

/**
 * Ein **Kürzel** in der Rollenfarbe — die Marke über der Zeitstrahl-Bahn.
 *
 * Sie steht hier und nicht im Band, weil sie das Maß der beiden anderen teilt.
 * Zwei Unterschiede zur Chronik-Zeile, beide bewusst:
 *
 * - **Monospace**, wie die Träger-Marke: über der Bahn stehen Kürzel neben
 *   Kürzeln, und `AK4` neben `AT4` liest sich nur mit fester Laufweite als Paar.
 * - **Meilenstein wirkt über die Schriftstärke**, nicht über die Akzentfarbe wie
 *   in der Matrix: der Farbkanal trägt hier schon die Rolle. Zwei Bedeutungen auf
 *   einem Kanal machten beide unlesbar.
 *
 * Ohne Rolle (neutral oder Kürzel nicht im Katalog) bleibt die Marke ungetönt —
 * die beiden Fälle unterscheidet der Titel, den der Aufrufer setzt (Pitfall #43).
 */
export function RollenKuerzel({ text, rolle, meilenstein = false, gedimmt = false, titel }: {
  text: string;
  /** `null` = neutral oder unbekannt — dann trägt die Marke keine Tönung. */
  rolle: Rolle | null;
  meilenstein?: boolean;
  gedimmt?: boolean;
  titel?: string;
}): React.ReactElement {
  const farbe = gedimmt || rolle === null ? ROLLE_GEDIMMT : rollenFarbe(rolle);
  return (
    <span
      className={`${MARKE} font-mono w-full justify-center overflow-hidden${
        meilenstein && !gedimmt ? ' font-medium' : ''}`}
      style={{
        background: farbe.flaeche,
        color: farbe.text,
        ...(rolle === null || gedimmt ? { border: '0.5px solid var(--tf-border-hover)' } : {}),
      }}
      title={titel}
    >
      {text}
    </span>
  );
}

/**
 * Die **Rollenbilanz** einer Zeitstrahl-Bahn: wie viele Termine je Rolle in ihr
 * stehen — „wer hat an diesem Teilvorhaben gearbeitet" in einer Zeile.
 *
 * Rollen ohne Termin fehlen ganz: eine `0` sagt dasselbe wie Abwesenheit und
 * kostet die Breite, die der Nachbar braucht. Neutrale Termine zählen nirgends
 * — die Summe der Marken ist deshalb weder die Zahl der Termine noch ihre
 * Obergrenze (ein Kürzel mit zwei Rollen zählt zweimal).
 */
export function RollenBilanz({ bilanz, wahl }: {
  bilanz: Readonly<Record<Rolle, number>>;
  /** Aktive Rollenwahl; leer oder vollständig = keine Einschränkung. */
  wahl?: ReadonlySet<Rolle>;
}): React.ReactElement | null {
  const offen = wahl === undefined || rollenWahlOffen(wahl);
  const rollen = sortiereRollen(
    (Object.keys(bilanz) as Rolle[]).filter(r => bilanz[r] > 0),
  );
  if (rollen.length === 0) return null;
  return (
    <span className={`inline-flex items-center ${ABSTAND}`}>
      {rollen.map(r => {
        const gedimmt = !offen && wahl?.has(r) !== true;
        const farbe = gedimmt ? ROLLE_GEDIMMT : rollenFarbe(r);
        return (
          <span
            key={r}
            className={`${MARKE} gap-[3px]`}
            style={{
              background: farbe.flaeche,
              color: farbe.text,
              ...(gedimmt ? { border: '0.5px solid var(--tf-border)' } : {}),
            }}
            title={`${ROLLE_LANG[r]}: ${bilanz[r]} Termine`}
          >
            <span className="font-medium">{ROLLE_LABEL[r]}</span>
            {bilanz[r]}
          </span>
        );
      })}
    </span>
  );
}

/**
 * Eine Träger-Marke — bewusst monospace, damit die Aktenzeichen untereinander
 * stehen.
 *
 * Die Schrift steht auf `--tf-text-secondary` über `--tf-bg-secondary`:
 * gemessen 5,0:1 hell und 6,3:1 dunkel, also über AA — dunkler geriete sie in
 * Konkurrenz zum Ereignistext, den sie nur begleitet. Was ihr fehlte, war der
 * **Umriss**: mit `--tf-border` (0,08 Alpha) verschwand die Fläche, und die
 * Marke las sich als loser grauer Text. Der Rand trägt deshalb `-hover` (0,15).
 */
function Traeger({ text, titel }: { text: string; titel?: string }): React.ReactElement {
  return (
    <span
      className={`${MARKE} font-mono`}
      style={{
        background: 'var(--tf-bg-secondary)',
        color: 'var(--tf-text-secondary)',
        border: '0.5px solid var(--tf-border-hover)',
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
