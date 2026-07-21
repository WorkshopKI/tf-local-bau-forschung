/**
 * Führungsleiste am Fuss des Prüfblatts.
 *
 * Zwei Fassungen: im Ablauf zählt sie „Schritt X von N · Phase M Name" und
 * bietet Zurück/Weiter samt Verweis auf den nächsten offenen Schritt; auf den
 * Konfigurations-Screens entfällt der Zähler und es bleibt der Rückweg.
 *
 * Rein darstellend — Index, Phase und nächster offener Schritt kommen fertig
 * aus `ansicht/schritte`.
 */
import { ArrowLeft, ArrowRight } from 'lucide-react';
import {
  istSchritt, phaseVonSchritt, SCHRITT_LABEL, SCHRITT_ORDER, schrittIndex,
  type AnsichtKey, type SchrittKey,
} from '../ansicht/schritte';

const KNOPF = [
  'inline-flex items-center gap-1.5 rounded-[var(--tf-radius)] px-3.5 py-2',
  'text-[12.5px] transition-colors cursor-pointer',
  'disabled:opacity-40 disabled:cursor-default',
].join(' ');

export function GuideLeiste({ aktiv, naechsterOffen, onWechsle }: {
  aktiv: AnsichtKey;
  naechsterOffen: SchrittKey | null;
  onWechsle: (key: AnsichtKey) => void;
}): React.ReactElement {
  const rahmen = 'shrink-0 flex items-center gap-3.5 px-7 py-2.5 bg-[var(--tf-card-surface,var(--tf-bg))]';
  const rahmenStil = { borderTop: '0.5px solid var(--tf-border)' };

  // --- Konfigurations-Screens: kein Schritt im Ablauf ---
  if (!istSchritt(aktiv)) {
    return (
      <div className={rahmen} style={rahmenStil}>
        <div className="flex-1 min-w-0">
          <div className="text-[12px] text-[var(--tf-text-secondary)]">
            Konfiguration · <b className="font-medium text-[var(--tf-text)]">{SCHRITT_LABEL[aktiv]}</b>
          </div>
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Wirkt auf neu gestartete Prüfungen — kein Schritt im Prüfablauf.
          </div>
        </div>
        <button
          type="button"
          className={`${KNOPF} bg-[var(--tf-sheet)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)]`}
          style={{ border: '0.5px solid var(--tf-border-hover)' }}
          onClick={() => onWechsle(naechsterOffen ?? 'kompakt')}
        >
          <ArrowLeft size={14} />
          Zurück zum Prüfablauf
        </button>
      </div>
    );
  }

  // --- Ablauf ---
  const idx = schrittIndex(aktiv);
  const phase = phaseVonSchritt(aktiv);
  const letzter = idx === SCHRITT_ORDER.length - 1;

  return (
    <div className={rahmen} style={rahmenStil}>
      <button
        type="button"
        className={`${KNOPF} bg-[var(--tf-sheet)] text-[var(--tf-text)] hover:bg-[var(--tf-hover)]`}
        style={{ border: '0.5px solid var(--tf-border-hover)' }}
        disabled={idx <= 0}
        onClick={() => onWechsle(SCHRITT_ORDER[idx - 1] as SchrittKey)}
      >
        <ArrowLeft size={14} />
        Zurück
      </button>

      <div className="flex-1 min-w-0 text-center">
        <div className="text-[12px] text-[var(--tf-text-secondary)]">
          Schritt <b className="font-medium text-[var(--tf-text)]">{idx + 1}</b> von {SCHRITT_ORDER.length}
          {' · '}Phase {phase.nummer} {phase.label}
        </div>
        {naechsterOffen !== null && naechsterOffen !== aktiv && (
          <div className="text-[11.5px] text-[var(--tf-text-tertiary)] truncate">
            Nächster offener Schritt: {SCHRITT_LABEL[naechsterOffen]}
          </div>
        )}
      </div>

      {/* Auf dem letzten Schritt gäbe „Weiter" nur einen Sprung auf sich
          selbst — dort bleibt die Stelle bewusst leer. */}
      {letzter
        ? <span className="w-[92px] shrink-0" aria-hidden="true" />
        : (
          <button
            type="button"
            className={`${KNOPF} bg-[var(--tf-primary)] text-[var(--tf-on-primary)] hover:bg-[var(--tf-primary)]`}
            onClick={() => onWechsle(SCHRITT_ORDER[idx + 1] as SchrittKey)}
          >
            Weiter
            <ArrowRight size={14} />
          </button>
        )}
    </div>
  );
}
