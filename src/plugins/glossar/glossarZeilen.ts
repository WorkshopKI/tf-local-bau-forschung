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
  bedingungFeldRefs, bedingungSatz, istNeutral, kategorieFuerCode, kategoriePfadLabel,
  phaseFuerCode, regelsatzVon, rollenLabel, rollenVonFeld, sonderKuerzel, todoFeld,
  KANONISCHE_CODE_FELDER,
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
  /**
   * Die Spalten der überzähligen Katalog-Zeilen desselben Codes — leer im
   * Normalfall.
   *
   * Nicht-leer heißt: die Fassung führt den Code mehrfach, und das ist ein
   * **Fehlstand**, kein zweiter Blickwinkel (Pitfall #44). Das Glossar zeigt
   * trotzdem nur EINEN Eintrag, benennt den Widerspruch aber — verschwiege es
   * ihn, stünde hier eine von zwei Beschriftungen als die Wahrheit.
   */
  verdraengt: readonly string[];
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
    // ihre eigene mit (Pitfall #45). Seit v4.87 hängt sie am Code, nicht an der
    // oben ermittelten Phase — die beschriftet nur noch den Verfahrensschritt.
    const kategorie = kategorieFuerCode(w.code);

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
 * Die Kürzel der Fassung, EINMAL je Code. Nur Felder MIT Kürzel — kanonische
 * Felder wie `status` tragen keines und sind hier nichts, wonach jemand
 * nachschlägt.
 *
 * **Warum entdoppelt wird** (wie schon bei {@link statuswertZeilen}): Wer „VBE"
 * nachschlägt, fragt nach dem Kürzel, nicht nach der Katalog-Zeile, die es
 * gerade trägt. Zwei Einträge gäben zwei Antworten auf eine Frage — und in der
 * Liste zwei Zeilen mit derselben Id.
 *
 * **Welche Zeile gewinnt**: die, die den WERT trägt. Führt eine Fassung einen
 * Code doppelt (kanonisches Feld UND eigenes `D_`-Feld, Pitfall #44), gibt die
 * Kollisionsregel der Feld-Auflösung dem kanonischen Feld den Wert; das
 * `D_`-Feld bleibt für immer leer. Das Glossar folgt genau dieser Regel, statt
 * eine dritte Antwort zu erfinden — und meldet den Fehlstand über
 * `verdraengt`. Bei einer Dublette OHNE kanonische Zeile gewinnt die erste;
 * dann ist keine besser als die andere, und der Hinweis trägt die Auskunft.
 */
export function kuerzelZeilen(
  version: MappingVersion, vorkommen: VorkommenStand | null,
): KuerzelZeile[] {
  const baum = version.kategorien ?? [];
  const jeCode = new Map<string, { zeile: KuerzelZeile; verdraengt: string[] }>();

  for (const f of version.felder) {
    if (f.code === undefined || f.code === '') continue;
    const code = f.code.normalize('NFC');
    const spalte = f.quelleKey ?? f.feldId;
    const kanonisch = KANONISCHE_CODE_FELDER.get(code) === f.feldId;

    const vorhanden = jeCode.get(code);
    if (vorhanden) {
      // Das kanonische Feld verdrängt die überzählige Spalte, sonst bleibt es
      // beim Ersten. So oder so wird die unterlegene Spalte NICHT verschwiegen.
      if (kanonisch) {
        vorhanden.verdraengt.push(vorhanden.zeile.csvSpalte);
        vorhanden.zeile = baueKuerzelZeile(f, code, spalte, baum, vorkommen);
      } else {
        vorhanden.verdraengt.push(spalte);
      }
      continue;
    }
    jeCode.set(code, {
      zeile: baueKuerzelZeile(f, code, spalte, baum, vorkommen),
      verdraengt: [],
    });
  }

  return [...jeCode.values()]
    .map(({ zeile, verdraengt }) => ({ ...zeile, verdraengt }))
    .sort((a, b) => a.code.localeCompare(b.code, 'de'));
}

/** Eine Katalog-Zeile als Kürzel-Zeile — ohne die Dubletten-Frage. */
function baueKuerzelZeile(
  f: StatusFeldEintrag, code: string, csvSpalte: string,
  baum: readonly StatusKategorie[], vorkommen: VorkommenStand | null,
): KuerzelZeile {
  return {
    code,
    feld: f,
    label: f.label,
    csvSpalte,
    rollen: rollenVonFeld(f),
    rollenText: rollenLabel(f),
    neutral: istNeutral(f),
    ordner: ordnerPfad(f.kategorieId, baum),
    vorkommen: vorkommen?.proKuerzel.get(code) ?? null,
    verdraengt: [],
  };
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
