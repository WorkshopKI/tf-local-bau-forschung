/**
 * „Diese Woche": alle Meilensteine, die jetzt Aufmerksamkeit brauchen — nach
 * Dringlichkeit gruppiert statt nach Verbund. Das ist die Arbeitsliste, aus der
 * das Home-Widget später seinen Auszug zieht.
 *
 * `zeilen` sind durch den Eingangs-Zeitraum der Seite vorgefiltert. Das war
 * zwischenzeitlich anders — mit der Begründung, ein alter überfälliger Vorgang
 * dürfe nicht aus der Arbeitsliste fallen. Die Annahme dahinter stimmt für diese
 * Daten nicht: Vorgänge von vor drei Jahren sind kein Rückstand, sondern
 * Altbestand mit unsauber gesetzten Status im Fachsystem, und sie stellten 1771
 * der 1836 Zeilen. Über „Alle Eingänge" bleiben sie einen Klick entfernt.
 *
 * Zusätzlich werden die Punkte je Verbund gebündelt (Standard):
 * bei einem Vorgang, der seit Jahren liegt, sind seine sechs gerissenen
 * Meilensteine dieselbe Tatsache. Die zugeklappte Zeile nennt deshalb den
 * DRINGENDSTEN Punkt — bei Überfälligen die Stelle, an der es hängen blieb —
 * statt nur zu zählen; sonst wäre der Tab bloß eine zweite Übersicht.
 *
 * Bewusst KEIN eigener Zustandsbegriff: „überfällig" ist genau `gerissen`,
 * „diese Woche" genau `faellig` (das 7-Tage-Fenster der Engine). Eine zweite
 * Schwellen-Definition in der Oberfläche würde unweigerlich von der Engine
 * abweichen.
 */
