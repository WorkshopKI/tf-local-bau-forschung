/**
 * Datenmodell des Gutachten-Workflows A–G. Ein `WorkflowRun` hält pro Verbund
 * (Persistenz-Key = Aktenzeichen) den Stand aller sieben Abschnitte. Jeder
 * Abschnitt ist ein `StepRun` — inhaltlich identisch zum `KurzfassungRecord`
 * (Schritt A), nur OHNE dessen `key` (den besitzt der Run, nicht der Schritt).
 * So generalisiert A sauber, ohne den per-Record-Store wieder einzuführen.
 *
 * Persistenz: ein Objekt im generischen `kv`-Store unter
 * `workflow-run:<typ>:<scopeId>` (Artefakt-Engine; GA = `workflow-run:ga:<az>`,
 * mit Alt-Key-Fallback auf `gutachten-workflow:<az>` — siehe workflow-store.ts) —
 * bewusst KEIN dedizierter Object-Store/Version-Bump (recurring-bug-classes.md §3 /
 * Pitfall #29).
 */
import type { CheckResult, KatalogRef, QuellenBeleg, SkillModifierKey, TeilFeld } from '@/core/services/skills';
import type { ChatResetStatus } from '@/core/services/ai/chat-reset';
import type { BridgeZiel } from '@/core/services/ai/transports/streamlit';
import type { KurzfassungVersion } from '../kurzfassung/types';

/**
 * Schritt-ID eines Gutachten-Workflows. Seit der Kuratierbarkeit (Phase 2) eine
 * offene `string`-Union — die konkreten IDs (`'A'..'G'`, später `'5a'` …) kommen
 * aus der aktiven `WorkflowDef`, nicht mehr aus einer geschlossenen Code-Union.
 * Der Alias bleibt für Lesbarkeit/Intent erhalten. Persistierte `WorkflowRun`s mit
 * `'A'..'G'`-Keys bleiben gültig (reine Typ-Weitung, kein Schema-Bump).
 */
export type StepId = string;

/**
 * Default-Reihenfolge der ZIM-EP-Abschnitte. Seit Phase 2 NICHT mehr autoritativ:
 * die Laufzeit reicht die geordnete Schrittliste der aktiven `WorkflowDef` als
 * Parameter herein; `STEP_ORDER` dient nur noch als abgeleiteter Default (deckungs-
 * gleich mit dem `zim-ep`-Seed, abgesichert per Cross-Layer-Test).
 */
export const STEP_ORDER: readonly StepId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

/** Status eines Abschnitts. `'leer'` = noch nie generiert. */
export type StepStatus = 'leer' | 'entwurf' | 'freigegeben';

/**
 * Ein beratender LLM-QS-Befund zu EINER Dimension (Erdung/Kohärenz/…). Bewusst
 * getrennt von `CheckResult` (mechanische Checks): QS ist qualitativ + beratend,
 * `'unklar'` deckt nicht-parsebare Modell-Ausgabe ab (kein Throw, kein Overwrite).
 */
export interface QsBefund {
  dimension: string;
  bewertung: 'ok' | 'hinweis' | 'unklar';
  /** Konkreter Befund / Belegstelle (1–2 Sätze). */
  text: string;
  /**
   * Betroffene Sätze im bewerteten Text (additiv, opt-in). 0-basiert gegen
   * `splitSentences(finalerText)` — dieselbe Konvention wie `QuellenBeleg.
   * satzIndizes` und `CheckResult.fundstellen`, damit der bestehende Sprung-/
   * Highlight-Pfad trägt. Das Modell nennt sie 1-basiert; der Parser rechnet um
   * und verwirft Unplausibles (kein Throw). Nur bei kriterien-basierter QS.
   */
  satzIndizes?: number[];
}

/**
 * Deterministische Abnahme eines kriterien-basierten QS-Laufs (additiv, opt-in).
 * `bestanden` ⇔ ALLE Befunde `'ok'` — abgeleitet, nicht vom Modell erklärt.
 *
 * Streng BERATEND: beeinflusst nur das Badge am Freigeben-Knopf, nie die
 * Freigabe selbst. Entsteht nur, wenn der Abschnitts-Skill `qsKriterien` führt —
 * die generischen Default-Dimensionen tragen keine Abnahme.
 */
