/**
 * Navigation des Prüfablaufs: drei Phasenkarten, darunter die Schritte der
 * aktiven Phase; die Konfigurations-Screens stehen rechts abgesetzt.
 *
 * Rein darstellend — Reihenfolge, Phase und Status kommen aus
 * `ansicht/schritte`. Die Schritt-Leiste nutzt das geteilte `ScopeTabs`
 * (Guard `no-parallel-scope-tabs`); der Statuspunkt sitzt in dessen
 * `leading`-Slot.
 */
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { Check } from 'lucide-react';
import {
  KONFIG_SCHRITTE, PHASEN, phaseIstFertig, phaseVonSchritt, SCHRITT_LABEL,
  statusVonSchritt, type AnsichtKey, type SchrittKey, type StatusSignale,
} from '../ansicht/schritte';
import { SchrittPunkt } from './SchrittPunkt';

function PhasenKarte({ nummer, label, anzahl, aktiv, fertig, onClick }: {
  nummer: number; label: string; anzahl: number;
  aktiv: boolean; fertig: boolean; onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={aktiv ? 'step' : undefined}
      className={[
        'flex-1 min-w-0 flex items-center gap-2.5 text-left cursor-pointer',
        'rounded-[var(--tf-radius)] px-3.5 py-2.5 transition-colors',
        aktiv
          ? 'bg-[var(--tf-sheet)]'
          : 'bg-[var(--tf-card-surface,var(--tf-bg))] hover:bg-[var(--tf-hover)]',
      ].join(' ')}
      style={{
        border: aktiv
          ? '0.5px solid var(--tf-primary)'
          : '0.5px solid var(--tf-border)',
        boxShadow: aktiv ? 'inset 0 0 0 0.5px var(--tf-primary)' : undefined,
      }}
    >
      <span
        className="w-[22px] h-[22px] shrink-0 rounded-full grid place-items-center text-[11px] font-medium"
        style={
          fertig
            ? { background: 'var(--tf-success-text)', color: 'var(--tf-on-primary)' }
            : aktiv
              ? { background: 'var(--tf-primary)', color: 'var(--tf-on-primary)' }
              : { background: 'var(--tf-hover)', color: 'var(--tf-text-secondary)' }
        }
      >
        {fertig ? <Check size={12} strokeWidth={3} /> : nummer}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-[var(--tf-text)] truncate">{label}</span>
        <span className="block text-[10.5px] text-[var(--tf-text-tertiary)] mt-px">
          {anzahl} {anzahl === 1 ? 'Schritt' : 'Schritte'}
        </span>
      </span>
    </button>
  );
}

export function PhasenNav({ aktiv, signale, konfigExtra, onWechsle }: {
  aktiv: AnsichtKey;
  signale: StatusSignale;
  /** Zusätzliche Konfigurations-Screens (z.B. das dev-Messwerkzeug). */
  konfigExtra?: readonly AnsichtKey[];
  onWechsle: (key: AnsichtKey) => void;
}): React.ReactElement {
  // Auf einem Konfigurations-Screen bleibt die zuletzt sinnvolle Phase stehen,
  // damit die Schritt-Leiste nicht leer wirkt.
  const aktivePhase = PHASEN.find(p => (p.schritte as readonly string[]).includes(aktiv))
    ?? phaseVonSchritt('kompakt');

  const konfig = [...KONFIG_SCHRITTE, ...(konfigExtra ?? [])];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        {PHASEN.map(p => (
          <PhasenKarte
            key={p.key}
            nummer={p.nummer}
            label={p.label}
            anzahl={p.schritte.length}
            aktiv={aktivePhase.key === p.key}
            fertig={phaseIstFertig(p, signale)}
            onClick={() => onWechsle(p.schritte[0] as SchrittKey)}
          />
        ))}
      </div>

      <div
        className="flex items-end justify-between gap-6 min-w-0"
        style={{ borderBottom: '0.5px solid var(--tf-border)' }}
      >
        <ScopeTabs
          items={aktivePhase.schritte.map(s => ({
            key: s,
            label: SCHRITT_LABEL[s],
            leading: <SchrittPunkt status={statusVonSchritt(s, signale)} />,
          }))}
          activeKey={aktiv}
          onChange={k => onWechsle(k as AnsichtKey)}
          aria-label={`Schritte der Phase ${aktivePhase.label}`}
        />
        <ScopeTabs
          items={konfig.map(k => ({ key: k, label: SCHRITT_LABEL[k] }))}
          activeKey={aktiv}
          onChange={k => onWechsle(k as AnsichtKey)}
          className="shrink-0"
          aria-label="Konfiguration"
        />
      </div>
    </div>
  );
}
