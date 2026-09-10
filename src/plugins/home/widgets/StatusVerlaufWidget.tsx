/**
 * Status & Verlauf (Home-Widget, Hauptbereich).
 *
 * Zeigt je Verbund die **ZAH-Phase des amtlichen VERBUND-Status**, einen
 * Mini-Verlauf (die letzten sichtbaren Status-Events) und die Aufgabe aus der
 * To-do-Kaskade. Die Zeile darüber („Meine Anträge") zeigt den Stand der
 * TEILVORHABEN — beide dürfen auseinanderlaufen, deshalb sagt die Marke, welche
 * Ebene sie meint (v4.132). Read-only +
 * strikt gerätelokal: liest ausschließlich via `idb.get`
 * (getVerbund/getStatusEvents) und die REINE Status-API
 * (@/core/status) — kein Share-/Snapshot-/Mirror-Write (Guard
 * `home-widgets-local-only`). Die Status-Logik wird NICHT dupliziert, nur
 * konsumiert (analog `useStatusVerlauf` der Verbund-Detailseite).
 *
 * Bis v2.383 stand hier die abgeleitete Spine-Phase, ein Konflikt-Badge und ein
 * Schritt aus den fünf handgeschriebenen Alt-Regeln. Alle drei haben Nachfolger,
 * die näher an den Daten sitzen: die Phase am amtlichen Code, der Widerspruch im
 * Herleitungs-Popover (als Auskunft, nicht als Warnung), das To-do in der
 * Kaskade des Vorgangssystems.
 *
 * Datenbasis: der einmal berechnete Dashboard-Aggregat
 * (`ctx.data.meineAntraege`) — bereits bearbeiter-gescoped, verbund-geclustert
 * (ein Eintrag je `verbund_id`) und frist-sortiert. Der „alle"/Team-Modus ist
 * damit ein First-Class-Zustand (`ctx.data.bearbeiterFilterActive === false`);
 * die Meta-Zeile macht ihn sichtbar. Gekappt auf die ersten ~8 (kritischste
 * Frist zuerst) — nur für diese wird geladen.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';
import { getVerbund } from '@/core/services/csv/idb-csv';
import { useZeilenAufgaben, type ZeilenAufgaben } from '@/core/hooks/useBestandsAufgaben';
import { isStatusCockpitEnabled } from '@/config/feature-flags';
import { QuellSpaltenTooltip } from '@/components/quellspalten';
import { feldQuellen } from '@/core/status/bedingung-quellen';
import {
  getAktiveVersion, getStatusEvents, aufgabenAnzeige,
  zahPhaseLabel, zahPhaseFuerStatusText,
  sortiereEvents, eventProminenz, eventZeitMs, feldLabel,
  type MappingVersion, type StatusEvent, type ZahPhaseId,
} from '@/core/status';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

/** Anzeige-Kappung: die kritischsten (frist-sortierten) Verbünde zuerst. */
const MAX_ZEILEN = 8;
/** Anzahl Punkte im Mini-Verlauf (jüngste zuerst). */
const MINI_VERLAUF = 3;

interface Verbundzeile {
  verbundId: string;
  akronym: string;
  titel: string;
  /** Die Teilvorhaben, für die diese Zeile steht — Grundlage der Aufgabe. */
  tvAktenzeichen: string[];
}

interface ZeileDaten {
  /** ZAH-Phase des amtlichen Verbund-Status; `null` = Marker oder nicht im Katalog. */
  phase: ZahPhaseId | null;
  events: StatusEvent[];
}

/**
 * Lädt den **Verbund-Status** und die Historie je (gekapptem) Verbund. Nur aktiv,
 * wenn das Widget ausgeklappt ist (`aktiv`) — der WidgetShell-Body existiert
 * eingeklappt gar nicht. Abbruch-sicher gegen Unmount / ID-Wechsel.
 *
 * **Das To-do kommt seit v4.132 NICHT mehr von hier.** Dieses Widget wertete die
 * Kaskade selbst aus — mit eigener Schema-Auflösung und, weil `opts.rolle`
 * fehlte, immer im AB-Regelsatz, ohne das zu sagen. Es liest jetzt dieselbe
 * Ablage wie die Zeile darüber und das Vorgangs-Board
 * ([useBestandsAufgaben](../../../core/hooks/useBestandsAufgaben.ts)); übrig
 * bleibt hier, was nur hier gebraucht wird: der Verbund-Status und die Events.
 */
