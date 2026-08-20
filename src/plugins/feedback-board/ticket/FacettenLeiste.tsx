/**
 * Facetten-Leiste (206px, v3.12): Typ · Status · Bereich, jede Zeile mit
 * Farbpunkt und Trefferzahl, je Gruppe ein „zurücksetzen".
 *
 * Gezählt wird auf der Menge, die die aktive Smart View übrig lässt (siehe
 * `boardFilter`) — eine Facettenzahl ist eine Zusage, und die gilt nur innerhalb
 * der Sicht, in der man gerade steht. Werte ohne Treffer werden ausgeblendet,
 * damit niemand auf eine leere Liste klickt; der aktive Wert bleibt IMMER
 * sichtbar, auch wenn er auf 0 fällt — sonst verschwände das Bedienelement,
 * mit dem man den Zustand wieder loswird.
 */
import type { FeedbackCategory, FeedbackStatus } from '@/core/types/feedback';
import {
  CATEGORY_DOT, CATEGORY_LABELS, CATEGORY_ORDER, STATUS_DOT, STATUS_LABELS,
} from '@/components/feedback/constants';
import { FEEDBACK_LANE_STATUS } from '@/components/feedback/feedbackLanes';
import { FEEDBACK_STATUS } from '@/core/services/feedback/feedback-status';
import { bereichLabel } from '@/components/feedback/feedbackUi';
import { TYP_UNKLASSIFIZIERT, type FacettenZaehler } from '../boardZahlen';

interface Wert {
  key: string;
  label: string;
  dot?: string;
  n: number;
}

export interface FacettenAuswahl {
  typ: FeedbackCategory | typeof TYP_UNKLASSIFIZIERT | '';
  status: FeedbackStatus | '';
  bereich: string;
}

export function FacettenLeiste({ zaehler, auswahl, onChange }: {
  zaehler: FacettenZaehler;
  auswahl: FacettenAuswahl;
  onChange: (a: Partial<FacettenAuswahl>) => void;
}): React.ReactElement {
  const typWerte: Wert[] = [
    ...CATEGORY_ORDER.map(c => ({
      key: c as string,
      label: CATEGORY_LABELS[c],
      dot: CATEGORY_DOT[c],
      n: zaehler.typ[c] ?? 0,
    })),
    {
      key: TYP_UNKLASSIFIZIERT,
      label: 'Unklassifiziert',
      dot: 'var(--tf-text-tertiary)',
      n: zaehler.typ[TYP_UNKLASSIFIZIERT] ?? 0,
    },
  ];

  // Die Lane-Liste PLUS `archiviert` (v4.129): der Lane-Katalog kennt es
  // bewusst nicht, `zaehleFacetten` zählt es aber mit. Solange die Gruppe nur
  // aus dem Katalog las, war die berechnete Zahl unerreichbar — mit
  // eingeblendetem Archiv summierte Typ 42 und Status 32, und es gab keinen Weg,
  // per Facette auf die Archivierten zu filtern. Werte ohne Treffer blendet
  // `Gruppe` ohnehin aus, die Zeile erscheint also nur, wo es welche gibt.
  const statusWerte: Wert[] = [...FEEDBACK_LANE_STATUS, FEEDBACK_STATUS.archiviert].map(s => ({
    key: s,
    label: STATUS_LABELS[s],
    dot: STATUS_DOT[s],
    n: zaehler.status[s] ?? 0,
  }));

  // Bereiche nach Häufigkeit — die Liste ist zwölf Einträge lang, und bei einer
  // festen Reihenfolge stünde der meistgenutzte Bereich womöglich ganz unten.
  const bereichWerte: Wert[] = Object.keys(zaehler.bereich)
    .map(ref => ({ key: ref, label: bereichLabel(ref), n: zaehler.bereich[ref] ?? 0 }))
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label, 'de'));

  return (
    <aside className="fb-facetten" aria-label="Filter">
      <Gruppe
        titel="Typ"
        werte={typWerte}
        aktiv={auswahl.typ}
        onWaehle={k => onChange({ typ: k as FacettenAuswahl['typ'] })}
      />
      <Gruppe
        titel="Status"
        werte={statusWerte}
        aktiv={auswahl.status}
        onWaehle={k => onChange({ status: k as FacettenAuswahl['status'] })}
      />
      <Gruppe
        titel="Bereich"
        werte={bereichWerte}
        aktiv={auswahl.bereich}
        onWaehle={k => onChange({ bereich: k })}
      />
    </aside>
  );
}

function Gruppe({ titel, werte, aktiv, onWaehle }: {
  titel: string;
  werte: readonly Wert[];
  aktiv: string;
  onWaehle: (key: string) => void;
}): React.ReactElement {
  const sichtbar = werte.filter(w => w.n > 0 || w.key === aktiv);
  return (
    <div className="fb-fgruppe">
      <div className="fb-flabel">
        {titel}
        {aktiv && (
          <button type="button" className="fb-reset" onClick={() => onWaehle('')}>
            zurücksetzen
          </button>
        )}
      </div>
      {sichtbar.length === 0 && (
        <div className="px-2 text-[11.5px] text-[var(--tf-text-tertiary)] italic">keine</div>
      )}
      {sichtbar.map(w => (
        <button
          key={w.key}
          type="button"
          className={`fb-fzeile${aktiv === w.key ? ' an' : ''}`}
          aria-pressed={aktiv === w.key}
          // Zweiter Klick auf denselben Wert hebt ihn auf — dieselbe Erwartung
          // wie bei den Filter-Chips überall sonst in der App.
          onClick={() => onWaehle(aktiv === w.key ? '' : w.key)}
        >
          {w.dot && <span className="fb-dot" style={{ background: w.dot }} aria-hidden />}
          <span className="fb-lbl">{w.label}</span>
          <span className="fb-n">{w.n}</span>
        </button>
      ))}
    </div>
  );
}
