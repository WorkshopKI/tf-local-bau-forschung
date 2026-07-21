/**
 * Befundliste mit Ampel. Rein darstellend — Schweregrad und Text kommen fertig
 * aus den Rechenchecks; diese Datei entscheidet nichts.
 *
 * Der Design-Handoff zeigt „2 von 4 Rechenchecks mit Hinweis". Diese Zahl gibt
 * es hier bewusst nicht: die Rechenchecks sammeln nur Befunde, bestandene
 * Prüfungen hinterlassen keinen Eintrag. Ein erfundener Nenner wäre genau der
 * Fehler, den der Prototyp an anderer Stelle macht — daher zählt die Leiste
 * ausschliesslich, was tatsächlich vorliegt.
 */
import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import type { MapSchwere, RechenBefund } from '../types';

const STIL: Record<MapSchwere, { farbe: string; Symbol: typeof AlertCircle; pille: string }> = {
  fehler: { farbe: 'var(--tf-danger-text)', Symbol: AlertCircle, pille: 'Fehler' },
  warnung: { farbe: 'var(--tf-warning-text)', Symbol: AlertTriangle, pille: 'Hinweis' },
  hinweis: { farbe: 'var(--tf-text-tertiary)', Symbol: Info, pille: 'Notiz' },
};

const PILLEN_BG: Record<MapSchwere, string> = {
  fehler: 'var(--tf-danger-bg)',
  warnung: 'var(--tf-warning-bg)',
  hinweis: 'var(--tf-hover)',
};

export function BefundAmpel({ befunde }: { befunde: readonly RechenBefund[] }): React.ReactElement {
  const fehler = befunde.filter(b => b.schwere === 'fehler').length;
  const warnungen = befunde.filter(b => b.schwere === 'warnung').length;

  if (befunde.length === 0) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--tf-text-secondary)]">
        <CheckCircle2 size={14} style={{ color: 'var(--tf-success-text)' }} />
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
      <p className="text-[13px] leading-[1.5] text-[var(--tf-text-secondary)]">
        Alle Rechenchecks sind ohne Befund: Kostensumme, Fördersatz, Personenmonate,
        Termine und die Personenmonats-Grenze je Arbeitspaket stimmen.
      </p>
    );
  }

  return (
    <ul className="flex flex-col">
      {befunde.map((b, i) => {
        const { farbe, Symbol, pille } = STIL[b.schwere];
        return (
          <li
            key={b.id}
            className="flex items-center gap-3 px-1 py-3"
            style={i === 0 ? undefined : { borderTop: '0.5px solid var(--tf-border)' }}
          >
            <span
              className="shrink-0 w-5 h-5 rounded-full grid place-items-center"
              style={{ background: farbe, color: 'var(--tf-on-primary)' }}
            >
              <Symbol size={12} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-medium text-[var(--tf-text)]">{b.titel}</p>
              <p className="text-[11.5px] text-[var(--tf-text-tertiary)] mt-0.5">
                erwartet: {b.erwartet} · gefunden: {b.gefunden}
              </p>
            </div>
            <span
              className="shrink-0 text-[10.5px] font-medium rounded-full px-2.5 py-0.5"
              style={{ background: PILLEN_BG[b.schwere], color: farbe }}
            >
              {pille}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
