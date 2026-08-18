/**
 * „180 Treffer in 14.225 Anträgen" — der Satz, auf den sich alles darunter
 * bezieht.
 *
 * Unter einer Richtlinien-Auswahl nennt er BEIDE Mengen („in 2.537 von 14.225
 * Anträgen"). Das ist keine Ausführlichkeit, sondern die Korrektur eines
 * Fehlers: die kleinere Zahl allein ließ den Leser glauben, der Index sei
 * geschrumpft — durchsucht wurde aber nur ein Teil davon.
 *
 * Solange der erste Lauf einer Anfrage offen ist, steht „… Treffer" statt einer
 * Zahl. Eine 0 vor der Messung wäre kein Ergebnis, sondern eine Falschaussage,
 * und sie stand durch Entprellung plus Korpuslauf lange genug da, um gelesen zu
 * werden.
 */
export function ErgebnisZahl({ steht, anzahl, erreichbar, gesamt }: {
  /** Darf eine Zahl BEHAUPTET werden, oder läuft der erste Lauf noch? */
  steht: boolean;
  anzahl: number;
  /** Wie viele Anträge die eingestellten Richtlinien überhaupt erreichbar
   *  lassen. Gleich `gesamt`, wenn nichts eingeschränkt ist. */
  erreichbar: number;
  gesamt: number;
}): React.ReactElement {
  return (
    <span className="text-[13px] text-[var(--tf-text)]">
      <b className="font-medium">
        {steht ? anzahl.toLocaleString('de-DE') : '…'} Treffer
      </b>
      <span className="text-[var(--tf-text-secondary)]">
        {' '}in {erreichbar.toLocaleString('de-DE')}
        {erreichbar !== gesamt && ` von ${gesamt.toLocaleString('de-DE')}`}
        {' '}Anträgen
      </span>
    </span>
  );
}
