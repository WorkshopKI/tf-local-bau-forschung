/**
 * „Für meine Rolle wichtig": die Kürzel einer Fachrolle, absteigend nach
 * Vorkommen im Bestand, mit einem Filter auf die Richtlinie.
 *
 * **Vorbelegt, nicht gesperrt.** Die Rolle kommt aus dem Profil und lässt sich
 * sofort umschalten — wer für eine Kollegin nachsieht, soll nicht in die
 * Einstellungen müssen.
 *
 * **Neutrale Kürzel stehen abgesetzt darunter.** Sie unter die Rolle zu mischen
 * behauptete eine Zuständigkeit, die die Zuarbeit nicht vergibt; sie
 * wegzulassen verschwiege die Hälfte des Alltags.
 *
 * **Die Suche der Seite gilt auch hier.** 585 Kürzel in zwei Abschnitten sind
 * genau die Sicht, in der man sucht; ein Feld, das beim Reiterwechsel wirkungslos
 * wird, wäre die schlechtere Antwort als eines, das überall greift.
 */
import { useMemo } from 'react';
import { MultiSelectDropdown } from '@/components/ui/MultiSelectDropdown';
import { ScopeTabs } from '@/components/ui/ScopeTabs';
import { useRichtlinienLabels, richtlinienLabel } from '@/core/hooks/useRichtlinienLabels';
import {
  ROLLEN, ROLLE_LABEL, ROLLE_LANG, normKey, programmeInTrigger,
  type Rolle, type TriggerStand,
} from '@/core/status';
import { rollenSicht, type KuerzelZeile } from './glossarZeilen';
import type { Suchbegriff } from './glossarSuche';
import { Markiert } from './Markiert';

