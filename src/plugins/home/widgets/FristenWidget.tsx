/**
 * „Fristen" (Home-Widget) — **eine Zeile je eigenem Verbund**, in zwei Gruppen.
 *
 * Beantwortet die vier Fragen, mit denen ein Bearbeiter die Karte liest
 * (entschieden 13.09.2026): Wie weit sind wir über der Frist? Welche
 * Meilensteine sind gerissen? Was ist zu tun? Welche Vorgänge stehen still,
 * bevor etwas reißt?
 *
 * Bis v6.66 stand hier eine Liste von „Anlässen" zweier Systeme — Stillstand
 * gegen Zieltage, Meilenstein gegen Soll —, sortiert über eine gemeinsame
 * „T über"-Zahl. An einem Vorgang standen so mehrere rote Tageszahlen, und
 * keine davon war die Frist. Jetzt trägt jede Uhr ihr eigenes Wort
 * (`core/utils/uhrWorte.ts`), und die Zeile nennt sie nebeneinander, statt sie
 * gegeneinander zu sortieren. Gruppen und Reihenfolge:
 * [fristenLage.ts](./fristenLage.ts).
 *
 * Scope ist der bereits berechnete Dashboard-Aggregat (`ctx.data.meineAntraege`),
 * kein zweiter Bearbeiter-Filter. Geladen wird nur im ausgeklappten Zustand.
 */
import { Fragment, useMemo, useRef } from 'react';
import { QuellSpaltenTooltip } from '@/components/quellspalten';
import { VorlaeufigMarke } from '@/components/ui/VorlaeufigMarke';
import { knotenQuellen } from '@/core/meilensteine';
import { aufgabenAnzeige, type AufgabenAnzeige } from '@/core/status';
import { feldQuellen } from '@/core/status/bedingung-quellen';
import { useNavigation } from '@/core/hooks/useNavigation';
import { useBearbeiterSicht } from '@/core/hooks/useBearbeiterSicht';
import { useZeilenAufgaben } from '@/core/hooks/useBestandsAufgaben';
import { schrittText } from '@/core/utils/naechsterSchritt';
import { bewegungWort, fristTageWort } from '@/core/utils/uhrWorte';
import { bearbeiterScopeLabel } from '@/plugins/antraege/bearbeiterFilter';
import { isMeilensteinMonitoringEnabled, isVorgangssystemEnabled } from '@/config/feature-flags';
import type { AntragVorgang } from '../dashboardAggregate';
import {
  GRUPPEN, bilanzText, meilensteinText, naechsterText, sichtbareZeilen,
  type FristenGruppe, type FristenZeile,
} from './fristenLage';
import { useFristenLage } from './useFristenLage';
import { WidgetShell } from './WidgetShell';
import type { WidgetProps } from './widgetProps';

const MAX_ZEILEN = 8;
/** So viele Plätze bekommt jede Gruppe mindestens (s. sichtbareZeilen). */
const MIN_JE_GRUPPE = 2;

const GRUPPE: Record<FristenGruppe, { titel: string; farbe: string; erklaerung: string }> = {
  eingreifen: {
    titel: 'Jetzt eingreifen',
    // Orange, nicht Rot: ein Signal zum Handeln, noch kein Rückstand.
    farbe: 'var(--tf-warning-text)',
    erklaerung: 'Keine Bewegung über die Zieltage des Status hinaus, die Frist läuft noch — '
      + 'hier lässt sich ein Riss noch verhindern. Zuerst, was als Nächstes reißt: nächster Meilenstein oder Frist.',
  },
  rueckstand: {
    titel: 'Rückstand',
    farbe: 'var(--tf-danger-text)',
    erklaerung: 'Die Frist ist überschritten oder ein Meilenstein ist gerissen. '
      + 'Zuerst, was am weitesten über der Frist ist.',
  },
};

