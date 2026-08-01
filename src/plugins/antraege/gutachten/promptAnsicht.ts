/**
 * Reine Auswertung für die Prompt-Ansicht: welche Blöcke stehen im Prompt, wie
 * groß ist er, und wo sitzt die Vorhabensbeschreibung darin.
 *
 * Hintergrund: `composeSkillPrompt` hängt bis zu neun bedingte Blöcke an das
 * kuratierte Template. Wer nur das Template im Editor sieht, kennt weder den
 * angehängten Vorgaben-Block noch die Anweisungs-Blöcke — und schon gar nicht,
 * dass die VB im Volltext mitgeht und ggf. gekappt wird. Genau diese drei Fragen
 * beantwortet dieses Modul, ohne dass jemand 170.000 Zeichen lesen muss.
 *
 * Kein React, kein IO.
 */
import type { SkillRecord, SkillRunInput, RenderedSkillPrompt } from '@/core/services/skills';
import { buildPromptVorgaben, type QualitaetsRegel } from '@/core/services/skills';
import { schaetzeTokens } from '@/core/services/ai/llm-context';

/** Was tatsächlich an den Transport ging (aus `SkillRunResult.gesendet`). */
export interface GesendeterPrompt {
  system: string;
  user: string;
  /** Die (ggf. gekappte) VB, wie sie im `user`-Text steht — trennt die Anzeige. */
  vb: string;
  vbGekuerzt: boolean;
}

/** Mess-Werte eines bereits gesendeten Prompts (kein `RenderedSkillPrompt` mehr zur Hand). */
export function masseVonGesendet(p: GesendeterPrompt, cap: number): PromptMasse {
  return promptMasse(
    { system: p.system, user: p.user, vb: p.vb, vbGekuerzt: p.vbGekuerzt, maxTokens: 0 },
    cap,
  );
}

/** Ein Baustein des zusammengesetzten Prompts. */
export interface PromptBlock {
  key: string;
  label: string;
  vorhanden: boolean;
  /** Kurze Einordnung — warum steht der Block da (bzw. warum nicht). */
  hinweis: string;
}

/**
 * Die Blöcke in der Reihenfolge, in der `composeSkillPrompt` sie aneinanderhängt.
 * Bewusst auch die ABWESENDEN: „kein persönlicher Stil aktiv" ist beim Suchen
 * nach der Ursache eines schlechten Ergebnisses genauso eine Auskunft.
 */
export function beschreibeBloecke(
  skill: SkillRecord,
  regeln: QualitaetsRegel[],
  input: SkillRunInput,
): PromptBlock[] {
  const hatVorgaben = buildPromptVorgaben(regeln).length > 0;
  return [
    {
      key: 'template',
      label: 'Prompt-Vorlage des Skills',
      vorhanden: true,
      hinweis: 'Der kuratierte Text aus der Skill-Verwaltung, mit eingesetzten Platzhaltern.',
    },
    {
      key: 'stil',
      label: 'Persönliche Stil-Präferenzen',
      vorhanden: !!input.tweak?.aktiv,
      hinweis: 'Ihre eigenen Stil-Hinweise. Sie heben die formalen Vorgaben nicht auf.',
    },
    {
      key: 'vorgaben',
      label: 'Formale Vorgaben',
      vorhanden: hatVorgaben,
      hinweis: 'Automatisch aus den Qualitätsregeln erzeugt und ans Ende gehängt.',
    },
    {
      key: 'teilstruktur',
      label: 'Strukturierte Ausgabe (JSON)',
      vorhanden: !!skill.teilStruktur?.length,
      hinweis: 'Verlangt den finalen Text als JSON-Felder und beansprucht Vorrang vor der Formatangabe der Vorlage.',
    },
    {
      key: 'vortext',
      label: 'Bisheriger finaler Text',
      vorhanden: !!input.vorherigerText,
      hinweis: 'Der vorhandene Abschnitt als Grundlage einer Überarbeitung.',
    },
    {
      key: 'modifier',
      label: 'Zusätzliche Anweisung (Neu/Kürzer/Länger)',
      vorhanden: !!input.modifier,
      hinweis: 'Der Modifier-Text des Skills.',
    },
    {
      key: 'anweisung',
      label: 'Ihre Überarbeitungs-Anweisung',
      vorhanden: !!input.anweisung?.trim(),
      hinweis: 'Gilt für genau diesen Lauf („Bearbeiten mit KI").',
    },
    {
      key: 'zusatz',
      label: 'Regel-gebundene Korrektur-Vorgabe',
      vorhanden: !!input.zusatzAnweisung?.trim(),
      hinweis: 'Entsteht aus einer verletzten Regel beim automatischen Nachbessern.',
    },
    {
      key: 'teil',
      label: 'Teil-Vorgabe',
      vorhanden: !!input.teilAufgabe?.trim(),
      hinweis: 'Zerlegt einen langen Abschnitt in mehrere Läufe und überstimmt Umfang und Struktur.',
    },
    {
      key: 'qs',
      label: 'Abnahme-Kriterien (QS)',
      vorhanden: !!input.qsKriterien?.trim(),
      hinweis: 'Nur im Qualitätssicherungs-Lauf.',
    },
  ];
}

/** Mess-Werte des Prompts — die Antwort auf „ist er zu lang?". */
export interface PromptMasse {
  /** System-Rolle + User-Content. */
  zeichen: number;
  /** Anteil der Vorhabensbeschreibung daran. */
  vbZeichen: number;
  /** Alles außer der VB (Anweisungen, Vorgaben, Stammdaten). */
  anweisungsZeichen: number;
  tokenSchaetzung: number;
  /** Zeichen-Obergrenze des Ziel-Kontextfensters. */
  cap: number;
  /** True, wenn die VB für diesen Lauf gekappt wurde (Schluss fehlt). */
  vbGekuerzt: boolean;
}

export function promptMasse(gerendert: RenderedSkillPrompt, cap: number): PromptMasse {
  const zeichen = gerendert.system.length + gerendert.user.length;
  const vbZeichen = gerendert.vb.length;
  return {
    zeichen,
    vbZeichen,
    anweisungsZeichen: Math.max(0, zeichen - vbZeichen),
    tokenSchaetzung: schaetzeTokens(zeichen),
    cap,
    vbGekuerzt: gerendert.vbGekuerzt,
  };
}

/** Der Prompt, in drei Teile zerlegt: vor der VB, die VB, nach der VB. */
export interface PromptTeile {
  vor: string;
  vb: string;
  nach: string;
}

/**
 * Zerlegt den User-Content an der eingesetzten VB. Die Anzeige klappt den
 * VB-Block sonst nicht ein — und ein `<pre>` mit 170.000 Zeichen macht den Dialog
 * unbenutzbar. Findet die VB nicht statt (leer / anderer Slot), bleibt alles im
 * `vor`-Teil: lieber vollständig als clever.
 */
export function trennePromptAmVb(user: string, vb: string): PromptTeile {
  if (!vb) return { vor: user, vb: '', nach: '' };
  const i = user.indexOf(vb);
  if (i < 0) return { vor: user, vb: '', nach: '' };
  return { vor: user.slice(0, i), vb, nach: user.slice(i + vb.length) };
}