import { useMemo, useState } from 'react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useNavigation } from '@/core/hooks/useNavigation';
import { ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import type { MeilensteinPlan } from '@/core/meilensteine';
import {
  gruppiereNachVerbund, nurMeinePunkte, sammleWochenPunkte,
  type VerbundGruppe, type WochenPunkt,
} from './monitoringLogic';
import {
  ladeWocheGruppiert, ladeWocheNurMeine, speichereWocheGruppiert, speichereWocheNurMeine,
} from './ansichtPersistenz';
import { PROGNOSE_FARBE, PROGNOSE_LABEL, ZUSTAND_FARBE, feldStil, formatDatum } from './labels';
import type { VerbundZeile } from './useMeilensteinStand';

/** „4692 T überfällig" / „in 3 T". */
function restText(restTage: number | null): string {
  if (restTage === null) return '—';
  return restTage < 0 ? `${-restTage} T überfällig` : `in ${restTage} T`;
}

function PunktZeile({ p, eingerueckt, onOeffnen }: {
  p: WochenPunkt;
  /** Als Kind einer Gruppe: eingerückt, ohne Akronym (steht in der Gruppenzeile). */
  eingerueckt?: boolean;
  onOeffnen: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onOeffnen}
      className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--tf-bg-secondary)] cursor-pointer${
        eingerueckt ? ' ml-6 w-auto' : ''
      }`}
      style={eingerueckt ? undefined : feldStil}
    >
      <span
        aria-hidden
        className="shrink-0 inline-block rounded-full"
        style={{ width: 8, height: 8, background: ZUSTAND_FARBE[p.zustand] }}
      />
      {!eingerueckt && (
        <span className="shrink-0 w-[104px] truncate text-[12.5px] font-medium text-[var(--tf-text)]" title={p.titel || p.akronym}>
          {p.akronym}
        </span>
      )}
      <span className="shrink-0 text-[10.5px] font-mono text-[var(--tf-text-tertiary)]">{p.nummer}</span>
      <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--tf-text-secondary)]" title={p.label}>
        {p.label}
      </span>
      <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">
        Soll {formatDatum(p.sollDatum)}
      </span>
      <span
        className="shrink-0 w-[92px] text-right text-[11px] tabular-nums"
        style={{ color: ZUSTAND_FARBE[p.zustand] }}
      >
        {restText(p.restTage)}
      </span>
      {!eingerueckt && (
        <span
          className="shrink-0 w-[104px] text-right text-[10.5px]"
          style={{ color: PROGNOSE_FARBE[p.prognose] }}
        >
          {PROGNOSE_LABEL[p.prognose]}
        </span>
      )}
    </button>
  );
}

function GruppenZeile({ gruppe, offen, onToggle, onOeffnen }: {
  gruppe: VerbundGruppe;
  offen: boolean;
  onToggle: () => void;
  onOeffnen: () => void;
}): React.ReactElement {
  const d = gruppe.dringendster;
  const Pfeil = offen ? ChevronDown : ChevronRight;
  // „hängt seit" nur bei Gerissenen — bei Fälligen ist es der nächste Termin,
  // da hängt noch nichts.
  const wortlaut = d.zustand === 'gerissen' ? 'hängt seit' : 'nächster';

  return (
    <div className="flex flex-col">
      <div className="flex items-center rounded" style={feldStil}>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={offen}
          className="flex flex-1 min-w-0 items-center gap-2 px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--tf-bg-secondary)] cursor-pointer rounded-l"
        >
          <Pfeil aria-hidden size={13} className="shrink-0 text-[var(--tf-text-tertiary)]" />
          <span
            aria-hidden
            className="shrink-0 inline-block rounded-full"
            style={{ width: 8, height: 8, background: ZUSTAND_FARBE[d.zustand] }}
          />
          <span
            className="shrink-0 w-[104px] truncate text-[12.5px] font-medium text-[var(--tf-text)]"
            title={gruppe.titel || gruppe.akronym}
          >
            {gruppe.akronym}
          </span>
          <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--tf-text-secondary)]">
            {wortlaut} <span className="font-mono text-[10.5px]">{d.nummer}</span> {d.label}
          </span>
          <span className="shrink-0 text-[11px] text-[var(--tf-text-tertiary)]">
            Soll {formatDatum(d.sollDatum)}
          </span>
          <span
            className="shrink-0 w-[92px] text-right text-[11px] tabular-nums"
            style={{ color: ZUSTAND_FARBE[d.zustand] }}
          >
            {restText(d.restTage)}
          </span>
          <span className="shrink-0 w-[62px] text-right text-[11px] tabular-nums text-[var(--tf-text-tertiary)]">
            {gruppe.punkte.length} offen
          </span>
          <span
            className="shrink-0 w-[104px] text-right text-[10.5px]"
            style={{ color: PROGNOSE_FARBE[d.prognose] }}
          >
            {PROGNOSE_LABEL[d.prognose]}
          </span>
        </button>
        <button
          type="button"
          onClick={onOeffnen}
          title={`Zum Verbund ${gruppe.akronym}`}
          aria-label={`Zum Verbund ${gruppe.akronym}`}
          className="shrink-0 px-2.5 py-1.5 text-[var(--tf-text-tertiary)] hover:text-[var(--tf-text)] transition-colors cursor-pointer rounded-r"
        >
          <ExternalLink aria-hidden size={13} />
        </button>
      </div>

      {offen && (
        <div className="flex flex-col gap-0.5 py-1">
          {gruppe.punkte.map(p => (
            <PunktZeile key={p.knotenId} p={p} eingerueckt onOeffnen={onOeffnen} />
          ))}
        </div>
      )}
    </div>
  );
}

function Gruppe({ titel, sektion, punkte, gruppiert, offene, onToggle, onOeffnen }: {
  titel: string;
  /** Aufklapp-Zustand je Sektion getrennt — ein Verbund kann in beiden stehen. */
  sektion: string;
  punkte: WochenPunkt[];
  gruppiert: boolean;
  offene: ReadonlySet<string>;
  onToggle: (schluessel: string) => void;
  onOeffnen: (verbundId: string) => void;
}): React.ReactElement | null {
  const verbuende = useMemo(
    () => (gruppiert ? gruppiereNachVerbund(punkte) : []),
    [gruppiert, punkte],
  );
  if (punkte.length === 0) return null;

  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)]">
        {titel}{' '}
        <span className="text-[var(--tf-text-tertiary)]">
          {gruppiert
            ? `(${verbuende.length} Verbünde · ${punkte.length} Meilensteine)`
            : `(${punkte.length})`}
        </span>
      </h3>
      {gruppiert
        ? verbuende.map(g => (
          <GruppenZeile
            key={g.verbundId} gruppe={g}
            offen={offene.has(`${sektion}:${g.verbundId}`)}
            onToggle={() => onToggle(`${sektion}:${g.verbundId}`)}
            onOeffnen={() => onOeffnen(g.verbundId)}
          />
        ))
        : punkte.map(p => (
          <PunktZeile
            key={`${p.verbundId}:${p.knotenId}`} p={p}
            onOeffnen={() => onOeffnen(p.verbundId)}
          />
        ))}
    </section>
  );
}

export function DieseWocheTab({ zeilen, plan, meinKuerzel, stand }: {
  zeilen: VerbundZeile[];
  plan: MeilensteinPlan;
  meinKuerzel: string;
  stand: string;
}): React.ReactElement {
  const { navigate } = useNavigation();
  const [nurMeine, setNurMeine] = useState(() => ladeWocheNurMeine(meinKuerzel !== ''));
  const [gruppiert, setGruppiert] = useState(ladeWocheGruppiert);
  const [offene, setOffene] = useState<ReadonlySet<string>>(() => new Set<string>());

  const waehleNurMeine = (naechster: boolean): void => {
    setNurMeine(naechster);
    speichereWocheNurMeine(naechster);
  };

  const waehleGruppiert = (naechster: boolean): void => {
    setGruppiert(naechster);
    speichereWocheGruppiert(naechster);
  };

  const toggleVerbund = (schluessel: string): void => {
    setOffene(vorher => {
      const naechste = new Set(vorher);
      if (!naechste.delete(schluessel)) naechste.add(schluessel);
      return naechste;
    });
  };

  const punkte = useMemo(() => {
    const alle = sammleWochenPunkte(zeilen, plan, stand);
    return nurMeine ? nurMeinePunkte(alle, meinKuerzel) : alle;
  }, [zeilen, plan, stand, nurMeine, meinKuerzel]);

  const ueberfaellig = useMemo(() => punkte.filter(p => p.zustand === 'gerissen'), [punkte]);
  const faellig = useMemo(() => punkte.filter(p => p.zustand === 'faellig'), [punkte]);
  const oeffneVerbund = (id: string): void => navigate('antraege', { selectedId: id });

  return (
    <div className="flex flex-col gap-4 pt-4">
      <div className="flex items-center gap-2 flex-wrap">
        {meinKuerzel && (
          <ToggleChip
            label="nur meine"
            selected={nurMeine}
            onToggle={() => waehleNurMeine(!nurMeine)}
            title={`Teilvorhaben mit Kürzel ${meinKuerzel}`}
          />
        )}
        <ToggleChip
          label="nach Verbund"
          selected={gruppiert}
          onToggle={() => waehleGruppiert(!gruppiert)}
          title="Meilensteine eines Verbunds zu einer Zeile bündeln"
        />
        <span className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Stand {formatDatum(stand)}
        </span>
      </div>

      {punkte.length === 0 ? (
        <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">
          Kein Meilenstein ist überfällig oder in den nächsten sieben Tagen fällig.
        </p>
      ) : (
        <>
          <Gruppe
            titel="Überfällig" sektion="ueberfaellig" punkte={ueberfaellig} gruppiert={gruppiert}
            offene={offene} onToggle={toggleVerbund} onOeffnen={oeffneVerbund}
          />
          <Gruppe
            titel="Diese Woche fällig" sektion="faellig" punkte={faellig} gruppiert={gruppiert}
            offene={offene} onToggle={toggleVerbund} onOeffnen={oeffneVerbund}
          />
        </>
      )}
    </div>
  );
}
