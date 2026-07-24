/**
 * Datenmodell des Textbaustein-Katalogs (Artefakt-Engine: NF / RNE / ABL).
 *
 * Bausteine sind **kuratierte App-Daten** wie Skills und Regeln: versioniert,
 * freigebbar, in der App pflegbar. Word ist nur noch Einfuhrquelle, nicht mehr
 * Ablageort; der frühere Code-Seed (`nf-bausteine.seed.ts`) bleibt als
 * Migrationsquelle bestehen.
 *
 * **Verbatim-Regel (Pitfall #34, unantastbar):** `text` ist Rechtstext und wird NIE
 * umformuliert — weder beim Import noch bei der Generierung. Das LLM füllt
 * Platzhalter bzw. wählt bei Alternativen die zutreffende Variante, sonst nichts.
 * Deshalb ist `platzhalter` auch kein Eingabefeld, sondern wird deterministisch aus
 * `text` abgeleitet (`extractPlatzhalter` — es gibt genau diesen einen Parser).
 */
import type { NfPlatzhalter, NfScope } from '../registry/nf-bausteine.seed';

/** Artefakt-Typen, für die es Bausteine gibt (Teilmenge von `ArtefaktTyp`). */
export type BausteinArtefaktTyp = 'nf' | 'rne' | 'abl';

/**
 * Lebenszyklus eines Bausteins. **Gelöscht wird nie** — ein Baustein, der nicht mehr
 * verwendet werden soll, wird `stillgelegt`; er bleibt lesbar, damit alte Artefakte
 * nachvollziehbar bleiben.
 */
export type BausteinStatus = 'entwurf' | 'freigegeben' | 'stillgelegt';

/** Ein Stand des Bausteins in der Historie (newest-first, `historie[0]` ≙ Record). */
export interface TextbausteinSnapshot {
  version: number;
  thema: string;
  kategorie: string;
  text: string;
  aspekte: string[];
  stichworte: string[];
  status: BausteinStatus;
  geaendertAm: string;
  geaendertVon?: string;
  /** Warum dieser Stand entstand — Pflicht bei Freigabe/Stilllegung. */
  begruendung?: string;
}

/** Ein kuratierter Textbaustein. */
export interface TextbausteinRecord {
  /** Stabile ID, z. B. `'G1.1'`, `'RNE-A2'`, `'ABL-C1'`. */
  id: string;
  artefaktTyp: BausteinArtefaktTyp;
  /** Bei `nf` aus dem ID-Präfix (G→verbund, T→tv); bei rne/abl optional. */
  scope?: NfScope;
  thema: string;
  /**
   * Überkategorie („Gesamtvorhaben", „Kosten & Verwertung", …). Geht als Teil der
   * Baustein-Überschrift in den Slot-Input des Skills — ohne sie sähe der Katalog,
   * den das Modell liest, anders aus als bisher.
   */
  kategorie: string;
  /** Prüfaspekt-Tags (A–J, gegen `ASPEKT_IDS` validiert) — treiben den Vorschlag. */
  aspekte: string[];
  stichworte: string[];
  /** Rechtstext WORTGETREU (mit `{Platzhaltern}` / `…` / `x €`). */
  text: string;
  /** Deterministisch aus `text` abgeleitet — nie von Hand gepflegt. */
  platzhalter: NfPlatzhalter[];
  status: BausteinStatus;
  version: number;
  historie: TextbausteinSnapshot[];
  geaendertAm: string;
  geaendertVon?: string;
}

/** Datei-Inhalt der Sidecar `_intern/skills/textbausteine.json`. */
export interface TextbausteinKatalog {
  version: 1;
  updated_at: string;
  bausteine: TextbausteinRecord[];
}

/**
 * Audit-Stempel eines Artefakt-Laufs: mit welchem Katalog-Stand und welchen
 * Baustein-Fassungen wurde erzeugt. Muster `vorlageRef` — additiv-optional am
 * `WorkflowRun`, kein Schema-Bump.
 */
export interface KatalogRef {
  /** `updated_at` des Katalogs zum Zeitpunkt des Laufs. */
  stand: string;
  /** Verwendete Bausteine → ihre Version zum Zeitpunkt des Laufs. */
  bausteinVersionen: Record<string, number>;
}
