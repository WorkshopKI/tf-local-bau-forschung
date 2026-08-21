/**
 * Das Maß, das sich die beiden Ordnungen des Verlaufs teilen.
 *
 * „nach Datum" ({@link StatusChronik}) und „nach Phase"
 * ({@link StatusSchrittMatrix}) zeigen **dieselben Termine**. Wer umschaltet,
 * will eine andere Ordnung sehen — nicht ein anderes Bild. Bis v4.13x standen
 * die Maße doppelt (Tailwind-Klassen dort, px-Konstanten hier) und waren längst
 * auseinandergelaufen: 84 gegen 104 in der linken Rinne, 46 gegen 54 beim
 * Kürzel. Der Ereignistext sprang beim Umschalten um gut 100 px.
 *
 * **Die Zahl steht zweimal — als Zahl und im Klassennamen.** Tailwind liest
 * Klassennamen aus dem Quelltext; `w-[${TAG_PX}px]` erzeugt kein CSS. Die
 * Paarung ist deshalb Absicht und wird von einem Test gehalten
 * (`verlaufGeometrie.test.ts`), nicht von Disziplin.
 *
 * **Wie die Spaltenbreiten der Tabelle daraus folgen:** die Chronik ist eine
 * Flex-Liste hinter einer Achse (`border-l` + `pl-4`), die Matrix eine Tabelle
 * mit festen `<col>`-Breiten. Damit beide dieselben x-Positionen treffen,
 * enthält eine Matrix-Spalte den Slot der Chronik **plus** deren `gap-2` —
 * und die Zellen tragen kein eigenes waagerechtes Polster, sonst wäre die
 * `<col>`-Breite nicht mehr die ganze Wahrheit.
 */

/** Linke Rinne: Monat („MÄRZ 2026") bzw. Phase („EINGANG"). */
export const RINNE_PX = 84;
/** Einzug hinter der senkrechten Achse (`pl-4` in der Chronik). */
export const ACHSE_PX = 16;
/** Tagesspalte. In „nach Phase" leer reserviert — die Daten stehen dort in den
 *  Träger-Spalten, aber ohne den Slot spränge alles dahinter nach links. */
export const TAG_PX = 42;
/** Kürzelspalte — der längste Code des Katalogs hat sechs Zeichen (`XSPDOK`). */
export const CODE_PX = 46;
/** Rollenspalte — Platz für drei Marken (31 der 506 Codes tragen drei). */
export const ROLLE_PX = 76;
/** Abstand zwischen zwei Spalten (`gap-2`). */
export const ABSTAND_PX = 8;
/** Zeilenhöhe beider Ordnungen. Ohne senkrechtes Polster: bei 28 Terminen sind
 *  3 px je Zeile ein ganzer Eintrag. */
export const ZEILE_PX = 19;

/**
 * Die Breiten stehen **ohne** Schriftangabe eigens da, weil die Spaltenköpfe
 * dieselbe Breite brauchen, aber nicht dieselbe Schrift: ein Kopf ist kleiner
 * und nie dicktengleich. Zwei Schriftgrößen im selben Klassen-String hätte
 * nicht die Reihenfolge im String entschieden, sondern die im erzeugten CSS —
 * also gar nichts Verlässliches.
 */
/** Die Rinne ohne Kopfabstand — für den Spaltenkopf, der oben bündig sitzt. */
export const RINNE_BREITE = 'w-[84px] shrink-0 pr-2';
/** Die Rinne als Block — Breite, Rechtsabstand, Kopfabstand ihrer Gruppe. */
export const RINNE_BLOCK = `${RINNE_BREITE} pt-2`;
/** Die Beschriftung in der Rinne (Monat wie Phase). */
export const RINNE_TEXT = 'text-[11px] font-medium uppercase tracking-wide';
/** Breite der Tagesspalte. */
export const TAG_BREITE = 'w-[42px] shrink-0';
/** Die Tagesspalte — hier steht bei einer Fehlzeile der Gedankenstrich. */
export const TAG_SPALTE = `${TAG_BREITE} font-mono text-[11px]`;
/**
 * Die Kürzelspalte. Steht zwischen Datum und Rolle — dieselbe Lesereihenfolge
 * wie im Fachsystem, wo das Kürzel der Bezeichner ist, unter dem das Team einen
 * Eintrag kennt. Die Bezeichnung sagt, WAS passiert ist; das Kürzel sagt, wo im
 * Fachsystem man es wiederfindet.
 */
export const CODE_BREITE = 'w-[46px] shrink-0 truncate';
export const CODE_SPALTE = `${CODE_BREITE} font-mono text-[11px]`;
/**
 * Die Rollenspalte. 62 px reichten für zwei Marken, und die dritte schob sich in
 * den Ereignistext (`AB` `FB` `Q`|`S-Freigabe …`); mehr fängt `RollenBadges`
 * mit „+n" ab.
 */
export const ROLLEN_SPALTE = 'w-[76px] shrink-0';
/** Die Zeilenhöhe als Klasse — siehe {@link ZEILE_PX}. */
export const ZEILE_KLASSE = 'leading-[19px]';

/**
 * Die Breite der linken Rinne in der Tabelle.
 *
 * Die vier folgenden Werte sind die x-Achse, auf der sich beide Ordnungen
 * treffen: `SPALTE_RINNE + SPALTE_TAG + SPALTE_CODE + SPALTE_ROLLE` ist genau
 * die Stelle, an der in beiden Ansichten der Ereignistext beginnt.
 */
export const SPALTE_RINNE = RINNE_PX;
/** Achse (1 px Linie) + Einzug + Tagesspalte + Abstand. */
export const SPALTE_TAG = 1 + ACHSE_PX + TAG_PX + ABSTAND_PX;
/** Kürzel + Abstand. */
export const SPALTE_CODE = CODE_PX + ABSTAND_PX;
/** Rollen + Abstand. */
export const SPALTE_ROLLE = ROLLE_PX + ABSTAND_PX;