function useStatusZeilen(
  version: MappingVersion | null,
  verbuende: Verbundzeile[],
  aktiv: boolean,
): { daten: Map<string, ZeileDaten>; laden: boolean } {
  const idb = useStorage().idb;
  const [daten, setDaten] = useState<Map<string, ZeileDaten>>(new Map());
  const [laden, setLaden] = useState(false);

  useEffect(() => {
    if (!version || !aktiv || verbuende.length === 0) {
      setDaten(new Map());
      setLaden(false);
      return;
    }
    let abgebrochen = false;
    setLaden(true);
    void (async () => {
      try {
        const paare = await Promise.all(
          verbuende.map(async (v): Promise<[string, ZeileDaten]> => {
            const [verbund, events] = await Promise.all([
              getVerbund(idb, v.verbundId),
              getStatusEvents(idb, v.verbundId),
            ]);
            return [v.verbundId, {
              phase: zahPhaseFuerStatusText(verbund?.status),
              events,
            }];
          }),
        );
        if (abgebrochen) return;
        setDaten(new Map(paare));
      } catch {
        if (!abgebrochen) setDaten(new Map());
      } finally {
        if (!abgebrochen) setLaden(false);
      }
    })();
    return () => { abgebrochen = true; };
  }, [idb, version, aktiv, verbuende]);

  return { daten, laden };
}

export function StatusVerlaufWidget({
  instanz,
  ctx,
  onToggleEingeklappt,
}: WidgetProps): React.ReactElement | null {
  const { navigate } = useNavigation();
  // Vor dem Flag-Return (React-Hook-Regel); trägt die Schreibweise der Kürzel.
  const { mode: bearbeiterMode } = useBearbeiterSicht();
  // Stabile Referenz solange keine neue Katalog-Version aktiviert wird
  // (Snapshot-Modul hält genau ein Objekt) — direkt in Render lesen, damit ein
  // erst nach Mount gesetzter Snapshot noch greift.
  const version = getAktiveVersion();

  // Ein Eintrag je Verbund (meineAntraege ist bereits nach verbund_id
  // dedupliziert + frist-sortiert); Solo-Anträge ohne verbund_id tragen keine
  // Verbund-Historie und bleiben außen vor.
  const verbuende = useMemo<Verbundzeile[]>(() => {
    const out: Verbundzeile[] = [];
    for (const a of ctx.data.meineAntraege) {
      if (!a.verbund_id) continue;
      out.push({
        verbundId: a.verbund_id,
        akronym: a.acronym ?? a.verbund_titel ?? a.title ?? a.verbund_id,
        titel: a.verbund_titel ?? a.title ?? '',
        // Dieselben Teilvorhaben wie in „Meine Anträge" — sonst faltete diese
        // Zeile über eine andere Menge und nennte eine andere Aufgabe.
        tvAktenzeichen: a.tv_aktenzeichen ?? [a.id],
      });
    }
    return out;
  }, [ctx.data.meineAntraege]);

  const sichtbare = useMemo(() => verbuende.slice(0, MAX_ZEILEN), [verbuende]);
  const aktiv = !instanz.eingeklappt;
  const { daten, laden } = useStatusZeilen(version, sichtbare, aktiv);
  const heuteRef = useRef<string>(new Date().toISOString());
  const aufgaben = useZeilenAufgaben('leerlauf', heuteRef.current);

  if (!isStatusCockpitEnabled() || !version) return null;

  const rest = verbuende.length - sichtbare.length;
  const scope = bearbeiterScopeLabel(bearbeiterMode);

  return (
    <WidgetShell
      titel="Status & Verlauf"
      meta={scope}
      variante={instanz.bereich === 'seite' ? 'seite' : 'haupt'}
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        <span className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]">
          {verbuende.length.toLocaleString('de-DE')} {verbuende.length === 1 ? 'Verbund' : 'Verbünde'}
        </span>
      }
    >
      {verbuende.length === 0 ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">Keine Verbünde.</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {sichtbare.map(v => (
            <StatusZeile
              key={v.verbundId}
              zeile={v}
              daten={daten.get(v.verbundId) ?? null}
              version={version}
              laden={laden}
              aufgaben={aufgaben}
              onOpen={() => navigate('antraege', { selectedId: v.verbundId })}
            />
          ))}
          {rest > 0 ? (
            <p className="pt-0.5 text-[11px] text-[var(--tf-text-tertiary)]">+{rest} weitere</p>
          ) : null}
        </div>
      )}
    </WidgetShell>
  );
}

