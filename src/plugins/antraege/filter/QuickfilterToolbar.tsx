/**
 * Quickfilter-Toolbar für die Förderanträge-Liste — **Akkordeon** in EINER
 * Zeile (Journey-Paket 2 Phase 2).
 *
 * Segmente (`CollapsibleSeg`, controlled): Status · Antragstyp · Projektart ·
 * PreCheck. **Mehrere Pillen dürfen gleichzeitig offen sein** (seit v3.13); der
 * Zustand ist eine Menge offener Segment-Ids, pro View persistiert
 * (`quickfilterExpanded.ts`).
 *
 * **Die Zeile trägt nur noch die MENGE.** Alles zur FORM steht im
 * „Darstellung"-Menü rechts (`darstellungsAchsen.ts`) — die Gruppierung seit
 * Journey-Paket 2, die Ansichtsform seit v4.64, die Sortierung seit v4.65. Zwei
 * Orte für „wie wird gezeigt" waren genau die Art Überschneidung, wegen der
 * niemand mehr wusste, wo er suchen soll.
 *
 * Filter-Backend:
 * - Status  → `useFilterState` (`system-status`, `phaseQuickfilter.ts`)
 * - Antragstyp → `useFilterState` (`system-vb-phase`, `kategorieQuickfilter.ts`)
 * - Projektart → eigener Store-Slot `projektart` (abgeleitet aus Antragstyp +
 *   TV-Zahl des Verbunds, kein Filter-Chip, siehe `projektartQuickfilter.ts`)
 * - PreCheck → eigener Store-Slot `precheckBucket` (abgeleitete Klassifikation,
 *   kein Filter-Chip, siehe `precheckQuickfilter.ts`)
 * - Sort → `useAntraegeStore` (per-View)
 *
 * Die **Gruppieren**-Steuerung ist seit Phase 2 kein Segment mehr, sondern eine
 * Achse im „Darstellung"-Menü rechts in `AntraegeMain` (`DarstellungDropdown`).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useAntraegeStore } from '../store';
import { useFilteredAntraege } from '../useFilteredAntraege';
import { useFilterState } from './useFilterState';
import { CollapsibleSeg } from './CollapsibleSeg';
import {
  getStillstandItems, stillstandLabel, stillstandStufeVon,
} from './stillstandQuickfilter';
import { useAktivitaetsIndex } from '../frage/useAktivitaetsIndex';
import {
  getPhaseFromActive,
  getPhaseItems,
  applyPhase,
  type PhaseLabel,
} from './phaseQuickfilter';
import {
  getKategorieFromActive,
  getKategorieItems,
  applyKategorie,
  matchesKategorie,
  type KategorieLabel,
} from './kategorieQuickfilter';
import { getPrecheckItems, asPrecheckBucket } from './precheckQuickfilter';
import {
  PROJEKTART_LABELS,
  getProjektartItems,
  projektartVonLabel,
} from './projektartQuickfilter';
import {
  loadExpandedSegs,
  saveExpandedSegs,
  toggleExpandedSeg,
  type QuickfilterSegId,
} from './quickfilterExpanded';

export function QuickfilterToolbar(): React.ReactElement {
  // Counts auf der "Kürzel-gefilterten" Basis berechnen, nicht auf der
  // Roh-Liste — sonst zeigen die Pillen Counts der gesamten Kohorte
  // obwohl die Tabs oben (Offen / Alle …) bereits den Kürzel-Filter
  // anwenden. countBase = View + Irrläufer-Pre-Filter + Bearbeiter-Filter,
  // ohne die Sidebar-Active-Filter (Stabilität).
  const { countBase, tvCountOf } = useFilteredAntraege();
  const activeView = useAntraegeStore(s => s.activeView);

  const active = useFilterState(s => s.active);
  const setActiveValue = useFilterState(s => s.setActiveValue);
  const clearFilter = useFilterState(s => s.clearFilter);

  const precheckBucket = useAntraegeStore(s => s.precheckBucket);
  const setPrecheckBucket = useAntraegeStore(s => s.setPrecheckBucket);
  const projektart = useAntraegeStore(s => s.projektart);
  const setProjektart = useAntraegeStore(s => s.setProjektart);
  const stillstandTage = useAntraegeStore(s => s.stillstandTage);
  const setStillstandTage = useAntraegeStore(s => s.setStillstandTage);
  const { index: aktivitaetsIndex } = useAktivitaetsIndex();
  const stichtagRef = useRef<string>(new Date().toISOString());

  // Offene Segmente, pro View persistiert. Mehrere dürfen gleichzeitig offen
  // sein — seit die Projektart-Zähler dem Antragstyp folgen, ist das Nebeneinander
  // die Stelle, an der man die Kaskade überhaupt sieht.
  const [expandedSegs, setExpandedSegs] = useState<ReadonlySet<QuickfilterSegId>>(
    () => loadExpandedSegs(activeView),
  );
  useEffect(() => {
    setExpandedSegs(loadExpandedSegs(activeView));
  }, [activeView]);
  const handleToggle = (seg: QuickfilterSegId): void => {
    setExpandedSegs(prev => {
      const next = toggleExpandedSeg(prev, seg);
      saveExpandedSegs(activeView, next);
      return next;
    });
  };

  // Phase. Der aktuelle Wert geht MIT hinein: steht in der Leiste eine
  // Auswahl, die kein Bucket ist, braucht die Pille ein Segment dafür — sonst
  // zeigte sie einen Wert an, den ihre eigene Liste nicht enthält, und wirkte
  // dann auf gar nichts.
  const phase = getPhaseFromActive(active);
  const phaseItems = useMemo(() => getPhaseItems(countBase, phase), [countBase, phase]);
  const onPhaseChange = (label: string): void => {
    applyPhase(label as PhaseLabel, (id, v) => setActiveValue(id, v), clearFilter);
  };

  // Antragstyp (Kategorie)
  const kategorie = getKategorieFromActive(active);
  const kategorieItems = useMemo(
    () => getKategorieItems(countBase, kategorie), [countBase, kategorie],
  );
  const onKategorieChange = (label: string): void => {
    applyKategorie(label as KategorieLabel, (id, v) => setActiveValue(id, v), clearFilter);
  };

  // Projektart (abgeleitet aus Antragstyp + TV-Zahl, eigener Store-Slot). Die
  // Zähler laufen über dieselbe `tvCountOf` wie der Filter — siehe
  // `projektartQuickfilter.ts`.
  //
  // EINSEITIGE KASKADE: die Basis folgt dem gewählten Antragstyp, nicht der
  // eigenen Auswahl. „FuE" oben heißt, dass hier nur noch FuE gezählt wird —
  // sonst behauptet „Einzelprojekt 397" eine Menge, die der Klick gar nicht
  // liefern kann, weil der Antragstyp-Filter davor liegt. Umgekehrt wirkt es
  // NICHT: eine Achse, die ihre eigenen Zähler beschneidet, springt bei jedem
  // Klick und macht die Auswahl unumkehrbar (Stabilitäts-Regel).
  const projektartBase = useMemo(
    () => (kategorie === 'Alle' ? countBase : countBase.filter(a => matchesKategorie(a, kategorie))),
    [countBase, kategorie],
  );
  const projektartItems = useMemo(
    () => getProjektartItems(projektartBase, tvCountOf), [projektartBase, tvCountOf],
  );
  const onProjektartChange = (label: string): void => {
    setProjektart(projektartVonLabel(label));
  };

  // PreCheck (abgeleiteter Bucket, eigener Store-Slot)
  // Zaehler ueber dieselbe `countBase` wie die anderen Pillen — und ueber
  // dieselbe Urteilsfunktion, die auch filtert (`beurteileStillstand`).
  const stillstandItems = useMemo(
    () => getStillstandItems(countBase, aktivitaetsIndex, stichtagRef.current),
    [countBase, aktivitaetsIndex],
  );
  const onStillstandChange = (label: string): void => {
    setStillstandTage(stillstandStufeVon(label));
  };

  const precheckItems = useMemo(() => getPrecheckItems(countBase), [countBase]);
  const onPrecheckChange = (label: string): void => {
    setPrecheckBucket(asPrecheckBucket(label));
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Beschriftet „Status", der Zusatz steht im Tooltip (v4.70): die Zeile
          braucht ihre Breite für die Filter. Der Zusatz ist damit verlagert, nicht
          gestrichen — die Zähler beziehen sich auf `countBase`, also auf die oben
          gewählte Sicht, und ohne diesen Hinweis standen „Offen 909"
          (Sicht-Reiter) und „Offen 852" (Pille) zwei Zeilen auseinander und
          widersprachen sich scheinbar (v2.372.2). */}
      <CollapsibleSeg
        label="Status"
        titel="Status in dieser Sicht — die Zahlen zählen innerhalb des oben gewählten Reiters"
        value={phase}
        items={phaseItems}
        onChange={onPhaseChange}
        expanded={expandedSegs.has('status')}
        onExpandToggle={() => handleToggle('status')}
      />
      <CollapsibleSeg
        label="Antragstyp"
        value={kategorie}
        items={kategorieItems}
        onChange={onKategorieChange}
        expanded={expandedSegs.has('antragstyp')}
        onExpandToggle={() => handleToggle('antragstyp')}
      />
      {/* Einzel-/Kooperationsprojekt. Die beiden Netzwerkbezug-Stufen hängen im
          MENÜ unter „Einzelprojekt" — sie liegen fachlich darin, und
          nebeneinander lasen sich die Zahlen wie eine Aufteilung, die sie nicht
          sind (ein DS-Einzelprojekt trägt weder 16KN noch 16EP). Die Zähler
          folgen dem gewählten Antragstyp (`projektartBase`). */}
      <CollapsibleSeg
        label="Projektart"
        value={PROJEKTART_LABELS[projektart]}
        items={projektartItems}
        onChange={onProjektartChange}
        expanded={expandedSegs.has('projektart')}
        onExpandToggle={() => handleToggle('projektart')}
      />
      <CollapsibleSeg
        label="PreCheck"
        value={precheckBucket}
        items={precheckItems}
        onChange={onPrecheckChange}
        expanded={expandedSegs.has('precheck')}
        onExpandToggle={() => handleToggle('precheck')}
      />
      {/* Stillstand: seit wann hat sich nichts mehr getan? Die Zaehler stehen
          erst da, wenn der Aktivitaets-Index gerechnet ist (er kostet einen
          Bestandslauf und startet erst mit der ersten Auswahl) — bis dahin
          bewusst OHNE Zahl, statt eine zu zeigen, die der Klick nicht liefert. */}
      <CollapsibleSeg
        label="Stillstand"
        titel="Seit wann wurde kein Kuerzel mehr neu gesetzt? Antraege ohne datierbares Kuerzel sind nicht pruefbar und fehlen in jeder Stufe."
        value={stillstandLabel(stillstandTage)}
        items={stillstandItems}
        onChange={onStillstandChange}
        expanded={expandedSegs.has('stillstand')}
        onExpandToggle={() => handleToggle('stillstand')}
      />
    </div>
  );
}
