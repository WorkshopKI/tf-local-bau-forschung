/**
 * Geteilte Anzeige-Helfer der Assistent-Einstellungssektionen (Arbeitsprotokoll +
 * Gedächtnis). Reine Formatierung — kein State.
 */
import type { AssistentEreignisTyp } from '@/core/services/assistent/protokoll';

const TYP_LABEL: Record<AssistentEreignisTyp, string> = {
  antrag_geoeffnet: 'Antrag geöffnet',
  dokument_geoeffnet: 'Dokument geöffnet',
  suche_ausgefuehrt: 'Suche',
  skill_gestartet: 'KI-Lauf gestartet',
  skill_abgeschlossen: 'KI-Lauf beendet',
  gutachten_abschnitt_editiert: 'Abschnitt bearbeitet',
  frist_angesehen: 'Fristen angesehen',
  einstellung_geaendert: 'Einstellung geändert',
};

export function typLabel(typ: string): string {
  return (TYP_LABEL as Record<string, string>)[typ] ?? typ;
}

export function fmtDatum(ts: number | null): string {
  return ts == null
    ? '–'
    : new Date(ts).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtZeit(ts: number): string {
  return new Date(ts).toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit',
  });
}
