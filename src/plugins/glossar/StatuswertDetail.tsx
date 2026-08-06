/**
 * Ein Statuswert, lesend: was er heißt, wo er im Verfahren steht, wer dann am
 * Zug ist, wie lange er stehen darf und wie oft er im Bestand vorkommt — dazu
 * „Wodurch dieser Status entsteht".
 *
 * Der Herkunfts-Block ist derselbe wie in den Vorgangs-Regeln, nicht ein zweiter
 * mit derselben Aussage. Er bringt seine drei ehrlichen Zustände selbst mit
 * (Trigger-Tabelle fehlt / kein Weg bekannt / Liste je Kürzel).
 */
import { StatusHerkunftBlock } from '@/components/vorgang/StatusHerkunftBlock';
import { Badge } from '@/components/ui/badge';
import type { MappingVersion, TriggerStand } from '@/core/status';
import type { StatuswertZeile } from './glossarZeilen';
import { Abschnitt, DetailKopf, Feld, Felder } from './GlossarFelder';

export function StatuswertDetail({ zeile, version, trigger }: {
  zeile: StatuswertZeile;
  version: MappingVersion;
  trigger: TriggerStand | null;
}): React.ReactElement {
  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-6 py-5">
      <DetailKopf titel={`Status ${zeile.code}`} unter={zeile.label} />

      <Felder>
        <Feld label="Verfahrensschritt">
          {zeile.phaseId === null
            ? <span className="flex items-center gap-1.5">
                <Badge variant="default">Marker</Badge>
                <span className="text-[var(--tf-text-secondary)]">
                  läuft ohne Schritt neben dem Verfahren
                </span>
              </span>
            : zeile.phaseLabel}
        </Feld>
        <Feld label="Arbeitsliste">{zeile.kategorieLabel}</Feld>
        <Feld
          label="Zieltage"
          // `null` ist NICHT null Tage: der Wächter urteilt dann „nicht prüfbar".
          leer="keine gepflegt — Stillstand ist für diesen Status nicht prüfbar"
        >
          {zeile.zieltage !== null ? `${zeile.zieltage} Tage ohne Vorgangs-Aktivität` : ''}
        </Feld>
        <Feld
          label="Vorkommen"
          leer="wird gezählt …"
        >
          {zeile.vorkommen !== null
            ? `${zeile.vorkommen.toLocaleString('de-DE')} Vorgänge im Bestand`
            : ''}
        </Feld>
      </Felder>

      {trigger !== null && (
        <StatusHerkunftBlock code={zeile.code} version={version} trigger={trigger} />
      )}
      {trigger === null && (
        <Abschnitt titel="Wodurch dieser Status entsteht">
          <p className="text-[12.5px] text-[var(--tf-text-secondary)]">
            Die Trigger-Tabelle wird noch geladen.
          </p>
        </Abschnitt>
      )}
    </div>
  );
}
