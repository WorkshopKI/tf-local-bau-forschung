/**
 * Was die Ähnlichkeitsstufe getan hat — die Zeile unter der Optionszeile.
 *
 * Zwei Sorten Meldung, dieselbe Zeile: die Stufe konnte gar nicht wirken
 * (`corpus-empty`/`model-failed`/`bereich-ruht`) — oder sie lief und legt
 * Rechenschaft ab ([aehnlichkeitsSatz.ts](./aehnlichkeitsSatz.ts), inkl. der
 * drei Fälle, der Deckelung, der Reichweite und einer überholten Textfassung).
 *
 * Den Zustand des Index holt die Zeile sich selbst aus
 * [useKorpusAbgleich](@/core/hooks/useKorpusAbgleich) — er hängt nicht am
 * Suchlauf, sondern am Start der Sitzung, und ihn durch `useUnifiedSearch`
 * durchzureichen hieße, einen Ladezustand als Suchergebnis auszugeben.
 */
import type { SemanticStatus, SemantikBefund } from '@/core/hooks/useUnifiedSearch';
import { SUCHBEREICH_LABEL, type Suchbereich } from '@/core/services/search/suchbereich';
import { useKorpusAbgleich } from '@/core/hooks/useKorpusAbgleich';
import { isKuratorFreigeschaltet } from '@/core/modul-freischaltung';
import { aehnlichkeitsSatz, type KorpusLage } from './aehnlichkeitsSatz';

/**
 * Der Modell-Fall ist unabhängig vom Korpus — er bleibt ein fester Satz.
 *
 * Der Korpus-Fall dagegen hatte bis v4.127 einen festen Satz, der zweierlei
 * versprach, das für die meisten Leser nicht galt: einen automatischen
 * Start-Download (der nur lief, wenn das Auslastungs-Modul freigeschaltet war)
 * und ersatzweise einen Knopf in eben diesem Modul. Wer die Ähnlichkeitssuche
 * in `zim-dashboard` einschaltete, bekam beides nicht. Jetzt sagt der Abgleich
 * selbst, woran es liegt.
 */
const MODELL_FEHLT = 'Ähnlichkeitssuche ohne Wirkung: Das Embedding-Modell konnte nicht '
  + 'geladen werden (Details in der Browser-Konsole, F12). Es werden nur Wortlaut-Treffer angezeigt.';

function leererKorpusText(lage: KorpusLage): string {
  const kopf = 'Ähnlichkeitssuche ohne Wirkung: Auf diesem Rechner liegen keine Embedding-Vektoren.';
  if (lage.laeuft) return `${kopf} Sie werden gerade vom Datenspeicher geladen — die nächste Suche findet sie.`;
  if (lage.abgleich === null) return `${kopf} Sie werden vom Datenspeicher geholt, sobald er erreichbar ist.`;
  const ausweg = lage.abgleich.aktion === 'ergaenzen' || lage.abgleich.aktion === 'ersetzen'
    ? ' Sie werden beim nächsten Start geholt.'
    : lage.kannKuratieren
      ? ' Aufgebaut wird der Korpus in der Kuration unter „Suche & Index".'
      : ' Aufgebaut wird der Korpus in der Kuration.';
  return `${kopf} ${lage.abgleich.grund}${ausweg}`;
}

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
  const abgleich = useKorpusAbgleich(s => s.befund);
  const laeuft = useKorpusAbgleich(s => s.laeuft);
  const lage: KorpusLage = { abgleich, laeuft, kannKuratieren: isKuratorFreigeschaltet() };

  if (!an) return null;
  let text: string | null = null;
  if (status === 'bereich-ruht') text = bereichRuhtText(bereich);
  else if (status === 'corpus-empty') text = leererKorpusText(lage);
  else if (status === 'model-failed') text = MODELL_FEHLT;
  else if (status === 'ok' && befund !== null) text = aehnlichkeitsSatz(befund, bestand, lage);
  if (text === null) return null;

  return (
    <div className="mt-2 flex w-full max-w-4xl items-start gap-1.5 text-[11.5px] text-[var(--tf-text-tertiary)]">
      <span aria-hidden="true">ⓘ</span>
      <span>{text}</span>
    </div>
  );
}
