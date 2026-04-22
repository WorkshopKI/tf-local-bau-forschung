// Sponsoring-UI: Punkte-Dropdown + Stunden-Dialog + "Zurückziehen"-Option.
// compact-Modus: "+1 Punkt" Quick-Action + "Mehr…" Popover.

import { useState } from 'react';
import { Check, Clock, Coins, Plus, X } from 'lucide-react';
import { useProfile } from '@/core/hooks/useProfile';
import { useStorage } from '@/core/hooks/useStorage';
import { loadUserBudget, sponsorTicket, unsponsorTicket } from '@/core/services/feedback';
import type { FeedbackConfig, FeedbackItem } from '@/core/types/feedback';
import { DEFAULT_BUDGET_POINTS_PER_QUARTER } from '@/core/types/feedback';

interface Props {
  ticket: FeedbackItem;
  config: FeedbackConfig;
  open: boolean;
  onChanged: () => void;
  /** Kompaktes Layout: "+1 Punkt" Quick-Action + "Mehr…" Trigger. */
  compact?: boolean;
}

const POINT_OPTIONS = [1, 2, 3, 5];

export function SponsorButton({ ticket, config, open, onChanged, compact }: Props): React.ReactElement | null {
  const { profile } = useProfile();
  const storage = useStorage();
  const [showPointsMenu, setShowPointsMenu] = useState(false);
  const [showHoursDialog, setShowHoursDialog] = useState(false);
  const [hours, setHours] = useState(2);
  const [projectRef, setProjectRef] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!profile?.name) return null;
  const userId = profile.name;
  const userDisplay = profile.name;

  const sponsors = ticket.sponsors ?? [];
  const mineP = sponsors.find(s => s.user_id === userId && s.type === 'points');
  const mineH = sponsors.find(s => s.user_id === userId && s.type === 'hours');

  if (!open) {
    return (
      <p className="text-[11.5px] text-[var(--tf-text-tertiary)] italic">Sponsoring geschlossen</p>
    );
  }

  const budget = loadUserBudget(userId, config.budget_points_per_quarter ?? DEFAULT_BUDGET_POINTS_PER_QUARTER);
  const remainingPoints = budget.points_total - budget.points_spent;

  const doSponsorPoints = async (amount: number): Promise<void> => {
    setErrorMsg(null);
    setShowPointsMenu(false);
    const res = await sponsorTicket(storage, ticket.id, {
      user_id: userId, user_display_name: userDisplay, type: 'points', amount,
      created_at: new Date().toISOString(),
    }, config);
    if (!res.ok) { setErrorMsg(errorToMsg(res.error)); return; }
    onChanged();
  };

  const doSponsorHours = async (): Promise<void> => {
    setErrorMsg(null);
    if (hours < 1 || !projectRef.trim()) { setErrorMsg('Stunden und Projekt-Referenz eingeben.'); return; }
    const res = await sponsorTicket(storage, ticket.id, {
      user_id: userId, user_display_name: userDisplay, type: 'hours', amount: hours,
      project_ref: projectRef.trim(), created_at: new Date().toISOString(),
    }, config);
    if (!res.ok) { setErrorMsg(errorToMsg(res.error)); return; }
    setShowHoursDialog(false);
    setProjectRef('');
    setHours(2);
    onChanged();
  };

  const doUnsponsor = async (type: 'points' | 'hours'): Promise<void> => {
    await unsponsorTicket(storage, ticket.id, userId, type, config);
    onChanged();
  };

  // ── Compact Layout ──────────────────────────────────────────────────────
  if (compact) {
    return (
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Punkte: bereits gesponsort oder Quick-Sponsor */}
          {mineP ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--tf-primary-light)] text-[var(--tf-primary)]">
              <Coins size={10} /> Du: {mineP.amount} Pkt
              <button type="button" onClick={() => doUnsponsor('points')} className="ml-0.5 cursor-pointer hover:opacity-70" aria-label="Zurückziehen"><X size={10} /></button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => doSponsorPoints(1)}
              disabled={remainingPoints <= 0}
              title={remainingPoints <= 0 ? 'Kein Budget übrig' : `Noch ${remainingPoints} Pkt übrig`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--tf-radius)] text-[11.5px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              +1 Punkt
            </button>
          )}
          {/* Stunden: bereits gesponsort */}
          {mineH && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]">
              <Clock size={10} /> Du: {mineH.amount}h
              <button type="button" onClick={() => doUnsponsor('hours')} className="ml-0.5 cursor-pointer hover:opacity-70" aria-label="Zurückziehen"><X size={10} /></button>
            </span>
          )}
          {/* Mehr… öffnet vollständiges Menü */}
          <div className="relative inline-block">
            <button
              type="button"
              onClick={() => { setShowPointsMenu(v => !v); setShowHoursDialog(false); }}
              className="text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer"
              style={{ border: '0.5px solid var(--tf-border)', borderRadius: 'var(--tf-radius)', padding: '4px 8px' }}
            >
              Mehr…
            </button>
            {showPointsMenu && (
              <div
                className="absolute z-10 top-full left-0 mt-1 rounded-[var(--tf-radius)] bg-[var(--tf-bg)] py-1 min-w-[160px]"
                style={{ border: '0.5px solid var(--tf-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
              >
                {!mineP && POINT_OPTIONS.map(p => (
                  <button
                    key={p} type="button"
                    onClick={() => !( p > remainingPoints) && doSponsorPoints(p)}
                    disabled={p > remainingPoints}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <Plus size={11} className="inline mr-1" />{p} Punkt{p > 1 ? 'e' : ''}
                  </button>
                ))}
                {!mineH && (
                  <button
                    type="button"
                    onClick={() => { setShowHoursDialog(true); setShowPointsMenu(false); }}
                    className="w-full text-left px-3 py-1.5 text-[12px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] cursor-pointer"
                    style={{ borderTop: '0.5px solid var(--tf-border)' }}
                  >
                    <Clock size={11} className="inline mr-1" />Stunden anbieten
                  </button>
                )}
                <div className="px-3 py-1 text-[10.5px] text-[var(--tf-text-tertiary)]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                  Noch {remainingPoints} Pkt übrig
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Stunden-Dialog (compact) */}
        {showHoursDialog && renderHoursDialog()}

        {errorMsg && <p className="text-[11px] text-[var(--tf-danger-text)]">{errorMsg}</p>}
      </div>
    );
  }

  // ── Standard Layout (unverändert) ───────────────────────────────────────
  return (
    <div className="flex flex-wrap items-start gap-2">
      {mineP ? (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11.5px] font-medium bg-[var(--tf-primary-light)] text-[var(--tf-primary)]">
          <Coins size={11} /> Du: {mineP.amount} Pkt
          <button type="button" onClick={() => doUnsponsor('points')} className="ml-1 cursor-pointer hover:opacity-70" aria-label="Zurückziehen"><X size={11} /></button>
        </span>
      ) : (
        <div className="relative inline-block">
          <button
            type="button" onClick={() => setShowPointsMenu(v => !v)}
            disabled={remainingPoints <= 0}
            title={remainingPoints <= 0 ? 'Kein Budget übrig dieses Quartal' : `Noch ${remainingPoints} Pkt übrig`}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--tf-radius)] text-[12px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Plus size={12} /> Punkte
          </button>
          {showPointsMenu && (
            <div
              className="absolute z-10 top-full left-0 mt-1 rounded-[var(--tf-radius)] bg-[var(--tf-bg)] py-1 min-w-[140px]"
              style={{ border: '0.5px solid var(--tf-border)', boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            >
              {POINT_OPTIONS.map(p => (
                <button key={p} type="button" onClick={() => !(p > remainingPoints) && doSponsorPoints(p)} disabled={p > remainingPoints}
                  className="w-full text-left px-3 py-1.5 text-[12.5px] text-[var(--tf-text)] hover:bg-[var(--tf-hover)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer">
                  +{p} Punkt{p > 1 ? 'e' : ''}
                </button>
              ))}
              <div className="px-3 py-1 text-[10.5px] text-[var(--tf-text-tertiary)]" style={{ borderTop: '0.5px solid var(--tf-border)' }}>
                Noch {remainingPoints} Pkt übrig
              </div>
            </div>
          )}
        </div>
      )}

      {mineH ? (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11.5px] font-medium bg-[var(--tf-info-bg)] text-[var(--tf-info-text)]">
          <Clock size={11} /> Du: {mineH.amount}h ({mineH.project_ref})
          <button type="button" onClick={() => doUnsponsor('hours')} className="ml-1 cursor-pointer hover:opacity-70" aria-label="Zurückziehen"><X size={11} /></button>
        </span>
      ) : (
        <button type="button" onClick={() => setShowHoursDialog(v => !v)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--tf-radius)] text-[12px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
          style={{ border: '0.5px solid var(--tf-border)' }}>
          <Clock size={12} /> Stunden
        </button>
      )}

      {showHoursDialog && renderHoursDialog()}

      {errorMsg && <p className="w-full text-[11px] text-[var(--tf-danger-text)]">{errorMsg}</p>}
    </div>
  );

  // ── Shared: Stunden-Dialog ──────────────────────────────────────────────
  function renderHoursDialog(): React.ReactElement {
    return (
      <div
        className="w-full p-2.5 rounded-[var(--tf-radius)] bg-[var(--tf-bg-secondary)] space-y-2"
        style={{ border: '0.5px solid var(--tf-border)' }}
      >
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="block text-[10.5px] text-[var(--tf-text-tertiary)] mb-0.5">Stunden</span>
            <input type="number" min={1} max={100} value={hours}
              onChange={e => setHours(Math.max(1, Number(e.target.value) || 1))}
              className="w-full px-2 py-1 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)]"
              style={{ border: '0.5px solid var(--tf-border)' }} />
          </label>
          <label className="flex-[2]">
            <span className="block text-[10.5px] text-[var(--tf-text-tertiary)] mb-0.5">Projekt-Ref.</span>
            <input value={projectRef} onChange={e => setProjectRef(e.target.value)} placeholder="z.B. BA-2026-015"
              className="w-full px-2 py-1 text-[12.5px] bg-transparent text-[var(--tf-text)] rounded-[var(--tf-radius)] outline-none focus:border-[var(--tf-primary)]"
              style={{ border: '0.5px solid var(--tf-border)' }} />
          </label>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={doSponsorHours} disabled={!projectRef.trim() || hours < 1}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-[var(--tf-radius)] text-[11.5px] font-medium bg-[var(--tf-primary)] text-white hover:opacity-90 disabled:opacity-40 cursor-pointer">
            <Check size={11} /> Sponsoren
          </button>
          <button type="button" onClick={() => { setShowHoursDialog(false); setErrorMsg(null); }}
            className="px-2 py-1 rounded-[var(--tf-radius)] text-[11.5px] text-[var(--tf-text-secondary)] hover:bg-[var(--tf-hover)] cursor-pointer"
            style={{ border: '0.5px solid var(--tf-border)' }}>
            Abbrechen
          </button>
        </div>
      </div>
    );
  }
}

function errorToMsg(e?: string): string {
  switch (e) {
    case 'no_budget': return 'Nicht genug Punkte übrig dieses Quartal.';
    case 'already_sponsored': return 'Du hast bereits mit diesem Typ gesponsort.';
    case 'not_open': return 'Sponsoring für dieses Ticket ist geschlossen.';
    case 'write_failed': return 'Schreiben in Shared-Datei fehlgeschlagen.';
    default: return 'Sponsoring fehlgeschlagen.';
  }
}
