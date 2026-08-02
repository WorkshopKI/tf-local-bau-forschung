/**
 * Das graue Info-Icon an jeder Status-Anzeige — „warum steht der Antrag hier?".
 *
 * Vollständig aus Daten gerendert (`baueHerleitung`), nie aus handgepflegtem
 * Text. Drei Eigenschaften sind Absicht:
 *
 * - **Kein Layout-Shift**: das Icon hat eine feste Breite und steht immer da,
 *   auch während geladen wird. Ein Icon, das erst nach dem Laden erscheint,
 *   verschiebt die Tabellenzeile unter dem Mauszeiger.
 * - **Lazy**: der Inhalt wird erst beim Öffnen geladen (`useHerleitung`), sonst
 *   ginge jede Listenzeile beim Rendern auf die IndexedDB.
 * - **Ehrlich**: unbekannter Status → Warnung statt Phase; fehlender Verlauf →
 *   Hinweis statt Leere; „Näherung" steht an der Näherung dran.
 */
import { useState } from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { useKopierAktion } from '@/core/hooks/useKopierAktion';
import { herleitungAlsText, type Herleitung, type VerlaufSchritt } from '@/core/status';
import { useHerleitung } from './useHerleitung';

/** `YYYY-MM-DD` → `DD.MM.YYYY`. */
function tagDe(tag: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(tag);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : tag;
}

function Zeile({ s }: { s: VerlaufSchritt }): React.ReactElement {
  return (
    <li className="flex items-baseline gap-1.5 min-w-0">
      <span className="shrink-0 text-[11px] font-mono text-[var(--tf-text-tertiary)] w-[68px]">
        {tagDe(s.tag)}
      </span>
      <span className="min-w-0 truncate text-[var(--tf-text-secondary)]" title={s.label}>
        {s.label}
      </span>
      {s.code && (
        <span className="shrink-0 text-[10.5px] font-mono text-[var(--tf-text-tertiary)]">{s.code}</span>
      )}
    </li>
  );
}

