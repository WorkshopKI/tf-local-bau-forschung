/**
 * Kopier-Icon für Teilvorhaben-Titel — die werden oft in andere Dokumente
 * übernommen. Zwei Einsatzorte: an der Unter-Überschrift „Verbundpartner und
 * Teilvorhaben" (in der Sektion „Antragsdaten") für ALLE Titel (eine Zeile je TV)
 * und in der TV-Zeile für den EINEN Titel dieses Teilvorhabens (dort auch der
 * visuell abgeschnittene Teil).
 *
 * Nur noch die TV-spezifische Hülle: Titel-Liste → eine Zeile je Titel, nichts
 * rendern wenn leer. Knopf, Kopier-Zustand und `stopPropagation` liegen im
 * geteilten `KopierIconButton`.
 */
import { KopierIconButton } from '@/components/ui/KopierIconButton';

interface Props {
  /** Titel-Zeilen (leere bereits ausgefiltert, Reihenfolge = TV-Liste). */
  titel: string[];
  title?: string;
}

export function TvTitelCopyButton({
  titel,
  title = 'Alle Teilvorhaben-Titel kopieren',
}: Props): React.ReactElement | null {
  if (titel.length === 0) return null;

  return <KopierIconButton text={() => titel.join('\n')} title={title} />;
}
