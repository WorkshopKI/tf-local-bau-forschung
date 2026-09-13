/**
 * Übersicht: eine Zeile je Verbund, je Haupt-Meilenstein eine Zustands-Spalte.
 * Links die Liste, rechts der Zeitstrahl des ausgewählten Verbunds
 * (`MasterDetailLayout` — kein eigenes Master/Detail nachbauen).
 *
 * Sortierung: dringendstes zuerst. „Dringend" heißt hier Prognose vor Restzeit —
 * ein Vorgang mit gerissener Frist gehört nach oben, auch wenn ein anderer
 * kalendarisch knapper dran ist.
 */
import { useMemo, useState } from 'react';
import { MasterDetailLayout } from '@/components/master-detail/MasterDetailLayout';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { Button } from '@/components/ui/button';
import { useNavigation } from '@/core/hooks/useNavigation';
import { ExternalLink, RotateCcw } from 'lucide-react';
import type { MeilensteinPlan, MstZustand } from '@/core/meilensteine';
import { kinderVon } from '@/core/meilensteine';
import { ANTRAGSTYP_BUCKETS } from '@/core/utils/vb-phase-mappings';
import { MeilensteinLeiste } from './MeilensteinLeiste';
import { filtereZeilen, standardFilter, type UebersichtFilter } from './monitoringLogic';
import { ladeUebersichtFilter, speichereUebersichtFilter } from './ansichtPersistenz';
import {
  ANKER_ERKLAERUNG, PROGNOSE_FARBE, PROGNOSE_LABEL, PROGNOSE_REIHENFOLGE, TYP_LABEL, ZUSTAND_FARBE,
  ZUSTAND_LABEL, feldStil, formatDatum, prognoseText, restzeitText,
} from './labels';
import { fristTageWort } from '@/core/utils/uhrWorte';
import type { VerbundZeile } from './useMeilensteinStand';

function ZustandsPunkt({ zustand }: { zustand: MstZustand }): React.ReactElement {
  return (
    <span
      title={ZUSTAND_LABEL[zustand]}
      aria-label={ZUSTAND_LABEL[zustand]}
      className="inline-block rounded-full"
      style={{
        width: 8, height: 8,
        background: zustand === 'offen' || zustand === 'nichtRelevant' ? 'transparent' : ZUSTAND_FARBE[zustand],
        border: `1.5px solid ${ZUSTAND_FARBE[zustand]}`,
      }}
    />
  );
}

function Zeile({ zeile, hauptKnotenIds, aktiv, onWaehlen }: {
  zeile: VerbundZeile;
  hauptKnotenIds: string[];
  aktiv: boolean;
  onWaehlen: () => void;
}): React.ReactElement {
  const perKnoten = new Map(zeile.ergebnisse.map(e => [e.knotenId, e]));
  return (
    <button
      type="button"
      onClick={onWaehlen}
      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition-colors hover:bg-[var(--tf-bg-secondary)] cursor-pointer"
      style={aktiv ? { ...feldStil, background: 'var(--tf-bg-secondary)' } : feldStil}
    >
      <span className="shrink-0 w-[104px] truncate text-[12.5px] font-medium text-[var(--tf-text)]" title={zeile.titel || zeile.akronym}>
        {zeile.akronym}
      </span>
      <span className="shrink-0 w-[30px] text-[10.5px] text-[var(--tf-text-tertiary)]">
        {zeile.typ ? TYP_LABEL[zeile.typ] : '—'}
      </span>
      <span className="shrink-0 w-[46px] text-[11px] tabular-nums text-[var(--tf-text-tertiary)]" title="Laufende Bearbeitungswoche">
        {zeile.wocheAktuell === null ? '—' : `W${zeile.wocheAktuell}`}
      </span>
      <span className="shrink-0 inline-flex items-center gap-1">
        {hauptKnotenIds.map(id => (
          <ZustandsPunkt key={id} zustand={perKnoten.get(id)?.zustand ?? 'nichtRelevant'} />
        ))}
      </span>
      <span className="flex-1 min-w-0" />
      <span
        className="shrink-0 text-[11px] tabular-nums"
        style={{ color: PROGNOSE_FARBE[zeile.prognose] }}
        title={
          zeile.prognose === 'unbekannt'
            ? `Unbekannt — kein Meilenstein des Plans gilt für diesen Verbund; die Frist ${formatDatum(zeile.fristDatum)} ist rechnerisch, aber durch keinen Meilenstein belegt.`
            : `${prognoseText(zeile)}${zeile.fristDatum === null ? '' : ` · Frist ${formatDatum(zeile.fristDatum)}`}`
        }
      >
        {/* Eine Restzeit steht nur da, wo der Plan sie auch trägt: bei
            `unbekannt` gilt kein einziger Meilenstein für diesen Verbund, und
            die Tageszahl aus der Gesamtfrist läse sich als geprüfte Frist. */}
        {zeile.restTage === null || zeile.prognose === 'unbekannt'
          ? PROGNOSE_LABEL[zeile.prognose]
          : fristTageWort(zeile.restTage)}
      </span>
    </button>
  );
}

