/**
 * Zeit-Einheiten in Millisekunden — die Heimat der Größe, die im Bestand unter
 * den meisten Namen lief.
 *
 * WARUM ES DIESE DATEI GIBT (v6.45). Ein Tag in Millisekunden stand 13-mal im
 * Produktionscode, unter VIER Namen (`MS_TAG` 9×, `TAG_MS` 2×, `DAY_MS` 1×,
 * `MS_PER_DAY` 1×) und in drei Schreibweisen (`86_400_000`,
 * `24 * 60 * 60 * 1000`, `1000 * 60 * 60 * 24`) — dazu 15 nackte Literale im
 * Ausdruck. Wer nach der Größe suchte, fand je nach Suchwort ein Drittel davon.
 *
 * WARUM NUR DER TAG. Minute und Stunde sind gemessen KEIN Fall: sie stehen fast
 * überall bereits in einer benannten Konstante mit eigener Bedeutung
 * (`STALE_HEARTBEAT_MS`, `DEFAULT_SESSION_TTL_MS`, `DIVERGENZ_FENSTER_MS`,
 * `ONLINE_STALE_WINDOW_MS`), und ein `60_000` in einem `setTimeout` liest sich
 * ohne Konstante besser als mit. Diese Datei sammelt nicht, was sich sammeln
 * ließe, sondern was auseinanderlief.
 *
 * KEIN RECHENWEG HIER. Die Einheit ist eine Zahl, keine Fachregel. Die
 * Bearbeitungsfrist rechnet weiterhin ausschließlich in
 * `core/services/csv/frist-ergebnis.ts` (Guard `no-inline-frist-arithmetik`) —
 * `MS_TAG` von hier zu importieren erlaubt nicht, sie anderswo nachzubauen.
 */

/** Ein Tag in Millisekunden. */
export const MS_TAG = 86_400_000;