function KuerzelListe({ zeilen, begriff, onWaehlen }: {
  zeilen: readonly KuerzelZeile[];
  begriff: Suchbegriff;
  onWaehlen: (id: string) => void;
}): React.ReactElement {
  if (zeilen.length === 0) {
    return (
      // Den richtigen Grund nennen: bei laufender Suche liegt es an ihr, nicht
      // an der Richtlinie — sonst zeigt die Seite auf die falsche Stellschraube.
      <p className="text-[12.5px] text-[var(--tf-text-tertiary)]">
        {begriff.roh === ''
          ? 'Kein Kürzel — unter der gewählten Richtlinie kommt hier keines vor.'
          : `Kein Kürzel zu „${begriff.roh}" — hier gefiltert nach Rolle und Richtlinie.`}
      </p>
    );
  }
  return (
    <ul className="flex flex-col">
      {zeilen.map(z => (
        <li key={z.code}>
          <button
            type="button"
            onClick={() => onWaehlen(`kuerzel:${z.code}`)}
            className="flex w-full cursor-pointer items-baseline gap-2 rounded-[var(--tf-radius-sm)] px-2 py-1 text-left transition hover:bg-[var(--tf-hover)]"
          >
            <span className="w-[64px] shrink-0 font-mono text-[12px] text-[var(--tf-text)]">
              <Markiert text={z.code} begriff={begriff} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--tf-text-secondary)]">
              <Markiert text={z.label} begriff={begriff} />
            </span>
            <span className="shrink-0 text-[11px] tabular-nums text-[var(--tf-text-tertiary)]">
              {z.vorkommen !== null ? z.vorkommen.toLocaleString('de-DE') : '—'}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function RollenSicht({
  zeilen, trigger, begriff, rolle, onRolle, programme, onProgramme, onWaehlen,
}: {
  /** Bereits nach der Suche gefiltert — die Seite besitzt den Suchbegriff. */
  zeilen: readonly KuerzelZeile[];
  trigger: TriggerStand | null;
  /** Nur zum Auszeichnen der Fundstelle und für den Leertext. */
  begriff: Suchbegriff;
  // Rolle und Richtlinien liegen bei der SEITE: dieser Reiter wird beim Wechsel
  // ausgehängt, und eine Auswahl, die jedes Mal zurückspringt, ist keine.
  rolle: Rolle | 'alle';
  onRolle: (r: Rolle | 'alle') => void;
  programme: readonly string[];
  onProgramme: (p: string[]) => void;
  onWaehlen: (id: string) => void;
}): React.ReactElement {
  const labels = useRichtlinienLabels();

  /** Je Richtlinie: welche KATALOG-Kürzel darin überhaupt einen Trigger haben. */
  const jeProgramm = useMemo(() => {
    const karte = new Map<string, Set<string>>();
    const bekannt = new Set(zeilen.map(z => normKey(z.code)));
    for (const t of trigger?.datei?.trigger ?? []) {
      if (t.programm === '' || !bekannt.has(normKey(t.kuerzel))) continue;
      const menge = karte.get(t.programm) ?? new Set<string>();
      menge.add(normKey(t.kuerzel));
      karte.set(t.programm, menge);
    }
    return karte;
  }, [trigger, zeilen]);

  // Die Zahl am Filter ist eine Zusage: sie ist genau die Menge, die dieser
  // Filter allein liefert — nicht die Zeilenzahl der Trigger-Tabelle.
  const optionen = useMemo(
    () => (trigger?.datei ? programmeInTrigger(trigger.datei.trigger) : [])
      .map(p => ({
        wert: p,
        label: `${richtlinienLabel(p, labels)} (${p})`,
        anzahl: jeProgramm.get(p)?.size ?? 0,
      })),
    [trigger, labels, jeProgramm],
  );

  const gefiltert = useMemo(() => {
    if (programme.length === 0) return zeilen;
    const erlaubt = new Set(programme.flatMap(p => [...(jeProgramm.get(p) ?? [])]));
    return zeilen.filter(z => erlaubt.has(normKey(z.code)));
  }, [zeilen, programme, jeProgramm]);

  const { eigene, neutrale } = useMemo(
    () => rollenSicht(gefiltert, rolle), [gefiltert, rolle],
  );

  return (
    <div className="flex h-full flex-col gap-3 overflow-y-auto px-6 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <ScopeTabs
          variant="pills"
          aria-label="Fachrolle"
          activeKey={rolle}
          onChange={k => onRolle(k as Rolle | 'alle')}
          items={[
            { key: 'alle', label: 'Alle Rollen' },
            ...ROLLEN.map(r => ({ key: r, label: ROLLE_LABEL[r], title: ROLLE_LANG[r] })),
          ]}
        />
        {optionen.length > 0 && (
          <MultiSelectDropdown
            einheit="Richtlinien"
            alleLabel="Alle Richtlinien"
            optionen={optionen}
            ausgewaehlt={programme}
            onChange={onProgramme}
          />
        )}
      </div>

      <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
        Sortiert nach Vorkommen im Bestand, das häufigste zuerst. Die Zahl sagt, wie viele
        Vorgänge das Kürzel gesetzt tragen — gezählt über den ganzen Bestand, nicht nur
        über den Betrachtungsbereich.
      </p>

      <section className="flex flex-col gap-1.5">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-[var(--tf-text-tertiary)]">
          {rolle === 'alle'
            ? `Mit Rollen-Vermerk · ${eigene.length}`
            : `${ROLLE_LANG[rolle]} · ${eigene.length}`}
        </h3>
        <KuerzelListe zeilen={eigene} begriff={begriff} onWaehlen={onWaehlen} />
      </section>

      <section className="flex flex-col gap-1.5 border-t border-[var(--tf-border)] pt-3">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-[var(--tf-text-tertiary)]">
          Ohne Rollen-Vermerk · {neutrale.length}
        </h3>
        <p className="text-[11.5px] text-[var(--tf-text-tertiary)]">
          Diese Kürzel darf jeder setzen. Sie stehen getrennt, weil sie zu keiner Rolle
          gehören — nicht, weil sie unwichtiger wären.
        </p>
        <KuerzelListe zeilen={neutrale} begriff={begriff} onWaehlen={onWaehlen} />
      </section>
    </div>
  );
}
