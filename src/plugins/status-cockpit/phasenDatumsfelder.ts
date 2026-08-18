/**
 * **Welches Datum speist das „seit wann" eines Verfahrensschritts?**
 *
 * Rein, ohne IO und ohne React — die Anzeige-Seite von `bestimmeSeit`
 * (`herleitung.ts`). Dort wird zu einem Status die Chronik nach einem
 * Datumsfeld **derselben Phase** durchsucht; findet sich keines, bleibt die
 * Zeile „seit …" weg. Hier steht die Gegenrichtung: welche Kürzel füttern einen
 * Schritt, und welcher Schritt geht leer aus.
 *
 * Bis v4.92 stand diese Zuordnung als Auswahlfeld in **jeder** der 509
 * Kürzel-Zeilen. Sie kann aber für die allermeisten gar keine Antwort haben —
 * die Trigger-Tabelle sagt nur für eine Handvoll Kürzel, welchen Status sie
 * setzen. 463 dauerhaft leere Zellen lasen sich als Rückstand. Die Frage gehört
 * an den Schritt, nicht an das Kürzel: dort sind es fünf Zeilen statt 509, und
 * dort ist die Lücke eine echte Aussage.
 *
 * **Gezählt wird nur, was auch wirkt.** Ein Kürzel mit Phase, das stillgelegt
 * ist oder dessen Prominenz auf `ignoriert` steht, erscheint gar nicht erst in
 * der Chronik (`reconcile.ts`) und kann deshalb kein „seit wann" liefern. Es
 * mitzuzählen ergäbe eine Zahl, die größer ist als die Wirkung — genau die Sorte
 * Zusage, die eine Oberfläche nicht halten kann.
 */
import type { GeltendeZahPhase, StatusFeldEintrag, ZahPhaseId } from '@/core/status';

/**
 * Trägt dieses Kürzel überhaupt zu einer „seit"-Angabe bei?
 *
 * Drei Bedingungen, alle aus der Chronik-Seite übernommen (nicht hier erfunden):
 * es muss ein Datum sein, es muss aktiv sein, und es darf nicht als `ignoriert`
 * ausgeblendet sein.
 */
export function speistSeitAngabe(f: StatusFeldEintrag): boolean {
  return f.typ === 'datum' && f.aktiv && f.prominenzDefault !== 'ignoriert';
}

/**
 * Die Datumsfelder eines Schritts, in Katalog-Reihenfolge (Code, dann Label).
 *
 * Stabil sortiert, weil die Liste im Detail-Bereich neben einer Auswahl steht:
 * eine Liste, die zwischen zwei Renderings die Reihenfolge wechselt, liest sich
 * wie eine Änderung.
 */
export function datumsfelderFuerPhase(
  felder: readonly StatusFeldEintrag[], phaseId: ZahPhaseId,
): StatusFeldEintrag[] {
  return felder
    .filter(f => f.zahPhaseId === phaseId && speistSeitAngabe(f))
    .sort((a, b) => (a.code ?? a.feldId).localeCompare(b.code ?? b.feldId, 'de'));
}

/**
 * Die Schritte, für die kein einziges Datumsfeld einspringt.
 *
 * Das ist die Lücke, die weh tut: für Status dieser Schritte kann die Erklärung
 * kein „seit wann" nennen, egal wie gut der Rest gepflegt ist.
 */
export function phasenOhneDatum(
  felder: readonly StatusFeldEintrag[], phasen: readonly GeltendeZahPhase[],
): GeltendeZahPhase[] {
  const belegt = new Set<string>();
  for (const f of felder) {
    if (f.zahPhaseId != null && speistSeitAngabe(f)) belegt.add(f.zahPhaseId);
  }
  return phasen.filter(p => !belegt.has(p.id));
}

/**
 * Die Kopfzeile über dem Phasen-Baum: wie viele Kürzel speisen das „seit wann",
 * und welcher Schritt geht leer aus.
 *
 * Der Ausfall wird **benannt**, nicht bloß gezählt — „2 Schritte ohne Datum"
 * schickt den Leser auf die Suche, „ohne Datum: In Prüfung, Begleitung" nicht.
 */
export function datumsBilanzText(
  felder: readonly StatusFeldEintrag[], phasen: readonly GeltendeZahPhase[],
): string {
  const zugeordnet = felder.filter(f => f.zahPhaseId != null && speistSeitAngabe(f)).length;
  const ohne = phasenOhneDatum(felder, phasen);
  const kopf = `${zugeordnet} Kürzel liefern das „seit wann"`;
  if (phasen.length === 0) return kopf;
  if (ohne.length === 0) return `${kopf} · jeder Schritt ist gedeckt`;
  return `${kopf} · ohne Datum: ${ohne.map(p => p.label).join(', ')}`;
}