export interface QsAbnahme {
  status: 'bestanden' | 'hinweise';
  /** ISO-Zeitstempel des QS-Laufs. */
  am: string;
  /** `SkillRecord.version` des Abschnitts-Skills zum Zeitpunkt der Abnahme. */
  kriterienVersion: number;
  /**
   * Der Text wurde nach der Abnahme geändert (manuell, Feinschliff,
   * Zurücksetzen) — die Abnahme beschreibt den Stand VOR der letzten Änderung.
   * Bewusst markiert statt gelöscht: „war mal abgenommen, ist aber nicht mehr
   * aktuell" ist die ehrlichere Aussage als „nie geprüft".
   */
  veraltet?: true;
}

/**
 * Persistierter Stand EINES Abschnitts. Inhalts-Felder spiegeln den
 * `KurzfassungRecord` (ohne `key`) — die Migration kopiert A feldweise.
 */
export interface StepRun {
  quellenanalyse: string;
  entwurf: string;
  finalerText: string;
  /**
   * Opt-in (additiv): strukturierte Teilfelder, falls der Skill `teilStruktur`
   * deklariert UND das Modell parsebares JSON lieferte. Render-only (Badges in der
   * UI) — `finalerText` (Teile verbunden) bleibt die flache Quelle der Wahrheit für
   * DOCX/Checks/Judge/Freigabe-Hash. Ein manueller Edit verwirft `teile` (der
   * editierte `finalerText` ist dann maßgeblich).
   */
  teile?: TeilFeld[];
  /**
   * Quellen-Belege mit Satz-Zuordnung (opt-in, Journey-Paket 4). Aus der
   * Quellenanalyse geparst; `satzIndizes` sind 0-basiert gegen `splitSentences(
   * finalerText)`. Bleibt bei manueller Text-Bearbeitung ERHALTEN (anders als
   * `teile`) — veraltete Indizes werden erst beim Rendern auf „ohne Zuordnung"
   * degradiert (Live-Neuberechnung), nicht verworfen. Additiv, Round-Trip-sicher.
   */
  belege?: QuellenBeleg[];
  /**
   * Vom Bearbeiter manuell editierter `finalerText` ersetzt den generierten; dieses
   * Feld hält den ursprünglich GENERIERTEN Text als Snapshot beim ersten Edit
   * (für „Zurücksetzen"). Gesetzt ⇔ der Abschnitt wurde manuell bearbeitet → treibt
   * das „bearbeitet"-Badge. Additiv (alte Records ohne Feld bleiben ladbar); eine
   * Re-Generierung baut einen frischen `StepRun` ohne dieses Feld (Edit verfällt).
   */
  originalText?: string;
  checks: CheckResult[];
  status: StepStatus;
  /** ISO-Zeitstempel der (letzten) Generierung. */
  erstellt_am: string;
  /** ISO-Zeitstempel der Freigabe. */
  freigegeben_am?: string;
  /** Transport-/Provider-Name zum Zeitpunkt der Generierung. */
  modell: string;
  skillId?: string;
  skillVersion?: number;
  vbGekuerzt?: boolean;
  warnung?: string;
  /**
   * Chat-Reset-Status DIESES Laufs — nur gesetzt, wenn der Reset FEHLSCHLUG
   * (`'nicht-gefunden'`/`'timeout'`, Pitfall #36); dann kann der Text durch alten
   * Chat-Verlauf beeinflusst sein → Warn-Banner. Additiv, Round-Trip-sicher.
   */
  chatResetStatus?: ChatResetStatus;
  /** Modifier, der zur AKTUELLEN Fassung führte (für die Verlaufs-Anzeige). */
  modifier?: SkillModifierKey;
  /**
   * Freie Überarbeitungs-Anweisung („Bearbeiten mit KI"), die zur AKTUELLEN Fassung
   * führte — wortgetreu wie eingegeben. Reine Provenienz für die Verlaufs-Anzeige,
   * kein Verhalten: die Anweisung gilt für GENAU einen Lauf und wird nie erneut
   * angewendet. Additiv (Alt-Runs ohne Feld bleiben ladbar); eine Re-Generierung
   * baut einen frischen `StepRun` ohne dieses Feld.
   */
  anweisung?: string;
  /**
   * True, wenn ein Lauf, der den aktuellen Text erzeugte oder veränderte
   * (Generierung ODER Feinschliff), von der agentischen auf die Standard-KI
   * zurückfiel (`ziel-fallback.ts`). Treibt das dezente „Standard-KI
   * (Fallback)"-Badge — `modell` trägt weiterhin den tatsächlich genutzten
   * Transport-Namen. Additiv; eine Re-Generierung baut einen frischen `StepRun`
   * ohne dieses Feld. Der reine QS-Lauf persistiert es NICHT (er ändert den Text
   * nicht).
   */
  zielFallback?: true;
  /**
   * Die interne KI, die den aktuellen Text TATSÄCHLICH erzeugt hat — nach einem
   * Ziel-Fallback also `'standard'`, nicht die globale Präferenz. Bewusst am Lauf
   * festgehalten und nicht zur Anzeigezeit aus dem Store abgeleitet: der Umschalter
   * bewegt sich, der Text nicht. Treibt die Fußzeilen-Angabe „Standard-KI" /
   * „Agentische KI"; `modell` bleibt der Transport-Name (beide Tabs sind derselbe
   * Transport, unterscheiden sich dort also nicht). Additiv — alte Records ohne Feld
   * bleiben ladbar und zeigen die Angabe einfach nicht.
   */
  ziel?: BridgeZiel;
  /**
   * `'mutig'`, wenn dieser Text mit erhöhter Sampling-Temperatur entstanden ist
   * („Zweitfassung mit mutigerer Einstellung", [sampling.ts](../../../core/services/ai/sampling.ts)).
   * Das Gegenstück zu `ziel` bei einer direkt angebundenen KI: dort gibt es keinen
   * zweiten Tab, den man benennen könnte, wohl aber eine zweite Einstellung — und
   * ohne diesen Marker sähen die beiden Fassungen im Verlauf gleich aus. Fehlt das
   * Feld, lief der sichere Standard; alte Records bleiben ladbar.
   */
  fassung?: 'mutig';
  /**
   * True, wenn über der aktuellen Fassung der sprachliche Feinschliff
   * (Lektor-Skill) lief — treibt das Badge an der Karte und den Vergleich gegen
   * die letzte Verlaufs-Fassung (Zahlen-/Längen-Wächter, `lektorat.ts`). Additiv;
   * eine Re-Generierung baut einen frischen `StepRun` ohne dieses Feld.
   */
  lektoriert?: boolean;
  /**
   * True, wenn der automatisch angehängte Feinschliff (Phase 2 der Lauf-Kette)
   * NICHT griff — leeres/verdächtig gekürztes Ergebnis, Transport-Fehler trotz
   * Ziel-Fallback oder Abbruch. Der angezeigte Text ist dann der Rohentwurf, und
   * der Abschnitt sagt das dezent. Bewusst KEIN Fehler: ein Rohentwurf ist ein
   * brauchbares Ergebnis. Ein späterer (manueller) Feinschliff löscht das Feld
   * (`applyLektorat`); eine Re-Generierung baut einen frischen `StepRun`.
   */
  feinschliffUebersprungen?: true;
  /**
   * Regel-ID, deren verletzter Check diesen Korrektur-Lauf ausgelöst hat (Journey-
   * Paket 3, additiv). Nur Anzeige/Nachvollziehbarkeit — kein Verhalten. Fehlt bei
   * regulären Läufen und in Alt-Runs (optional, Round-Trip-sicher).
   */
  korrekturRegelId?: string;
  /** Frühere Fassungen (älteste zuerst), gekappt auf MAX_VERLAUF. */
  verlauf?: KurzfassungVersion[];
  mitTweak?: boolean;
  tweakGeaendertAm?: string;
  /** Reasoning-/Thinking-Text dieses Laufs, falls Thinking aktiv war (aufklappbarer „Denkprozess"). */
  denkprozess?: string;
  /** True, wenn dieser Lauf MIT aktivem Thinking generiert wurde — für den Hinweis, falls kein Denkprozess kam. */
  denkprozessAngefordert?: boolean;
  /**
   * Hash des finalen Textes zum Zeitpunkt DIESER Freigabe. Treibt den dezenten
   * „frühere Abschnitte geändert"-Hinweis nach „Erneut öffnen" — Seam für die
   * präzise Versionierung später. Nur gesetzt, solange `status === 'freigegeben'`.
   */
  freigabeHash?: string;
  /**
   * Beratende LLM-QS-Befunde (additiv, KEIN Schema-Bump). Getrennt von `checks`:
   * der QS-Schritt schreibt sie an den BEWERTETEN Generierungs-Schritt; sie ändern
   * weder Status noch Text (Auto-Overwrite ausgeschlossen).
   */
  qsHinweise?: QsBefund[];
  /**
   * Deterministische Abnahme des letzten kriterien-basierten QS-Laufs (additiv).
   * Nur gesetzt, wenn der Abschnitts-Skill `qsKriterien` führt. Beratend — treibt
   * ausschließlich das Badge am Freigeben-Knopf.
   */
  qsAbnahme?: QsAbnahme;
}

