/**
 * Aus Katalog-Fassung + Vorkommen werden Glossar-Zeilen. Rein — keine
 * IndexedDB, kein React.
 *
 * **Nichts wird hier neu erfunden.** Verfahrensschritt, Arbeitsliste, Zieltage
 * und Rollen kommen durchweg aus den vorhandenen Einzelquellen des
 * Status-Moduls; dieses Modul setzt sie nur zu einer Zeile zusammen. Ein zweites
 * Mapping neben `kategorie-ableitung.ts` oder `rollen.ts` liefe bei der ersten
 * Kuration auseinander (Pitfalls #43/#45).
 */
import {
  bedingungFeldRefs, bedingungSatz, istNeutral, kategorieFuerPhase, kategoriePfadLabel,
  phaseFuerCode, regelsatzVon, rollenLabel, rollenVonFeld, sonderKuerzel, todoFeld,
  zahPhaseLabel, zahPhaseRang, zahPhasenVon, zieltageFuer,
  type MappingVersion, type Rolle, type StatusFeldEintrag, type StatusKategorie,
  type TodoRegel, type VorkommenStand, type ZahPhaseId,
} from '@/core/status';
import { getStatusCategoryLabel } from '@/core/utils/status-category-labels';
import type { StatusCategory } from '@/core/utils/status-canonical';

export interface StatuswertZeile {
  code: number;
  /** Amtliche Bezeichnung aus der Fassung. */
  label: string;
  /** `null` = Marker, läuft ohne Verfahrensschritt neben dem Verfahren. */
  phaseId: ZahPhaseId | null;
  phaseLabel: string;
  /** Sortier-Rang der Phase; Marker sinken ans Ende. */
  phaseRang: number;
  kategorie: StatusCategory;
  kategorieLabel: string;
  /** `null` = keine gepflegt ⇒ der Wächter urteilt „nicht prüfbar", nicht „in Ordnung". */
  zieltage: number | null;
  /** `null` = noch nicht gezählt (oder Zählung gescheitert), nicht „null Vorgänge". */
  vorkommen: number | null;
}

export interface KuerzelZeile {
  /** Das Kürzel selbst (`ABB`), NFC-normalisiert. */
  code: string;
  feld: StatusFeldEintrag;
  label: string;
  /** Die Spalte des nächtlichen Exports, in der es steht. */
  csvSpalte: string;
  rollen: readonly Rolle[];
  /** `AB/FB` bzw. `alle` — leer heißt „jeder darf", nie „niemand" (Pitfall #43). */
  rollenText: string;
  neutral: boolean;
  /** Pfad im Ordnerbaum der Fassung; leer, wenn nicht zugeordnet. */
  ordner: string;
  vorkommen: number | null;
}

/**
 * Die Statuswerte der Fassung, EINMAL je Code.
 *
 * Jeder Code steht zweimal in `version.werte` — unter dem TV-Feld und unter dem
 * Verbund-Feld. Ohne Entdopplung stünde im Glossar jeder Statuswert doppelt, und
 * zwar mit derselben Auskunft: die Frage „was heißt 34" gilt dem Code, nicht der
 * Ebene, auf der er gerade steht.
 */
export function statuswertZeilen(
  version: MappingVersion, vorkommen: VorkommenStand | null,
): StatuswertZeile[] {
  const phasen = zahPhasenVon(version.zahPhasen);
  const jeCode = new Map<number, StatuswertZeile>();

  for (const w of version.werte) {
    if (w.code === undefined) continue;
    if (jeCode.has(w.code)) continue;

    // Dreiwertig: gesetzt = kuratiert, `null` = bewusst Marker, `undefined` =
    // noch nicht zugeordnet ⇒ Auslieferungs-Schnitt.
    const phaseId = w.zahPhaseId === undefined ? phaseFuerCode(w.code) : w.zahPhaseId;
    // Abgeleitet, nie `w.kategorie` geglaubt: eine alte Fassung schleppte sonst
    // ihre eigene mit (Pitfall #45).
    const kategorie = kategorieFuerPhase(phaseId, w.code, phasen);

    jeCode.set(w.code, {
      code: w.code,
      label: w.label ?? w.wert,
      phaseId,
      phaseLabel: zahPhaseLabel(phaseId, phasen),
      phaseRang: zahPhaseRang(phaseId, phasen),
      kategorie,
      kategorieLabel: getStatusCategoryLabel(kategorie),
      zieltage: zieltageFuer(version, w.code),
      vorkommen: vorkommen?.proCode.get(w.code) ?? null,
    });
  }

  return [...jeCode.values()].sort((a, b) => a.code - b.code);
}

/**
 * Die Kürzel der Fassung. Nur Felder MIT Kürzel — kanonische Felder wie `status`
 * tragen keines und sind hier nichts, wonach jemand nachschlägt.
 */
