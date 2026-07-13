/**
 * Teil-weise Generierung langer Gutachten-Abschnitte (unsichtbar für den Nutzer).
 *
 * Hintergrund: Der interne LLM-Server deckelt die AUSGABE hart (Reasoning + langer
 * Fließtext teilen sich ein festes Output-Budget, das die App auf dem Streamlit-Pfad
 * NICHT beeinflussen kann — `maxTokens` ist dort inert). Abschnitt B (Hintergrund +
 * Stand der Technik + Lösungsweg, ≥ 750 Wörter) sprengt das Budget → der finale Text
 * wird mittendrin abgeschnitten. Lösung: B in zwei kürzeren Läufen erzeugen und wieder
 * zu EINEM Abschnitt zusammenführen.
 *
 * Alles hier ist rein/deterministisch (kein LLM, kein IO) und damit unit-testbar; die
 * eigentliche Orchestrierung (N × runSkill + persist) liegt in `useGutachtenWorkflow`.
 *
 * Der Merge ist bewusst simple String-Verkettung: seit dem Deterministik-Rückbau der
 * Belege (v2.241.5) werden Satz↔Quelle-Zuordnungen erst beim RENDERN aus dem flachen
 * `finalerText` + `quellenanalyse` abgeleitet — es gibt keine persistierten Satz-Indizes,
 * die beim Zusammenfügen verschoben werden müssten.
 */
import type { QualitaetsRegel } from '@/core/services/skills';

/** Skill-ID des Abschnitts B (Hintergrund/Stand der Technik/Lösungsweg). */
const AUSGANGSLAGE_SKILL_ID = 'gutachten-ausgangslage';

/** Ein Teil-Abschnitt eines gesplitteten Skills (Reihenfolge = Generierungs-Reihenfolge). */
export interface TeilAbschnitt {
  /** Kurzlabel (nur intern/Log). */
  label: string;
  /** Was in DIESEM Lauf geschrieben wird (Scope + Umfang) — wird ins Prompt gehängt. */
  instruktion: string;
}

/**
 * B in zwei Teilen: (1) Hintergrund + Stand der Technik, (2) Lösungsweg. Die Umfänge
 * spiegeln die Richtwerte des B-Skills (Hintergrund ≥ 150 + SdT ≥ 150 ≈ 300–400;
 * Lösungsweg ≥ 450). Zusammen ≥ 750 Wörter → der gemergte Text erfüllt die B-Regeln.
 */
const B_TEILE: TeilAbschnitt[] = [
  {
    label: 'Hintergrund + Stand der Technik',
    instruktion:
      'ausschließlich (1) den Hintergrund / die Ausgangssituation (Problem, Bedarf, Motivation) '
      + 'UND (2) den Stand der Technik (bestehende Ansätze und ihre Grenzen). Fließtext, mindestens '
      + 'zwei Absätze, Richtwert zusammen ca. 300–400 Wörter. Schreibe den LÖSUNGSWEG NICHT — er '
      + 'wird in einem separaten Lauf ergänzt.',
  },
  {
    label: 'Lösungsweg',
    instruktion:
      'ausschließlich den Lösungsweg (den im Antrag beschriebenen Lösungsansatz in einigen Absätzen — '
      + 'KEINE mehrseitige Detail-Darstellung). Fließtext, mehrere Absätze, Richtwert ca. 450–550 Wörter. '
      + 'Hintergrund und Stand der Technik NICHT wiederholen.',
  },
];

/**
 * Liefert den Teil-Plan für einen Skill oder `null`, wenn der Skill nicht gesplittet
 * wird. Gated auf die Skill-IDENTITÄT (nicht die Workflow-Position), weil die Teil-
 * Instruktionen an B's konkrete Struktur gebunden sind.
 */
export function getTeilPlan(skillId: string): TeilAbschnitt[] | null {
  return skillId === AUSGANGSLAGE_SKILL_ID ? B_TEILE : null;
}

