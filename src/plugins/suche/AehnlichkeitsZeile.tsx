/**
 * Was die Ähnlichkeitsstufe getan hat — die Zeile unter der Optionszeile.
 *
 * Zwei Sorten Meldung, dieselbe Zeile: die Stufe konnte gar nicht wirken
 * (`corpus-empty`/`model-failed`/`bereich-ruht`) — oder sie lief und legt
 * Rechenschaft ab ([aehnlichkeitsSatz.ts](./aehnlichkeitsSatz.ts), inkl. der
 * drei Fälle, der Deckelung und der Reichweite des Korpus).
 */
import type { SemanticStatus, SemantikBefund } from '@/core/hooks/useUnifiedSearch';
import { SUCHBEREICH_LABEL, type Suchbereich } from '@/core/services/search/suchbereich';
import { aehnlichkeitsSatz } from './aehnlichkeitsSatz';

const OHNE_WIRKUNG: Record<'corpus-empty' | 'model-failed', string> = {
  'corpus-empty': 'Ähnlichkeitssuche ohne Wirkung: Auf diesem Rechner liegen keine Embedding-Vektoren (Korpus). Er wird beim Start automatisch vom Datenspeicher geladen, sofern dort vorhanden — sonst im Auslastungs-Modul „Vom Datenspeicher laden".',
  'model-failed': 'Ähnlichkeitssuche ohne Wirkung: Das Embedding-Modell konnte nicht geladen werden (Details in der Browser-Konsole, F12). Es werden nur Wortlaut-Treffer angezeigt.',
};

/**
 * Der Bereich hat die Stufe stillgelegt — und sagt es, statt sie still mitlaufen
 * zu lassen. Bis v4.113 lief sie in jedem Bereich mit und lieferte unter „nur
 * Einrichtung" genau das Thema, das gerade ausgeschlossen war
 * (`bereichNutztAehnlichkeit`).
 */
function bereichRuhtText(bereich: Suchbereich): string {
  return `Ähnlichkeit ruht: „${SUCHBEREICH_LABEL[bereich]}" fragt nicht nach dem Thema — `
    + 'der Vektor eines Vorhabens kennt nur Titel, Kurzbeschreibung und Deskriptoren. '
    + 'Für thematisch verwandte Vorhaben „alle Vorhabensfelder" oder „nur Titel & '
    + 'Kurzbeschreibung" wählen.';
}

export function AehnlichkeitsZeile({ an, status, befund, bestand, bereich }: {
  /** Der Schalter selbst — ohne ihn gibt es nichts zu berichten. */
  an: boolean;
  status: SemanticStatus;
  befund: SemantikBefund | null;
  /** Bestandszahl des Suchindex, für die Reichweite. */
  bestand: number;
  /** „Suchen in" — entscheidet, ob die Stufe überhaupt mitlaufen darf. */
  bereich: Suchbereich;
}): React.ReactElement | null {
  if (!an) return null;
  let text: string | null = null;
  if (status === 'bereich-ruht') text = bereichRuhtText(bereich);
  else if (status === 'corpus-empty' || status === 'model-failed') text = OHNE_WIRKUNG[status];
  else if (status === 'ok' && befund !== null) text = aehnlichkeitsSatz(befund, bestand);
  if (text === null) return null;

  return (
    <div className="mt-2 flex w-full max-w-4xl items-start gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
      <span aria-hidden="true">ⓘ</span>
      <span>{text}</span>
    </div>
  );
}
