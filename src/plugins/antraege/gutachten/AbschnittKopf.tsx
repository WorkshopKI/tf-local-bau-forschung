/**
 * Kopfzeile der Abschnitts-Karte — EINE Zeile: Titel · Status-Chip · Version ·
 * (rechts) Pipeline-Status · Fallback-Badge · ⋯-Menü.
 *
 * Von BEIDEN Zuständen genutzt: dem leeren Abschnitt (in `GutachtenSection`) und
 * der Review-Karte. Dadurch gibt es die Kopf-Optik genau einmal; das ⋯-Menü
 * erscheint nur, wo es Aktionen gibt (`menu`).
 *
 * Das Menü ist bewusst handgerollt (`useClickOutside`) — Radix `DropdownMenu` ist
 * im Projekt nicht installiert, Hausmuster ist `suche/SearchDownloadMenu.tsx`.
 */
import { useRef, useState } from 'react';
import { AlertTriangle, Check, MoreHorizontal, Pencil } from 'lucide-react';
import { useClickOutside } from '@/core/hooks/useClickOutside';
import type { StepStatus } from './types';

export interface MenuAktion {
  key: string;
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  /** Optischer Trenner ÜBER diesem Eintrag. */
  trenner?: boolean;
  /**
   * Menü nach dem Klick offen lassen (Default: schließen). Für Aktionen, deren
   * Ergebnis im Label steht — „Text kopieren" → „Kopiert"; schlösse das Menü
   * sofort, bliebe ein Fehlschlag unsichtbar.
   */
  offenLassen?: boolean;
}

interface Props {
  /** „A — Kurzfassung". */
  titel: string;
  status: StepStatus;
  /** Version des erzeugenden Skills (klein, monospace). */
  skillVersion?: number;
  /** „Formuliert · Feinschliff" — nur bei generiertem Abschnitt. */
  pipeline?: { text: string; ton: 'ok' | 'hinweis' | 'neutral' };
  /** Der Text entstand über die Standard-KI, weil die agentische fehlte. */
  zielFallback?: boolean;
  /** Manuell bearbeitet → Badge + „Zurücksetzen". */
  bearbeitet?: boolean;
  onZuruecksetzen?: () => void;
  zuruecksetzenBusy?: boolean;
  /** Persönlicher Stil wirkt auf diesen Abschnitt. */
  tweakAktiv?: boolean;
  /** Nur bei EXTERNER KI ein sichtbarer Warnhinweis (DSGVO-Klasse). */
  externerProvider?: string;
  /** dev: Prompt/Workflow dieses Schritts bearbeiten. */
  onOpenWerkstatt?: () => void;
  /** Einträge des ⋯-Menüs; leer/fehlend → kein Menü. */
  menu?: MenuAktion[];
}

export function AbschnittKopf({
  titel, status, skillVersion, pipeline, zielFallback, bearbeitet, onZuruecksetzen,
  zuruecksetzenBusy, tweakAktiv, externerProvider, onOpenWerkstatt, menu,
}: Props): React.ReactElement {
  const menuRef = useRef<HTMLDivElement>(null);
  const [offen, setOffen] = useState(false);
  useClickOutside(menuRef, () => setOffen(false), offen);

  return (
    <div className="g-card-head">
      <h2 className="g-card-title">{titel}</h2>
      {status === 'freigegeben' ? (
        <span className="g-pill ok"><Check className="g-pi" /> Freigegeben</span>
      ) : status === 'entwurf' ? (
        <span className="g-pill draft">Entwurf</span>
      ) : null}
      {skillVersion != null && (
        <span
          className="text-[11px] text-[var(--tf-text-tertiary)] font-mono"
          title="Version des Skills, der diesen Abschnitt erzeugt"
        >
          v{skillVersion}
        </span>
      )}
      {onOpenWerkstatt && (
        <button
          type="button"
          className="text-[var(--tf-text-tertiary)] hover:text-[var(--tf-primary)] transition-colors"
          title="Prompt/Workflow dieses Schritts bearbeiten (dev)"
          aria-label="Workflow bearbeiten (dev)"
          onClick={onOpenWerkstatt}
        >
          <Pencil size={13} />
        </button>
      )}
      {bearbeitet && (
        <span className="g-edited-badge">
          <Pencil /> bearbeitet
          {onZuruecksetzen && (
            <button
              type="button"
              className="g-edited-restore"
              disabled={zuruecksetzenBusy}
              onClick={onZuruecksetzen}
              title="Ursprünglich generierten Text wiederherstellen"
            >
              Zurücksetzen
            </button>
          )}
        </span>
      )}
      {tweakAktiv && <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">persönlicher Stil aktiv</span>}

      <span className="g-ab-spacer" />

      {externerProvider && (
        <span className="g-extern-warn"><AlertTriangle size={13} /> Externe KI: {externerProvider}</span>
      )}
      {pipeline && (
        <span className={`g-pipeline ${pipeline.ton}`} title="Was mit diesem Abschnitt bereits gelaufen ist">
          {pipeline.ton === 'ok' && <Check className="g-pi" />}{pipeline.text}
        </span>
      )}
      {zielFallback && (
        <span className="g-fallback-badge" title="Die agentische KI war nicht erreichbar — die Standard-KI hat diesen Lauf übernommen.">
          Standard-KI (Fallback)
        </span>
      )}
      {menu && menu.length > 0 && (
        <div ref={menuRef} className="relative">
          <button
            type="button"
            className="g-vbtn"
            aria-label="Weitere Aktionen"
            aria-expanded={offen}
            title="Weitere Aktionen"
            onClick={() => setOffen(o => !o)}
          >
            <MoreHorizontal className="g-vi" />
          </button>
          {offen && (
            <div
              className="absolute top-full right-0 mt-1 z-[100] w-[230px] bg-[var(--tf-bg)] rounded-[var(--tf-radius)] shadow-md py-1"
              style={{ border: '0.5px solid var(--tf-border)' }}
              role="menu"
            >
              {menu.map(a => (
                <button
                  key={a.key}
                  type="button"
                  role="menuitem"
                  disabled={a.disabled}
                  className={`g-menu-item${a.trenner ? ' trenner' : ''}`}
                  onClick={() => { if (!a.offenLassen) setOffen(false); a.onClick(); }}
                >
                  {a.icon}
                  {a.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
