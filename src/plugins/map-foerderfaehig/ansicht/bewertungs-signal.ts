/**
 * Wie alarmierend ist ein Bewertungsstand?
 *
 * Rein. Trennt die fachliche Frage („zählt das als schwach?") von der
 * Darstellung („welches Token?"). Die Komponenten bilden die Signalstufe nur
 * noch auf `--tf-*`-Tokens ab.
 *
 * Leitsatz: **Vollständig ist nicht gut.** Ein fertig bewerteter Innovations-
 * grad unterhalb des Kurzpfads (etwa dreimal B1) ist ein schwaches Ergebnis
 * und darf nicht grün quittiert werden — sonst liest der Prüfer „fertig" als
 * „in Ordnung".
 */
import type { MapInnoScore } from '../checkliste/bewertung';
import type { MapItemStatus, MapStufe } from '../checkliste/typen';

export type Signalstufe = 'neutral' | 'gut' | 'warnung' | 'kritisch';

/** Trägt die Stufe einen Befund, der in einer langen Liste auffallen muss? */
export function istAlarm(signal: Signalstufe): boolean {
  return signal === 'warnung' || signal === 'kritisch';
}

/** B0 ist ein K.-o.-Befund, B1 bleibt hinter dem Anspruch zurück. */
export function signalFuerStufe(stufe: MapStufe | null): Signalstufe {
  switch (stufe) {
    case 'B0': return 'kritisch';
    case 'B1': return 'warnung';
    case 'B2': return 'neutral';
    case 'B3': return 'gut';
    case null: return 'neutral';
  }
}

export function signalFuerStatus(status: MapItemStatus): Signalstufe {
  switch (status) {
    case 'nicht-erfuellt': return 'kritisch';
    case 'nf-notwendig': return 'warnung';
    case 'erfuellt':
    case 'nf-erfuellt': return 'gut';
    case 'offen':
    case 'nicht-zutreffend': return 'neutral';
  }
}

/**
 * Gesamtaussage des Innovationsgrads. `neutral`, solange noch bewertet wird —
 * ein Zwischenstand ist kein Ergebnis.
 */
export function signalFuerInnoScore(innoScore: MapInnoScore): Signalstufe {
  if (innoScore.nullWegenB0) return 'kritisch';
  if (!innoScore.vollstaendig) return 'neutral';
  return innoScore.vertiefungNoetig ? 'warnung' : 'gut';
}
