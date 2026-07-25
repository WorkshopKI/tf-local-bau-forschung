/**
 * „Warum dieser Status?"-Panel (Phase 5) — die menschenlesbare Begründung der
 * deterministischen Ableitung. Geteilt: inline in der Status-Detailsektion UND
 * als Tooltip-Inhalt hinter dem Konflikt-Badge (Tabelle + Detail). Rein
 * präsentierend, kompakt genug für ein 380px-Popover.
 */
import { AlertTriangle } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/badge';
import { feldLabel } from '@/core/status';
import type { AbleitungsErgebnis, MappingVersion, SpinePhase } from '@/core/status';
import { SPINE_LABEL, KATEGORIE_LABEL, GRUND_LABEL } from './labels';

/** Badge-Variante zur abgeleiteten Spine-Phase (rein visuell). */
function phaseVariant(p: SpinePhase): BadgeVariant {
  switch (p) {
    case 'bewilligung':
    case 'schluss':
      return 'success';
    case 'keine':
      return 'default';
    default:
      return 'info';
  }
}

export function StatusWarum({
  ableitung,
  version,
}: {
  ableitung: AbleitungsErgebnis;
  version: MappingVersion;
}): React.ReactElement {
  const { spinePhase, kategorie, terminal, konflikt, konfliktDetails, fuehrenderWert, beitraege } = ableitung;
  return (
    <div className="text-[12px] text-[var(--tf-text)] leading-[1.5]">
      {/* Kopf: abgeleitete Phase + Kategorie + Terminal-Tag */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[var(--tf-text-tertiary)]">Abgeleitet:</span>
        <Badge variant={phaseVariant(spinePhase)}>{SPINE_LABEL[spinePhase]}</Badge>
        <span className="text-[var(--tf-text-tertiary)]">{KATEGORIE_LABEL[kategorie]}</span>
        {terminal ? (
          <span className="text-[10.5px] px-1.5 py-[1px] rounded-full bg-[var(--tf-bg-secondary)] text-[var(--tf-text-secondary)]">
            terminal
          </span>
        ) : null}
      </div>

      {konflikt ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-[var(--tf-warning-text)]">
          <AlertTriangle size={13} aria-hidden="true" />
          <span>Widersprüchliche Statussignale</span>
        </div>
      ) : null}

      {fuehrenderWert ? (
        <div className="mt-2">
          <span className="text-[var(--tf-text-tertiary)]">Führt: </span>
          <span className="font-medium">{feldLabel(version, fuehrenderWert.feldId)}</span>
          <span className="text-[var(--tf-text-secondary)]"> = {fuehrenderWert.wert}</span>
        </div>
      ) : null}

      {/* Beiträge — berücksichtigte normal, übrige gedimmt mit Grund */}
      {beitraege.length > 0 ? (
        <ul className="mt-2 flex flex-col gap-0.5">
          {beitraege.map((b, i) => (
            <li
              key={`${b.feldId}:${b.tvId ?? ''}:${b.wert}:${i}`}
              className={`flex items-baseline gap-1.5 ${b.beruecksichtigt ? '' : 'opacity-50'}`}
            >
              <span className="text-[var(--tf-text-secondary)] shrink-0">{feldLabel(version, b.feldId)}</span>
              <span className="truncate">{b.wert}</span>
              <span className="text-[var(--tf-text-tertiary)] shrink-0">· {SPINE_LABEL[b.spinePhase]}</span>
              {!b.beruecksichtigt && b.grund ? (
                <span className="text-[var(--tf-text-tertiary)] shrink-0 italic">({GRUND_LABEL[b.grund]})</span>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}

      {/* Konflikt-Details */}
      {konflikt && konfliktDetails.length > 0 ? (
        <div
          className="mt-2 p-2 rounded-[var(--tf-radius)]"
          style={{ background: 'var(--tf-warning-bg)', border: '0.5px solid var(--tf-warning-border)' }}
        >
          <div className="text-[11px] font-medium text-[var(--tf-warning-text)] mb-1">Widerspruch</div>
          <ul className="flex flex-col gap-0.5">
            {konfliktDetails.map((k, i) => (
              <li
                key={`${k.feldId}:${k.tvId ?? ''}:${i}`}
                className="text-[var(--tf-warning-text)] flex items-baseline gap-1.5"
              >
                <span className="shrink-0">{feldLabel(version, k.feldId)}</span>
                <span className="truncate">{k.wert}</span>
                <span className="shrink-0">· {SPINE_LABEL[k.spinePhase]}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
