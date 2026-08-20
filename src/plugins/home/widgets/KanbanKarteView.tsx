/**
 * Die Kompaktkarte des Anträge-Kanbans — EINE Karte für beide Ansichten.
 *
 * Lag bis v3.47 als lokale Funktion in `AntragKanbanWidget.tsx`. Sie zog hier
 * heraus, als das Vollbild-Fenster dieselbe Karte brauchte: eine zweite Fassung
 * hätte genau die Doppelung angelegt, an der dieses Modul zuletzt zerfallen ist
 * (docs/architecture/board-komponente.md).
 *
 * `onOpen` statt `useNavigation`: die Karte läuft im Vollbild in einer ZWEITEN
 * React-Wurzel, und dort gibt es keinen Router-Kontext.
 */
import { alterInTagen } from '@/core/utils/relativeZeit';
import type { KanbanKarte } from './kanbanLanes';

export interface KanbanKarteViewProps {
  karte: KanbanKarte;
  onOpen: () => void;
}

/** Akronym, nächster Schritt, Meta (TV-Zahl bzw. FKZ · Alter). */
export function KanbanKarteView({ karte, onOpen }: KanbanKarteViewProps): React.ReactElement {
  const alter = alterInTagen(karte.alterTage);
  const herkunft = karte.tvCount > 1 ? `${karte.tvCount} TV` : karte.aktenzeichen;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="block w-full text-left rounded-[10px] bg-[var(--tf-bg)] hover:bg-[var(--tf-bg-secondary)] transition-colors cursor-pointer px-3 py-2.5"
      style={{ border: '0.5px solid var(--tf-border)', borderLeft: '2.5px solid var(--tf-border-hover)' }}
    >
      <p className="text-[13px] font-medium text-[var(--tf-text)] truncate" title={karte.label}>
        {karte.label}
      </p>
      {karte.schrittText ? (
        // `line-clamp-2` schneidet ohne Rueckweg ab — der Titel daneben hat aus
        // demselben Grund einen. Greift bei langen Status-Kurzformen.
        <p className="mt-0.5 text-[12px] leading-snug text-[var(--tf-text-secondary)] line-clamp-2" title={karte.titel || karte.schrittText}>
          {karte.schrittText}
        </p>
      ) : null}
      {/* Wer am Zug ist, steht in einer EIGENEN Zeile: „in QS" ist die Aufgabe,
          „wartet auf QS" die Auskunft dazu. In einen Satz gezogen läse sich
          beides als Anweisung an den Leser der Karte (v4.132). */}
      {karte.adresse ? (
        <p className="mt-0.5 text-[11px] leading-snug text-[var(--tf-text-tertiary)] truncate" title={karte.adresse}>
          {karte.adresse}
        </p>
      ) : null}
      <p className="mt-1.5 text-[11px] tabular-nums text-[var(--tf-text-tertiary)] truncate">
        {herkunft}{alter ? ` · ${alter}` : ''}
      </p>
    </button>
  );
}