/**
 * Baut die Scoping-Anweisung, die als `teilAufgabe` ans Prompt gehängt wird. Beim
 * ersten Teil ohne Vorlauf; ab dem zweiten Teil wird der bereits generierte Text als
 * Anschluss-Kontext mitgegeben (das Modell soll nahtlos anknüpfen, NICHT wiederholen).
 */
export function teilAufgabe(teil: TeilAbschnitt, vorText: string): string {
  const kopf =
    'Teil-Generierung (WICHTIG): Die Aufgabe oben beschreibt den GESAMTEN Abschnitt, dieser wird '
    + 'aber in mehreren Läufen erstellt. In DIESEM Lauf schreibst du ' + teil.instruktion
    + ' Gib „### Quellenanalyse" und „### Finaler Text" NUR für diesen Teil aus.';
  const rest = vorText.trim();
  if (!rest) return kopf;
  return kopf
    + '\n\nDie vorherigen Teile dieses Abschnitts sind bereits geschrieben. Schließe stilistisch und '
    + 'inhaltlich NAHTLOS daran an und WIEDERHOLE sie NICHT:\n\n' + rest;
}

/**
 * Regeln für einen Teil-PROMPT: die auf den GESAMT-Abschnitt bezogenen Größen-Regeln
 * (Gesamt-Wortzahl, Mindest-Absätze) fallen weg — sie gelten für den gemergten Text und
 * würden den Teil-Lauf sonst fälschlich auf die volle Länge zwingen. Stil-/Verbots-Regeln
 * (keine Aufzählungen, verbotene Floskeln) bleiben. Der FINALE Check läuft mit dem VOLLEN
 * Regelsatz gegen den gemergten Text.
 */
const TEIL_UNTERDRUECKTE_TYPEN = new Set(['wortanzahl', 'absatz_min']);
export function teilRegeln(regeln: QualitaetsRegel[]): QualitaetsRegel[] {
  return regeln.filter(r => !TEIL_UNTERDRUECKTE_TYPEN.has(r.typ));
}

/** Rohergebnis eines Teil-Laufs (nur die für den Merge relevanten Felder). */
export interface TeilErgebnis {
  quellenanalyse: string;
  finalerText: string;
  thinking?: string;
  vbGekuerzt?: boolean;
  warnung?: string;
}

/** Gemergtes Ergebnis aller Teile → fließt 1:1 in die `GenerationInput`. */
export interface MergeErgebnis {
  quellenanalyse: string;
  entwurf: string;
  finalerText: string;
  thinking?: string;
  vbGekuerzt: boolean;
  warnung?: string;
}

/**
 * Fügt die Teil-Läufe zu einem Abschnitt zusammen: `finalerText` per Absatz-Umbruch,
 * `quellenanalyse` per Zeilen-Umbruch (Zitat-Listen), Denkprozesse getrennt gestapelt.
 * `entwurf` bleibt leer (B kennt keinen Entwurf-Block). Leere Teile werden übersprungen.
 */
export function mergeTeile(teile: TeilErgebnis[]): MergeErgebnis {
  const finalerText = teile.map(t => t.finalerText.trim()).filter(Boolean).join('\n\n');
  const quellenanalyse = teile.map(t => t.quellenanalyse.trim()).filter(Boolean).join('\n');
  const thinkingTeile = teile.map(t => t.thinking?.trim()).filter((t): t is string => !!t);
  const warnungen = teile.map(t => t.warnung?.trim()).filter((w): w is string => !!w);
  return {
    quellenanalyse,
    entwurf: '',
    finalerText,
    ...(thinkingTeile.length ? { thinking: thinkingTeile.join('\n\n---\n\n') } : {}),
    vbGekuerzt: teile.some(t => !!t.vbGekuerzt),
    ...(warnungen.length ? { warnung: warnungen.join(' ') } : {}),
  };
}