export function kuerzelZeilen(
  version: MappingVersion, vorkommen: VorkommenStand | null,
): KuerzelZeile[] {
  const baum = version.kategorien ?? [];
  const zeilen: KuerzelZeile[] = [];

  for (const f of version.felder) {
    if (f.code === undefined || f.code === '') continue;
    const code = f.code.normalize('NFC');
    const rollen = rollenVonFeld(f);
    zeilen.push({
      code,
      feld: f,
      label: f.label,
      csvSpalte: f.quelleKey ?? f.feldId,
      rollen,
      rollenText: rollenLabel(f),
      neutral: istNeutral(f),
      ordner: ordnerPfad(f.kategorieId, baum),
      vorkommen: vorkommen?.proKuerzel.get(code) ?? null,
    });
  }

  return zeilen.sort((a, b) => a.code.localeCompare(b.code, 'de'));
}

/** Der Ordnerpfad eines Feldes; leer, wenn es keinem zugeordnet ist. */
function ordnerPfad(
  kategorieId: string | undefined, baum: readonly StatusKategorie[],
): string {
  if (kategorieId === undefined || baum.length === 0) return '';
  return kategoriePfadLabel(baum, kategorieId);
}

/**
 * Was das Glossar zu einem Kürzel sagen kann, das die Fassung nicht führt.
 *
 * Vier Kürzel stehen in der Trigger-Zuarbeit, aber nicht im Katalog: eines
 * vergibt Rollen, drei sind Testkürzel. Ohne diese Auskunft stünde bei ihnen
 * „nicht im Katalog" — richtig, aber ohne Grund, und der Leser sucht dann einen
 * Fehler, den es nicht gibt.
 */
export function sonderErklaerung(code: string): string | null {
  const s = sonderKuerzel(code);
  return s === null ? null : `${s.label} — ${s.zusatz}`;
}

export interface RegelZeile {
  regel: TodoRegel;
  /** Die Bedingung als Satz — aus dem EINEN Formatierer (Pitfall #41). */
  satz: string;
  /** Welcher Regelsatz sie abarbeitet; fehlend heißt AB. */
  regelsatz: Rolle;
  /** Eine Sperre erzeugt kein To-do, sondern legt Stränge still. */
  sperre: boolean;
}

/** Die To-do-Regeln der Fassung als Glossar-Zeilen. */
export function regelZeilen(version: MappingVersion): RegelZeile[] {
  return (version.todoRegeln ?? []).map(r => ({
    regel: r,
    satz: bedingungSatz(r.bedingung, version),
    regelsatz: regelsatzVon(r),
    sperre: (r.sperrt ?? []).length > 0,
  }));
}

/**
 * Der Rückwärts-Index Kürzel → Regeln: welche To-do-Regeln prüfen dieses Kürzel?
 *
 * Die Übersetzung über `todoFeld()` ist PFLICHT (Pitfall #44): vier Kürzel hängen
 * an kanonischen Feldern (`ABB` → `bewilligung_datum`). Wer stattdessen auf
 * `D_ABB` sucht, bekommt „0 Regeln", obwohl mehrere es prüfen — und merkt nichts
 * davon, weil eine leere Liste wie eine Antwort aussieht.
 *
 * Reine Auflistung. Welches To-do am Ende erscheint, sagt das Glossar
 * ausdrücklich NICHT: das hinge an der ganzen Kaskade samt Sperren und wäre
 * falsch, sobald es interessant wird.
 */
export function regelnZuKuerzel(
  zeilen: readonly RegelZeile[], code: string,
): RegelZeile[] {
  const feldId = todoFeld(code);
  return zeilen.filter(z => bedingungFeldRefs(z.regel.bedingung).includes(feldId));
}

/**
 * Kürzel einer Rollensicht, nach Vorkommen absteigend.
 *
 * Neutrale Kürzel bleiben DRAUSSEN und stehen getrennt daneben: sie unter eine
 * Rolle zu mischen behauptete eine Zuständigkeit, die die Zuarbeit nicht
 * vergibt — sie wegzulassen verschwiege die Hälfte des Alltags.
 */
export function rollenSicht(
  zeilen: readonly KuerzelZeile[], rolle: Rolle | 'alle',
): { eigene: KuerzelZeile[]; neutrale: KuerzelZeile[] } {
  const nachVorkommen = (a: KuerzelZeile, b: KuerzelZeile): number => (
    (b.vorkommen ?? -1) - (a.vorkommen ?? -1) || a.code.localeCompare(b.code, 'de')
  );
  return {
    eigene: zeilen
      .filter(z => !z.neutral && (rolle === 'alle' || z.rollen.includes(rolle)))
      .sort(nachVorkommen),
    neutrale: zeilen.filter(z => z.neutral).sort(nachVorkommen),
  };
}
