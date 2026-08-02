/**
 * Nachschlagen eines Statuswerts in einer Katalog-Fassung — **die eine Regel**,
 * unter welchen Schreibweisen ein Eintrag zu finden ist.
 *
 * Der Katalog führt **eine Zeile je Status-Code**; die Schreibweisen, unter
 * denen der Export denselben Status liefert, stehen als `varianten` daran
 * („VN techn. geprüft" zu 95, „Ablehnung" zu 70, „Nachforderung gestellt" zu
 * 35). Wer nur `w.wert` indiziert, findet im echten Bestand einen dreistelligen
 * Prozentsatz der Vorgänge nicht — und meldet dann „nicht im Katalog", wo der
 * Join in Wahrheit trägt.
 *
 * Diese Regel hatte kurzzeitig drei Fundorte (Snapshot, Phasen-Vergleich,
 * Ableitung). Sie hat genau einen, weil sie sonst beim nächsten Varianten-Nachzug
 * auseinanderliefe.
 *
 * **Amtlicher Text gewinnt.** Eine Variante darf nie einen kuratierten
 * Haupteintrag überschreiben — deshalb zwei Durchgänge, Varianten zuerst.
 *
 * Rein und deterministisch: keine IO, keine Uhr.
 */
import { normalisiereWert, type StatusWertEintrag } from './typen';

/**
 * Baut den Nachschlage-Index über die Wert-Einträge einer Fassung.
 *
 * @param werte      Die Einträge (der Aufrufer filtert vorher, was nicht zählt —
 *                   `unkuratiert` etwa gehört nicht in die Laufzeit-Kategorie).
 * @param schluessel Wie der Map-Schlüssel aus Eintrag und normalisierter
 *                   Schreibweise entsteht. Default: die Schreibweise selbst.
 *                   Die Ableitung schlägt feld-skopiert nach (`feldId::wert`).
 */
export function indexNachSchreibweise(
  werte: readonly StatusWertEintrag[],
  schluessel: (w: StatusWertEintrag, normalisiert: string) => string = (_w, k) => k,
): Map<string, StatusWertEintrag> {
  const m = new Map<string, StatusWertEintrag>();
  for (const w of werte) {
    for (const variante of w.varianten ?? []) {
      const norm = normalisiereWert(variante);
      if (!norm) continue;
      const k = schluessel(w, norm);
      if (!m.has(k)) m.set(k, w);
    }
  }
  for (const w of werte) {
    const norm = normalisiereWert(w.wert);
    if (!norm) continue;
    m.set(schluessel(w, norm), w);
  }
  return m;
}
