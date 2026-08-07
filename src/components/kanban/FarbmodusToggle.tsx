/**
 * Umschalter „Farben der Köpfe" (Bunt / Einfarbig) — EIN Bauteil für alle
 * Kanbans (Feedback-Board-Einstellungen, Home-Widget-Formular).
 *
 * Bis v3.23 stand er zweimal im Code: eine `FarbmodusOption` in
 * `FeedbackKanbanEinstellungen`, eine zweite in `WidgetConfigForm`. Der
 * Kommentar an der einen wies auf die andere hin („visuell identisch zum
 * Pendant im Home-Widget-Formular") — die Verdopplung war also bekannt und
 * gepflegt statt aufgelöst.
 *
 * Aufgesetzt auf `SegmentedToggle` (dem geteilten Mini-Segmented-Control), nicht
 * auf einer dritten handgebauten Segmentgruppe. Die Einfarbig-Punkte zeigt die
 * echte Rampe aus `laneAccent.ts` — die Vorschau kann damit nicht von dem
 * abweichen, was das Board später zeichnet.
 */
import { SegmentedToggle } from '@/components/ui/SegmentedToggle';
import { MONO_LANE_ACCENTS, type LaneFarbmodus } from './laneAccent';

function Punkte({ farben }: { farben: readonly string[] }): React.ReactElement {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {farben.map(f => (
        <span key={f} className="w-2 h-2 rounded-full" style={{ background: f }} />
      ))}
    </span>
  );
}

export function FarbmodusToggle({ value, onChange, buntDots }: {
  value: LaneFarbmodus;
  onChange: (modus: LaneFarbmodus) => void;
  /** Drei Beispiel-Töne der bunten Variante — je Kanban andere Lanes. */
  buntDots: readonly string[];
}): React.ReactElement {
  return (
    <SegmentedToggle
      value={value}
      onChange={onChange}
      ariaLabel="Farben der Lane-Köpfe"
      options={[
        { id: 'bunt', label: 'Bunt', icon: <Punkte farben={buntDots} /> },
        { id: 'monochrom', label: 'Einfarbig', icon: <Punkte farben={MONO_LANE_ACCENTS} /> },
      ]}
    />
  );
}
