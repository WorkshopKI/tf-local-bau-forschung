/**
 * Den Antragsplan auf die **vorhandenen** Achsen der Antrags-Seite anwenden.
 *
 * Hier entsteht kein Filter, hier wird keiner ausgewertet — der Plan wird in die
 * Slots geschrieben, die `useFilteredAntraege` ohnehin liest. Die Pillen und
 * Chips zeigen danach, was verstanden wurde, und jede einzelne Achse bleibt von
 * Hand korrigierbar. Genau das ist der Grund für diesen Umweg: eine Frage, die
 * ihre eigene Trefferliste aufbaut, ließe sich nur neu stellen, nicht
 * nachjustieren.
 *
 * **Callbacks statt Store-Import**, wie in
 * [phaseQuickfilter.ts](src/plugins/antraege/filter/phaseQuickfilter.ts)
 * (`applyPhase`): dieses Modul bleibt rein und ohne Mocks testbar.
 *
 * ## Setzen heißt ersetzen, nicht abräumen
 *
 * Ein Plan überschreibt die Achsen, die er **nennt**, und lässt alle anderen
 * stehen. Das ist keine Bequemlichkeit, sondern die einzige Lesart, die nicht
 * lügt: räumte eine Frage nach dem Bearbeiter alles ab, verlöre der Nutzer
 * stillschweigend den Statusfilter, den er zwei Klicks vorher gesetzt hat — und
 * die Liste zeigte mehr, als beide Eingaben zusammen erlauben.
 *
 * Wer wirklich bei Null anfangen will, hat dafür „Filter zurücksetzen".
 *
 * ## Was der Bestand nicht hergibt, wird gemeldet
 *
 * Die Jahresauswahl ist ein Spaltenkopf-Filter über **konkrete** Monatswerte
 * (`YYYY-MM`); ein Jahr, zu dem kein Monat im Bestand steht, hat keinen
 * setzbaren Wert. Dasselbe gilt für eine Statuskategorie, die der aktive Katalog
 * nicht kennt. Beides landet in `PlanWirkung.ohneWirkung` und damit in der
 * Deutungszeile — ein still übergangenes „2027" wäre eine Liste, die eine
 * Einschränkung weniger hat als die Frage.
 */
import { getStatusValuesByCategory } from '@/core/utils/status-canonical';
import type { PlanBegriff } from '@/core/services/search/frageplan';
import { KATEGORIE_FILTER_ID } from '../filter/kategorieQuickfilter';
import { STATUS_FILTER_ID } from '../filter/phaseQuickfilter';
import type { PrecheckBucket } from '../filter/precheckQuickfilter';
import type { Projektart } from '../filter/projektartQuickfilter';
import { jahrGruppe } from '../spaltenFilterWerte';
import { VB_PHASE_LABELS } from '@/core/utils/vb-phase-mappings';
import { KATEGORIE_TEXTE } from '@/core/utils/status-category-labels';
import { PROJEKTART_LABELS } from '../filter/projektartQuickfilter';
import type { Antragsplan } from './antragsplan';

/**
 * Der Spaltenkopf, über den „aus dem Jahr X" läuft.
 *
 * Der Antragseingang, nicht die Bewilligung: `jahrVon` im Vorgangs-Board liest
 * dasselbe Feld, und „ein Antrag aus 2025" meint sein Eingangsjahr. Der Schlüssel
 * ist der Spalten-Key aus `tableColumns.tsx`.
 */
export const JAHR_SPALTE = 'antragsdatum';

/** Die Setzer, die eine Anwendung braucht — je einer je Achse. */
export interface PlanAnwendung {
  /** Ein Multi-Select-Filter (`useFilterState.setActiveValue`). */
  setActiveValue: (filterId: string, value: string[]) => void;
  /** Spaltenkopf-Auswahl (`kopfFilter.setzeSpalte`). */
  setzeKopfSpalte: (key: string, werte: Set<string>) => void;
  setProjektart: (art: Projektart) => void;
  setPrecheckBucket: (bucket: PrecheckBucket) => void;
  /** `null` = keine Stillstands-Schwelle. */
  setStillstandTage: (tage: number | null) => void;
  /** Kürzel-Ausschnitt aus der Frage; `null` = zurück zum Profil-Kürzel. */
  setFrageKuerzel: (tokens: string[] | null) => void;
  /** Die Leitbegriffe für die Wortlaut-Stufe; leer = keine Themensuche. */
  setPlanTeile: (teile: readonly PlanBegriff[]) => void;
}

export interface PlanKontext {
  /**
   * Die im Bestand vorkommenden Monatswerte der Antragseingangs-Spalte
   * (`YYYY-MM`), wie `deriveFilterCandidates` sie liefert.
   *
   * Hereingereicht, damit dieses Modul rein bleibt — und weil ein Jahr ohne
   * Monatswerte gemeldet werden muss, statt als leerer Filter zu verpuffen.
   */
  monatsWerte: readonly string[];
}

export interface PlanWirkung {
  /** Was gesetzt wurde, im Klartext — die Deutungszeile liest das. */
  gesetzt: string[];
  /** Was der Plan nannte, was der Bestand aber nicht hergibt. */
  ohneWirkung: string[];
}

