/**
 * Kompakte Index-Diagnose-Zeile („X Textabschnitte im Index · Y Anträge geladen").
 * EINE gemeinsame Quelle für die Zahl — konsolidiert die früher an zwei Stellen in
 * `SuchSeite` duplizierte Zeile. Kernregel: die Zahl **„0 Textabschnitte" wird
 * Nutzern NIE angezeigt** — bei leerem Dokumentenindex fällt das Segment weg
 * (die Volltext-Info übernimmt der Leerzustand als dezente Zeile).
 */

/**
 * Baut den Diagnose-Text. Reine Funktion (testbar): bei leerem Index (`0`) fällt
 * das „Textabschnitte"-Segment KOMPLETT weg — „0 Textabschnitte" erscheint nie.
 */
export function buildIndexInfoText(textabschnitteImIndex: number, antraegeGeladen: number): string {
  const antraege = `${antraegeGeladen.toLocaleString('de-DE')} Anträge geladen`;
  return textabschnitteImIndex > 0
    ? `${textabschnitteImIndex.toLocaleString('de-DE')} Textabschnitte im Index · ${antraege}`
    : antraege;
}

export function IndexInfoZeile({
  textabschnitteImIndex,
  antraegeGeladen,
}: {
  textabschnitteImIndex: number;
  antraegeGeladen: number;
}): React.ReactElement {
  return <span>{buildIndexInfoText(textabschnitteImIndex, antraegeGeladen)}</span>;
}