function Inhalt({ h }: { h: Herleitung }): React.ReactElement {
  const kopieren = useKopierAktion(() => herleitungAlsText(h), 'Herleitung kopieren');
  const v = h.letzterVorgang;

  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        {h.code !== null && (
          <span className="font-mono text-[13px] text-[var(--tf-text)]">{h.code}</span>
        )}
        <span className="text-[13px] font-medium text-[var(--tf-text)]">
          {h.statusText || '(kein Status)'}
        </span>
        {h.seit && (
          <span className="text-[var(--tf-text-tertiary)]">
            seit {tagDe(h.seit)}{h.tage !== null && ` (${h.tage} Tage)`}
          </span>
        )}
      </div>

      {h.nichtImKatalog ? (
        <p className="flex items-start gap-1.5 text-[var(--tf-warning-text)]">
          <AlertTriangle size={13} className="shrink-0 mt-[2px]" />
          <span>
            Statuswert nicht im Katalog (Katalog v{h.datenstand.katalogVersion}) — keine ZAH-Phase
            zugeordnet.
          </span>
        </p>
      ) : h.marker ? (
        <p className="text-[var(--tf-text-secondary)]">
          <Badge variant="default">Marker</Badge>{' '}
          läuft ohne Phase neben dem Verfahren.
        </p>
      ) : h.zahPhase === null ? (
        // „Keine Phase zugeordnet" ist etwas anderes als „Marker". Beides mit
        // demselben Satz zu beschriften behauptete eine Kuration, die es nicht
        // gibt — der Code ist bekannt, nur seine Einordnung fehlt noch.
        <p className="text-[var(--tf-text-tertiary)]">
          Diesem Code ist noch keine ZAH-Phase zugeordnet.
        </p>
      ) : (
        <p className="text-[var(--tf-text-secondary)]">ZAH-Phase: {h.zahPhaseLabel}</p>
      )}

      {h.joinArt === 'variante-lose' && (
        <p className="text-[11px] text-[var(--tf-text-tertiary)]">
          Über eine abweichende Schreibweise zugeordnet.
        </p>
      )}

      <div className="border-t border-[var(--tf-border)] pt-1.5">
        {v ? (
          <>
            <p className="text-[var(--tf-text-secondary)]">
              Letzter Vorgang:{' '}
              <span className="text-[var(--tf-text)]">{v.label}</span>{' '}
              <span className="text-[11px] text-[var(--tf-text-tertiary)]">
                {v.code && `${v.code} · `}{tagDe(v.tag)} · {v.rollen}
              </span>
            </p>
            {v.text && (
              <p className="text-[11.5px] text-[var(--tf-text-tertiary)] italic">„{v.text}"</p>
            )}
            {v.trigger.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5">
                {v.trigger.map(t => (
                  <li key={t.folge} className="text-[11.5px] text-[var(--tf-text-secondary)]">
                    → {t.satz}
                  </li>
                ))}
              </ul>
            )}
            {/* Warum hier keine Wirkung steht, ist eine Aussage — Schweigen
                sähe aus wie „dieses Kürzel löst nichts aus". */}
            {v.trigger.length === 0 && h.programm === null && (
              <p className="mt-1 text-[11.5px] text-[var(--tf-warning-text)]">
                Programm des Vorhabens unbekannt (Spalte FM_NUMMER nicht gemappt) — Trigger
                lassen sich nicht zuordnen.
              </p>
            )}
            {v.trigger.length === 0 && h.programmOhneTrigger && (
              <p className="mt-1 text-[11.5px] text-[var(--tf-warning-text)]">
                Für Programm {h.programm} sind keine Trigger importiert.
              </p>
            )}
          </>
        ) : (
          <p className="text-[var(--tf-text-tertiary)]">
            Letzter Vorgang: kein Datumseintrag gefunden.
          </p>
        )}
      </div>

      {h.verlauf.length > 0 && (
        <div className="border-t border-[var(--tf-border)] pt-1.5">
          <ul className="flex flex-col gap-0.5">
            {h.verlauf.map(s => <Zeile key={`${s.tag}-${s.label}`} s={s} />)}
          </ul>
          <p className="mt-1 text-[10.5px] text-[var(--tf-text-tertiary)]">
            {h.verlaufGesamt > h.verlauf.length && `${h.verlaufGesamt - h.verlauf.length} weitere · `}
            Verlauf ist eine Näherung aus den Datumsspalten.
          </p>
        </div>
      )}

      <div className="border-t border-[var(--tf-border)] pt-1.5 flex items-center gap-2 flex-wrap">
        <span className="text-[10.5px] text-[var(--tf-text-tertiary)]">
          Import{' '}
          {h.datenstand.importiertAm ? tagDe(h.datenstand.importiertAm.slice(0, 10)) : 'unbekannt'}
          {' · '}Katalog v{h.datenstand.katalogVersion}
          {h.datenstand.triggerVersion !== null
            ? ` · Trigger v${h.datenstand.triggerVersion}`
            : ' · Trigger nicht importiert'}
        </span>
        <button
          type="button"
          onClick={() => { void kopieren.run(); }}
          title={kopieren.titel}
          className="ml-auto text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer underline"
        >
          {kopieren.fehler ? '⚠ nicht kopiert' : kopieren.kopiert ? 'kopiert' : 'Herleitung kopieren'}
        </button>
      </div>
    </div>
  );
}

export function HerleitungPopover({ verbundId, statusRoh }: {
  verbundId: string | null;
  statusRoh: unknown;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const stand = useHerleitung(verbundId, statusRoh, offen);

  return (
    <Popover open={offen} onOpenChange={setOffen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Warum dieser Status?"
          title="Warum dieser Status?"
          // Feste Breite + `shrink-0`: das Icon darf die Zeile nie umbrechen
          // oder ihre Breite ändern, wenn der Inhalt nachlädt (Pitfall #14).
          // Grau über `--tf-text-tertiary`; ein `--tf-text-muted`, wie es
          // naheläge, gibt es global nicht — ein undefiniertes var() macht die
          // ganze Farb-Deklaration ungültig (v2.67.1-„nackt"-Falle).
          className="shrink-0 inline-flex w-[18px] h-[18px] items-center justify-center rounded text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer align-middle"
          onClick={e => { e.stopPropagation(); }}
        >
          <Info size={13} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start" className="w-[380px]"
        onClick={e => e.stopPropagation()}
      >
        {stand.laden && (
          <p className="text-[12px] text-[var(--tf-text-tertiary)]">Lädt …</p>
        )}
        {stand.fehler != null && (
          <p className="text-[12px] text-[var(--tf-danger-text)]">⚠ {stand.fehler}</p>
        )}
        {stand.herleitung && <Inhalt h={stand.herleitung} />}
      </PopoverContent>
    </Popover>
  );
}