export function UebersichtTab({ zeilen, plan, meineTokens, meineTokensAnzeige }: {
  zeilen: VerbundZeile[];
  plan: MeilensteinPlan;
  /** Eigene Kürzel in der Vergleichsform; leer = kein eigenes Kürzel. */
  meineTokens: string[];
  /** Dieselben in der Schreibweise der Daten — nur für die Beschriftung. */
  meineTokensAnzeige: string[];
}): React.ReactElement {
  const { navigate } = useNavigation();
  const hatKuerzel = meineTokens.length > 0;
  const [filter, setFilter] = useState<UebersichtFilter>(() => ladeUebersichtFilter(hatKuerzel));
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);

  const hauptKnotenIds = useMemo(
    () => kinderVon(plan.knoten, null).map(k => k.id),
    [plan.knoten],
  );
  const sichtbar = useMemo(
    () => filtereZeilen(zeilen, filter, meineTokens),
    [zeilen, filter, meineTokens],
  );
  const aktiv = sichtbar.find(z => z.verbundId === gewaehlt) ?? null;

  const toggle = <T,>(liste: T[], wert: T): T[] =>
    liste.includes(wert) ? liste.filter(x => x !== wert) : [...liste, wert];

  // Setzen und Merken in einem Schritt — bewusst NICHT als Seiteneffekt im
  // useState-Updater, der liefe unter StrictMode doppelt. Den Suchtext verwirft
  // erst das Persistenz-Modul, damit es hier nur EINEN Weg gibt.
  const aendere = (patch: Partial<UebersichtFilter>): void => {
    const naechster = { ...filter, ...patch };
    setFilter(naechster);
    speichereUebersichtFilter(naechster);
  };

  const standard = standardFilter(hatKuerzel);
  const abweichend = filter.suche !== '' || filter.typen.length > 0
    || filter.prognosen.length > 0 || filter.nurMeine !== standard.nurMeine;

  const liste = (
    <div className="flex flex-col gap-2 h-full min-h-0">
      <div className="flex items-center gap-1.5 flex-wrap">
        <input
          value={filter.suche}
          onChange={e => aendere({ suche: e.target.value })}
          placeholder="Akronym oder Titel …"
          aria-label="Verbünde durchsuchen"
          className="flex-1 min-w-[140px] text-[12.5px] rounded px-2.5 py-1.5 bg-[var(--tf-bg)] text-[var(--tf-text)]"
          style={feldStil}
        />
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {ANTRAGSTYP_BUCKETS.map(t => (
          <ToggleChip
            key={t} label={TYP_LABEL[t]}
            selected={filter.typen.includes(t)}
            onToggle={() => aendere({ typen: toggle(filter.typen, t) })}
          />
        ))}
        {hatKuerzel && (
          <ToggleChip
            label="nur meine"
            selected={filter.nurMeine}
            onToggle={() => aendere({ nurMeine: !filter.nurMeine })}
            title={`Teilvorhaben mit Kürzel ${(meineTokensAnzeige.length > 0 ? meineTokensAnzeige : meineTokens).join('/')}`}
          />
        )}
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {PROGNOSE_REIHENFOLGE.map(p => (
          <ToggleChip
            key={p} label={PROGNOSE_LABEL[p]}
            selected={filter.prognosen.includes(p)}
            onToggle={() => aendere({ prognosen: toggle(filter.prognosen, p) })}
          />
        ))}
        {abweichend && (
          <Button
            variant="ghost" size="sm" icon={RotateCcw}
            onClick={() => aendere(standard)}
            title="Filter dieser Liste auf den Standard zurücksetzen"
          >
            Zurücksetzen
          </Button>
        )}
      </div>

      <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
        {sichtbar.length} von {zeilen.length} offenen Verbünden
      </p>

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-1">
        {sichtbar.map(z => (
          <Zeile
            key={z.verbundId} zeile={z} hauptKnotenIds={hauptKnotenIds}
            aktiv={z.verbundId === gewaehlt}
            onWaehlen={() => setGewaehlt(z.verbundId)}
          />
        ))}
        {sichtbar.length === 0 && (
          <p className="text-[12.5px] text-[var(--tf-text-tertiary)] pt-2">
            Kein Verbund passt zu den Filtern.
          </p>
        )}
      </div>
    </div>
  );

  const detail = aktiv === null ? undefined : (
    <div className="flex flex-col gap-4 p-4 overflow-y-auto h-full min-h-0">
      <div className="flex items-start gap-2 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[15px] font-medium text-[var(--tf-text)]">{aktiv.akronym}</h2>
          {aktiv.titel && (
            <p className="text-[12px] text-[var(--tf-text-secondary)]">{aktiv.titel}</p>
          )}
        </div>
        <Button
          variant="ghost" size="sm" icon={ExternalLink} className="ml-auto"
          onClick={() => navigate('antraege', { selectedId: aktiv.verbundId })}
        >
          Zum Verbund
        </Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap text-[12px]">
        <span style={{ color: PROGNOSE_FARBE[aktiv.prognose] }}>{prognoseText(aktiv)}</span>
        <span className="text-[var(--tf-text-secondary)]" title={ANKER_ERKLAERUNG}>
          Eingang {formatDatum(aktiv.anker)}
        </span>
        {aktiv.fristDatum !== null && (
          <span className="text-[var(--tf-text-secondary)]">
            Frist {formatDatum(aktiv.fristDatum)}
          </span>
        )}
        {/* Wie im Meilenstein-Abschnitt des Verbunds: bei angehaltener Frist sagt es die Prognose schon. */}
        {aktiv.prognose !== 'angehalten' && (
          <span className={aktiv.restTage !== null && aktiv.restTage < 0 ? 'text-[var(--tf-danger-text)]' : 'text-[var(--tf-text-secondary)]'}>
            {restzeitText(aktiv)}
          </span>
        )}
        {aktiv.kuerzelAnzeige.length > 0 && (
          <span className="text-[var(--tf-text-tertiary)]">
            Bearbeitung: {aktiv.kuerzelAnzeige.join(', ')}
          </span>
        )}
      </div>

      {/* Was der Plan über diesen Verbund NICHT sagt, gehört neben die Zahlen —
          sonst liest sich eine rechnerische Frist wie eine geprüfte. */}
      {aktiv.prognose === 'unbekannt' && aktiv.fristDatum !== null && (
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Kein Meilenstein des freigegebenen Plans gilt für diesen Verbund
          {aktiv.typ ? ` (Antragstyp ${TYP_LABEL[aktiv.typ]})` : ''} — die Frist ist aus der
          Gesamtfrist gerechnet, aber durch keinen Meilenstein belegt.
        </p>
      )}

      <MeilensteinLeiste bewertung={aktiv} knoten={plan.knoten} />
    </div>
  );

  return (
    <MasterDetailLayout
      list={liste}
      detail={detail}
      onCloseDetail={() => setGewaehlt(null)}
      listWidthKey="meilensteine_uebersicht_breite"
    />
  );
}
