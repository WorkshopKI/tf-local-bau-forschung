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
import { useNavigation } from '@/core/hooks/useNavigation';
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

/**
 * Was in der Pille steht — und woher es kommt.
 *
 * Die Zeile beantwortet die Frage, die ein Kurator hier stellt: ist diese
 * Kurzform von uns, kommt sie mit der Auslieferung, oder ist gar keine gepflegt
 * und die App behilft sich mit dem gekürzten Bezeichner? Der dritte Fall ist
 * bewusst als **unfertig** benannt und nicht kaschiert — er gehört auf die
 * Kurzlabel-Pflegeliste in den Vorgangs-Regeln.
 *
 * Weggelassen, wo sie nichts sagt: deckt sich die Kurzform mit dem vollen
 * Bezeichner darüber, wäre sie eine Wiederholung.
 */
function KurzformZeile({ h }: { h: Herleitung }): React.ReactElement | null {
  if (h.statusRoh === '') return null;
  const voll = h.statusText || h.statusRoh;
  if (h.kurzLabelHerkunft === 'katalog' && h.kurzLabel === voll) return null;
  const herkunft = h.kurzLabelHerkunft === 'fassung'
    ? `aus der Katalog-Fassung v${h.datenstand.katalogVersion}`
    : h.kurzLabelHerkunft === 'katalog'
      ? 'aus der Auslieferung'
      : 'kein Kurzlabel gepflegt — gekürzter Bezeichner';
  return (
    <div className="flex items-baseline gap-1.5 flex-wrap text-[11.5px]">
      <span className="text-[var(--tf-text-tertiary)]">Kurzform:</span>
      <span className="text-[var(--tf-text-secondary)]">{h.kurzLabel}</span>
      <span
        className={h.kurzLabelHerkunft === 'ohne'
          ? 'text-[var(--tf-warning-text)]'
          : 'text-[var(--tf-text-tertiary)]'}
      >
        · {herkunft}
      </span>
    </div>
  );
}

/**
 * Der Weg vom Statuscode ins Glossar — dorthin, wo der Code seine Bezeichnung,
 * seinen Verfahrensschritt und seine Zieltage hat. Steht in der Fußzeile neben
 * „Herleitung kopieren", nicht als vierter Knopf oben: die Frage entsteht beim
 * LESEN, aber sie ist nicht die dringlichste.
 */
function GlossarLink({ code }: { code: number | null }): React.ReactElement | null {
  const { navigate } = useNavigation();
  if (code === null) return null;
  return (
    <button
      type="button"
      onClick={() => navigate('glossar')}
      title={`Status ${code} im Glossar nachschlagen`}
      className="text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer underline"
    >
      im Glossar
    </button>
  );
}

function Inhalt({ h, ebene, abweichend, weitere, onGanzenVerlauf }: {
  h: Herleitung;
  ebene: StatusEbene;
  abweichend: AbweichendeEbene[];
  weitere: number;
  /** Öffnet den aufgeklappten Bereich der Zeile. Fehlt auf der Detailseite —
   *  dort steht die Verlaufs-Sektion ohnehin auf der Seite. */
  onGanzenVerlauf?: () => void;
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
        <KurzformZeile h={h} />
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

      {/* Die „Verlaufs-Näherung (max. 5)" ist mit v3.21 hier raus. Fünf von
          durchschnittlich 33 Terminen waren ein Ausschnitt ohne Auswahlregel —
          und die Eskalationsleiter ist jetzt eindeutig: das Popover sagt, WAS
          der Status ist, der aufgeklappte Bereich sagt, WIE es dazu kam. Die
          Engine rechnet `verlauf` weiter (der kopierte Text ist ein Protokoll
          und behält ihn), nur angezeigt wird er nicht mehr. */}
      {/* OHNE Zahl (v4.124): `verlaufGesamt` ist die Chronik MINUS den Eintrag,
          der eine Zeile darüber schon als „Letzter Vorgang" steht — also
          systematisch um mindestens 1 zu klein. Und sie zählt eine andere
          Einheit als das Ziel: der Knopf öffnet den Reiter „Zeitverlauf", der
          Bahnen zeichnet, keine Termine. Eine Zahl ist eine Zusage; ungedeckt
          lieber keine. Zusätzlich entfällt die Bedingung `> 0`: sonst gab es
          bei genau einem relevanten Termin überhaupt keinen Weg dorthin. */}
      {onGanzenVerlauf !== undefined && (
        <div className="border-t border-[var(--tf-border)] pt-1.5">
          <button
            type="button"
            onClick={onGanzenVerlauf}
            className="text-[11.5px] text-[var(--tf-text-secondary)] hover:text-[var(--tf-text)] cursor-pointer underline"
          >
            Ganzen Verlauf zeigen
          </button>
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
        <span className="ml-auto flex items-center gap-2.5">
          <GlossarLink code={h.code} />
          <button
            type="button"
            onClick={() => { void kopieren.run(); }}
            title={kopieren.titel}
            className="text-[11px] text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] cursor-pointer underline"
          >
            {kopieren.fehler ? '⚠ nicht kopiert' : kopieren.kopiert ? 'kopiert' : 'Herleitung kopieren'}
          </button>
        </span>
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
export function HerleitungPopover({
  verbundId, statusRoh, ebene, aktenzeichen, onGanzenVerlauf, umfang,
}: {
  verbundId: string | null;
  statusRoh: unknown;
  ebene: StatusEbene;
  /** Bei `ebene: 'tv'` das erklärte Teilvorhaben — sonst rechnete die
   *  Erklärung über alle TVs des Verbundes (siehe `useHerleitung`). */
  aktenzeichen?: string | null;
  /** Öffnet den ausklappbaren Bereich der Tabellenzeile. Ohne die Prop zeigt
   *  das Popover keinen Verweis — auf der Detailseite gäbe es kein Ziel. */
  onGanzenVerlauf?: () => void;
  /**
   * Wie groß der Verlauf dieses Vorgangs ist („17 Schritte · 39 Datumsangaben").
   * Auf der Detailseite steht die Zahl seit v4.13x hier statt in einer eigenen
   * Zeile unter der Überschrift.
   *
   * Bewusst `ReactNode` und nicht `VerlaufKennzahlen`: dasselbe Popover hängt
   * an jeder Tabellenzeile (`tableColumns.tsx`), und dort gibt es weder eine
   * Chronik noch ihre Kennzahlen. Ohne die Prop ändert sich dort nichts.
   */
  umfang?: React.ReactNode;
}): React.ReactElement {
  const [offen, setOffen] = useState(false);
  const stand = useHerleitung(verbundId, statusRoh, offen, ebene, aktenzeichen ?? null);

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
            {...(onGanzenVerlauf
              ? { onGanzenVerlauf: () => { setOffen(false); onGanzenVerlauf(); } }
              : {})}
          />
        )}
        {/* Der Umfang steht UNTER der Herleitung und außerhalb von `Inhalt`:
            gefragt wurde nach dem Status, die Größe des Verlaufs ist die
            Beigabe. Außerhalb, weil er nicht am Ladezustand des Hooks hängt —
            der Aufrufer hat die Zahl längst, während `useHerleitung` noch
            nachlädt. */}
        {umfang !== undefined && (
          <div className="mt-2 flex items-baseline gap-2 border-t border-[var(--tf-border)] pt-1.5">
            <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">Verlauf:</span>
            {umfang}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
