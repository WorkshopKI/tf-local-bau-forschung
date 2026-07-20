/**
 * Befundliste mit Ampel. Rein darstellend — Schweregrad und Text kommen fertig
 * aus den Rechenchecks; diese Datei entscheidet nichts.
 */
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { MapSchwere, RechenBefund } from '../types';

const STIL: Record<MapSchwere, { farbe: string; Symbol: typeof AlertCircle }> = {
  fehler: { farbe: 'var(--tf-danger, #dc2626)', Symbol: AlertCircle },
  warnung: { farbe: 'var(--tf-warning, #f59e0b)', Symbol: AlertTriangle },
  hinweis: { farbe: 'var(--tf-text-tertiary)', Symbol: Info },
};

export function BefundAmpel({ befunde }: { befunde: readonly RechenBefund[] }): React.ReactElement {
  const fehler = befunde.filter(b => b.schwere === 'fehler').length;
  const warnungen = befunde.filter(b => b.schwere === 'warnung').length;

  if (befunde.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--tf-text-secondary)]">
        <CheckCircle2 size={14} style={{ color: 'var(--tf-success, #16a34a)' }} />
        Rechenchecks ohne Befund
      </span>
    );
  }

  const teile = [
    fehler > 0 ? `${fehler} Fehler` : null,
    warnungen > 0 ? `${warnungen} Warnung${warnungen === 1 ? '' : 'en'}` : null,
  ].filter(Boolean);

  const { farbe, Symbol } = STIL[fehler > 0 ? 'fehler' : 'warnung'];
  return (
    <span className="inline-flex items-center gap-1.5 text-[12.5px]" style={{ color: farbe }}>
      <Symbol size={14} />
      {teile.join(' · ')}
    </span>
  );
}

export function BefundListe({ befunde }: { befunde: readonly RechenBefund[] }): React.ReactElement {
  if (befunde.length === 0) {
    return (
      <p className="text-[13px] text-[var(--tf-text-secondary)]">
        Alle Rechenchecks sind ohne Befund: Kostensumme, Fördersatz, Personenmonate,
        Termine und die Personenmonats-Grenze je Arbeitspaket stimmen.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {befunde.map(b => {
        const { farbe, Symbol } = STIL[b.schwere];
        return (
          <li
            key={b.id}
            className="rounded-[var(--tf-radius-md,8px)] px-3 py-2.5"
            style={{ border: '0.5px solid var(--tf-border)', borderLeft: `3px solid ${farbe}` }}
          >
            <div className="flex items-start gap-2">
              <Symbol size={15} style={{ color: farbe, flexShrink: 0, marginTop: 1 }} />
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-[var(--tf-text)]">{b.titel}</p>
                <p className="text-[12.5px] text-[var(--tf-text-secondary)] mt-0.5">
                  erwartet: {b.erwartet}
                </p>
                <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
                  gefunden: {b.gefunden}
                </p>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
