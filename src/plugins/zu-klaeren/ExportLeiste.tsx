/**
 * Die drei Ausgaben einer Klärung — der einzige Weg nach draußen.
 *
 * Sie stehen bewusst **unter** der Tabelle und nicht im Seitenkopf: exportiert
 * wird am Ende einer Runde, nicht nebenbei. Und sie sind zu dritt, weil drei
 * verschiedene Leute etwas anderes brauchen (Termin, Protokoll, Umsetzung) —
 * ein einziger Knopf zwänge jeden, sich das Seine herauszusuchen.
 */
import { Table2, FileText, Code2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAsyncAction } from '@/core/hooks/useAsyncAction';
import { exportiereArbeitsmappe, exportiereKurzfassung, type ExportEingabe } from './export';
import { exportiereSeedDiff } from './seedExport';

export function ExportLeiste({
  baueEingabe,
}: {
  /** Erst beim Klick auswerten — der Stichtag ist der des Exports, nicht des Renderns. */
  baueEingabe: () => ExportEingabe;
}): React.ReactElement {
  const mappe = useAsyncAction(async () => { exportiereArbeitsmappe(baueEingabe()); });
  const kurz = useAsyncAction(async () => { exportiereKurzfassung(baueEingabe()); });
  const seed = useAsyncAction(async () => { exportiereSeedDiff(baueEingabe()); });
  const fehler = mappe.error ?? kurz.error ?? seed.error;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[13px] font-medium text-[var(--tf-text)]">Ergebnis mitnehmen</h2>
        <span className="text-[11px] text-[var(--tf-text-tertiary)]">
          Nichts davon ändert etwas in der App — das Ergebnis trägt ein Mensch weiter.
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={mappe.busy} onClick={() => mappe.run()}
          title="Alle Stimmen nebeneinander, plus Grundsatzfragen und Rohdaten">
          <Table2 size={13} /> Arbeitsmappe
        </Button>
        <Button variant="secondary" size="sm" disabled={kurz.busy} onClick={() => kurz.run()}
          title="Nur die abweichenden Zeilen und die kommentierten Fragen — fürs Protokoll">
          <FileText size={13} /> Kurzfassung
        </Button>
        <Button variant="secondary" size="sm" disabled={seed.busy} onClick={() => seed.run()}
          title="Pastefähige Zeilen für die Phasen-Tabelle — aus dem gepflegten Katalog, nicht aus den Antworten">
          <Code2 size={13} /> Seed-Änderungen
        </Button>
      </div>

      {fehler != null && (
        <span className="text-[11.5px] text-[var(--tf-danger-text)]">⚠ {fehler}</span>
      )}
    </section>
  );
}
