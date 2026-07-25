/**
 * Status & Verlauf (Home-Widget, Hauptbereich).
 *
 * Zeigt je Verbund den DETERMINISTISCH abgeleiteten Status (SPINE_LABEL), einen
 * Mini-Verlauf (die letzten sichtbaren Status-Events) und den ersten nächsten
 * Schritt. Read-only + strikt gerätelokal: liest ausschließlich via `idb.get`
 * (getVerbund/listAntraegeByVerbund/getStatusEvents) und die REINE Status-API
 * (@/core/status) — kein Share-/Snapshot-/Mirror-Write (Guard
 * `home-widgets-local-only`). Die Status-Logik wird NICHT dupliziert, nur
 * konsumiert (analog `useStatusVerlauf` der Verbund-Detailseite).
 *
 * Datenbasis: der einmal berechnete Dashboard-Aggregat
 * (`ctx.data.meineAntraege`) — bereits bearbeiter-gescoped, verbund-geclustert
 * (ein Eintrag je `verbund_id`) und frist-sortiert. Der „alle"/Team-Modus ist
 * damit ein First-Class-Zustand (`ctx.data.bearbeiterFilterActive === false`);
 * die Meta-Zeile macht ihn sichtbar. Gekappt auf die ersten ~8 (kritischste
 * Frist zuerst) — nur für diese wird geladen.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useStorage } from '@/core/hooks/useStorage';
import { getVerbund, listAntraegeByVerbund } from '@/core/services/csv/idb-csv';
import { isStatusCockpitEnabled } from '@/config/feature-flags';
import {
  getAktiveVersion, getStatusEvents, baueVerbundFelder, leiteStatusAb,
  sortiereEvents, eventProminenz, eventZeitMs, feldLabel,
  type MappingVersion, type StatusEvent, type AbleitungsErgebnis,
} from '@/core/status';
import { SPINE_LABEL } from '@/plugins/antraege/status/labels';
import { KonfliktBadge } from '@/plugins/antraege/status/KonfliktBadge';
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
}

interface ZeileDaten {
  ableitung: AbleitungsErgebnis;
  events: StatusEvent[];
}

/**
 * Lädt Ensemble + Historie je (gekapptem) Verbund und leitet den Status ab.
 * Nur aktiv, wenn das Widget ausgeklappt ist (`aktiv`) — der WidgetShell-Body
 * existiert eingeklappt gar nicht. Abbruch-sicher gegen Unmount / ID-Wechsel.
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
        const heute = new Date().toISOString();
        const paare = await Promise.all(
          verbuende.map(async (v): Promise<[string, ZeileDaten]> => {
            const [verbund, antraege, events] = await Promise.all([
              getVerbund(idb, v.verbundId),
              listAntraegeByVerbund(idb, v.verbundId),
              getStatusEvents(idb, v.verbundId),
            ]);
            const vf = baueVerbundFelder(
              version,
              v.verbundId,
              (verbund ?? {}) as unknown as Record<string, unknown>,
              antraege.map(a => ({
                aktenzeichen: a.aktenzeichen,
                record: a as unknown as Record<string, unknown>,
              })),
            );
            const ableitung = leiteStatusAb(version, vf.felder, vf.tvFelder, heute);
            return [v.verbundId, { ableitung, events }];
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
      });
    }
    return out;
  }, [ctx.data.meineAntraege]);

  const sichtbare = useMemo(() => verbuende.slice(0, MAX_ZEILEN), [verbuende]);
  const aktiv = !instanz.eingeklappt;
  const { daten, laden } = useStatusZeilen(version, sichtbare, aktiv);

  if (!isStatusCockpitEnabled() || !version) return null;

  const rest = verbuende.length - sichtbare.length;
  const scope =
    ctx.data.bearbeiterFilterActive && ctx.data.bearbeiterTokens.length > 0
      ? `Kürzel ${ctx.data.bearbeiterTokens.join(', ')}`
      : 'Alle Bearbeiter';

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
  onOpen,
}: {
  zeile: Verbundzeile;
  daten: ZeileDaten | null;
  version: MappingVersion;
  laden: boolean;
  onOpen: () => void;
}): React.ReactElement {
  const ableitung = daten?.ableitung ?? null;
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

  const naechster = ableitung?.naechsteSchritte[0]?.label ?? null;

  // Einzeilig: Akronym · Status-Badge · Konflikt · (nächster Schritt, füllt) ·
  // Mini-Verlauf. Der nächste Schritt / Leer-Hinweis wandert in dieselbe Zeile
  // (füllt den Rest, truncate), damit vertikal mehr Verbünde sichtbar sind.
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
      {ableitung ? (
        <span
          className="shrink-0 inline-flex items-center rounded-[6px] px-1.5 py-0.5 text-[11px]"
          style={{
            color: 'color-mix(in srgb, var(--tf-primary) 75%, var(--tf-text))',
            background: 'color-mix(in srgb, var(--tf-primary) 12%, var(--tf-bg))',
          }}
        >
          {SPINE_LABEL[ableitung.spinePhase]}
        </span>
      ) : laden ? (
        <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">…</span>
      ) : null}
      {ableitung ? <KonfliktBadge ableitung={ableitung} version={version} kompakt /> : null}
      {naechster ? (
        <span
          className="flex-1 min-w-0 truncate text-[12px] text-[var(--tf-text-secondary)]"
          title={naechster}
        >
          {naechster}
        </span>
      ) : ableitung && verlauf.length === 0 ? (
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
