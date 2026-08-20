/**
 * Kuratur-Paket — Übertragung eines ganzen kuratierten Standes (Skills, Regeln,
 * Workflows, Textbausteine) von einem Daten-Share auf einen anderen.
 *
 * Vier reine Bausteine, keine IO:
 *  - `typen`      Datenmodell + Zählwerk
 *  - `schnueren`  Paket packen / lesen
 *  - `vergleich`  Paket ↔ Ziel: neu / geändert / identisch + Vorschlag
 *  - `einspielen` Entscheidungen anwenden (fortschreiben statt überschreiben)
 */
export * from './typen';
export * from './schnueren';
export * from './vergleich';
export * from './einspielen';