function StatusZeile({
  zeile,
  daten,
  version,
  laden,
  aufgaben,
  onOpen,
}: {
  zeile: Verbundzeile;
  daten: ZeileDaten | null;
  version: MappingVersion;
  laden: boolean;
  aufgaben: ZeilenAufgaben;
  onOpen: () => void;
}): React.ReactElement {
  const phase = daten?.phase ?? null;
  const events = daten?.events ?? [];

  // Mini-Verlauf: sichtbare Events (Meilenstein/Normal — nebensächliche +
  // ignorierte fallen raus), jüngste zuerst, auf MINI_VERLAUF gekappt.
  const verlauf = useMemo(() => {
    const sichtbar = sortiereEvents(events).filter(e => {
      const p = eventProminenz(e, version);
      return p === 'meilenstein' || p === 'normal';
    });
    return sichtbar.slice(-MINI_VERLAUF).reverse();
  }, [events, version]);

  // Die Aufgabe kommt aus derselben Ablage wie „Meine Anträge" und das Board —
  // und über dieselben Teilvorhaben gefaltet. Ohne Rückfall auf die
  // Status-Formel: dieses Widget stand nie für sie ein, und eine Zeile, die den
  // amtlichen Status ohnehin daneben zeigt, braucht keine Ableitung daraus.
  const anzeige = aufgabenAnzeige({
    aufgabe: aufgaben.fuer(zeile.tvAktenzeichen),
    rueckfall: '',
    laeuftNoch: aufgaben.laeuftNoch,
    ausserhalbLauf: aufgaben.ausserhalb(zeile.tvAktenzeichen),
    regeln: aufgaben.regeln,
  });
  const naechster = anzeige.text || null;

  // Einzeilig: Akronym · ZAH-Phase · (To-do, füllt) · Mini-Verlauf. Das To-do /
  // der Leer-Hinweis wandert in dieselbe Zeile (füllt den Rest, truncate), damit
  // vertikal mehr Verbünde sichtbar sind.
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 min-w-0 rounded-[10px] bg-[var(--tf-bg)] px-3 py-1.5 text-left transition-colors hover:bg-[var(--tf-bg-secondary)] cursor-pointer"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <span
        className="shrink-0 max-w-[42%] truncate text-[13px] font-medium text-[var(--tf-text)]"
        title={zeile.titel || zeile.akronym}
      >
        {zeile.akronym}
      </span>
      {phase !== null ? (
        // **Die Marke meint den VERBUND-Status.** Die Zeile darüber („Meine
        // Anträge") zeigt den Stand der Teilvorhaben, und die beiden dürfen
        // auseinanderlaufen: CALYPSO trägt am Verbund „abgelehnt/zurückgezogen"
        // (Phase: Abgeschlossen), am Teilvorhaben „Widerspruch zur Ablehnung".
        // Beides stimmt — ohne dieses Wort las es sich als Widerspruch (v4.132).
        // Die Quellspalte kommt aus dem Schema statt als festes „(STATUS_VB)" im
        // Text — so sagt der Tooltip auch, wenn ein Programm sie nicht mappt.
        <QuellSpaltenTooltip
          erklaere={idx => feldQuellen(['STATUS_VB'], idx,
            'Verfahrensschritt des Verbund-Status — die Teilvorhaben können weiter sein.')}
          wrapperClassName="shrink-0 inline-flex"
        >
          <span
            className="inline-flex items-center rounded-[6px] px-1.5 py-0.5 text-[11px] cursor-help"
            style={{
              color: 'color-mix(in srgb, var(--tf-primary) 75%, var(--tf-text))',
              background: 'color-mix(in srgb, var(--tf-primary) 12%, var(--tf-bg))',
            }}
          >
            {zahPhaseLabel(phase, version.zahPhasen)}
          </span>
        </QuellSpaltenTooltip>
      ) : laden ? (
        <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">…</span>
      ) : null}
      {naechster ? (
        <span
          className="flex-1 min-w-0 truncate text-[12px] text-[var(--tf-text-secondary)]"
          title={anzeige.titel}
        >
          {naechster}
          {anzeige.neben ? (
            <span className="ml-1.5 text-[11px] text-[var(--tf-text-tertiary)]">{anzeige.neben}</span>
          ) : null}
        </span>
      ) : daten && verlauf.length === 0 ? (
        <span className="flex-1 min-w-0 truncate text-[11px] text-[var(--tf-text-tertiary)]">
          Noch keine Statushistorie.
        </span>
      ) : (
        <div className="flex-1 min-w-0" />
      )}
      {verlauf.length > 0 ? (
        <span className="shrink-0 inline-flex items-center gap-1">
          {verlauf.map(e => (
            <VerlaufPunkt key={e.id} event={e} version={version} />
          ))}
        </span>
      ) : null}
    </button>
  );
}

/** Ein Verlaufs-Punkt: Meilensteine tragen die Primärfarbe, sonst gedämpft. */
function VerlaufPunkt({
  event,
  version,
}: {
  event: StatusEvent;
  version: MappingVersion;
}): React.ReactElement {
  const meilenstein = eventProminenz(event, version) === 'meilenstein';
  const datum = new Date(eventZeitMs(event)).toLocaleDateString('de-DE');
  const titel = `${feldLabel(version, event.feldId)}: ${event.wert} (${datum})`;
  return (
    <span
      title={titel}
      aria-label={titel}
      className="inline-block h-[7px] w-[7px] rounded-full"
      style={{ background: meilenstein ? 'var(--tf-primary)' : 'var(--tf-border-hover)' }}
    />
  );
}
