/**
 * Die Auswahl des Betrachtungsbereichs: drei Stufen plus die Programm-Liste.
 *
 * **Klartext führt, der Code steht daneben** — die Nummern älterer Richtlinien
 * kennt außerhalb der AB kaum jemand. Gespeichert werden trotzdem die Codes:
 * sie sind stabil, Bezeichnungen ändern sich mit jedem Label-Import.
 *
 * Gruppiert nach **Richtlinien-Generation**: das ist das Modell, in dem der
 * Fachbereich denkt („die letzten drei Richtlinien"), und es macht sichtbar,
 * warum der Chip ggf. keine Generationszahl mehr nennt — bei zwei von drei
 * Häkchen einer Gruppe sieht man den Grund an derselben Stelle.
 */
import { ToggleChip } from '@/components/ui/ToggleChip';
import { generationenVon, gruppiereNachGeneration } from '@/core/status/betrachtungsbereich';
import { richtlinienLabel } from '@/core/hooks/useRichtlinienLabels';
import type { Bereich } from '@/core/hooks/useBereich';

/** Wie der Standard-Bereich in einem Satz heißt („12 Programme, Richtlinien …"). */
function standardText(standard: readonly string[]): string {
  const zahl = standard.length === 1 ? '1 Programm' : `${standard.length} Programme`;
  const { jahre, exakt } = generationenVon(standard);
  return exakt ? `${zahl}, Richtlinien ${jahre.join(' + ')}` : zahl;
}

export function BereichPanel({ bereich, labels }: {
  bereich: Bereich;
  labels: ReadonlyMap<string, string>;
}): React.ReactElement {
  const eigene = bereich.modus === 'auswahl' ? bereich.programme : bereich.standard;
  const gruppen = gruppiereNachGeneration([...new Set([...bereich.standard, ...eigene])]);
  // Eine eigene Auswahl überlebt jede Änderung des Standard-Bereichs — sie
  // gehört der Person. Damit sie nicht STILL veraltet, sagt das Panel, wovon
  // sie abweicht; der „Standard-Bereich"-Chip darüber ist der Rückweg.
  const weichtVomStandardAb = bereich.modus === 'auswahl'
    && [...bereich.programme].sort().join('|') !== [...bereich.standard].sort().join('|');

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

      {/* 320px, nicht 260: mit drei Gruppen-Überschriften braucht die Liste
          307 px (gemessen). Bei 260 lag die zuletzt ergänzte Generation unter
          der Kante — genau die, deren Vorhandensein man hier nachsieht. */}
      <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
        {eigene.length === 0 && (
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Keine Programme im Bereich.
          </p>
        )}
        {gruppen.map(gruppe => (
          <div key={gruppe.titel} className="flex flex-col gap-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--tf-text-tertiary)] mt-1 first:mt-0">
              {gruppe.titel}
            </p>
            {gruppe.programme.map(code => {
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
        ))}
      </div>

      {weichtVomStandardAb && (
        <p className="text-[11.5px] text-[var(--tf-text-secondary)]">
          Ihre Auswahl weicht vom Standard-Bereich ab ({standardText(bereich.standard)}).
        </p>
      )}

      {bereich.weichtVomSeedAb && (
        <p className="text-[11.5px] text-[var(--tf-warning-text)]">
          ⚠ Die Bereichs-Definition im Status-Katalog weicht vom ausgelieferten Stand ab — sie
          wirkt in den schlanken Varianten (prod/as) erst mit dem nächsten Release.
        </p>
      )}
    </div>
  );
}
