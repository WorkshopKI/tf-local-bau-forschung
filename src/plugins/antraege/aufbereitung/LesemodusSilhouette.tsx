/**
 * Schmale Silhouette-Scroll-Navigation des Lesemodus (Paket 5, Phase 5). Ein Block je
 * Ebene-1-Kapitel, Höhe ∝ Zeichenanteil (geteilter `baueSilhouetteBloecke`-Kern). Der
 * Block, der den aktuellen Viewport-Abschnitt enthält, ist hervorgehoben; Klick scrollt
 * zur Sektion. Monochrom — Hervorhebung nur über `--tf-primary` (Selektion).
 */
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { VbSektion } from './gliederung';
import { baueSilhouetteBloecke, findeL1Block } from './silhouette-core';

const H_TARGET = 420; // Zielhöhe für 100 % Anteil (etwas kompakter als die Abdeckungs-Silhouette)
const MIN_ROW = 10;

export function LesemodusSilhouette({
  gliederung, aktiveSektionId, onJump,
}: {
  gliederung: VbSektion[];
  aktiveSektionId: string | null;
  onJump: (sektionId: string) => void;
}): React.ReactElement | null {
  const bloecke = useMemo(() => baueSilhouetteBloecke(gliederung), [gliederung]);
  const aktiverBlock = useMemo(
    () => (aktiveSektionId ? findeL1Block(gliederung, aktiveSektionId, bloecke) : null),
    [gliederung, aktiveSektionId, bloecke],
  );
  if (bloecke.length === 0) return null;

  return (
    <div className="hidden lg:flex w-8 shrink-0 flex-col gap-[2px] sticky top-4 self-start">
      {bloecke.map(b => {
        const aktiv = aktiverBlock?.sektion.id === b.sektion.id;
        return (
          <button
            key={b.sektion.id}
            type="button"
            onClick={() => onJump(b.sektion.id)}
            title={`${b.sektion.nummer ? `${b.sektion.nummer} ` : ''}${b.sektion.titel}`}
            aria-label={`Zu Abschnitt ${b.sektion.nummer ?? b.sektion.titel} springen`}
            className={cn('w-full rounded-[2px] transition-colors', aktiv ? '' : 'hover:opacity-80')}
            style={{
              height: Math.max(MIN_ROW, b.anteil * H_TARGET),
              background: aktiv ? 'var(--tf-primary)' : 'var(--tf-bg-secondary)',
              border: '0.5px solid var(--tf-border)',
            }}
          />
        );
      })}
    </div>
  );
}
