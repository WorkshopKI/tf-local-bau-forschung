/**
 * Tagesbrief — die reine Komposition.
 *
 * Nimmt die fertig gebauten Punkte entgegen und macht daraus den Brief:
 * abwählen, ranken, deckeln, Nachsatz bilden, Leere erklären. **Keine** IO,
 * **keine** Uhr — `tage` kommt fertig herein, damit dieses Modul byte-
 * deterministisch und node-testbar bleibt (dieselbe Trennung wie beim
 * Assistenten-Assembler).
 *
 * **Warum nur die Uhr-Themen ranken:** von den zehn Themen trägt nur etwa die
 * Hälfte eine Fälligkeit. „12 Vorgänge über Nacht geändert" und „2 Antworten auf
 * dein Feedback" sind Neuigkeiten ohne Termin; sie auf dieselbe Skala zu heben
 * hiesse, Gewichte zu erfinden, die gegen nichts prüfbar wären. Sie stehen
 * deshalb in EINEM Nachsatz — sichtbar, aber ohne behauptete Dringlichkeit.
 */
import { THEMEN, themaRang, themaVon } from './themen';
import type { Brief, BriefPunkt, ThemaId } from './typen';

/**
 * Höchstzahl gerankter Punkte. Fünf, weil der Brief oben auf der Startseite
 * steht und in einem Blick lesbar bleiben muss; was darüber liegt, nennt die
 * Karte als Zahl („und N weitere") statt es zu verschweigen.
 */
export const DECKEL = 5;

/**
 * Ab wann gilt ein Uhr-Punkt als dringlich genug für den Brief?
 *
 * 30 Tage — ein Monat Vorlauf. Der Wert ist am echten Bestand gemessen
 * (Messlauf zur Umsetzung); eine Schwelle über dem Wertebereich schaltet
 * lautlos ab, deshalb steht sie hier als benannte Konstante und nicht als
 * Zahl im Code.
 */
export const DRINGLICH_AB_TAGEN = 30;

export interface BriefEingabe {
  /** Alles, was die Themen geliefert haben — in beliebiger Reihenfolge. */
  punkte: readonly BriefPunkt[];
  /** Die aktiven Themen (verfügbar und nicht abgewählt). */
  aktiv: ReadonlySet<ThemaId>;
  /** Läuft noch eine Quelle? Dann ist Leere kein Befund, sondern Warten. */
  laedt: boolean;
  /** Nur für Messläufe/Tests — sonst gilt {@link DECKEL}. */
  deckel?: number;
  /** Nur für Messläufe/Tests — sonst gilt {@link DRINGLICH_AB_TAGEN}. */
  dringlichAbTagen?: number;
}

/** Aufsteigend nach Tagen; bei Gleichstand entscheidet die Katalog-Ordnung. */
function nachDringlichkeit(a: BriefPunkt, b: BriefPunkt): number {
  const d = (a.tage as number) - (b.tage as number);
  return d !== 0 ? d : themaRang(a.themaId) - themaRang(b.themaId);
}

/** „Nichts Dringendes gefunden. Geprüft: A, B, C." — in Katalog-Reihenfolge. */
function leereErklaeren(aktiv: ReadonlySet<ThemaId>): string {
  const namen = THEMEN.filter(t => aktiv.has(t.id)).map(t => t.label);
  if (namen.length === 0) return 'Kein Thema ausgewählt.';
  return `Nichts Dringendes gefunden. Geprüft: ${namen.join(', ')}.`;
}

export function baueBrief(e: BriefEingabe): Brief {
  const deckel = e.deckel ?? DECKEL;
  const schwelle = e.dringlichAbTagen ?? DRINGLICH_AB_TAGEN;

  const gewaehlt = e.punkte.filter(p => e.aktiv.has(p.themaId));

  // Uhr-Punkte: nur die dringlichen, überfällig zuerst. Was jenseits der
  // Schwelle liegt, ist verworfen — es taucht auch nicht als „weitere" auf,
  // sonst versprächen die weggelassenen eine Dringlichkeit, die sie nicht haben.
  const dringlich = gewaehlt
    .filter(p => p.tage !== null && p.tage <= schwelle)
    .sort(nachDringlichkeit);

  // Ein Vorgang spricht EINMAL. Gemessen am echten Bestand stand „WidyLa" zweimal
  // im selben Absatz — einmal mit einem Meilenstein, einmal mit einem zweiten;
  // ein Brief, der denselben Verbund wiederholt, fasst nichts zusammen. Behalten
  // wird der dringlichste Punkt, weil die Liste bereits sortiert ist.
  const gesehen = new Set<string>();
  const einmalJeVorgang = dringlich.filter(p => {
    if (p.gruppe === undefined) return true;
    if (gesehen.has(p.gruppe)) return false;
    gesehen.add(p.gruppe);
    return true;
  });

  const punkte = einmalJeVorgang.slice(0, deckel);
  const weitere = Math.max(0, einmalJeVorgang.length - deckel);

  // Ohne Uhr: EIN Nachsatz, in Katalog-Reihenfolge statt in Eingabe-Reihenfolge
  // — die Eingabe folgt der Hook-Verdrahtung und wäre kein Versprechen.
  const nachsatz = gewaehlt
    .filter(p => p.tage === null)
    .sort((a, b) => themaRang(a.themaId) - themaRang(b.themaId));

  const leer = punkte.length === 0 && nachsatz.length === 0;

  return {
    punkte,
    weitere,
    nachsatz,
    // Solange etwas nachlädt, ist „nichts gefunden" eine Behauptung, kein Befund.
    leerText: leer && !e.laedt ? leereErklaeren(e.aktiv) : null,
    laedt: e.laedt,
  };
}

/**
 * Der Satz unter dem Brief: was der Deckel weggelassen hat. `null`, wenn nichts
 * weggelassen wurde — ein „und 0 weitere" wäre eine Zeile über nichts.
 */
export function weitereText(weitere: number): string | null {
  if (weitere <= 0) return null;
  return weitere === 1 ? 'und ein weiterer Punkt' : `und ${weitere} weitere Punkte`;
}

/** Das Label eines Themas für die Oberfläche; unbekannt → die rohe Id. */
export function themaLabel(id: ThemaId): string {
  return themaVon(id)?.label ?? id;
}
