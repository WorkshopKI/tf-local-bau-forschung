/**
 * NF-Auswahl/Füll-Skill + NF-WorkflowDef (Artefakt-Engine, Draft).
 *
 * Essenz aus ROLLE/GRUNDREGELN von `Prompt-Nachforderungen-v2.md` — OHNE die
 * Konversations-/Befehls-/Freigabe-Schicht (W/N/E/L, Dokumentenerkennung, „warte
 * auf Eingabe"): die liefert der Workflow-Runner + Modifier-Leiter + Freigabe-
 * Workflow. Kernaufgabe des Skills: erkannte Lücke → passenden Baustein aus dem
 * Katalog wählen → Platzhalter füllen / Alternative wählen — **wortgetreu**.
 *
 * Der Baustein-Katalog wird zur Laufzeit über den `{{nfBausteine}}`-Slot
 * eingespeist (kuratierte App-Daten, `nf-bausteine.seed.ts`), nicht hier im
 * Template dupliziert. `{{tvKontext}}`/`{{verbundKontext}}` tragen die VB-Analyse
 * (dokument-tragend → intern, Pitfall #30). Seed als **Draft** (`aktiv:false`).
 */
import type { SkillModifierKey, SkillRecord, WorkflowDef } from './types';

const SEED_TS = '2026-06-22T00:00:00.000Z';

/** Skill-ID des NF-Auswahl/Füll-Skills. */
export const NF_SKILL_ID = 'nf-auswahl-fuellung';

const NF_SYSTEM_PROMPT =
  'Du bist ein erfahrener Sachbearbeiter für ZIM-Forschungsanträge und erstellst '
  + 'Nachforderungen aus einem kuratierten Textbaustein-Katalog. Du verwendest die '
  + 'Bausteine WORTGETREU und füllst ausschließlich deren Platzhalter bzw. wählst bei '
  + 'Alternativen die zutreffende Variante. Antworte ausschließlich auf Deutsch und '
  + 'halte dich exakt an das vorgegebene Ausgabeformat.';

const NF_PROMPT_TEMPLATE = `Erstelle die **Nachforderungen** zu einem ZIM-Teilvorhaben auf Basis des kuratierten Baustein-Katalogs.

## Stammdaten des Antrags
{{stammdaten}}

## Gesamtvorhaben-Kontext (Verbund)
{{verbundKontext}}

## Teilvorhaben (Quelle der Analyse)
{{tvKontext}}

## Verfügbare Textbausteine (KATALOG — ausschließlich diese verwenden, wortgetreu)
{{nfBausteine}}

## Aufgabe & Kontrakt
1. Analysiere das Teilvorhaben und identifiziere die Lücken/Klärungsbedarfe, zu denen eine Nachforderung nötig ist.
2. Wähle für jede Lücke den passenden Baustein aus dem Katalog (per Baustein-ID). Erfinde keine Bausteine.
3. **Fülle ausschließlich die Platzhalter** des gewählten Bausteins und **wähle bei Alternativen die zutreffende Variante**.

Regeln:
- **Wortgetreu:** Verwende die Baustein-Texte EXAKT wie im Katalog. Formuliere den Rechtstext NIEMALS um, kürze ihn nicht und ergänze keine eigenen Sätze.
- **Platzhalter-Typen:** \`…\`/\`...\` = freie Einsetzung aus dem Antrag; \`{a / b / c}\` = genau EINE Alternative wählen (die übrigen entfernen); \`{…}\` = optionaler Einschub (behalten, wenn zutreffend, sonst ersatzlos streichen); \`x €\`/Zahlen = konkreten Wert aus dem Antrag einsetzen.
- **Streng quellenbasiert:** Nutze ausschließlich Inhalte des Antrags. Erfinde nichts (keine Technologienamen, Zahlen oder Spezifikationen, die nicht im Antrag stehen). Fehlende Angaben kennzeichne wörtlich mit „[Im Antrag nicht genannt]".
- Es bleiben **keine** ungefüllten Platzhalter (\`…\`, \`{…}\`, \`x €\`) im finalen Text.

## Ausgabeformat (genau diese drei Abschnitte, jeweils mit der ###-Überschrift)
### Quellenanalyse
Die erkannten Lücken — je mit kurzem Beleg-Zitat aus dem Antrag und der gewählten Baustein-ID.

### Entwurf
Je Nachforderung: Baustein-ID + der Baustein mit eingesetzten Platzhaltern (Arbeitsstand).

### Finaler Text
Die fertigen Nachforderungen — wortgetreuer Baustein-Text mit gefüllten Platzhaltern, nach Kategorie gruppiert.`;

/** Re-Invocation-Instruktionen für die NF-Generierung. */
const NF_MODIFIERS: Record<SkillModifierKey, string> = {
  neu: 'Wähle die Bausteine erneut — prüfe, ob andere/zusätzliche Bausteine die erkannten Lücken besser '
    + 'abdecken. Gleiche Quellenbasis, gleiche Wortgetreuheit.',
  kuerzer: 'Beschränke dich auf die wesentlichen Nachforderungen — entferne Bausteine zu Nebenaspekten. '
    + 'Die verbleibenden Bausteine bleiben wortgetreu (nicht kürzen).',
  laenger: 'Prüfe das Teilvorhaben systematisch erneut auf weitere Lücken und ergänze passende Bausteine '
    + 'aus dem Katalog. Keine eigenen Formulierungen — nur zusätzliche Katalog-Bausteine.',
};

/** Der NF-Auswahl/Füll-Skill (Draft-Seed; Regeln folgen über die NF-QS in Phase 5). */
export const SEED_NF_SKILL: SkillRecord = {
  id: NF_SKILL_ID,
  name: 'Nachforderungen (Auswahl & Füllung)',
  beschreibung: 'Wählt passende ZIM-Nachforderungs-Bausteine zu erkannten Lücken und füllt deren Platzhalter '
    + 'wortgetreu aus der Antrags-/Teilvorhaben-Analyse.',
  version: 1,
  promptTemplate: NF_PROMPT_TEMPLATE,
  systemPrompt: NF_SYSTEM_PROMPT,
  maxTokens: 3072,
  modifiers: NF_MODIFIERS,
  regelIds: [],
  slots: ['stammdaten', 'verbundKontext', 'tvKontext', 'nfBausteine'],
  geaendert_am: SEED_TS,
};

/**
 * NF-WorkflowDef „zim-nf" — ein Lauf PRO Teilvorhaben (`ebene:'tv'`). Als **Draft**
 * (`aktiv:false`) geseedet: auf dem geteilten Share wäre ein aktiver Workflow
 * sofort teamweit live; NF bleibt bis zur bewussten Kuratierung inaktiv.
 */
export const NF_DEF: WorkflowDef = {
  id: 'zim-nf',
  name: 'ZIM-Nachforderungen',
  version: 1,
  artefaktTyp: 'nf',
  ebene: 'tv',
  aktiv: false,
  steps: [
    {
      id: 'NF', nr: 'NF', kurz: 'NF', label: 'Nachforderungen',
      skillId: NF_SKILL_ID, gateExpr: 'immer', kontextBedarf: 'voll',
    },
  ],
};
