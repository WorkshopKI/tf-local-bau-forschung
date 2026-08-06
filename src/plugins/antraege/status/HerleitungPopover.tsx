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
 * - **Benennt die Ebene**: der Kopf sagt, WELCHEN Status er erklärt
 *   („Verbund-Status: 31 · beantragt"). Weicht die andere Ebene ab, steht sie in
 *   einer zweiten Zeile. Vorher las man dieselbe Erklärung in der Liste (TV) und
 *   im Detail (Verbund), ohne dass irgendwo stand, welcher gemeint war — und bei
 *   Ein-TV-Verbünden, wo man beide für dasselbe hält, war es am irreführendsten.
 */
import { Fragment, useState } from 'react';
import { Info, AlertTriangle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tooltip } from '@/components/ui/Tooltip';
import { useKopierAktion } from '@/core/hooks/useKopierAktion';
import { formatDatumsWert } from '@/core/services/csv/dateParse';
import {
  herleitungAlsText, sortiereRollen, ROLLE_LABEL, ROLLE_LANG,
  type Herleitung, type VerlaufSchritt,
} from '@/core/status';
import { ErklaerterSatz } from '@/components/vorgang/ErklaerterSatz';
import { useHerleitung, type AbweichendeEbene, type StatusEbene } from './useHerleitung';
import { useRichtlinienLabels, richtlinienLabel } from '@/core/hooks/useRichtlinienLabels';

const EBENE_LABEL: Record<StatusEbene, string> = {
  verbund: 'Verbund-Status',
  tv: 'TV-Status',
};

/** `YYYY-MM-DD` → `DD.MM.YYYY`; über die zentrale Kette. */
const tagDe = formatDatumsWert;

/**
 * Wer den Eintrag setzt — `AB/FB` bzw. `alle`, jedes Kürzel mit seinem Klartext.
 *
 * Angezeigt wird weiter `rollenLabel`s Schreibweise, Zeichen für Zeichen: die
 * Ids dienen nur der Erklärung, sie ersetzen den String nicht.
 */
function Rollen({ s }: { s: VerlaufSchritt }): React.ReactElement {
  if (s.rollenIds.length === 0) {
    return <Tooltip text="Kein Rollen-Vermerk in der Zuarbeit — jeder darf diesen Eintrag setzen.">
      <span className="cursor-help underline decoration-dotted decoration-[var(--tf-text-tertiary)] underline-offset-2">
        {s.rollen}
      </span>
    </Tooltip>;
  }
  return (
    <>
      {sortiereRollen([...s.rollenIds]).map((r, i) => (
        <Fragment key={r}>
          {i > 0 && '/'}
          <Tooltip text={ROLLE_LANG[r]}>
            <span
              tabIndex={0}
              aria-label={ROLLE_LANG[r]}
              className="cursor-help underline decoration-dotted decoration-[var(--tf-text-tertiary)] underline-offset-2"
            >
              {ROLLE_LABEL[r]}
            </span>
          </Tooltip>
        </Fragment>
      ))}
    </>
  );
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

/**
 * Die andere Ebene: nur Code, Text und Phase — kein „seit", weil die Liegezeit
 * an den Vorkommen der ERKLÄRTEN Ebene hängt und hier geraten wäre.
 */
function AndereEbeneZeile({ a }: { a: AbweichendeEbene }): React.ReactElement {
  const s = a.kurz;
  return (
    <div className="flex items-baseline gap-1.5 flex-wrap text-[11.5px] text-[var(--tf-text-secondary)]">
      <span className="text-[var(--tf-text-tertiary)]">{EBENE_LABEL[a.ebene]}:</span>
      {s.code !== null && <span className="font-mono">{s.code}</span>}
      <span>{s.statusText || '(kein Status)'}</span>
      {a.anzahl > 1 && (
        <span className="text-[var(--tf-text-tertiary)]">({a.anzahl} TV)</span>
      )}
      {s.nichtImKatalog
        ? <span className="text-[var(--tf-warning-text)]">· nicht im Katalog</span>
        : s.marker
          ? <span className="text-[var(--tf-text-tertiary)]">· Marker (ohne Phase)</span>
          : s.zahPhase !== null
            && <span className="text-[var(--tf-text-tertiary)]">· ZAH-Phase {s.zahPhaseLabel}</span>}
    </div>
  );
}

function Inhalt({ h, ebene, abweichend, weitere }: {
  h: Herleitung;
  ebene: StatusEbene;
  abweichend: AbweichendeEbene[];
  weitere: number;
}): React.ReactElement {
  const kopieren = useKopierAktion(
    () => herleitungAlsText(h, {
      ebeneLabel: EBENE_LABEL[ebene],
      abweichend: abweichend.map(a => ({
        label: EBENE_LABEL[a.ebene], kurz: a.kurz, anzahl: a.anzahl,
      })),
      weitere,
    }),
    'Herleitung kopieren',
  );
  const labels = useRichtlinienLabels();
  const v = h.letzterVorgang;

  return (
    <div className="flex flex-col gap-2 text-[12px]">
      <div className="flex flex-col gap-0.5">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="text-[var(--tf-text-tertiary)]">{EBENE_LABEL[ebene]}:</span>
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
        {abweichend.map(a => (
          <AndereEbeneZeile key={`${a.ebene}-${a.kurz.statusRoh}`} a={a} />
        ))}
        {weitere > 0 && (
          <span className="text-[11px] text-[var(--tf-text-tertiary)]">
            … {weitere} weitere abweichende Statuswerte
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
                {v.code && `${v.code} · `}{tagDe(v.tag)} · <Rollen s={v} />
              </span>
            </p>
            {v.text && (
              <p className="text-[11.5px] text-[var(--tf-text-tertiary)] italic">„{v.text}"</p>
            )}
            {v.trigger.length > 0 && (
              <ul className="mt-1 flex flex-col gap-0.5">
                {v.trigger.map(t => (
                  <li key={t.folge} className="text-[11.5px] text-[var(--tf-text-secondary)]">
                    → <ErklaerterSatz segmente={t.segmente} />
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
                Für „{richtlinienLabel(h.programm ?? '', labels)}" ({h.programm}) sind keine
                Trigger importiert.
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
          {/* Der Satz trennt jetzt belegt von genähert: DIESER Verlauf bleibt
              die Näherung aus den Datumsspalten. Was sich seit dem Nullpunkt
              wirklich geändert hat, steht unter „Belegte Änderungen" auf der
              Vorhaben-Seite — aus dem Import-Diff-Journal. */}
          <p className="mt-1 text-[10.5px] text-[var(--tf-text-tertiary)]">
            {h.verlaufGesamt > h.verlauf.length && `${h.verlaufGesamt - h.verlauf.length} weitere · `}
            Dieser Verlauf ist eine Näherung: die `D_`-Spalten tragen je Kürzel das zuletzt gesetzte
            Datum, frühere Setzungen sind im Export überschrieben. Belegte Änderungen ab dem
            Journal-Nullpunkt stehen auf der Vorhaben-Seite unter „Status &amp; Verlauf".
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

/**
 * @param ebene Welche Ebene der übergebene `statusRoh` ist. Der Aufrufer weiß
 *              es — die Liste zeigt den TV-Status, das Detail den
 *              Verbund-Status; das Bauteil rät nicht. Die jeweils andere Ebene
 *              liest der Hook selbst aus den geladenen Records.
 */
export function HerleitungPopover({ verbundId, statusRoh, ebene }: {
  verbundId: string | null;
  statusRoh: unknown;
  ebene: StatusEbene;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const stand = useHerleitung(verbundId, statusRoh, offen, ebene);

  return (
    <Popover open={offen} onOpenChange={setOffen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Warum dieser ${EBENE_LABEL[ebene]}?`}
          title={`Warum dieser ${EBENE_LABEL[ebene]}?`}
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
        {stand.herleitung && (
          <Inhalt
            h={stand.herleitung} ebene={ebene}
            abweichend={stand.abweichend} weitere={stand.weitere}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}
