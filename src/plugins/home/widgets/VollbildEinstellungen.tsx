/**
 * Die Kanban-Einstellungen IM eigenen Fenster — die Bahnen, die NUR hier gelten.
 *
 * Bis v4.25 stand hier das Formular der Startseite, und ein Fußnotensatz erklärte,
 * warum seine Regler in diesem Fenster nichts tun: das Fenster leitete seine
 * Bahnen aus dem Bestand ab und las die Einstellung gar nicht. Ein Schalter, der
 * erklärt werden muss, warum er wirkungslos ist, ist der falsche Schalter.
 *
 * Jetzt bedient diese Liste den Zustand des FENSTERS (gehalten in
 * `KanbanVollbild`, persistiert über das Widget). Damit ist die Komponente reine
 * Props — kein Store, kein `StorageContext`-Nachbau für den zweiten React-Baum,
 * keine Hooks. Der Farbmodus bleibt geteilt: er beschreibt die Köpfe beider
 * Ansichten, nicht die Anordnung einer.
 *
 * Geteilte Bauteile, keine zweite Fassung: `LaneListe` (Haken, Pfeile,
 * Spaltenschalter) und `FarbmodusToggle` sind dieselben wie auf der Startseite
 * und im Feedback-Board.
 */
import { RotateCcw } from 'lucide-react';
import { LaneListe } from '@/components/ui/LaneListe';
import { FarbmodusToggle } from '@/components/kanban/FarbmodusToggle';
import type { TfBahnSpalten } from '@/components/kanban/tfBoardBahn';
import type { StatusCategory } from '@/core/utils/status-canonical';
import { getStatusCategoryLabel } from '@/core/utils/status-category-labels';
import { KANBAN_LANE_ACCENT, verschiebeVollbildLane } from './kanbanLanes';
import type { KanbanWidgetConfig, VollbildLane } from './types';

export interface VollbildEinstellungenProps {
  /** Alle Kategorien in der Reihenfolge dieses Fensters (auch die abgewählten —
   *  die Liste IST die Bahnfolge). */
  lanes: VollbildLane[];
  onLanes: (lanes: VollbildLane[]) => void;
  /** Der frisch gerechnete Startvorschlag — der Weg zurück zur automatischen
   *  Anordnung. Fehlt er, gibt es keinen Zurücksetzen-Knopf. */
  seed?: VollbildLane[];
  farbmodus: KanbanWidgetConfig['farbmodus'];
  onFarbmodus: (farbmodus: KanbanWidgetConfig['farbmodus']) => void;
}

export function VollbildEinstellungen({
  lanes, onLanes, seed, farbmodus, onFarbmodus,
}: VollbildEinstellungenProps): React.ReactElement {
  const spaltenProKey = new Map<string, TfBahnSpalten>(
    lanes.filter(l => l.sichtbar).map(l => [l.kategorie as string, l.spalten]),
  );

  // Ein-/Ausblenden verschiebt NICHT (Lehre des Feedback-Boards, v3.40): wer eine
  // Bahn kurz ausblendet, findet sie danach an ihrem Platz wieder.
  const setzeAn = (key: string, patch: Partial<VollbildLane>): void => {
    onLanes(lanes.map(l => (l.kategorie === key ? { ...l, ...patch } : l)));
  };

  const ausgeblendet = lanes.filter(l => !l.sichtbar).length;

  return (
    <>
      <p className="kv-einst-feld">Bahnen in diesem Fenster</p>
      <LaneListe
        options={lanes.map(l => ({
          key: l.kategorie,
          label: getStatusCategoryLabel(l.kategorie),
          akzent: KANBAN_LANE_ACCENT[l.kategorie],
        }))}
        spaltenProKey={spaltenProKey}
        onToggle={key => {
          const lane = lanes.find(l => l.kategorie === key);
          if (lane) setzeAn(key, { sichtbar: !lane.sichtbar });
        }}
        onSpalten={(key, spalten) => setzeAn(key, { spalten })}
        onVerschiebe={(key, richtung) => {
          const next = verschiebeVollbildLane(lanes, key as StatusCategory, richtung);
          // Am Rand kommt dieselbe Liste zurück — dann kein Schreibvorgang.
          if (next !== lanes) onLanes(next);
        }}
        // Das Fenster hat Platz — hier scrollt keine Liste in einer Liste.
        maxSichtbareZeilen={lanes.length}
      />
      <p className="kv-einst-fuss">
        Leere Bahnen stehen als Schiene; abgewählte fehlen ganz.
        {ausgeblendet > 0 ? ` Zurzeit ausgeblendet: ${ausgeblendet}.` : null}
      </p>

      <div className="kv-einst-farbe">
        <p className="kv-einst-feld">Farben der Köpfe</p>
        <FarbmodusToggle
          value={farbmodus}
          onChange={m => { if (m !== farbmodus) onFarbmodus(m); }}
          buntDots={['var(--tf-kanban-offen)', 'var(--tf-kanban-nachforderung)', 'var(--tf-kanban-bewilligt)']}
        />
      </div>

      {/* Was hier gilt und was nicht — jetzt als Abgrenzung, nicht mehr als
          Entschuldigung für einen wirkungslosen Regler. */}
      <p className="kv-einst-hinweis">
        Die Bahnen gelten nur in diesem Fenster; die Startseite behält ihre eigene
        Auswahl. Farben und Datenbasis teilen sich beide Ansichten.
      </p>

      {seed ? (
        <button
          type="button"
          className="kv-einst-reset"
          title="Alle Bahnen sichtbar, Spalten wieder aus dem Bestand vorgeschlagen"
          onClick={() => onLanes(seed)}
        >
          <RotateCcw size={11} strokeWidth={2} aria-hidden />
          Anordnung zurücksetzen
        </button>
      ) : null}
    </>
  );
}