function LageZeile({ z, anzeige, onOeffnen }: {
  z: FristenZeile;
  /** Die Aufgabe aus der Kaskade; `null`, wo der Vorgang nicht im Aggregat steht. */
  anzeige: AufgabenAnzeige | null;
  onOeffnen: () => void;
}): React.ReactElement {
  const m = z.meilensteine;
  const b = z.bewegung;
  const riss = m ? meilensteinText(m) : null;
  const blocker = m?.blocker ?? null;
  const grund = b?.grund ?? null;
  const quellFelder = grund?.quellFelder ?? [];

  // Jede Angabe mit ihrer Herkunft im Tooltip: der Stillstand mit dem Status
  // bzw. Kürzel-Paar, der Riss mit der Bedingung des Blockers.
  const bewegungTeil = b === null ? null : quellFelder.length > 0 && grund !== null ? (
    <QuellSpaltenTooltip erklaere={idx => feldQuellen(quellFelder, idx, grund.text)}>
      <span className="cursor-help text-[var(--tf-warning-text)]">{bewegungWort(b.liegeTage, b.zieltage, b.belegt)}</span>
    </QuellSpaltenTooltip>
  ) : (
    <span className="text-[var(--tf-warning-text)]" title={grund?.text}>
      {bewegungWort(b.liegeTage, b.zieltage, b.belegt)}
    </span>
  );
  const rissTeil = riss === null ? null : blocker !== null ? (
    <QuellSpaltenTooltip erklaere={idx => knotenQuellen(blocker.knoten, idx)}>
      <span className="cursor-help">{riss}</span>
    </QuellSpaltenTooltip>
  ) : <span>{riss}</span>;
  const naechster = z.gruppe === 'eingreifen' && m ? naechsterText(m) : null;
  const naechsterTeil = naechster === null ? null : <span>{naechster}</span>;

  // Eingreifen: zuerst der Grund der Gruppe (keine Bewegung), dann der
  // Meilenstein, der sonst reißt. Rückstand: zuerst der Riss.
  const teile = (z.gruppe === 'eingreifen'
    ? [bewegungTeil, naechsterTeil, rissTeil]
    : [rissTeil, bewegungTeil]
  ).filter((t): t is React.ReactElement => t !== null);

  return (
    <button
      type="button"
      onClick={onOeffnen}
      className="flex w-full flex-col gap-0.5 min-w-0 rounded-[10px] bg-[var(--tf-bg)] px-3 py-1.5 text-left transition-colors hover:bg-[var(--tf-bg-secondary)] cursor-pointer"
      style={{ border: '0.5px solid var(--tf-border)' }}
    >
      <span className="flex w-full items-center gap-2 min-w-0">
        <span
          aria-hidden
          className="shrink-0 inline-block rounded-full"
          style={{ width: 7, height: 7, background: GRUPPE[z.gruppe].farbe }}
        />
        <span className="shrink-0 max-w-[34%] truncate text-[13px] font-medium text-[var(--tf-text)]">
          {z.akronym}
        </span>
        <span className="flex-1 min-w-0 truncate text-[12px] text-[var(--tf-text-secondary)]">
          {teile.map((t, i) => <Fragment key={i}>{i > 0 ? ' · ' : null}{t}</Fragment>)}
        </span>
        <span
          className={`shrink-0 text-[11px] tabular-nums ${z.fristTage < 0 ? 'text-[var(--tf-danger-text)]' : 'text-[var(--tf-text-secondary)]'}`}
          title="Dieselbe Bearbeitungsfrist wie in der Frist-Spalte der Förderanträge"
        >
          {fristTageWort(z.fristTage)}
        </span>
      </span>
      {anzeige?.text ? (
        <span className="flex items-baseline gap-1.5 min-w-0 pl-[15px] text-[11.5px]" title={anzeige.titel}>
          <span
            className={anzeige.quelle === 'gesperrt'
              ? 'shrink-0 text-[var(--tf-text-tertiary)]'
              : 'shrink-0 text-[var(--tf-text-secondary)]'}
          >
            {anzeige.text}
          </span>
          {anzeige.vorlaeufig ? <VorlaeufigMarke /> : null}
          {anzeige.neben ? (
            <span className="truncate min-w-0 text-[11px] text-[var(--tf-text-tertiary)]">{anzeige.neben}</span>
          ) : null}
        </span>
      ) : null}
    </button>
  );
}