/**
 * Audit-Referenz auf die zuletzt zum Befüllen genutzte Vorlage (Artefakt-Engine,
 * additiv). Beim Erstellen des Artefakts gestempelt — macht reproduzierbar, gegen
 * WELCHE Vorlage (Pfad + Inhalts-Hash) das Dokument erzeugt wurde.
 */
export interface VorlageRef {
  /** Dateiname der Vorlage im Vorlagenverzeichnis. */
  pfad: string;
  /** SHA-256-Hex der gelesenen Vorlagen-Bytes. */
  hash: string;
  /** ISO-Zeitstempel des Lesens/Stempelns. */
  gelesenAm: string;
}

/**
 * Gesamtstand des Gutachtens für einen Verbund. `schritte` ist dünn besetzt:
 * fehlt eine ID, war der Abschnitt nie in Arbeit (UI-Status `'leer'`).
 */
export interface WorkflowRun {
  /** Persistenz-Key (= Aktenzeichen/Verbund-ID). Ein Run pro Verbund. */
  aktenzeichen: string;
  schritte: Partial<Record<StepId, StepRun>>;
  /** Der aktuell als offene Review-Karte präsentierte Abschnitt. */
  aktiverSchritt: StepId;
  erstellt_am: string;
  geaendert_am: string;
  /** Provenance: true, sobald ein Alt-Kurzfassungs-Lauf als A übernommen wurde. */
  ausKurzfassungUebernommen?: boolean;
  /**
   * Audit-Stempel der zuletzt verwendeten Vorlage (additiv; fehlt, solange kein
   * Artefakt erzeugt wurde). Kein Schema-Bump.
   */
  vorlageRef?: VorlageRef;
  /**
   * Audit-Stempel des Textbaustein-Katalogs: mit welchem Stand und welchen
   * Baustein-Fassungen wurde erzeugt (Muster `vorlageRef`). Additiv-optional, kein
   * Schema-Bump — Runs von vor v2.309 bleiben unverändert lesbar. Nur bei
   * baustein-getragenen Artefakten (NF/RNE/ABL) gesetzt, nie beim Gutachten.
   */
  katalogRef?: KatalogRef;
  /**
   * Stabile Keys der offenen Punkte, die dieser Lauf adressiert (Artefakt-Werkbank).
   * Additiv-optional; nur bei über die Werkbank erzeugten Läufen gesetzt. Trägt die
   * Provenienz für die spätere Widerspruchs-Gegenüberstellung (Phase 6).
   */
  werkbankPunkte?: string[];
  schemaVersion: 1;
}
