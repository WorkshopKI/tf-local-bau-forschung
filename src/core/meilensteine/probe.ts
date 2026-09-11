/**
 * Probe am Bestand: was eine Bedingungs-Gruppe oder ein ganzer Meilenstein-
 * Entwurf an echten Verbünden trifft — **während** die PL die Regel baut.
 *
 * Anlass (Rückmeldung der PL, 11.09.2026): „Würde man dann beim Bauen der
 * Meilensteine sehen, welche Auswirkungen diese haben?" Bis dahin zeigte sich
 * eine Regel erst nach Speichern, Freigeben und Neuberechnen — und eine falsch
 * zugeordnete Spalte fiel erst in der Auswertung auf, wenn überhaupt.
 *
 * **Kein zweiter Evaluator, kein zweiter Kontextbauer.** Gruppen zählen über
 * `pruefeBedingung`, Meilensteine über `bewerteVerbund` — damit gelten
 * Eltern-ODER-Regel, `nurTypen` und `ohneBedingung` genau wie in Übersicht und
 * Auswertung. Die Kontexte baut `baueMeilensteinKontext`, der Nenner der
 * Gruppen folgt `giltFuerTyp`.
 *
 * **Offen und abgeschlossen getrennt.** Bei abgeschlossenen Verbünden müsste
 * fast jeder Meilenstein erfüllt sein. Trifft eine Bedingung dort wenig, liest
 * sie vermutlich die falsche Spalte — die Prüfung, die ein „unbestätigt" im
 * Plan nicht leisten kann. „Abgeschlossen" ist der terminale Leit-Status,
 * derselbe Schnitt, mit dem die Projektion ihre offenen Verbünde wählt.
 *
 * **Inaktive Meilensteine bekommen eine eigene Zahl.** Die Bewertung nennt sie
 * `nichtRelevant` — gerade sie baut die PL aber: die unbestätigten Knoten des
 * Auslieferungs-Plans sind inaktiv. Gezählt wird für jeden in einem eigenen
 * Lauf, in dem nur ER aktiv ist. Die übrigen Knoten behalten die Zahl des
 * echten Plans: ein zusätzlich aktivierter Kind-Knoten verschöbe sonst die
 * Eltern-ODER-Regel seiner Eltern, und die Probe widerspräche der Auswertung.
 *
 * Rein: keine IO, keine Uhr (`heute` kommt herein), kein React. Das Laden
 * übernimmt `useMeilensteinProbe`.
 */
import { pruefeBedingung, type Bedingung, type BedingungsKontext } from '@/core/status';
import type { AntragstypBucket } from '@/core/utils/vb-phase-mappings';
import type { MeilensteinPlan } from './typen';
import { baueMeilensteinKontext, type FeldAufloesung } from './felder';
import { bewerteVerbund, giltFuerTyp, type BewertungsEingabe } from './bewertung';

/** Ein Verbund der Probe — nur, was Kontext und Bewertung brauchen. */
export interface ProbeVerbund {
  verbundId: string;
  typ: AntragstypBucket | null;
  antragsdatum: string | null;
  /** Wirksamer Eingang — derselbe Anker wie in der Projektion. */
  anker: string | null;
  /** Terminaler Leit-Status (`isTerminalStatus`), vom Lader bestimmt. */
  abgeschlossen: boolean;
  verbundRecord: Record<string, unknown>;
  antraege: readonly { aktenzeichen: string; record: Record<string, unknown> }[];
}

/** Ein Verbund mit fertigem Auswertungs-Kontext. */
export interface ProbeFall {
  verbund: ProbeVerbund;
  kontext: BedingungsKontext;
}

/** `treffer` von `von` — ohne Nenner ist keine Zahl einzuordnen. */
export interface ProbeTeil {
  treffer: number;
  von: number;
}

export interface ProbeZahlen {
  offen: ProbeTeil;
  abgeschlossen: ProbeTeil;
}

/** Erreicht, aber ohne Ist-Termin — getrennt nach offen und abgeschlossen. */
export interface OhneDatum {
  offen: number;
  abgeschlossen: number;
}

export interface KnotenProbe extends ProbeZahlen {
  /** Im Plan inaktiv — gezählt in einem Lauf, in dem nur dieser Knoten aktiv ist. */
  inaktiv: boolean;
  /**
   * Erreicht, aber OHNE Ist-Termin: die Regel traf nur über eine datumslose
   * Bedingung zu (Status, Kürzel, „VB Kurzname"). Solche Verbünde fehlen still
   * in jeder Abweichung der Auswertung. Gezählt aus demselben Bewertungslauf —
   * exakt, nicht als Differenz zweier Regeln geschätzt.
   */
  ohneDatum: OhneDatum;
}

type LaufZahlen = ProbeZahlen & { ohneDatum: OhneDatum };

const leer = (): ProbeZahlen => ({
  offen: { treffer: 0, von: 0 },
  abgeschlossen: { treffer: 0, von: 0 },
});

const leerLauf = (): LaufZahlen => ({ ...leer(), ohneDatum: { offen: 0, abgeschlossen: 0 } });

/** Was eine Zahl als Befund sagt. */
export type ProbeBefund = 'keiner' | 'alle';