/** Die Monatswerte eines Jahres, die es im Bestand wirklich gibt. */
function monateVonJahr(monatsWerte: readonly string[], jahr: string): string[] {
  return monatsWerte.filter(m => jahrGruppe(m) === jahr);
}

/** Aufzählung für die Deutungszeile — „a, b und c", nicht „a,b,c". */
function undListe(teile: readonly string[]): string {
  if (teile.length <= 1) return teile[0] ?? '';
  return `${teile.slice(0, -1).join(', ')} und ${teile[teile.length - 1]}`;
}

/**
 * Schreibt den Plan in die Slots und sagt, was davon gewirkt hat.
 *
 * Ruft je Achse **höchstens einmal** einen Setzer — und nur für Achsen, die der
 * Plan nennt.
 */
export function wendeAntragsplanAn(
  plan: Antragsplan,
  ktx: PlanKontext,
  ziel: PlanAnwendung,
): PlanWirkung {
  const gesetzt: string[] = [];
  const ohneWirkung: string[] = [];

  // ── Status ────────────────────────────────────────────────────────────────
  if (plan.status.length > 0) {
    // Bei JEDEM Aufruf aus dem aktiven Katalog abgeleitet, nie als Modul-
    // Konstante: der kuratierte Katalog wird nach dem Modul-Import gesetzt, und
    // eine beim Import gerechnete Menge rechnete dauerhaft mit dem Code-Seed
    // (die Lehre aus `chipStatusValues`, v2.403).
    const werte = new Set<string>();
    for (const cat of plan.status) for (const v of getStatusValuesByCategory(cat)) werte.add(v);
    const namen = plan.status.map(c => KATEGORIE_TEXTE[c].lang);
    if (werte.size > 0) {
      ziel.setActiveValue(STATUS_FILTER_ID, [...werte]);
      gesetzt.push(`Status ${undListe(namen)}`);
    } else {
      ohneWirkung.push(`Status ${undListe(namen)} — im Katalog steht dazu kein Wert`);
    }
  }

  // ── Fördervariante ────────────────────────────────────────────────────────
  if (plan.vbPhasen.length > 0) {
    ziel.setActiveValue(KATEGORIE_FILTER_ID, plan.vbPhasen.map(String));
    gesetzt.push(`Variante ${undListe(plan.vbPhasen.map(n => VB_PHASE_LABELS[n] ?? String(n)))}`);
  }

  // ── Jahr des Antragseingangs ──────────────────────────────────────────────
  if (plan.jahre.length > 0) {
    const werte = new Set<string>();
    const leer: string[] = [];
    for (const j of plan.jahre) {
      const monate = monateVonJahr(ktx.monatsWerte, j);
      if (monate.length === 0) leer.push(j);
      for (const m of monate) werte.add(m);
    }
    if (werte.size > 0) {
      ziel.setzeKopfSpalte(JAHR_SPALTE, werte);
      const getroffen = plan.jahre.filter(j => !leer.includes(j));
      gesetzt.push(`Antragseingang ${undListe(getroffen)}`);
    }
    if (leer.length > 0) {
      ohneWirkung.push(`Antragseingang ${undListe(leer)} — dazu gibt es keinen Antrag`);
    }
  }

  // ── Projektart ────────────────────────────────────────────────────────────
  if (plan.projektart !== undefined) {
    ziel.setProjektart(plan.projektart);
    gesetzt.push(PROJEKTART_LABELS[plan.projektart]);
  }

  // ── PreCheck ──────────────────────────────────────────────────────────────
  if (plan.precheck !== undefined) {
    ziel.setPrecheckBucket(plan.precheck);
    gesetzt.push(`PreCheck ${plan.precheck}`);
  }

  // ── Bearbeiter ────────────────────────────────────────────────────────────
  if (plan.bearbeiter.length > 0) {
    // Normalisiert an EINER Stelle: `applyBearbeiterFilter` vergleicht
    // großgeschrieben, und Umlaut-Kürzel („THü") müssen vorher durch NFC, sonst
    // trifft derselbe Buchstabe je Herkunft mal und mal nicht (Pitfall #22).
    const tokens = plan.bearbeiter
      .map(t => t.trim().toUpperCase().normalize('NFC'))
      .filter(t => t.length > 0);
    if (tokens.length > 0) {
      ziel.setFrageKuerzel(tokens);
      gesetzt.push(`Bearbeiter ${undListe(tokens)}`);
    }
  }

  // ── Stillstand ────────────────────────────────────────────────────────────
  if (plan.stillstandTage !== undefined) {
    ziel.setStillstandTage(plan.stillstandTage);
    gesetzt.push(`ohne neues Kürzel seit über ${plan.stillstandTage} Tagen`);
  }

  // ── Themen ────────────────────────────────────────────────────────────────
  // Immer gesetzt, auch leer: die Leitbegriffe gehören zu DIESER Frage, und ein
  // stehengebliebenes Bündel der vorigen suchte nach etwas, das niemand mehr
  // gefragt hat.
  ziel.setPlanTeile(plan.leitbegriffe);
  if (plan.leitbegriffe.length > 0) {
    gesetzt.push(`Thema ${undListe(plan.leitbegriffe.map(b => b.begriff))}`);
  }

  return { gesetzt, ohneWirkung };
}
