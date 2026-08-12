/**
 * Herkunft eines Antrags-Aufrufs (v3.50).
 *
 * Ein Treffer der Suche führt auf `/antraege/<fkz>` — dieselbe Route wie aus der
 * Förderanträge-Liste. Ohne einen Vermerk, WOHER der Aufruf kam, kann die
 * Detailseite nur einen Rückweg anbieten: den in die Liste. Wer aus der Suche
 * kam, stand damit vor einer Sackgasse.
 *
 * Der Vermerk reist im `location.state` von react-router mit. Bewusst KEIN
 * Query-Parameter: er gehört nicht zur Adresse des Antrags (ein geteilter Link
 * soll niemandem einen fremden Rückweg unterschieben) und würde beim Kopieren
 * mitwandern.
 *
 * Bewusste Grenze: `location.state` überlebt kein Neuladen der Seite. Danach
 * greift wieder der normale Rückweg in die Liste — falsch ist das nie, nur
 * weniger bequem.
 *
 * Rein und ohne Router-Import, damit die Ableitung ohne Rendering testbar ist.
 */

/** Schlüssel im `location.state`. */
export const VON_SUCHE_STATE_KEY = 'vonSuche';

/** Ziel des Rückwegs — Route, auf die „Zurück"/Schließen führt. */
export const SUCHE_ROUTE = '/suche';
export const ANTRAEGE_ROUTE = '/antraege';

/** Kam dieser Aufruf aus der Suche? Toleranter Leser: alles Unerwartete = nein. */
export function kamAusDerSuche(state: unknown): boolean {
  if (!state || typeof state !== 'object') return false;
  return (state as Record<string, unknown>)[VON_SUCHE_STATE_KEY] === true;
}

/**
 * Wohin das Schließen des Detail-Panels führt. Aus der Suche gekommen heißt:
 * zurück zur Suche — sonst in die Förderanträge-Liste wie bisher.
 */
export function detailSchliessenZiel(state: unknown): string {
  return kamAusDerSuche(state) ? SUCHE_ROUTE : ANTRAEGE_ROUTE;
}