/**
 * Trifft die Bedingung **keinen** oder **jeden** Verbund? Beides ist keine
 * Schwelle, sondern ein Befund: so eine Bedingung unterscheidet nichts. Der
 * Anlass stand im ausgelieferten Plan — „VB Kurzname ist gefüllt" machte MST 4.3
 * bei allen 1 094 offenen Verbünden „erreicht", ein Statuswert in MST 5 traf
 * keinen (gemessen 11.09.2026). Ohne Nenner kein Befund.
 */
export function probeBefund(z: ProbeZahlen | null): ProbeBefund | null {
  if (!z) return null;
  const von = z.offen.von + z.abgeschlossen.von;
  if (von === 0) return null;
  const treffer = z.offen.treffer + z.abgeschlossen.treffer;
  if (treffer === 0) return 'keiner';
  return treffer === von ? 'alle' : null;
}

/** Kontexte je Verbund — neu zu bauen, sobald die Feldmenge sich ändert. */
export function baueProbeFaelle(
  bestand: readonly ProbeVerbund[],
  aufloesung: readonly FeldAufloesung[],
): ProbeFall[] {
  return bestand.map(verbund => ({
    verbund,
    kontext: baueMeilensteinKontext(aufloesung, verbund.verbundRecord, verbund.antraege),
  }));
}

/**
 * Was eine Bedingung (typisch: eine Gruppe) trifft. Der Nenner sind die
 * Verbünde, für die der Meilenstein gilt (`nurTypen`, leer = alle).
 */
export function zaehleBedingung(
  b: Bedingung,
  faelle: readonly ProbeFall[],
  nurTypen: readonly AntragstypBucket[],
  heute: string,
): ProbeZahlen {
  const z = leer();
  for (const f of faelle) {
    if (!giltFuerTyp(nurTypen, f.verbund.typ)) continue;
    const teil = f.verbund.abgeschlossen ? z.abgeschlossen : z.offen;
    teil.von += 1;
    if (pruefeBedingung(b, f.kontext, heute)) teil.treffer += 1;
  }
  return z;
}

function eingabe(f: ProbeFall): BewertungsEingabe {
  const v = f.verbund;
  return {
    verbundId: v.verbundId,
    antragsdatum: v.antragsdatum,
    anker: v.anker,
    typ: v.typ,
    kontext: f.kontext,
    terminal: v.abgeschlossen,
  };
}

/**
 * Ein Bewertungslauf über alle Fälle. Gezählt wird je Knoten, für wie viele
 * Verbünde er gilt (`von`) und bei wie vielen er erreicht ist. `nichtRelevant`
 * (inaktiv oder typ-fremd) und `ohneBedingung` (ein Urteil über den Plan, nicht
 * über den Verbund) zählen in keinen Nenner.
 */
function zaehleLauf(
  plan: MeilensteinPlan,
  faelle: readonly ProbeFall[],
  heute: string,
  nur?: string,
): Map<string, LaufZahlen> {
  const out = new Map<string, LaufZahlen>();
  for (const f of faelle) {
    const r = bewerteVerbund(plan, eingabe(f), heute);
    for (const e of r.ergebnisse) {
      if (nur !== undefined && e.knotenId !== nur) continue;
      if (e.zustand === 'nichtRelevant' || e.zustand === 'ohneBedingung') continue;
      const z = out.get(e.knotenId) ?? leerLauf();
      out.set(e.knotenId, z);
      const teil = f.verbund.abgeschlossen ? z.abgeschlossen : z.offen;
      teil.von += 1;
      if (e.zustand !== 'erreicht') continue;
      teil.treffer += 1;
      if (e.istDatum === null) z.ohneDatum[f.verbund.abgeschlossen ? 'abgeschlossen' : 'offen'] += 1;
    }
  }
  return out;
}

/**
 * Je Knoten: bei wie vielen Verbünden der Meilenstein erreicht ist. Aktive
 * Knoten aus EINEM Lauf über den echten Plan, inaktive aus je einem eigenen
 * Lauf (siehe Modulkopf). Ein Knoten ohne auswertbare Bedingung steht mit 0
 * von 0 da — die Oberfläche sagt dann „ohne Bedingung", nicht „trifft nichts".
 */
export function probeMeilensteine(
  plan: MeilensteinPlan,
  faelle: readonly ProbeFall[],
  heute: string,
): Map<string, KnotenProbe> {
  const out = new Map<string, KnotenProbe>();
  const echt = zaehleLauf(plan, faelle, heute);
  for (const k of plan.knoten) {
    if (k.aktiv) out.set(k.id, { ...(echt.get(k.id) ?? leerLauf()), inaktiv: false });
  }
  for (const k of plan.knoten) {
    if (k.aktiv) continue;
    const nurDieser: MeilensteinPlan = {
      ...plan,
      knoten: plan.knoten.map(x => (x.id === k.id ? { ...x, aktiv: true } : x)),
    };
    const lauf = zaehleLauf(nurDieser, faelle, heute, k.id);
    out.set(k.id, { ...(lauf.get(k.id) ?? leerLauf()), inaktiv: true });
  }
  return out;
}
