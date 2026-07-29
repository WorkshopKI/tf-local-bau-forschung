/**
 * „Diese Woche": alle Meilensteine, die jetzt Aufmerksamkeit brauchen — nach
 * Dringlichkeit gruppiert statt nach Verbund. Das ist die Arbeitsliste, aus der
 * das Home-Widget später seinen Auszug zieht.
 *
 * `zeilen` sind hier ALLE offenen Verbünde — der Eingangs-Zeitraum der Seite gilt
 * für diesen Tab bewusst nicht, sonst verschwände ein überfälliger Meilenstein
 * nur deshalb, weil sein Antrag aus einem früheren Jahr stammt.
 *
 * Bewusst KEIN eigener Zustandsbegriff: „überfällig" ist genau `gerissen`,
 * „diese Woche" genau `faellig` (das 7-Tage-Fenster der Engine). Eine zweite
 * Schwellen-Definition in der Oberfläche würde unweigerlich von der Engine
 * abweichen.
 */
import { useMemo, useState } from 'react';
import { ToggleChip } from '@/components/ui/ToggleChip';
import { useNavigation } from '@/core/hooks/useNavigation';
import type { MeilensteinPlan } from '@/core/meilensteine';
import { nurMeinePunkte, sammleWochenPunkte, type WochenPunkt } from './monitoringLogic';
import { ladeWocheNurMeine, speichereWocheNurMeine } from './ansichtPersistenz';
import { PROGNOSE_FARBE, PROGNOSE_LABEL, ZUSTAND_FARBE, feldStil, formatDatum } from './labels';
import type { VerbundZeile } from './useMeilensteinStand';

function PunktZeile({ p, onOeffnen }: { p: WochenPunkt; onOeffnen: () => void }): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onOeffnen}
      className="flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left transition-colors hover:bg-[var(--tf-bg-secondary)] cursor-pointer"
      style={feldStil}
    >
      <span
        aria-hidden
        className="shrink-0 inline-block rounded-full"
        style={{ width: 8, height: 8, background: ZUSTAND_FARBE[p.zustand] }}
      />
      <span className="shrink-0 w-[104px] truncate text-[12.5px] font-medium text-[var(--tf-text)]" title={p.titel || p.akronym}>
        {p.akronym}
      </span>
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
        {p.restTage === null
          ? '—'
          : p.restTage < 0 ? `${-p.restTage} T überfällig` : `in ${p.restTage} T`}
      </span>
      <span
        className="shrink-0 w-[104px] text-right text-[10.5px]"
        style={{ color: PROGNOSE_FARBE[p.prognose] }}
      >
        {PROGNOSE_LABEL[p.prognose]}
      </span>
    </button>
  );
}

function Gruppe({ titel, punkte, onOeffnen }: {
  titel: string; punkte: WochenPunkt[]; onOeffnen: (verbundId: string) => void;
}): React.ReactElement | null {
  if (punkte.length === 0) return null;
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-[12px] font-medium text-[var(--tf-text-secondary)]">
        {titel} <span className="text-[var(--tf-text-tertiary)]">({punkte.length})</span>
      </h3>
      {punkte.map(p => (
        <PunktZeile key={`${p.verbundId}:${p.knotenId}`} p={p} onOeffnen={() => onOeffnen(p.verbundId)} />
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

  const waehleNurMeine = (naechster: boolean): void => {
    setNurMeine(naechster);
    speichereWocheNurMeine(naechster);
  };

  const punkte = useMemo(() => {
    const alle = sammleWochenPunkte(zeilen, plan, stand);
    return nurMeine ? nurMeinePunkte(alle, meinKuerzel) : alle;
  }, [zeilen, plan, stand, nurMeine, meinKuerzel]);

  const ueberfaellig = punkte.filter(p => p.zustand === 'gerissen');
  const faellig = punkte.filter(p => p.zustand === 'faellig');

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
            titel="Überfällig" punkte={ueberfaellig}
            onOeffnen={id => navigate('antraege', { selectedId: id })}
          />
          <Gruppe
            titel="Diese Woche fällig" punkte={faellig}
            onOeffnen={id => navigate('antraege', { selectedId: id })}
          />
        </>
      )}
    </div>
  );
}
