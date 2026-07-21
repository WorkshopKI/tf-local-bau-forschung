/**
 * Wirkungskette: Problem → Ergebnis → Verwertung → Wirkung, waagerecht.
 *
 * Die Richtwert-Anzeigen darunter sind deterministisch — sie rechnen gegen die
 * importierten Projektkosten und unterscheiden ausdrücklich zwischen „verfehlt"
 * und „nicht beziffert". Ein fehlender Wert ist etwas anderes als ein
 * verfehlter.
 *
 * Rein darstellend.
 */
import { ChevronRight } from 'lucide-react';
import type { RichtwertBefund, RichtwertLage } from '../infografik/richtwerte';
import type { Wirkungskette, WirkungsGlied } from '../infografik/schema';

const GLIEDER: ReadonlyArray<{ key: keyof Wirkungskette; titel: string }> = [
  { key: 'problem', titel: 'Problem' },
  { key: 'ergebnis', titel: 'Ergebnis' },
  { key: 'verwertung', titel: 'Verwertung' },
  { key: 'wirkung', titel: 'Wirkung' },
];

const LAGE_STIL: Record<RichtwertLage, { label: string; farbe: string }> = {
  erfuellt: { label: 'erfüllt', farbe: 'var(--tf-success-text)' },
  verfehlt: { label: 'verfehlt', farbe: 'var(--tf-danger-text)' },
  'nicht-quantifiziert': { label: 'nicht beziffert', farbe: 'var(--tf-warning-text)' },
};

function Glied({ titel, glied }: { titel: string; glied: WirkungsGlied }): React.ReactElement {
  const vage = glied.belegtheit !== 'belegt';
  return (
    <div
      className="rounded-[var(--tf-radius-md,8px)] px-3 py-2.5 flex-1 min-w-[160px]"
      style={vage
        ? { border: '1px dashed var(--tf-warning-text)' }
        : { border: '0.5px solid var(--tf-border)' }}
    >
      <p className="text-[11.5px] font-medium text-[var(--tf-text)] uppercase tracking-wide">{titel}</p>
      {glied.text.length === 0 ? (
        <p className="text-[12px] mt-1" style={{ color: 'var(--tf-warning-text)' }}>
          <em>In der Vorhabensbeschreibung nicht belegt.</em>
        </p>
      ) : (
        <>
          <p className="text-[12px] text-[var(--tf-text-secondary)] leading-relaxed mt-1">
            {glied.text}
          </p>
          {glied.zahlenziel != null && (
            <p className="text-[12px] font-medium text-[var(--tf-text)] mt-1 tabular-nums">
              {glied.zahlenziel}
            </p>
          )}
          {vage && (
            <p className="text-[10.5px] mt-1" style={{ color: 'var(--tf-warning-text)' }}>
              nur vage belegt
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function WirkungsketteAnsicht({
  kette, richtwerte,
}: {
  kette: Wirkungskette;
  richtwerte: readonly RichtwertBefund[];
}): React.ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-stretch gap-1.5">
        {GLIEDER.map((g, i) => (
          <div key={g.key} className="flex items-center gap-1.5 flex-1 min-w-[160px]">
            <Glied titel={g.titel} glied={kette[g.key]} />
            {i < GLIEDER.length - 1 && (
              <ChevronRight size={16} className="text-[var(--tf-text-tertiary)] shrink-0" />
            )}
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-1.5">
        <h4 className="text-[11.5px] font-medium text-[var(--tf-text-secondary)] uppercase tracking-wide">
          Richtwerte der Fachprüfung
        </h4>
        {richtwerte.map(r => {
          const stil = LAGE_STIL[r.lage];
          return (
            <div
              key={r.id}
              className="rounded px-3 py-2"
              style={{ border: '0.5px solid var(--tf-border)', borderLeft: `3px solid ${stil.farbe}` }}
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12.5px] text-[var(--tf-text)]">{r.titel}</span>
                <span className="text-[11.5px] shrink-0" style={{ color: stil.farbe }}>{stil.label}</span>
              </div>
              <p className="text-[11.5px] text-[var(--tf-text-secondary)] mt-0.5">{r.erlaeuterung}</p>
            </div>
          );
        })}
      </section>
    </div>
  );
}
