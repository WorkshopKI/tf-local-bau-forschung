/**
 * QS-Freigaben-Widget (Home, Hauptbereich — Phase 3 v1.1).
 *
 * Read-only + Navigation: listet lokale Artefakt-Entwürfe, die noch nicht
 * freigegeben sind (Entwurf ≠ Entscheidung). Das Widget gibt NIE frei — beide
 * Aktionen navigieren nur in die Artefakt-/Verbund-Oberfläche. Lazy: der IDB-
 * Bulk-Read (`entries`) läuft erst ausgeklappt.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';
import {
  zaehleProTyp,
  type QsFreigabeZeile,
} from './qsFreigaben';
import { useQsFreigaben } from './useQsFreigaben';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const DEFAULT_MAX = 4;

/** Typ-Badge über bestehende semantische Tokens (kein neues Theme-Token). */
const TYP_BADGE_KLASSE: Record<string, string> = {
  ga: 'bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]',
  nf: 'bg-[var(--tf-success-bg)] text-[var(--tf-success-text)]',
  abl: 'bg-[var(--tf-danger-bg)] text-[var(--tf-danger-text)]',
  rne: 'bg-[var(--tf-warning-bg)] text-[var(--tf-warning-text)]',
  precheck: 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]',
};
const BADGE_FALLBACK = 'bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]';

export function QsFreigabenWidget({ instanz, onToggleEingeklappt }: WidgetProps): React.ReactElement {
  const { navigate } = useNavigation();

  const maxZeilen = instanz.config.art === 'qs-freigaben' ? instanz.config.maxZeilen : DEFAULT_MAX;
  // Lazy: eingeklappt kein Bulk-Read. Geteilter Hook (auch der Hero-Alert-Chip
  // „QS-Freigaben offen" liest daraus → identische Zahl, kein Drift).
  const { zeilen, mode } = useQsFreigaben(!instanz.eingeklappt);

  // In-Karte erweitern statt wegzunavigieren (v4.131): „+ N weitere →" führte
  // in die ungefilterte Förderanträge-Liste, in der von QS-Entwürfen nichts zu
  // sehen ist — eine QS-Listenseite gibt es nicht. Der Rest gehört deshalb
  // hierher, wie das „+10 anzeigen" in „Meine Anträge".
  const [alleZeigen, setAlleZeigen] = useState(false);
  // Ein neuer Karten-Stand (Widget-Einstellung geändert) startet wieder gekappt.
  useEffect(() => { setAlleZeigen(false); }, [maxZeilen]);

  const sichtbar = alleZeigen ? zeilen : zeilen.slice(0, maxZeilen);
  const rest = zeilen.length - sichtbar.length;
  const typPills = useMemo(() => zaehleProTyp(zeilen), [zeilen]);

  const openArtefakt = (scopeId: string): void => navigate('antraege', { selectedId: scopeId });

  return (
    <WidgetShell
      titel="QS-Freigaben offen"
      meta={`Entwurf ≠ Entscheidung · ${bearbeiterScopeLabel(mode)}`}
      variante="haupt"
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        typPills.length > 0 ? (
          <span className="flex items-center gap-1.5">
            {typPills.map(p => (
              <span key={p.typ} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10.5px] font-semibold tabular-nums ${TYP_BADGE_KLASSE[p.typ] ?? BADGE_FALLBACK}`}>
                {p.badge} {p.count}
              </span>
            ))}
          </span>
        ) : undefined
      }
    >
      {zeilen.length === 0 ? (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)] py-1">
          Keine offenen Entwürfe — alle Artefakte sind freigegeben.
        </p>
      ) : (
        <div className="flex flex-col">
          {sichtbar.map((z, i) => (
            <QsZeile key={z.key} zeile={z} onOpen={() => openArtefakt(z.scopeId)} last={i === sichtbar.length - 1 && rest <= 0} />
          ))}
          {rest > 0 ? (
            <button
              type="button"
              onClick={() => setAlleZeigen(true)}
              title="Zeigt die restlichen Entwürfe hier in der Karte."
              className="mt-2 self-start text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
            >
              + {rest} weitere anzeigen
            </button>
          ) : alleZeigen && zeilen.length > maxZeilen ? (
            <button
              type="button"
              onClick={() => setAlleZeigen(false)}
              className="mt-2 self-start text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
            >
              Weniger anzeigen
            </button>
          ) : null}
        </div>
      )}
    </WidgetShell>
  );
}

function QsZeile({ zeile, onOpen, last }: { zeile: QsFreigabeZeile; onOpen: () => void; last: boolean }): React.ReactElement {
  const regelText = zeile.regelnGruen
    ? 'alle Regeln grün'
    : `${zeile.offeneRegeln} ${zeile.offeneRegeln === 1 ? 'Regel offen' : 'Regeln offen'}`;
  const meta = [
    zeile.alterTage !== null ? `Entwurf seit ${zeile.alterTage} T` : null,
    zeile.pflichtfreigabe ? 'Pflichtfreigabe' : null,
  ].filter(Boolean).join(' · ');
  return (
    <div
      className="flex items-center gap-3 py-2"
      style={last ? undefined : { borderBottom: '0.5px solid var(--tf-border)' }}
    >
      <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-[6px] text-[10.5px] font-semibold ${TYP_BADGE_KLASSE[zeile.typ] ?? BADGE_FALLBACK}`}>
        {zeile.typBadge}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold text-[var(--tf-text)] truncate">
          {zeile.titel} · {zeile.untertitel}
        </span>
        <span className="block text-[11.5px] tabular-nums text-[var(--tf-text-tertiary)] truncate">
          {meta}{meta ? ' · ' : ''}
          <span className={zeile.regelnGruen ? 'text-[var(--tf-success-text)]' : 'text-[var(--tf-danger-text)]'}>{regelText}</span>
        </span>
      </span>
      <button
        type="button"
        onClick={onOpen}
        className="shrink-0 rounded-[var(--tf-radius)] px-2.5 py-1 text-[12px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] hover:bg-[var(--tf-bg-secondary)] cursor-pointer"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        {zeile.regelnGruen ? 'Freigeben →' : 'Prüfen →'}
      </button>
    </div>
  );
}
