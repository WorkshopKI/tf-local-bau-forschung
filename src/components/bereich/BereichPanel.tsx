/**
 * Die Auswahl des Betrachtungsbereichs: drei Stufen plus die Programm-Liste.
 *
 * **Klartext führt, der Code steht daneben** — die Nummern älterer Richtlinien
 * kennt außerhalb der AB kaum jemand. Gespeichert werden trotzdem die Codes:
 * sie sind stabil, Bezeichnungen ändern sich mit jedem Label-Import.
 */
import { ToggleChip } from '@/components/ui/ToggleChip';
import { richtlinienLabel } from '@/core/hooks/useRichtlinienLabels';
import type { Bereich } from '@/core/hooks/useBereich';

export function BereichPanel({ bereich, labels }: {
  bereich: Bereich;
  labels: ReadonlyMap<string, string>;
}): React.ReactElement {
  const eigene = bereich.modus === 'auswahl' ? bereich.programme : bereich.standard;

  return (
    <div className="flex flex-col gap-2.5">
      <p className="text-[12px] text-[var(--tf-text-secondary)]">
        Der Bereich bestimmt den <strong>Arbeitsvorrat</strong>: Listen, Zähler, Fristen und
        Auslastung. Die <strong>Suche bleibt am Vollbestand</strong>, und ein Antrag lässt sich
        immer direkt öffnen — auch außerhalb des Bereichs.
      </p>

      <div className="flex flex-wrap gap-1.5">
        <ToggleChip
          label="Standard-Bereich" selected={bereich.modus === 'standard'}
          onToggle={() => bereich.setModus('standard')}
        />
        <ToggleChip
          label="Alle Richtlinien" selected={bereich.modus === 'alle'}
          onToggle={() => bereich.setModus('alle')}
        />
      </div>

      <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto">
        {eigene.length === 0 && (
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Keine Programme im Bereich.
          </p>
        )}
        {[...new Set([...bereich.standard, ...eigene])].map(code => {
          const an = bereich.modus === 'alle' || eigene.includes(code);
          return (
            <label
              key={code}
              className="flex items-center gap-2 text-[12px] text-[var(--tf-text)] cursor-pointer"
            >
              <input
                type="checkbox" className="accent-[var(--tf-primary)] cursor-pointer"
                checked={an} disabled={bereich.modus === 'alle'}
                onChange={e => {
                  const next = e.target.checked
                    ? [...eigene, code]
                    : eigene.filter(c => c !== code);
                  bereich.setAuswahl(next);
                }}
              />
              <span className="truncate">{richtlinienLabel(code, labels)}</span>
              <span className="ml-auto text-[11px] font-mono text-[var(--tf-text-tertiary)]">{code}</span>
            </label>
          );
        })}
      </div>

      {bereich.weichtVomSeedAb && (
        <p className="text-[11.5px] text-[var(--tf-warning-text)]">
          ⚠ Die Bereichs-Definition im Status-Katalog weicht vom ausgelieferten Stand ab — sie
          wirkt in den schlanken Varianten (prod/as) erst mit dem nächsten Release.
        </p>
      )}
    </div>
  );
}