export function FristenWidget({
  instanz, ctx, onToggleEingeklappt,
}: WidgetProps): React.ReactElement | null {
  const { navigate } = useNavigation();
  // Vor jedem Flag-Return (React-Hook-Regel); trägt die Schreibweise der Kürzel.
  const { mode: bearbeiterMode } = useBearbeiterSicht();
  const aktiv = !instanz.eingeklappt;
  // EIN Stichtag je Mount, in die reinen Bausteine injiziert.
  const heuteRef = useRef<string>(new Date().toISOString());

  // Geteilt mit dem Tagesbrief — eine Herleitung, zwei Leser.
  const { zeilen, unbewertet, ohneBedingung, ohneLaufendeFrist, laden } =
    useFristenLage(aktiv, ctx.data.meineAntraege, heuteRef.current);
  // Die Aufgabe aus derselben Kaskade und mit derselben Formel wie „Meine Anträge".
  const aufgaben = useZeilenAufgaben('leerlauf', heuteRef.current);
  const vorgangVon = useMemo(() => {
    const m = new Map<string, AntragVorgang>();
    for (const a of ctx.data.meineAntraege) {
      if (a.verbund_id && !m.has(a.verbund_id)) m.set(a.verbund_id, a);
    }
    return m;
  }, [ctx.data.meineAntraege]);

  const zieltageAn = isVorgangssystemEnabled();
  const meilensteineAn = isMeilensteinMonitoringEnabled();
  if (!zieltageAn && !meilensteineAn) return null;

  const sichtbar = sichtbareZeilen(zeilen, MAX_ZEILEN, MIN_JE_GRUPPE);
  const scope = bearbeiterScopeLabel(bearbeiterMode);

  const anzeigeVon = (verbundId: string): AufgabenAnzeige | null => {
    const v = vorgangVon.get(verbundId);
    if (!v) return null;
    const akten = v.tv_aktenzeichen ?? [v.id];
    return aufgabenAnzeige({
      aufgabe: aufgaben.fuer(akten),
      rueckfall: schrittText(v.status, v.precheck_urteil_label ?? ''),
      laeuftNoch: aufgaben.laeuftNoch,
      vorlaeufig: aufgaben.vorlaeufig,
      ausserhalbLauf: aufgaben.ausserhalb(akten),
      regeln: aufgaben.regeln,
    });
  };

  // Was die Karte NICHT zeigt, sagt sie — sonst liest man eine unvollständige
  // Liste als vollständige.
  const hinweise: string[] = [];
  if (!zieltageAn) hinweise.push('Ohne Stillstands-Wächter — „Jetzt eingreifen" bleibt leer.');
  if (!meilensteineAn) hinweise.push('Ohne Meilenstein-Plan — gerissene Meilensteine werden nicht gezählt.');
  if (ohneLaufendeFrist > 0) {
    hinweise.push(`${ohneLaufendeFrist} ${ohneLaufendeFrist === 1 ? 'Vorgang' : 'Vorgänge'} ohne laufende Frist `
      + `(angehalten oder nicht berechenbar) ${ohneLaufendeFrist === 1 ? 'steht' : 'stehen'} nicht hier.`);
  }
  if (unbewertet > 0) {
    hinweise.push(`${unbewertet} nicht bewertbar — für ihren Status sind keine Zieltage gepflegt.`);
  }
  if (ohneBedingung > 0) {
    hinweise.push(`${ohneBedingung} ${ohneBedingung === 1 ? 'Meilenstein trägt' : 'Meilensteine tragen'}`
      + ` keine Bedingung und ${ohneBedingung === 1 ? 'wird' : 'werden'} nicht bewertet`
      + ' (Modul „Fristen & Meilensteine").');
  }

  return (
    <WidgetShell
      titel="Fristen"
      meta={scope}
      variante={instanz.bereich === 'seite' ? 'seite' : 'haupt'}
      eingeklappt={instanz.eingeklappt}
      onToggleEingeklappt={onToggleEingeklappt}
      instanz={instanz}
      zaehler={
        // **Eingeklappt wird nicht gerechnet** (Lazy-Guard `aktiv`) — dann steht
        // hier ein „—", kein „0" (v4.131): die Null läse sich als „nichts ist zu
        // spät", während schlicht nichts bewertet wurde.
        <span
          className="text-[12px] tabular-nums text-[var(--tf-text-tertiary)]"
          title={!aktiv ? 'Zum Zählen aufklappen — eingeklappt wird nicht bewertet.' : undefined}
        >
          {!aktiv ? '—' : laden ? '…' : zeilen.length > 0 ? bilanzText(zeilen) : '0'}
        </span>
      }
    >
      {laden ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">Bewertet …</p>
      ) : zeilen.length === 0 ? (
        <p className="text-[12px] text-[var(--tf-text-tertiary)]">
          Nichts zum Eingreifen und kein Rückstand.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {GRUPPEN.map(g => {
            const alle = zeilen.filter(z => z.gruppe === g);
            if (alle.length === 0) return null;
            const hier = sichtbar.filter(z => z.gruppe === g);
            const rest = alle.length - hier.length;
            return (
              <div key={g} className="flex flex-col gap-1.5">
                <p className="flex items-center gap-1.5 text-[11.5px]" title={GRUPPE[g].erklaerung}>
                  <span
                    aria-hidden
                    className="inline-block rounded-full"
                    style={{ width: 6, height: 6, background: GRUPPE[g].farbe }}
                  />
                  <span className="font-medium text-[var(--tf-text)]">{GRUPPE[g].titel}</span>
                  <span className="tabular-nums text-[var(--tf-text-tertiary)]">{alle.length}</span>
                </p>
                {hier.map(z => (
                  <LageZeile
                    key={z.verbundId}
                    z={z}
                    anzeige={anzeigeVon(z.verbundId)}
                    onOeffnen={() => navigate('antraege', { selectedId: z.verbundId })}
                  />
                ))}
                {rest > 0 && (
                  <p className="text-[11px] text-[var(--tf-text-tertiary)]">
                    +{rest} {rest === 1 ? 'weiterer Vorgang' : 'weitere Vorgänge'}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {hinweise.length > 0 && (
        <p className="pt-1 text-[11px] text-[var(--tf-text-tertiary)]">{hinweise.join(' ')}</p>
      )}
    </WidgetShell>
  );
}
