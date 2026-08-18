/**
 * Die Auswahl des Betrachtungsbereichs: drei Kurzwahlen plus die Programm-Liste.
 *
 * **Klartext führt, der Code steht daneben** — die Nummern älterer Richtlinien
 * kennt außerhalb der AB kaum jemand. Gespeichert werden trotzdem die Codes:
 * sie sind stabil, Bezeichnungen ändern sich mit jedem Label-Import.
 *
 * Der Einleitungssatz kommt vom Aufrufer: dieselbe Bedienung schneidet je nach
 * Chip den Arbeitsvorrat oder die Trefferliste der Suche.
 *
 * Gruppiert nach **Richtlinien-Generation**: das ist das Modell, in dem der
 * Fachbereich denkt („die letzten drei Richtlinien"), und es macht sichtbar,
 * warum der Chip ggf. keine Generationszahl mehr nennt — bei zwei von drei
 * Häkchen einer Gruppe sieht man den Grund an derselben Stelle.
 */
import { ToggleChip } from '@/components/ui/ToggleChip';
import {
  RICHTLINIEN_GENERATIONEN, generationenVon, gruppiereNachGeneration,
} from '@/core/status/betrachtungsbereich';
import { richtlinienLabel } from '@/core/hooks/useRichtlinienLabels';
import type { Bereich } from '@/core/hooks/useBereich';

/** Wie der Standard-Bereich in einem Satz heißt („12 Programme, Richtlinien …"). */
function standardText(standard: readonly string[]): string {
  const zahl = standard.length === 1 ? '1 Programm' : `${standard.length} Programme`;
  const { jahre, exakt } = generationenVon(standard);
  return exakt ? `${zahl}, Richtlinien ${jahre.join(' + ')}` : zahl;
}

export function BereichPanel({ bereich, labels, einleitung }: {
  bereich: Bereich;
  labels: ReadonlyMap<string, string>;
  /** Was diese Auswahl bewirkt. Der Satz gehoert dem Aufrufer: der
   *  Betrachtungsbereich schneidet den Arbeitsvorrat, die Richtlinien-Auswahl
   *  der Suche die Trefferliste — dieselbe Bedienung, zwei Wirkungen. */
  einleitung?: React.ReactNode;
}): React.ReactElement {
  // Angehakt ist, was gilt — außer in der Stufe „alle", wo alles gilt und die
  // Liste deshalb den Standard-Bereich als Bezugsrahmen zeigt.
  const eigene = bereich.modus === 'alle' ? bereich.standard : bereich.programme;
  // In der Stufe „alle" stehen ALLE bekannten Generationen in der Liste, nicht
  // nur die des Standard-Bereichs: sonst zeigte das Panel zwölf angehakte
  // Programme, während sechzehn gelten — vier davon unsichtbar. Ein Haken, der
  // mehr behauptet als er zeigt, ist schlimmer als keiner.
  const gruppen = gruppiereNachGeneration([...new Set([
    ...(bereich.modus === 'alle' ? RICHTLINIEN_GENERATIONEN.flatMap(g => g.programme) : []),
    ...bereich.standard,
    ...eigene,
  ])]);
  // Eine eigene Auswahl überlebt jede Änderung des Standard-Bereichs — sie
  // gehört der Person. Damit sie nicht STILL veraltet, sagt das Panel, wovon
  // sie abweicht; der „Standard-Bereich"-Chip darüber ist der Rückweg.
  const weichtVomStandardAb = bereich.modus === 'auswahl'
    && [...bereich.programme].sort().join('|') !== [...bereich.standard].sort().join('|');

  return (
    <div className="flex flex-col gap-2.5">
      {einleitung !== undefined && (
        <p className="text-[12px] text-[var(--tf-text-secondary)]">{einleitung}</p>
      )}

      {/* Reihenfolge: der Rückweg links, daneben die Verengung, rechts die
          Erweiterung. „Aktuelle Richtlinie" ist eine eigene Stufe und keine
          vorgesetzte Häkchen-Liste — sonst hieße der Chip „eigene Auswahl" und
          zeigte 2030 noch auf die Programme von 2025. */}
      {/* `px-2.5` statt der Chip-Vorgabe `px-3`: die drei Beschriftungen
          brauchen zusammen 380 px (gemessen) und passen damit in EINE Zeile.
          Umgebrochen stünde die Erweiterung unter der Verengung und läse sich
          wie deren Unterpunkt. */}
      <div className="flex flex-wrap gap-1.5">
        <ToggleChip
          className="px-2.5" label="Standard-Bereich" selected={bereich.modus === 'standard'}
          onToggle={() => bereich.setModus('standard')}
        />
        <ToggleChip
          className="px-2.5" label="Aktuelle Richtlinie" selected={bereich.modus === 'aktuell'}
          onToggle={() => bereich.setModus('aktuell')}
        />
        <ToggleChip
          className="px-2.5" label="Alle Richtlinien" selected={bereich.modus === 'alle'}
          onToggle={() => bereich.setModus('alle')}
        />
      </div>

      {/* **Zwei Spalten, damit nichts scrollt.** Untereinander braucht die
          volle Liste (16 Programme + 4 Überschriften) 440 px und lag damit
          unter jeder Popover-Kante; nebeneinander sind es 246 px. Eine Gruppe
          bleibt dabei ganz — deshalb ein Raster mit den Generationen als
          Zellen und nicht `columns-2`, das mitten in eine Generation umbricht.
          `flex-1 min-h-0` ist die Reißleine: das Popover ist auf die von Radix
          gemessene Resthöhe gedeckelt, und die Liste nimmt sich davon, was
          Einleitung und Kurzwahlen übrig lassen. Sie scrollt also erst, wenn
          der Platz wirklich nicht reicht — ein fester Deckel hier wäre auf
          jedem zweiten Bildschirm der falsche. */}
      <div className="grid grid-cols-2 gap-x-5 gap-y-1 items-start flex-1 min-h-0 overflow-y-auto">
        {eigene.length === 0 && (
          <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
            Keine Programme im Bereich.
          </p>
        )}
        {gruppen.map(gruppe => (
          <div key={gruppe.titel} className="flex flex-col gap-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--tf-text-tertiary)]">
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
                  {/* `title` als Reißleine: die Breite ist auf den heute
                      längsten Namen gemessen — ein künftiger Label-Import darf
                      dann kürzen, aber nicht verschweigen. */}
                  <span className="truncate" title={richtlinienLabel(code, labels)}>
                    {richtlinienLabel(code, labels)}
                  </span>
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
